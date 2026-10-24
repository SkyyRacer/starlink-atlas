const assert=require('node:assert/strict'),real=require('../static/vendor/cesium/index.cjs'),{create,vertex,fragment}=require('../static/point-cloud.js');
let clock=0,uploads=0,allocations=0,destroyedArrays=0;
const glBuffers=[];
const C={...real,Buffer:{createVertexBuffer(options){allocations++;const buffer={values:new Float32Array(options.typedArray),copyFromArrayView(value){uploads++;this.values.set(value);}};glBuffers.push(buffer);return buffer;}},
 VertexArray:class{constructor(options){this.options=options;}destroy(){destroyedArrays++;}},ShaderProgram:{fromCache:options=>({...options,destroy(){}})},RenderState:{fromCache:x=>x}};
const viewer={scene:{requestRender(){}}},layer=create(C,viewer,{now:()=>clock});
const item=layer.add({id:1,color:real.Color.CYAN,pixelSize:3,outlineWidth:0}),start=new real.Cartesian3(-6378137.123,12345678.456,-7654321.789),end=real.Cartesian3.add(start,new real.Cartesian3(7500,-1234,567),new real.Cartesian3());
item.position=start;layer.commit(0,false);const frame=()=>({mode:3,passes:{render:true},context:{},commandList:[]});
let f=frame();layer.update(f);assert.equal(f.commandList.length,1);assert.equal(f.commandList[0].primitiveType,real.PrimitiveType.POINTS);assert.equal(f.commandList[0].count,1);assert.equal(allocations,1);
const data=glBuffers[0].values;
for(let axis=0;axis<3;axis++)assert.ok(Math.abs(data[axis]+data[axis+3]-[start.x,start.y,start.z][axis])<.01,'High/low position retains centimetre precision');
clock=1000;item.position=end;layer.commit(clock,true);layer.update(frame());assert.equal(uploads,1);
clock=1500;const half=item.position;assert.ok(real.Cartesian3.distance(half,real.Cartesian3.lerp(start,end,.5,new real.Cartesian3()))<1e-8);assert.equal(layer.active,true);
for(let i=0;i<60;i++){const next=frame();layer.update(next);assert.equal(next.commandList.length,1);assert.equal(next.commandList[0].uniformMap.u_progress(),.5);}
assert.equal(uploads,1,'No per-point GPU buffer upload during animation');assert.equal(allocations,1,'GPU allocation reused');
item.color=real.Color.RED;layer.commit(clock,true,true);assert.ok(real.Cartesian3.distance(item.position,half)<1e-8,'Color changes preserve displayed position');
clock=2000;assert.ok(real.Cartesian3.equals(item.position,end));assert.equal(layer.active,false);
item.show=false;layer.commit(clock,false);f=frame();layer.update(f);assert.equal(f.commandList.length,0);
item.show=true;layer.commit(clock,false);layer.show=false;f=frame();layer.update(f);assert.equal(f.commandList.length,0,'Moon view hides the full layer');layer.show=true;
f=frame();f.passes.render=false;layer.update(f);assert.equal(f.commandList.length,0,'Picking uses CPU hitboxes, no second GPU cloud draw');
clock=3000;item.position=start;layer.commit(clock,false);assert.ok(real.Cartesian3.equals(item.position,start),'Date changes snap without interpolating across epochs');
// Compile the dependency-expanded shaders through the actual bundled Cesium shader assembler.
for(const [stage,source] of [['Vertex',vertex],['Fragment',fragment]]){const shader=new real.ShaderSource({sources:[source],defines:['LOG_DEPTH']});const result=shader['createCombined'+stage+'Shader']({webgl2:true});assert.ok(result.includes('void main()'));assert.ok(result.includes(stage==='Vertex'?'u_cameraHigh':'gl_FragDepth'));}
assert.equal(layer.recover(new Error('Fragment shader failed to compile')),true);assert.equal(layer.stats.batched,false);assert.equal(layer.recover(new Error('Fragment shader failed to compile')),false);assert.ok(destroyedArrays>0);
layer.suspend();layer.destroy();assert.equal(layer.isDestroyed(),true);
console.log('GPU cloud: batched points, precision, one upload per snapshot, continuous motion, filtering, dates, picking, Cesium shader assembly and fallback OK.');

