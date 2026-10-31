'use strict';
/* Shared celestial and terrestrial projection for consistent apparent positions. */
window.AtlasSky={
 create(viewer,C,{solarFlare=true,sunPosition=null,earthPosition=null}={}){
  let enabled=false,texture=null,command=null,pending=null,destroyed=false;
  const credit=new C.Credit('Ciel : NASA SVS · texture satellitemap.space',true);
  const primitive={
   update(frame){
    if(!enabled||!texture||frame.mode!==C.SceneMode.SCENE3D)return;
    if(!command){
     const geometry=new C.Geometry({
      attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array([-1,-1,1,-1,1,1,-1,1])})},
      indices:new Uint16Array([0,1,2,0,2,3]),primitiveType:C.PrimitiveType.TRIANGLES
     });
     const vertexArray=C.VertexArray.fromGeometry({context:frame.context,geometry,attributeLocations:{position:0},bufferUsage:C.BufferUsage.STATIC_DRAW});
     const shaderProgram=C.ShaderProgram.fromCache({context:frame.context,attributeLocations:{position:0},
      vertexShaderSource:'in vec2 position; out vec2 v_clip; void main(){v_clip=position;gl_Position=vec4(position,1.0,1.0);}',
      fragmentShaderSource:`uniform sampler2D u_stars;
       uniform mat3 u_fixedToIcrf;
       uniform vec3 u_sunPosition;
       uniform vec3 u_earthPosition;
       uniform float u_aspect;
       uniform float u_mood;
       uniform float u_solarFlare;
       in vec2 v_clip;
       void main(){
        vec3 ray=normalize((czm_inverseProjection*vec4(v_clip,-1.0,1.0)).xyz);
        vec3 fixedRay=transpose(czm_viewRotation)*ray;
        vec3 celestial=u_fixedToIcrf*fixedRay;
        vec2 uv=vec2(fract(0.5-atan(celestial.y,celestial.x)/czm_twoPi),0.5+asin(clamp(celestial.z,-1.0,1.0))/czm_pi);
        vec3 stars=texture(u_stars,uv).rgb;
        vec3 color=pow(stars,vec3(0.85))*1.25;
        vec3 sunVector=czm_viewRotation*(u_sunPosition-czm_viewerPositionWC);
        vec3 sunDirection=normalize(sunVector);
        float solarRadius=asin(clamp(695700000.0/length(sunVector),0.0,1.0));
        float separation=clamp(dot(ray,sunDirection),-1.0,1.0);
        float angle=atan(length(cross(ray,sunDirection)),separation);
        // Photographic starburst around the actual solar direction.
        vec3 sunRight=normalize(cross(sunDirection,abs(sunDirection.y)<0.95?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0)));
        vec3 sunUp=cross(sunRight,sunDirection);
        vec2 offset=vec2(dot(ray,sunRight),dot(ray,sunUp));
        float azimuth=atan(offset.y,offset.x+1e-8);
        float aa=max(fwidth(angle),0.00015);
        float disk=1.0-smoothstep(solarRadius-aa,solarRadius+aa,angle);
        float bloom=1.65*exp(-angle*angle/0.00018)+0.30*exp(-angle*55.0);
        float mainRays=pow(abs(cos(azimuth*7.0+0.22)),32.0);
        float fineRays=pow(abs(cos(azimuth*11.0-0.40)),72.0);
        float rays=(mainRays*0.52+fineRays*0.10)*exp(-angle*30.0);
        rays*=smoothstep(0.002,0.008,angle)*(1.0-smoothstep(0.09,0.15,angle));
        float outerHalo=0.10*exp(-angle*angle/0.006);
        vec3 rayTint=mix(vec3(1.0,0.93,0.79),vec3(0.60,0.77,1.0),smoothstep(0.015,0.10,angle));
        // Match the Sun's independent sky projection to the globe's projection
        // before testing Earth occultation. Flare vanishes behind the limb.
        vec4 solarClip=czm_projection*vec4(sunDirection,0.0);
        vec2 sunScreen=solarClip.xy/max(0.0001,solarClip.w);
        vec4 cameraRay=czm_inverseProjection*vec4(sunScreen,-1.0,1.0);
        vec3 towardSun=normalize(transpose(czm_viewRotation)*cameraRay.xyz);
        float cameraDistance=max(length(czm_viewerPositionWC-u_earthPosition),6371001.0);
        float earthRadius=asin(clamp(6371000.0/cameraDistance,0.0,1.0));
        float earthSeparation=acos(clamp(dot(towardSun,normalize(u_earthPosition-czm_viewerPositionWC)),-1.0,1.0));
        float visible=smoothstep(-0.006,0.006,earthSeparation-earthRadius);
        visible*=1.0-smoothstep(0.95,1.25,max(abs(sunScreen.x),abs(sunScreen.y)));
        visible*=step(sunDirection.z,-0.0001);
        vec3 solar=vec3(disk*1.8)+vec3(0.92,0.96,1.0)*bloom+rayTint*rays+vec3(0.42,0.61,1.0)*outerHalo;
        vec2 screen=v_clip*vec2(u_aspect,1.0);
        vec2 lightScreen=sunScreen*vec2(u_aspect,1.0);
        float ghostA=length(screen+lightScreen*0.30);
        float ghostB=length(screen+lightScreen*0.65);
        float ghostC=length(screen-lightScreen*0.50);
        vec3 flare=vec3(0.20,0.42,0.65)*0.19*exp(-pow(ghostA/0.055,2.0));
        flare+=vec3(0.58,0.31,0.16)*0.11*exp(-pow((ghostB-0.075)/0.018,2.0));
        flare+=vec3(0.20,0.55,0.42)*0.085*exp(-pow(ghostC/0.028,2.0));
        vec3 warmTint=mix(vec3(1.0),vec3(1.07,0.92,0.78),u_mood);
        color=mix(color,color*vec3(0.82,0.85,0.93),u_mood);
        // Low, warm scattered light stays local to the Sun and fades at eclipse.
        vec3 haze=vec3(0.025,0.013,0.006)*exp(-angle*3.5)*u_mood;
        color+=((solar+flare)*warmTint+haze)*visible*u_solarFlare;
        out_FragColor=vec4(color,1.0);
       }`});
     command=new C.DrawCommand({vertexArray,shaderProgram,uniformMap:{u_solarFlare:()=>typeof solarFlare==='function'?Math.max(0,Math.min(1,solarFlare())):solarFlare?1:0,u_fixedToIcrf:()=>window.AtlasCelestialFrame.fixedToIcrf(C,viewer.clock.currentTime),u_sunPosition:()=>sunPosition?sunPosition():window.AtlasCelestialFrame.sun(C,viewer.clock.currentTime),u_earthPosition:()=>earthPosition?earthPosition():{x:0,y:0,z:0},u_mood:()=>document.getElementById('earth-realistic-toggle')?.getAttribute('aria-checked')==='true'?1:0,u_stars:()=>texture,u_aspect:()=>viewer.canvas.clientWidth/Math.max(1,viewer.canvas.clientHeight)},renderState:C.RenderState.fromCache({depthTest:{enabled:false},depthMask:false}),pass:C.Pass.ENVIRONMENT,owner:primitive});
    }
    return command;
   },
   isDestroyed(){return destroyed;},
   destroy(){destroyed=true;texture?.destroy();command?.vertexArray.destroy();command?.shaderProgram.destroy();}
  };
  viewer.scene.skyBox=primitive;
  async function setEnabled(value){
   enabled=value;
   if(enabled&&!texture){
    pending??=C.Resource.fetchImage({url:'/images/sky/reference-starmap-8k.jpg'}).then(image=>{
     if(destroyed)return;
     const gl=viewer.scene.context?._gl,limit=gl?gl.getParameter(gl.MAX_TEXTURE_SIZE):8192;if(image.width>limit||image.height>limit){const resized=document.createElement('canvas'),ratio=limit/Math.max(image.width,image.height);resized.width=Math.max(1,Math.round(image.width*ratio));resized.height=Math.max(1,Math.round(image.height*ratio));resized.getContext('2d').drawImage(image,0,0,resized.width,resized.height);image=resized;}
     texture=new C.Texture({context:viewer.scene.context,source:image,flipY:true,sampler:new C.Sampler({minificationFilter:C.TextureMinificationFilter.LINEAR,magnificationFilter:C.TextureMagnificationFilter.LINEAR})});
    }).catch(error=>{pending=null;throw error;});
    await pending;
   }
   if(enabled)viewer.creditDisplay.addStaticCredit(credit);else viewer.creditDisplay.removeStaticCredit(credit);
   viewer.scene.requestRender();
  }
  return {setEnabled};
 }
};
