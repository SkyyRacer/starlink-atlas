const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),C=require('../static/vendor/cesium/index.cjs'),attitude=require('../static/model-attitude.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync('static/globe.js','utf8'),context);const api=context.window.AtlasGlobe;
function camera(){return new C.Camera({canvas:{clientWidth:1200,clientHeight:800},mapProjection:new C.GeographicProjection(),drawingBufferWidth:1200,drawingBufferHeight:800});}
const c=camera(),first=C.Cartesian3.fromDegrees(15,43,400000),offset=new C.HeadingPitchRange(.4,-.5,700);let reference=api.followPose(C,c,16609,first,offset),bodyBefore;
const axes=['directionWC','upWC','rightWC'],original=axes.map(k=>C.Cartesian3.clone(c[k])),relative=C.Cartesian3.subtract(c.positionWC,first,new C.Cartesian3());
for(let i=0;i<=720;i++){
 const angle=i*Math.PI/360,pos=new C.Cartesian3(6778000*Math.cos(angle),6778000*Math.sin(angle)*.6,6778000*Math.sin(angle)*.8),velocity=[-7.7*Math.sin(angle),7.7*Math.cos(angle)*.6,7.7*Math.cos(angle)*.8];
 api.followStep(C,c,16609,pos,reference);
 for(let k=0;k<axes.length;k++)assert.ok(C.Cartesian3.equalsEpsilon(c[axes[k]],original[k],1e-9),'Camera world axes never inherit body/orbital rotation');
 assert.ok(C.Cartesian3.equalsEpsilon(C.Cartesian3.subtract(c.positionWC,pos,new C.Cartesian3()),relative,1e-8),'Only camera translation follows Mir');
 const body=attitude.matrix(C,{}, {id:16609,velocity_inertial_fixed_km_s:velocity},pos);if(i===0)bodyBefore=C.Matrix4.getMatrix3(body,new C.Matrix3());if(i===180)assert.ok(!C.Matrix3.equalsEpsilon(bodyBefore,C.Matrix4.getMatrix3(body,new C.Matrix3()),1e-3),'Station rotates independently');
}
// Explicit recenter keeps the same frozen axes at a different date/location.
reference=api.followPose(C,c,16609,C.Cartesian3.fromDegrees(-120,-35,400000),offset,reference);
for(let k=0;k<axes.length;k++)assert.ok(C.Cartesian3.equalsEpsilon(c[axes[k]],original[k],1e-9),'Recenter does not select new geographic camera axes');
const iss=camera(),target=C.Cartesian3.fromDegrees(40,25,420000);assert.equal(api.followPose(C,iss,25544,target,offset),null);assert.ok(C.Matrix4.equalsEpsilon(iss.transform,C.Transforms.eastNorthUpToFixedFrame(target),1e-8),'ISS initialization unchanged');api.followStep(C,iss,25544,first);assert.ok(C.Matrix4.equalsEpsilon(iss.transform,C.Transforms.eastNorthUpToFixedFrame(first),1e-8),'ISS follow unchanged');
console.log('Real Cesium Camera: Mir keeps world axes and relative pose over 720 frames and recenter, station rotates independently, ISS behaviour retained');
