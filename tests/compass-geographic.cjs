const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('../static/vendor/cesium/index.cjs');
const context={window:{}};vm.runInNewContext(fs.readFileSync('static/globe.js','utf8'),context);const globe=context.window.AtlasGlobe;
for(const [lon,lat] of [[0,0],[125,51.6],[-75,-30],[179.9,51.6],[-179.9,-51.6]]){
 const point=C.Cartesian3.fromDegrees(lon,lat,420000),enu=C.Transforms.eastNorthUpToFixedFrame(point);
 const axis=index=>C.Cartesian3.normalize(C.Matrix4.getColumn(enu,index,new C.Cartesian4()),new C.Cartesian3()),east=axis(0),north=axis(1),zenith=axis(2);
 for(const below of [false,true]){
  const camera={right:C.Cartesian3.multiplyByScalar(east,below?-1:1,new C.Cartesian3()),up:C.Cartesian3.clone(north),direction:C.Cartesian3.multiplyByScalar(zenith,below?1:-1,new C.Cartesian3()),look:C.Camera.prototype.look};
  const cardinal=globe.cardinalAngles(north,east,camera.right,camera.up);
  assert.ok(Math.abs(cardinal.north)<1e-12);assert.ok(Math.abs(Math.abs(cardinal.south)-Math.PI)<1e-12);
  assert.ok(Math.abs(cardinal.east-(below?-1:1)*Math.PI/2)<1e-12,'East/west projection remains correct when viewing ISS from above or below');
  for(const roll of [.6,1.6,3.1]){
   C.Camera.prototype.twistRight.call(camera,roll);
   const angle=globe.compassAngle(north,camera.right,camera.up);C.Camera.prototype.twistRight.call(camera,angle);
   assert.ok(Math.abs(globe.compassAngle(north,camera.right,camera.up))<1e-12,'Recenter North cancels real Cesium camera roll');
  }
 }
 let picks=0;const camera={positionWC:new C.Cartesian3(1e7,0,0),pickEllipsoid(){picks++;return C.Cartesian3.fromDegrees(80,-45);}};
 assert.equal(globe.compassAnchor(C,camera,C.Ellipsoid.WGS84,1200,800,point),point);assert.equal(picks,0,'Following ISS uses its local geographic frame, not a distant Earth intersection');
 globe.compassAnchor(C,camera,C.Ellipsoid.WGS84,1200,800);assert.equal(picks,1,'Earth overview retains its surface reference');
}
const north=C.Cartesian3.UNIT_Z,east=C.Cartesian3.UNIT_X;
const axial=globe.cardinalAngles(north,east,C.Cartesian3.UNIT_X,C.Cartesian3.UNIT_Y);
assert.equal(axial.north,null);assert.equal(axial.south,null);assert.ok(Number.isFinite(axial.east),'Do not invent an angle for North when it lies along the viewing direction');
console.log('Geographic compass: all cardinal projections, ISS local frame, above/below views, dateline, hemispheres and North reset with the real Cesium camera math OK.');
