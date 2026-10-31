const fs=require('node:fs'),assert=require('node:assert/strict');const root=process.cwd(),C=require(root+'/static/vendor/cesium/index.cjs'),solar=require(root+'/static/iss-solar-tracking.js');
const info=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')).find(x=>x.key==='tiangong'),b=fs.readFileSync(info.original_file),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),names=new Map(g.nodes.map(n=>[n.name,n])),overrides=new Map();
assert.equal(info.solar_rig.length,10);assert.equal(info.solar_rig.filter(j=>j.kind==='alpha').length,4);
function scene(){const world=new Map(),seen=new Set();function visit(i,parent){assert.ok(!seen.has(i),'GLB nodes have one parent only');seen.add(i);const n=g.nodes[i],matrix=C.Matrix4.multiply(parent,overrides.get(n.name)||C.Matrix4.fromArray(n.matrix||Array.from(C.Matrix4.IDENTITY)),new C.Matrix4());world.set(n.name,matrix);for(const c of n.children||[])visit(c,matrix);}for(const i of g.scenes[0].nodes)visit(i,C.Matrix4.IDENTITY);return world;}
const before=scene(),position=new C.Cartesian3(7000000,0,0),model={modelMatrix:C.Matrix4.fromTranslation(position),getNode(name){assert.ok(names.has(name));return {set matrix(v){overrides.set(name,C.Matrix4.clone(v));}};}},viewer={clock:{currentTime:C.JulianDate.now()},scene:{requestRender(){}}};let tick=0,sun=new C.Cartesian3(.3,.5,-.8);
const tracker=solar.create(C,viewer,model,info.solar_rig,{now:()=>tick,sunPosition:()=>C.Cartesian3.add(position,C.Cartesian3.multiplyByScalar(sun,1e11,new C.Cartesian3()),new C.Cartesian3())});
for(const dir of [[.3,.5,-.8],[-.6,.2,.7],[1,0,0],[0,1,0],[0,0,-1]]){sun=new C.Cartesian3(...dir);viewer.clock.currentTime=C.JulianDate.addSeconds(viewer.clock.currentTime,1,new C.JulianDate());for(let i=0;i<150;i++){tick+=50;tracker.update();}const world=scene();
for(const j of info.solar_rig.filter(j=>j.kind==='beta'&&j.alpha)){const bind=C.Matrix4.fromArray(j.body_from_joint),delta=C.Matrix4.multiply(world.get(j.name),C.Matrix4.inverse(bind,new C.Matrix4()),new C.Matrix4()),normal=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(delta,new C.Cartesian3(...j.normal_body),new C.Cartesian3()),new C.Cartesian3());assert.ok(C.Cartesian3.dot(normal,C.Cartesian3.normalize(sun,new C.Cartesian3()))>.99999,'Two-axis wings face Sun '+j.name);}
for(const name of ['Tianhe / Large crew cabin','Wentian / Work cabin','Mengtian / Work cabin','Atlas CSS Shenzhou front / Orbital cabin'])assert.ok(C.Matrix4.equals(world.get(name),before.get(name)),'Body, labs, visitors remain fixed');}
console.log('Tiangong: six wings, four two-axis drives, two single-axis drives; Sun pointing, unique GLB hierarchy, fixed station and ships OK');
// The two precursor labs have one drive per wing, not CSS's two-axis mechanism.
for(const key of ['tiangong-1','tiangong-2']){
 const entry=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')).find(x=>x.key===key),raw=fs.readFileSync(entry.original_file),doc=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12))),changes=new Map();assert.equal(entry.solar_rig.length,2);assert.ok(entry.solar_rig.every(j=>j.kind==='beta'&&!j.alpha));
 let stamp=0;const observer={clock:{currentTime:C.JulianDate.now()},scene:{requestRender(){}}},object={modelMatrix:C.Matrix4.IDENTITY,getNode(name){assert.ok(doc.nodes.some(n=>n.name===name));return {set matrix(v){changes.set(name,C.Matrix4.clone(v));}};}};
 const control=solar.create(C,observer,object,entry.solar_rig,{now:()=>stamp,sunPosition:()=>new C.Cartesian3(1e11,2e10,-1e11)});control.update();
 for(const joint of entry.solar_rig){const delta=C.Matrix4.multiply(changes.get(joint.name),C.Matrix4.inverse(C.Matrix4.fromArray(joint.body_from_joint),new C.Matrix4()),new C.Matrix4()),origin=C.Matrix4.multiplyByPoint(delta,new C.Cartesian3(...joint.body_from_joint.slice(12,15)),new C.Cartesian3());assert.ok(C.Cartesian3.distance(origin,new C.Cartesian3(...joint.body_from_joint.slice(12,15)))<1e-8,'Wing hinge stays attached');const n=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(delta,new C.Cartesian3(0,0,-1),new C.Cartesian3()),new C.Cartesian3());assert.ok(C.Cartesian3.dot(n,C.Cartesian3.normalize(new C.Cartesian3(1,0,-1),new C.Cartesian3()))>.99999,'Single-axis points at projected Sun');}
 assert.equal(changes.size,2,'Only the two wings are animated');
}
console.log('Tiangong-1/2: one Sun-pointing axis per complete wing, fixed attachment pivots and stationary capsules OK');
// Full-orbit body motion, stable nadir and heading, including missing/radial velocity.
const attitude=require('../static/model-attitude.js');
for(const id of [37820,41765,48274]){
 let previous;
 for(let i=0;i<=720;i++){
  const a=i*Math.PI/360,inc=(id===48274?41.5:42.8)*Math.PI/180,pos=new C.Cartesian3(6778000*Math.cos(a),6778000*Math.sin(a)*Math.cos(inc),6778000*Math.sin(a)*Math.sin(inc)),velocity=[-7.7*Math.sin(a),7.7*Math.cos(a)*Math.cos(inc),7.7*Math.cos(a)*Math.sin(inc)],m=attitude.matrix(C,{}, {id,velocity_inertial_fixed_km_s:velocity},pos),down=C.Cartesian3.normalize(C.Cartesian3.negate(pos,new C.Cartesian3()),new C.Cartesian3()),x=C.Matrix4.multiplyByPointAsVector(m,C.Cartesian3.UNIT_X,new C.Cartesian3()),z=C.Matrix4.multiplyByPointAsVector(m,C.Cartesian3.UNIT_Z,new C.Cartesian3());
  assert.ok(C.Cartesian3.dot(z,down)>.999999);assert.ok(C.Cartesian3.dot(x,C.Cartesian3.normalize(new C.Cartesian3(...velocity),new C.Cartesian3()))>.999999);assert.ok(C.Cartesian3.equals(C.Matrix4.getTranslation(m,new C.Cartesian3()),pos));
  const q=C.Quaternion.fromRotationMatrix(C.Matrix4.getMatrix3(m,new C.Matrix3()));if(previous)assert.ok(Math.abs(C.Quaternion.dot(q,previous))>.9999,'No abrupt attitude jumps along the orbit');previous=q;
 }
 for(const pos of [new C.Cartesian3(6778000,0,0),new C.Cartesian3(0,0,6778000)])for(const velocity of [undefined,[0,0,0],[NaN,0,0],[1,2],[pos.x,pos.y,pos.z]]){
  const m=attitude.matrix(C,{}, {id,velocity_inertial_fixed_km_s:velocity},pos),down=C.Cartesian3.normalize(C.Cartesian3.negate(pos,new C.Cartesian3()),new C.Cartesian3());assert.ok(C.Matrix4.toArray(m).every(Number.isFinite));assert.ok(C.Cartesian3.dot(C.Matrix4.multiplyByPointAsVector(m,C.Cartesian3.UNIT_Z,new C.Cartesian3()),down)>.999999,'Degenerate heading never flips the station upside down');
 }
}
console.log('Tiangong 1/2/CSS: continuous full-orbit body attitude, flight heading, stable nadir at poles and missing/radial velocity, position preserved OK');
