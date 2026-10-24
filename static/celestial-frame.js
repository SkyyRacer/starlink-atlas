/* One J2000/ICRF frame for spacecraft, stars and the apparent solar direction. */
(function(root){
 let stamp=null,rotation=null;const pending=new Set();
 function fallback(at,C){
  const jd=at/86400000+2440587.5,T=(jd-2451545)/36525,k=Math.PI/648000;
  const a=(2306.2181*T+.30188*T*T+.017998*T*T*T)*k,b=(2306.2181*T+1.09468*T*T+.018203*T*T*T)*k,c=(2004.3109*T-.42665*T*T-.041833*T*T*T)*k;
  const g=(280.46061837+360.98564736629*(jd-2451545)+.000387933*T*T-T*T*T/38710000)*Math.PI/180;
  const apply=([x,y,z])=>{const A=Math.sin(a)*x+Math.cos(a)*y,B=Math.cos(c)*(Math.cos(a)*x-Math.sin(a)*y)-Math.sin(c)*z,Z=Math.sin(c)*(Math.cos(a)*x-Math.sin(a)*y)+Math.cos(c)*z,X=B*Math.cos(b)-A*Math.sin(b),Y=B*Math.sin(b)+A*Math.cos(b);return [X*Math.cos(g)+Y*Math.sin(g),-X*Math.sin(g)+Y*Math.cos(g),Z];};
  return C.Matrix3.fromColumnMajorArray([...apply([1,0,0]),...apply([0,1,0]),...apply([0,0,1])]);
 }
 function icrfToFixed(C,time){
  const at=C.JulianDate.toDate(time).getTime();if(stamp===at&&rotation)return rotation;
  let matrix=C.Transforms.computeIcrfToFixedMatrix(time);
  if(!matrix){
   const day=Math.floor(at/86400000);
   if(!pending.has(day)){
    pending.add(day);
    C.Transforms.preloadIcrfFixed(new C.TimeInterval({start:C.JulianDate.addDays(time,-1,new C.JulianDate()),stop:C.JulianDate.addDays(time,1,new C.JulianDate())})).then(()=>{stamp=null;root.dispatchEvent?.(new Event('atlas:celestial-frame-ready'));}).catch(()=>{pending.delete(day);});
   }
   matrix=fallback(at,C);
  }
  stamp=at;rotation=matrix;return matrix;
 }
 function fixedToIcrf(C,time){return C.Matrix3.transpose(icrfToFixed(C,time),new C.Matrix3());}
 function position(C,time,xyz,result){
  // New GPU markers start with a null target; Cesium matrix multiplication requires an output vector.
  result=result||new C.Cartesian3();
  return C.Matrix3.multiplyByVector(icrfToFixed(C,time),C.Cartesian3.fromElements(xyz[0]*1000,xyz[1]*1000,xyz[2]*1000,result),result);
 }
 function sun(C,time){return C.Matrix3.multiplyByVector(icrfToFixed(C,time),C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time),new C.Cartesian3());}
 const api={icrfToFixed,fixedToIcrf,position,sun,fallback};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasCelestialFrame=api;
})(typeof window==='undefined'?globalThis:window);
