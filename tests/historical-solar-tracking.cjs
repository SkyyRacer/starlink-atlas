const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('../static/vendor/cesium/index.cjs'),solar=require('../static/iss-solar-tracking.js'),attitude=require('../static/model-attitude.js');
const manifest=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')),white=JSON.parse(fs.readFileSync('resources/science-model-manifest.json'));
const expected={'mir':10,'skylab':0,'salyut-1':0,'salyut-2':2,'salyut-3':2,'salyut-4':3,'salyut-5':2,'salyut-6':3,'salyut-7':3};
function read(file){const b=fs.readFileSync(file);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));}
for(const [key,count] of Object.entries(expected)){
 const info=manifest.find(m=>m.key===key),g=read('static/'+info.url.split('?')[0]);assert.equal(info.solar_rig.length,count,key);
 if(key.startsWith('salyut')||key==='mir'){
  const w=white.find(m=>m.ids.includes(info.ids[0]));assert.ok(w);assert.equal(w.body_axes,true);assert.ok(read('static/'+w.glb.split('?')[0]).nodes.every(n=>!n.name?.startsWith('Atlas solar hinge ')),'White geometry has no animated nodes');
 }
 if(!count)continue;
 const names=new Set(g.nodes.map(n=>n.name)),writes=new Map(),position=new C.Cartesian3(7e6,0,0),model={modelMatrix:C.Matrix4.fromTranslation(position),getNode(name){assert.ok(names.has(name));return {set matrix(m){writes.set(name,C.Matrix4.clone(m));}};}};
 let tick=0,sun=new C.Cartesian3(.3,-.5,.8),time=C.JulianDate.fromIso8601('1985-07-01T12:00:00Z');C.Cartesian3.normalize(sun,sun);
 const camera={untouched:true},viewer={clock:{currentTime:time},camera,scene:{requestRender(){}}},initial=C.Matrix4.clone(model.modelMatrix),tracker=solar.create(C,viewer,model,info.solar_rig,{now:()=>tick,sunPosition:()=>C.Cartesian3.add(position,C.Cartesian3.multiplyByScalar(sun,1.5e11,new C.Cartesian3()),new C.Cartesian3())});assert.ok(tracker);
 function check(){for(const r of info.solar_rig){
  const b=C.Matrix4.fromArray(r.body_from_joint),axis=C.Cartesian3.normalize(C.Matrix4.getColumn(b,2,new C.Cartesian4()),new C.Cartesian3()),normal=new C.Cartesian3(...r.normal_body),inverse=C.Matrix4.inverse(b,new C.Matrix4());
  const localNormal=C.Matrix4.multiplyByPointAsVector(inverse,normal,new C.Cartesian3()),localSun=C.Matrix4.multiplyByPointAsVector(inverse,sun,new C.Cartesian3());let theta=solar.angleToSun(localNormal,localSun);theta=Math.max(r.minimum_angle,Math.min(r.maximum_angle,theta));
  const local=C.Matrix4.multiply(C.Matrix4.inverse(C.Matrix4.fromArray(r.base_matrix),new C.Matrix4()),writes.get(r.name),new C.Matrix4()),actual=Math.atan2(local[1],local[0]);assert.ok(Math.abs(actual-theta)<1e-4,'Each rigid wing rotates on its one reviewed hinge to the reachable Sun angle');assert.ok(actual>=r.minimum_angle-1e-6&&actual<=r.maximum_angle+1e-6);
  const delta=C.Matrix4.multiply(C.Matrix4.multiply(b,local,new C.Matrix4()),inverse,new C.Matrix4()),pivot=C.Matrix4.getTranslation(b,new C.Cartesian3());assert.ok(C.Cartesian3.distance(pivot,C.Matrix4.multiplyByPoint(delta,pivot,new C.Cartesian3()))<1e-6,'Wing hinge remains attached to the station');
 }
 assert.deepEqual([...writes.keys()].sort(),info.solar_rig.map(r=>r.name).sort());assert.ok(C.Matrix4.equals(initial,model.modelMatrix),'Solar motors never move the whole object');assert.equal(viewer.camera,camera);
 }
 tracker.update();check();sun=new C.Cartesian3(-.7,.6,-.2);C.Cartesian3.normalize(sun,sun);viewer.clock.currentTime=C.JulianDate.addSeconds(time,900,new C.JulianDate());for(let i=0;i<100;i++){tick+=50;tracker.update();}check();
 if(key==='mir')assert.ok(info.solar_rig.every(r=>!r.name.includes('dorsal')&&!r.name.includes('Soyuz')),'Fixed dorsal/visitor arrays are excluded');
}
// Fixed-array stations point the complete detailed body at the Sun. White
// symbols keep their schematic placement and do not acquire solar animation.
const previous=globalThis.AtlasCelestialFrame;let sun=new C.Cartesian3(8e10,1e11,2e10);globalThis.AtlasCelestialFrame={sun:()=>sun};
try{for(const id of [5160,6633])for(const velocity of [undefined,[1,6,2]]){
 const position=new C.Cartesian3(6778000,0,0),p={id,velocity_inertial_fixed_km_s:velocity},viewer={clock:{currentTime:C.JulianDate.now()}},m=attitude.matrix(C,viewer,p,position,'realistic'),fixed=attitude.matrix(C,viewer,p,position,'white'),normal=id===5160?new C.Cartesian3(0,0,-1):new C.Cartesian3(0,-Math.SQRT1_2,Math.SQRT1_2),actual=C.Matrix4.multiplyByPointAsVector(m,normal,new C.Cartesian3()),direction=C.Cartesian3.normalize(C.Cartesian3.subtract(sun,position,new C.Cartesian3()),new C.Cartesian3());assert.ok(C.Cartesian3.dot(actual,direction)>.999999);assert.ok(C.Matrix4.toArray(m).every(Number.isFinite));
 sun=C.Cartesian3.negate(sun,new C.Cartesian3());assert.ok(C.Matrix4.equalsEpsilon(fixed,attitude.matrix(C,viewer,p,position,'white'),1e-12),'Sun changes never animate white symbols');assert.ok(!C.Matrix4.equalsEpsilon(m,attitude.matrix(C,viewer,p,position,'realistic'),1e-6),'Fixed-array stations change body attitude with Sun');
}}finally{globalThis.AtlasCelestialFrame=previous;}
console.log('Historical solar tracking: correct fixed/moving families, one-axis reachable pointing, attached hinges, fixed visitors/dorsal array, Sun-oriented station bodies only in detailed mode, camera untouched OK');
