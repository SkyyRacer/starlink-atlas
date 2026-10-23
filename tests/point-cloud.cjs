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
for(const [stage,source] of [['Vertex',vertex],['Fragment',fragment]]){const shader=new real.ShaderSource({sources:[source],defines:['LOG_DEPTH']});const result=shader['createCombined'+stage+'Shader']({webgl2:true});assert.ok(result.includes('void main()'));assert.ok(result.includes(stage==='Vertex'?'czm_translateRelativeToEye':'gl_FragDepth'));}
assert.equal(layer.recover(new Error('Fragment shader failed to compile')),true);assert.equal(layer.stats.batched,false);assert.equal(layer.recover(new Error('Fragment shader failed to compile')),false);assert.ok(destroyedArrays>0);
layer.suspend();layer.destroy();assert.equal(layer.isDestroyed(),true);
console.log('GPU cloud: batched points, precision, one upload per snapshot, continuous motion, filtering, dates, picking, Cesium shader assembly and fallback OK.');


