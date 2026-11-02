const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../static/vendor/cesium/index.cjs'),attitude=require('../static/model-attitude.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync('static/globe.js','utf8'),context);const api=context.window.AtlasGlobe;
function camera(){return new C.Camera({canvas:{clientWidth:1200,clientHeight:800},mapProjection:new C.GeographicProjection(),drawingBufferWidth:1200,drawingBufferHeight:800});}
const mir=camera(),iss=camera(),first=C.Cartesian3.fromDegrees(15,43,400000),offset=new C.HeadingPitchRange(.4,-.5,700);
api.followPose(C,mir,16609,first,offset);api.followPose(C,iss,25544,first,offset);
const axes=['position','direction','up','right'],local=axes.map(k=>C.Cartesian3.clone(mir[k]));let bodyBefore;
for(let i=0;i<=720;i++){
 const angle=i*Math.PI/360,pos=new C.Cartesian3(6778000*Math.cos(angle),6778000*Math.sin(angle)*.6,6778000*Math.sin(angle)*.8),velocity=[-7.7*Math.sin(angle),7.7*Math.cos(angle)*.6,7.7*Math.cos(angle)*.8];
 api.followStep(C,mir,16609,pos);api.followStep(C,iss,25544,pos);
 assert.ok(C.Matrix4.equalsEpsilon(mir.transform,C.Transforms.eastNorthUpToFixedFrame(pos),1e-8),'Mir camera keeps the local Earth vertical, including longitude wrap');
 for(let k=0;k<axes.length;k++)assert.ok(C.Cartesian3.equalsEpsilon(mir[axes[k]],local[k],1e-9),'Following preserves the inspection angle and offset');
 for(const axis of ['positionWC','directionWC','upWC','rightWC'])assert.ok(C.Cartesian3.equalsEpsilon(mir[axis],iss[axis],1e-8),'Mir follows exactly like the unchanged ISS camera');
 assert.ok(Math.abs(Math.atan2(Math.sin(mir.roll),Math.cos(mir.roll)))<1e-5,'No automatic camera roll during an orbit');
 const body=attitude.matrix(C,{}, {id:16609,velocity_inertial_fixed_km_s:velocity},pos);if(i===0)bodyBefore=C.Matrix4.getMatrix3(body,new C.Matrix3());if(i===180)assert.ok(!C.Matrix3.equalsEpsilon(bodyBefore,C.Matrix4.getMatrix3(body,new C.Matrix3()),1e-3),'Station attitude changes independently');
}
// A user-controlled rotation and lateral pan survive subsequent follow updates.
const controls=api.inspectionControls(C,mir,{});controls.orbit(40,-20);controls.pan(24,15);
const userPose=axes.map(k=>C.Cartesian3.clone(mir[k]));
api.followStep(C,mir,16609,C.Cartesian3.fromDegrees(-120,-35,400000));
for(let k=0;k<axes.length;k++)assert.ok(C.Cartesian3.equalsEpsilon(mir[axes[k]],userPose[k],1e-9),'Following preserves mouse orbit and lateral camera pan');
api.followPose(C,mir,16609,first,offset);
assert.ok(Math.abs(Math.atan2(Math.sin(mir.roll),Math.cos(mir.roll)))<1e-5,'Recenter restores a level camera');
console.log('Real Cesium Camera: Mir keeps Earth vertical over 720 frames, matches ISS, preserves mouse orbit/pan, and leaves model attitude independent');
