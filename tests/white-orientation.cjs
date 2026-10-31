const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('../static/vendor/cesium/index.cjs'),attitude=require('../static/model-attitude.js');
const files=new Map([[25544,'static/images/iss.glb'],[48274,'static/images/tiangong.glb'],[37820,'static/images/science/tiangong-1.glb'],[41765,'static/images/science/tiangong-2.glb']]);
for(const [id,file] of files){
 const raw=fs.readFileSync(file),g=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));assert.ok(!g.nodes[0].rotation,'Calibrated white root has no legacy fixed tilt');
 const loader=C.ModelUtility.getAxisCorrectionMatrix(C.Axis.Z,C.Axis.X,new C.Matrix4());assert.ok(C.Matrix4.equals(loader,C.Matrix4.IDENTITY));
 for(const xyz of [C.Cartesian3.fromDegrees(0,0,400000),C.Cartesian3.fromDegrees(120,-40,350000),C.Cartesian3.fromDegrees(-75,89.9,410000)])for(const velocity of [undefined,[1,7,2],[-5,2,3]]){
  const p={id,velocity_inertial_fixed_km_s:velocity},white=attitude.matrix(C,{},p,xyz,'white'),real=attitude.matrix(C,{},p,xyz,'realistic'),rendered=C.Matrix4.multiply(white,loader,new C.Matrix4()),nadir=id!==25544&&!velocity?C.Cartesian3.negate(C.Ellipsoid.WGS84.geodeticSurfaceNormal(xyz,new C.Cartesian3()),new C.Cartesian3()):C.Cartesian3.normalize(C.Cartesian3.negate(xyz,new C.Cartesian3()),new C.Cartesian3()),actual=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(rendered,C.Cartesian3.UNIT_Z,new C.Cartesian3()),new C.Cartesian3());
  assert.ok(C.Cartesian3.dot(actual,nadir)>.99999999,'Body nadir faces Earth in white mode: '+id);assert.ok(C.Matrix4.equalsEpsilon(white,real,1e-10),'White/detailed transition preserves the station body frame');assert.ok(C.Cartesian3.distance(C.Matrix4.getTranslation(rendered,new C.Cartesian3()),xyz)<1e-7,'Orientation never moves the orbit position');assert.ok(Math.abs(C.Matrix3.determinant(C.Matrix4.getMatrix3(rendered,new C.Matrix3()))-1)<1e-10,'No mirrored body frame');
 }
}
console.log('ISS and three Tiangong white orientations: actual loader correction, Earth-facing nadir, matching detailed body frames, finite near poles, missing velocity fallback, unchanged position and no reflection OK');
