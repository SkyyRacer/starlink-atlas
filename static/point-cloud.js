'use strict';
/* One GPU batch; only two observed endpoints are interpolated, never extrapolated. */
(function(root){
 const STRIDE=16;
 const vertex=`in vec3 positionHigh;
 in vec3 positionLow;
 in vec3 displacement;
 in vec4 color;
 in vec3 shape;
 uniform float u_progress;
 out vec4 v_atlasColor;
 out float v_atlasInner;
 void main(){
  vec4 relative=czm_translateRelativeToEye(positionHigh,positionLow);
  relative.xyz+=displacement*u_progress;
  vec4 eye=czm_modelViewRelativeToEye*relative;
  gl_Position=czm_projection*eye;
  gl_PointSize=clamp(shape.x*czm_pixelRatio,1.0,128.0);
  v_atlasColor=color;
  v_atlasInner=shape.y>0.0?1.0-2.0*shape.y/shape.x:1.0;
  czm_vertexLogDepth();
  // Keep the far side hidden even when globe terrain depth testing is disabled.
  vec3 radii=vec3(6378137.0,6378137.0,6356752.314245);
  vec3 origin=czm_viewerPositionWC/radii;
  vec3 ray=(positionHigh+positionLow+displacement*u_progress)/radii-origin;
  float a=dot(ray,ray);
  float b=dot(origin,ray);
  float discriminant=b*b-a*(dot(origin,origin)-1.0);
  float entry=(-b-sqrt(max(0.0,discriminant)))/max(a,1e-20);
  if(discriminant>0.0&&entry>0.0&&entry<0.999999)gl_Position=vec4(2.0,2.0,2.0,1.0);
 }`;
 const fragment=`in vec4 v_atlasColor;
 in float v_atlasInner;
 void main(){
  float radius=length(gl_PointCoord*2.0-1.0);
  if(radius>1.0)discard;
  float aa=max(fwidth(radius),0.02);
  vec4 tint=v_atlasColor;
  if(v_atlasInner<0.99)tint=mix(tint,vec4(0.663,0.773,0.875,1.0),smoothstep(v_atlasInner-aa,v_atlasInner+aa,radius));
  tint.a*=1.0-smoothstep(1.0-aa,1.0,radius);
  out_FragColor=tint;
  czm_writeLogDepth();
 }`;
 function create(C,viewer,{now=()=>performance.now()}={}){
  const records=[],scratch=new C.Cartesian3();let capacity=0,packed=new Float32Array(0),count=0,dirty=false,started=0,duration=0,command=null,buffer=null,array=null,destroyed=false,fallback=null;
  function fraction(time=now()){return duration?Math.min(1,Math.max(0,(time-started)/duration)):1;}
  function sample(item,result,time=now()){
   const t=fraction(time),a=item.from||item.target,b=item.to||item.target;
   result.x=a.x+(b.x-a.x)*t;result.y=a.y+(b.y-a.y)*t;result.z=a.z+(b.z-a.z)*t;return result;
  }
  function release(){array?.destroy();array=null;buffer=null;command?.shaderProgram.destroy();command=null;}
  const layer={show:true,
   add(options){
    const item={...options,show:options.show!==false,target:null,from:null,to:null};
    Object.defineProperty(item,'position',{get(){return item.from?sample(item,new C.Cartesian3()):item.target;},set(value){item.target=value;}});
    records.push(item);return item;
   },
   commit(time=now(),smooth=false,preserve=false){
    const remaining=Math.max(0,started+duration-time);
    // Rebase every record before changing the shared interpolation clock, including hidden ones.
    for(const item of records)if(item.target){sample(item,scratch,time);item.from=C.Cartesian3.clone(scratch,item.from||new C.Cartesian3());item.to=C.Cartesian3.clone(item.target,item.to||new C.Cartesian3());if(!smooth&&!preserve)C.Cartesian3.clone(item.to,item.from);}
    started=time;duration=preserve?remaining:smooth?1000:0;count=0;
    for(const item of records)if(item.show&&!item.skipGPU&&item.target)count++;
    if(count>capacity){capacity=Math.max(256,2**Math.ceil(Math.log2(count)));packed=new Float32Array(capacity*STRIDE);release();}
    let index=0,radius=0;
    for(const item of records){if(!item.show||item.skipGPU||!item.target)continue;
     const from=item.from,to=item.to,color=item.color;
     const hx=Math.trunc(from.x/65536)*65536,hy=Math.trunc(from.y/65536)*65536,hz=Math.trunc(from.z/65536)*65536;
     packed[index++]=hx;packed[index++]=hy;packed[index++]=hz;
     packed[index++]=from.x-hx;packed[index++]=from.y-hy;packed[index++]=from.z-hz;
     packed[index++]=to.x-from.x;packed[index++]=to.y-from.y;packed[index++]=to.z-from.z;
     packed[index++]=color?.red??1;packed[index++]=color?.green??1;packed[index++]=color?.blue??1;packed[index++]=color?.alpha??1;
     const outline=item.outlineWidth||0;packed[index++]=(item.pixelSize||3)+2*outline;packed[index++]=outline;packed[index++]=item.diameter_m||10;
     radius=Math.max(radius,C.Cartesian3.magnitude(from),C.Cartesian3.magnitude(to));
    }
    layer.radius=radius+100;dirty=true;
   },
   samplePosition(item,result,time=now()){return sample(item,result,time);},
   suspend(){release();dirty=true;},
   get count(){return count;},get active(){return duration>0&&fraction()<1;},
   get stats(){return {points:count,capacity,bytes:packed.byteLength,batched:!fallback};},
   update(frame){
    if(!layer.show||!count||frame.mode!==C.SceneMode.SCENE3D||!frame.passes.render)return;
    if(fallback){
     for(const item of records){if(!item.native)item.native=fallback.add({id:item.id});const point=item.native;point.show=item.show&&!item.skipGPU;if(!point.show)continue;point.position=sample(item,scratch);point.color=item.color;point.pixelSize=item.pixelSize;point.outlineWidth=item.outlineWidth;point.outlineColor=item.outlineColor;point.scaleByDistance=item.scaleByDistance;}
     fallback.update(frame);return;
    }
    if(!command){
     buffer=C.Buffer.createVertexBuffer({context:frame.context,typedArray:packed,usage:C.BufferUsage.DYNAMIC_DRAW});
     array=new C.VertexArray({context:frame.context,attributes:[
      {index:0,vertexBuffer:buffer,componentsPerAttribute:3,componentDatatype:C.ComponentDatatype.FLOAT,offsetInBytes:0,strideInBytes:64},
      {index:1,vertexBuffer:buffer,componentsPerAttribute:3,componentDatatype:C.ComponentDatatype.FLOAT,offsetInBytes:12,strideInBytes:64},
      {index:2,vertexBuffer:buffer,componentsPerAttribute:3,componentDatatype:C.ComponentDatatype.FLOAT,offsetInBytes:24,strideInBytes:64},
      {index:3,vertexBuffer:buffer,componentsPerAttribute:4,componentDatatype:C.ComponentDatatype.FLOAT,offsetInBytes:36,strideInBytes:64},
      {index:4,vertexBuffer:buffer,componentsPerAttribute:3,componentDatatype:C.ComponentDatatype.FLOAT,offsetInBytes:52,strideInBytes:64}]});
     command=new C.DrawCommand({owner:layer,vertexArray:array,primitiveType:C.PrimitiveType.POINTS,modelMatrix:C.Matrix4.IDENTITY,
      shaderProgram:C.ShaderProgram.fromCache({context:frame.context,attributeLocations:{positionHigh:0,positionLow:1,displacement:2,color:3,shape:4},vertexShaderSource:vertex,fragmentShaderSource:fragment}),
      uniformMap:{u_progress:()=>fraction()},renderState:C.RenderState.fromCache({depthTest:{enabled:true},depthMask:false,blending:C.BlendingState.ALPHA_BLEND}),pass:C.Pass.TRANSLUCENT});
     dirty=false;
    }
    if(dirty){buffer.copyFromArrayView(packed.subarray(0,count*STRIDE));dirty=false;}
    command.count=count;if(!command.boundingVolume)command.boundingVolume=new C.BoundingSphere(C.Cartesian3.ZERO,layer.radius);else command.boundingVolume.radius=layer.radius;frame.commandList.push(command);
   },
   recover(error){if(fallback||!/shader|compile|vertex|fragment/i.test(String(error?.message||error)))return false;release();fallback=new C.PointPrimitiveCollection();viewer.scene.requestRender();return true;},
   isDestroyed(){return destroyed;},destroy(){release();fallback?.destroy();destroyed=true;return C.destroyObject(layer);}
  };
  return layer;
 }
 const api={create,vertex,fragment};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasPointCloud=api;
})(typeof window==='undefined'?globalThis:window);
