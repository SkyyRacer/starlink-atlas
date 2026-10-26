const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../static/vendor/cesium/index.cjs'),attitude=require('../static/model-attitude.js');
const point={id:25544,velocity_inertial_fixed_km_s:[0,7.4,2]};
for(const [position,velocity] of [
 [new C.Cartesian3(6778000,0,0),[0,7.4,2]],
 [new C.Cartesian3(0,6778000,0),[-7.4,0,2]],
 [new C.Cartesian3(0,0,6778000),[7.4,2,0]],
]){
 const p={...point,velocity_inertial_fixed_km_s:velocity},before=C.Cartesian3.clone(position);
 const matrix=attitude.matrix(C,{},p,position),rotation=C.Matrix4.getMatrix3(matrix,new C.Matrix3());
 const axis=index=>C.Matrix3.getColumn(rotation,index,new C.Cartesian3()),x=axis(0),y=axis(1),z=axis(2);
 assert.ok(C.Cartesian3.equals(before,position),'Orientation never changes the real position');
 assert.ok(C.Cartesian3.equals(C.Matrix4.getTranslation(matrix,new C.Cartesian3()),position));
 assert.ok(C.Cartesian3.dot(z,C.Cartesian3.normalize(position,new C.Cartesian3()))<-.999999,'Station nadir points to the centre of Earth');
 const v=new C.Cartesian3(...velocity);assert.ok(C.Cartesian3.dot(x,v)>0,'Station forward follows inertial velocity, not geographic east');
 assert.ok(Math.abs(C.Cartesian3.dot(x,z))<1e-12);assert.ok(C.Cartesian3.distance(C.Cartesian3.cross(x,y,new C.Cartesian3()),z)<1e-12,'Right-handed LVLH body frame');
}
for(const invalid of [{id:25544},{id:25544,velocity_inertial_fixed_km_s:[0,0,0]},{id:25544,velocity_inertial_fixed_km_s:[NaN,1,2]},{id:20580,velocity_inertial_fixed_km_s:[0,7,0]}]){
 const position=new C.Cartesian3(6778000,0,0),matrix=attitude.matrix(C,{},invalid,position);
 if(invalid.id===25544){const down=C.Matrix4.multiplyByPointAsVector(matrix,C.Cartesian3.UNIT_Z,new C.Cartesian3());assert.ok(C.Cartesian3.dot(down,C.Cartesian3.UNIT_X)<-.99999,'Old snapshots without velocity still point Cupola towards Earth');assert.match(attitude.describe(invalid),/cap.*indisponible/);}
 else assert.deepEqual(matrix,C.Transforms.eastNorthUpToFixedFrame(position));
 assert.equal(attitude.nominal(invalid),false,'Never claim measured or complete attitude from an unavailable velocity');
}
const context={};vm.runInNewContext(fs.readFileSync('static/motion.js','utf8'),context);const motion=new context.SatelliteMotion();
motion.set([{...point,lat:0,lon:0,altitude_km:400}],0,false);
motion.set([{...point,lat:1,lon:1,altitude_km:400,velocity_inertial_fixed_km_s:[2,5.4,4]}],100,true);
motion.sample(600);assert.ok(Math.abs(motion.get(25544).velocity_inertial_fixed_km_s[0]-1)<1e-12,'Body frame uses the same interpolation as the visible position');
const manifest=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')),iss=manifest.find(row=>row.key==='iss');
const read=file=>{const b=fs.readFileSync(file);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
const source=read(iss.original_file),runtime=read('static/'+iss.url.split('?')[0]);
assert.equal(source.meshes.length,555);assert.equal(runtime.meshes.length,555);assert.equal(runtime.images.length,110);
assert.ok(runtime.images.every(image=>image.mimeType==='image/png'));assert.ok(!runtime.extensionsUsed.includes('EXT_texture_webp'));
assert.equal(iss.compatibility.neutral_vertex_colours.length,45);
assert.equal(runtime.materials.find(m=>m.name==='Node.Cupola').alphaMode,'BLEND','Cupola glazing retains transparency');
for(const name of ['Zarya','Zvezda.SM','Node.MRM1','Node.MRM2'])assert.equal(runtime.materials.find(m=>m.name===name).alphaMode,'MASK','Opaque module cutouts write depth and do not disappear through transparency sorting');
function sceneNodes(doc){const nodes=new Map();function visit(index,parent){const node=doc.nodes[index];const local=node.matrix?C.Matrix4.fromArray(node.matrix):C.Matrix4.fromTranslationQuaternionRotationScale(new C.Cartesian3(...(node.translation||[0,0,0])),new C.Quaternion(...(node.rotation||[0,0,0,1])),new C.Cartesian3(...(node.scale||[1,1,1])),new C.Matrix4());const matrix=C.Matrix4.multiply(parent,local,new C.Matrix4());nodes.set(node.name,{matrix,origin:C.Matrix4.getTranslation(matrix,new C.Cartesian3())});for(const child of node.children||[])visit(child,matrix);}for(const index of doc.scenes[doc.scene||0].nodes)visit(index,C.Matrix4.IDENTITY);return nodes;}
const nodes=sceneNodes(runtime),cupola=C.Cartesian3.normalize(C.Cartesian3.subtract(nodes.get('Cupola').origin,nodes.get('Node3').origin,new C.Cartesian3()),new C.Cartesian3()),forward=C.Cartesian3.normalize(C.Cartesian3.subtract(nodes.get('Node2').origin,nodes.get('Node1').origin,new C.Cartesian3()),new C.Cartesian3());
assert.ok(C.Cartesian3.dot(cupola,C.Cartesian3.UNIT_Z)>.99999,'Actual assembled Cupola is at body nadir, including all source parent transforms');
assert.ok(C.Cartesian3.dot(forward,C.Cartesian3.UNIT_X)>.99999,'Assembled Harmony lies forward of Unity');
// Include Cesium's actual loader correction. Previously the tests stopped at
// modelMatrix, missing the default Y-up/Z-forward conversion applied afterwards.
const layerContext={window:{},document:{currentScript:{src:'http://localhost/detailed-models.js'}},URL,Map,AbortController};
vm.runInNewContext(fs.readFileSync('static/detailed-models.js','utf8'),layerContext);
const axes=layerContext.window.AtlasDetailed.axisOptions(C,iss);
const correction=C.ModelUtility.getAxisCorrectionMatrix(axes.upAxis??C.Axis.Y,axes.forwardAxis??C.Axis.Z,new C.Matrix4());
assert.ok(C.Matrix4.equals(correction,C.Matrix4.IDENTITY),'A calibrated body frame must not receive another glTF axis rotation');
const oldCorrection=C.ModelUtility.getAxisCorrectionMatrix(C.Axis.Y,C.Axis.Z,new C.Matrix4());
for(const position of [new C.Cartesian3(6778000,0,0),new C.Cartesian3(0,6778000,0),new C.Cartesian3(0,0,6778000),C.Cartesian3.fromDegrees(10,48,400000)]){
 const matrix=attitude.matrix(C,{},point,position),rendered=C.Matrix4.multiply(matrix,correction,new C.Matrix4());
 const direction=C.Matrix4.multiplyByPointAsVector(rendered,cupola,new C.Cartesian3()),earth=C.Cartesian3.normalize(C.Cartesian3.negate(position,new C.Cartesian3()),new C.Cartesian3());
 assert.ok(C.Cartesian3.dot(direction,earth)>.99999,'Cupola points towards Earth after the real Cesium axis correction');
 const oldDirection=C.Matrix4.multiplyByPointAsVector(C.Matrix4.multiply(matrix,oldCorrection,new C.Matrix4()),cupola,new C.Cartesian3());
 assert.ok(Math.abs(C.Cartesian3.dot(oldDirection,earth))<.0001,'Regression: the previous loader put Cupola sideways, 90 degrees from Earth');
 const normal=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(nodes.get('Cupola').matrix,new C.Cartesian3(0,-1,0),new C.Cartesian3()),new C.Cartesian3());
 assert.ok(C.Cartesian3.dot(C.Matrix4.multiplyByPointAsVector(rendered,normal,new C.Cartesian3()),earth)>.99999,'The Cupola viewing axis also points to Earth, not just its attachment position');
}
const other=layerContext.window.AtlasDetailed.axisOptions(C,manifest.find(row=>row.key==='hubble'));
assert.equal(other.upAxis,undefined);assert.equal(other.forwardAxis,undefined,'Other models retain the standard glTF axis conversion');
assert.ok(!fs.readFileSync('resources/science-visual.template.js','utf8').includes('AtlasModelAttitude'),'The white layer never uses the flight orientation');
assert.ok(!fs.readFileSync('static/globe.js','utf8').includes('AtlasModelAttitude.matrix'),'White ISS/Tiangong never use the flight orientation');
console.log('ISS: complete NASA IGOAL assembly, original PNG colours, Cupola viewing axis checked through the real Cesium conversion, nominal LVLH, interpolated velocities; unmeasured attitudes remain explicitly unavailable.');
