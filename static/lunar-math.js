'use strict';
(function(root){
 const TAU=Math.PI*2,DAY=86400000;
 const mod=x=>(x%TAU+TAU)%TAU;
 function sample(C,ms){
  const time=C.JulianDate.fromDate(new Date(ms));
  const moon=C.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(time);
  const sun=C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time);
  const e=23.4392911*Math.PI/180;
  const longitude=v=>Math.atan2(v.y*Math.cos(e)+v.z*Math.sin(e),v.x);
  const angle=mod(longitude(moon)-longitude(sun));
  const moonToSun=C.Cartesian3.subtract(sun,moon,new C.Cartesian3());
  const cosine=-C.Cartesian3.dot(moon,moonToSun)/(C.Cartesian3.magnitude(moon)*C.Cartesian3.magnitude(moonToSun));
  const phase=['Nouvelle Lune','Premier croissant','Premier quartier','Gibbeuse croissante','Pleine Lune','Gibbeuse décroissante','Dernier quartier','Dernier croissant'][Math.round(angle/TAU*8)%8];
  return {time,moon,sun,angle,phase,distance:C.Cartesian3.magnitude(moon)/1000,illumination:(1+cosine)/2};
 }
 function nextPhase(C,ms,target){
  const astronomy=root.Astronomy||(typeof require==='function'?require('./vendor/astronomy.browser.min.js'):null);
  const next=astronomy.SearchMoonPhase(target*180/Math.PI,new Date(ms+1000),35);
  if(!next)throw new Error('Phase lunaire hors intervalle');
  return next.date.getTime();
 }
 function fixed(C,time,inertial){const rotation=C.Transforms.computeIcrfToFixedMatrix(time)||C.Transforms.computeTemeToPseudoFixedMatrix(time);return C.Matrix3.multiplyByVector(rotation,inertial,new C.Cartesian3());}
 const api={sample,nextPhase,fixed};if(typeof module!=='undefined')module.exports=api;else root.AtlasLunarMath=api;
})(typeof window==='undefined'?globalThis:window);