// Real interplanetary distances: compare the shader's float32 subtraction with
// a camera a few kilometres from the spacecraft, not an Earth-sized fixture.
for(const [name,distance] of [['voyager-1',2.58e13],['voyager-2',2.16e13],['new-horizons',8.9e12],['kepler',1.5e11]]){
 const observer=new real.Cartesian3(distance+1200.125,-distance*.41+3456.25,distance*.17-789.5);
 const target=new real.Cartesian3(distance,-distance*.41,distance*.17);
 const distantLayer=create(C,{camera:{positionWC:observer},scene:{requestRender(){}}},{now:()=>0});
 const distant=distantLayer.add({id:2,color:real.Color.WHITE});distant.position=target;distantLayer.commit(0,false);const snapshot=frame();distantLayer.update(snapshot);
 const packed=glBuffers.at(-1).values,uniforms=snapshot.commandList[0].uniformMap;
 for(const [i,axis] of ['x','y','z'].entries()){
  const delta=Math.fround(Math.fround(packed[i]-uniforms.u_cameraHigh()[axis])+Math.fround(packed[i+3]-uniforms.u_cameraLow()[axis]));
  assert.ok(Math.abs(delta-(target[axis]-observer[axis]))<.15,name+' camera-relative GPU position retains sub-metre precision');
 }
 distantLayer.destroy();
}
console.log('Voyager 1/2, New Horizons and Kepler: real-distance GPU/camera precision OK.');
// During playback the selected point bypasses large float32 displacements.
// A 1,000 km step must not shake a camera only 20 m from the marker.
{
 let t=0;const camera={positionWC:new real.Cartesian3()},moving=create(C,{camera,scene:{requestRender(){}}},{now:()=>t});
 const p=moving.add({id:10,color:real.Color.WHITE,cameraRelative:true});
 p.position=new real.Cartesian3(2.58e13,-1.1e13,6e12);moving.commit(0,false);
 p.position=real.Cartesian3.add(p.position,new real.Cartesian3(1e9,-5e8,2e8),new real.Cartesian3());moving.commit(0,true);
 for(t=0;t<=1000;t+=16){const displayed=moving.samplePosition(p,new real.Cartesian3());camera.positionWC=real.Cartesian3.add(displayed,new real.Cartesian3(20,-30,40),new real.Cartesian3());const snapshot=frame();moving.update(snapshot);const relative=snapshot.commandList[0].uniformMap.u_selectedRelative();assert.deepEqual([relative.x,relative.y,relative.z],[-20,30,-40],'Selected Voyager marker stays fixed relative to its following camera throughout playback');}
 moving.destroy();
}

// Simulate the CPU and GPU phases taking different amounts of time. At Voyager
// distances a 1 ms timing mismatch can move the symbol by thousands of metres.
for(const [mission,distance] of [['Voyager 1',2.58e13],['Voyager 2',2.16e13],['New Horizons',8.9e12]]){
 let t=0;const camera={positionWC:new real.Cartesian3()},moving=create(C,{camera,scene:{requestRender(){}}},{now:()=>t});
 const p=moving.add({id:11,color:real.Color.WHITE,cameraRelative:true});
 p.position=new real.Cartesian3(distance,-distance*.4,distance*.2);moving.commit(0,false);
 p.position=real.Cartesian3.add(p.position,new real.Cartesian3(1e9,-5e8,2e8),new real.Cartesian3());moving.commit(0,true);
 for(const delay of [.1,1,5,16,40]){
  t=500;moving.setFrameTime(t);
  const displayed=moving.samplePosition(p,new real.Cartesian3());camera.positionWC=real.Cartesian3.add(displayed,new real.Cartesian3(20,-30,40),new real.Cartesian3());
  t+=delay;assert.ok(real.Cartesian3.distance(p.position,displayed)>100000,mission+' reproduces the old timing drift before the shared frame clock');const snapshot=frame();moving.update(snapshot);const uniforms=snapshot.commandList[0].uniformMap,relative=uniforms.u_selectedRelative();
  assert.deepEqual([relative.x,relative.y,relative.z],[-20,30,-40],'Render delay cannot move a distant point away from the tracking camera');
  t+=delay;assert.equal(uniforms.u_progress(),.5,'Every depth/frustum pass uses the same frozen interpolation instant');
 }
 moving.destroy();
}
console.log('Distant playback: camera, GPU marker and multiple render passes stay synchronized under variable frame delays.');
