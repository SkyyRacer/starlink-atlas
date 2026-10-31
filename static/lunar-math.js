'use strict';
(function(root){
 const TAU=Math.PI*2,DAY=86400000;
 const mod=x=>(x%TAU+TAU)%TAU;
 function phaseName(angle){
  const a=mod(angle),tolerance=Math.PI/360;
  if(Math.min(a,TAU-a)<=tolerance)return 'Nouvelle Lune';
  if(Math.abs(a-Math.PI/2)<=tolerance)return 'Premier quartier';
  if(Math.abs(a-Math.PI)<=tolerance)return 'Pleine Lune';
  if(Math.abs(a-3*Math.PI/2)<=tolerance)return 'Dernier quartier';
  return a<Math.PI/2?'Premier croissant':a<Math.PI?'Gibbeuse croissante':a<3*Math.PI/2?'Gibbeuse décroissante':'Dernier croissant';
 }
 // A frame tied to the Earth-Moon viewing direction. Keeping camera coordinates
 // in this frame preserves manual orbiting while dates advance or jump.
 function viewFrame(C,position){
  const z=C.Cartesian3.normalize(position,new C.Cartesian3());
  const x=C.Cartesian3.cross(Math.abs(z.z)>.99?C.Cartesian3.UNIT_Y:C.Cartesian3.UNIT_Z,z,new C.Cartesian3());C.Cartesian3.normalize(x,x);
  const y=C.Cartesian3.cross(z,x,new C.Cartesian3());
  return C.Matrix3.fromColumnMajorArray([x.x,x.y,x.z,y.x,y.y,y.z,z.x,z.y,z.z]);
 }
 function sample(C,ms){
  const time=C.JulianDate.fromDate(new Date(ms));
  const moon=C.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(time);
  const sun=C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time);
  const e=23.4392911*Math.PI/180;
  const longitude=v=>Math.atan2(v.y*Math.cos(e)+v.z*Math.sin(e),v.x);
  const angle=mod(longitude(moon)-longitude(sun));
  const moonToSun=C.Cartesian3.subtract(sun,moon,new C.Cartesian3());
  const cosine=-C.Cartesian3.dot(moon,moonToSun)/(C.Cartesian3.magnitude(moon)*C.Cartesian3.magnitude(moonToSun));
  const phase=phaseName(angle);
  return {time,moon,sun,angle,phase,distance:C.Cartesian3.magnitude(moon)/1000,illumination:(1+cosine)/2};
 }
 function nextPhase(C,ms,target){
  const astronomy=root.Astronomy||(typeof require==='function'?require('./vendor/astronomy.browser.min.js'):null);
  const next=astronomy.SearchMoonPhase(target*180/Math.PI,new Date(ms+1000),35);
  if(!next)throw new Error('Phase lunaire hors intervalle');
  return next.date.getTime();
 }
 function fixed(C,time,inertial){const rotation=C.Transforms.computeIcrfToFixedMatrix(time)||C.Transforms.computeTemeToPseudoFixedMatrix(time);return C.Matrix3.multiplyByVector(rotation,inertial,new C.Cartesian3());}
 const api={sample,nextPhase,fixed,phaseName,viewFrame};if(typeof module!=='undefined')module.exports=api;else root.AtlasLunarMath=api;
})(typeof window==='undefined'?globalThis:window);
