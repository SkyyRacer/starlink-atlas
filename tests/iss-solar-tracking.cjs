const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('../static/vendor/cesium/index.cjs');
const solar=require('../static/iss-solar-tracking.js'),attitude=require('../static/model-attitude.js');
const info=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')).find(row=>row.key==='iss');
const bytes=fs.readFileSync('static/'+info.url.split('?')[0]),g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const local=node=>node.matrix?C.Matrix4.fromArray(node.matrix):C.Matrix4.fromTranslationQuaternionRotationScale(new C.Cartesian3(...(node.translation||[0,0,0])),new C.Quaternion(...(node.rotation||[0,0,0,1])),new C.Cartesian3(...(node.scale||[1,1,1])),new C.Matrix4());
const overrides=new Map(),touched=new Set(),names=new Map(g.nodes.map(node=>[node.name,node]));let writes=0;
function scene(){const world=new Map();function visit(index,parent){const node=g.nodes[index],matrix=C.Matrix4.multiply(parent,overrides.get(node.name)||local(node),new C.Matrix4());world.set(node.name,matrix);for(const child of node.children||[])visit(child,matrix);}for(const index of g.scenes[g.scene||0].nodes)visit(index,C.Matrix4.IDENTITY);return world;}
const baseline=scene(),position=C.Cartesian3.fromDegrees(12,48,420000),point={id:25544,velocity_inertial_fixed_km_s:[-4,5,3]};
const model={modelMatrix:attitude.matrix(C,{},point,position),getNode(name){assert.ok(names.has(name));return {set matrix(value){overrides.set(name,C.Matrix4.clone(value));touched.add(name);writes++;}};}};
let tick=0,renders=0,calls=0,sunDirection=new C.Cartesian3(0,.7,-.7);
const viewer={clock:{currentTime:C.JulianDate.fromIso8601('2026-10-25T12:00:00Z')},camera:{unchanged:true},scene:{requestRender(){renders++;}}};
const stationBefore=C.Matrix4.clone(model.modelMatrix),cameraBefore=JSON.stringify(viewer.camera);
const provider=()=>{calls++;const direction=C.Matrix4.multiplyByPointAsVector(model.modelMatrix,sunDirection,new C.Cartesian3());return C.Cartesian3.add(position,C.Cartesian3.multiplyByScalar(direction,1.5e11,new C.Cartesian3()),new C.Cartesian3());};
const tracker=solar.create(C,viewer,model,info.solar_rig,{now:()=>tick,sunPosition:provider});assert.ok(tracker);
function advance(){viewer.clock.currentTime=C.JulianDate.addSeconds(viewer.clock.currentTime,1,new C.JulianDate());}
function settle(){for(let i=0;i<100;i++){tick+=50;tracker.update();}}
function check(){
 const current=scene(),sun=C.Cartesian3.normalize(sunDirection,new C.Cartesian3());
 for(const descriptor of info.compatibility.solar_alignment){
  const m=current.get(descriptor.plane_node),normal=C.Cartesian3.normalize(C.Matrix4.getColumn(m,descriptor.normal_axis,new C.Cartesian4()),new C.Cartesian3());
  const rig=info.solar_rig.find(row=>row.name===descriptor.joint),axis=C.Cartesian3.normalize(C.Matrix4.getColumn(C.Matrix4.fromArray(rig.body_from_joint),2,new C.Cartesian4()),new C.Cartesian3());
  assert.ok(C.Cartesian3.dot(normal,sun)>.99999,'Combined alpha and beta point every wing fully at the Sun, including directions previously unreachable with beta alone');
  const alpha=info.solar_rig.find(row=>row.name===rig.alpha);
  const origin=matrix=>C.Matrix4.getTranslation(matrix,new C.Cartesian3());
  assert.ok(Math.abs(C.Cartesian3.distance(origin(current.get(descriptor.joint)),origin(current.get(alpha.name)))-C.Cartesian3.distance(origin(baseline.get(descriptor.joint)),origin(baseline.get(alpha.name))))<1e-5,'Beta pivots remain attached to the rotating outboard truss');
 }
 for(const name of ['Cupola','Node1','Node2','Node3','USLab','Truss_P1','Truss_S1'])assert.ok(C.Matrix4.equals(current.get(name),baseline.get(name)),'Central station, Cupola and inboard truss nodes do not move');
 assert.ok(C.Matrix4.equals(model.modelMatrix,stationBefore));assert.equal(JSON.stringify(viewer.camera),cameraBefore,'Solar tracking never changes the camera');
}
tracker.update();check();assert.equal(touched.size,10);assert.deepEqual([...touched].sort(),info.solar_rig.map(row=>row.name).sort());
for(const direction of [new C.Cartesian3(.5,-.2,-.8),new C.Cartesian3(-.3,.8,.4),new C.Cartesian3(0,-1,0)]){
 sunDirection=direction;advance();const before=C.Matrix4.clone(overrides.get(info.solar_rig[0].name));tracker.update();assert.ok(C.Matrix4.equals(before,overrides.get(info.solar_rig[0].name)),'A date change schedules a smooth movement rather than teleporting panels');
 settle();check();
}
assert.ok(renders>0,'Only unsettled panel motion requests animation frames');
// Full carrier revolution: vertical 90-degree and flat configurations must
// both be reachable through real SARJ pivots, without rotating the ISS body.
for(let i=0;i<=16;i++){
 const theta=i*Math.PI/8;sunDirection=new C.Cartesian3(Math.sin(theta),0,-Math.cos(theta));advance();tracker.update();settle();check();
 if(i===4){const current=scene(),mast=C.Cartesian3.normalize(C.Matrix4.getColumn(current.get('PORT_BETA_ROT_2A'),2,new C.Cartesian4()),new C.Cartesian3());assert.ok(Math.abs(C.Cartesian3.dot(mast,C.Cartesian3.UNIT_Z))>.99999,'A 90-degree carrier configuration raises the solar masts relative to the central station');assert.ok(!C.Matrix4.equalsEpsilon(current.get('Truss_P4'),baseline.get('Truss_P4'),1e-5),'Outboard support follows the actual alpha joint rather than letting panels float');}
}
for(const alpha of info.solar_rig.filter(row=>row.kind==='alpha')){const actual=C.Matrix4.getTranslation(scene().get(alpha.name),new C.Cartesian3()),expected=C.Matrix4.getTranslation(baseline.get(alpha.name),new C.Cartesian3());assert.ok(C.Cartesian3.distance(actual,expected)<1e-7,'SARJ pivot never detaches from the inboard truss');}
const pausedWrites=writes,pausedRenders=renders,pausedCalls=calls;settle();assert.equal(writes,pausedWrites);assert.equal(renders,pausedRenders);assert.equal(calls,pausedCalls,'Paused time performs no repeated Sun computation and no continued animation');
const n=new C.Cartesian3(1,0,0);assert.equal(solar.angleToSun(n,C.Cartesian3.UNIT_Z,1.2),1.2,'No undefined spin when Sun is exactly along the hinge');
assert.ok(Math.abs(solar.wrap((-179-179)*Math.PI/180)-2*Math.PI/180)<1e-12,'Crossing 180 degrees takes the short path');
// Real astronomical direction at distinct chronological dates, with no network.
const celestial=require('../static/celestial-frame.js');
const fixedSun=(engine,time)=>C.Matrix3.multiplyByVector(celestial.fallback(C.JulianDate.toDate(time).getTime(),C),C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time),new C.Cartesian3());
const astronomical=solar.create(C,viewer,model,info.solar_rig,{now:()=>tick,sunPosition:fixedSun});astronomical.update();const first=C.Matrix4.clone(overrides.get(info.solar_rig[0].name));
viewer.clock.currentTime=C.JulianDate.addDays(viewer.clock.currentTime,40,new C.JulianDate());
for(let i=0;i<100;i++){tick+=50;astronomical.update();}
assert.ok(!C.Matrix4.equalsEpsilon(first,overrides.get(info.solar_rig[0].name),1e-5),'Chronology drives the true computed Sun direction rather than a decorative oscillation');
assert.ok(C.Matrix4.equals(model.modelMatrix,stationBefore));
console.log('ISS solar tracking: two alpha + eight beta pivots, full Sun incidence and 90/360-degree carrier motion, real Sun/date response, smooth movement, stable central modules/Cupola/camera, no paused-time loop and mirrored-source correctness OK.');
