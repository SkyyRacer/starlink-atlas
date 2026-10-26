/* Position is not attitude. Only calibrated body frames may use a nominal mode.
 * ISS: NASA SSP LVLH +X along velocity, +Z nadir; this is not live telemetry.
 * Other objects retain an explicitly illustrative orientation until pointing
 * measurements and their model-to-body alignment are available.
 */
(function(root){
 function nominal(point){return point?.id===25544&&Array.isArray(point.velocity_inertial_fixed_km_s)&&point.velocity_inertial_fixed_km_s.length===3&&point.velocity_inertial_fixed_km_s.every(Number.isFinite)&&Math.hypot(...point.velocity_inertial_fixed_km_s)>1e-8;}
 function matrix(C,viewer,point,position){
  if(point?.id===25544&&C.Cartesian3.magnitudeSquared(position)>1){
   const z=C.Cartesian3.normalize(C.Cartesian3.negate(position,new C.Cartesian3()),new C.Cartesian3());
   // Old/offline editions may lack velocity: still keep Cupola at nadir,
   // but explicitly report the along-track heading as unavailable.
   const velocity=nominal(point)?new C.Cartesian3(...point.velocity_inertial_fixed_km_s):Math.abs(z.z)<.99?C.Cartesian3.UNIT_Z:C.Cartesian3.UNIT_X;
   const x=C.Cartesian3.subtract(velocity,C.Cartesian3.multiplyByScalar(z,C.Cartesian3.dot(velocity,z),new C.Cartesian3()),new C.Cartesian3());
   if(C.Cartesian3.magnitudeSquared(x)>1e-12){
    C.Cartesian3.normalize(x,x);const y=C.Cartesian3.normalize(C.Cartesian3.cross(z,x,new C.Cartesian3()),new C.Cartesian3());
    const rotation=C.Matrix3.fromColumnMajorArray([x.x,x.y,x.z,y.x,y.y,y.z,z.x,z.y,z.z]);
    return C.Matrix4.fromRotationTranslation(rotation,position,new C.Matrix4());
   }
  }
  return C.Transforms.eastNorthUpToFixedFrame(position);
 }
 function describe(point){return nominal(point)?'Alignement orbital nominal · attitude réelle indisponible':point?.id===25544?'Nadir vers la Terre · cap de vol indisponible':'Attitude réelle indisponible · orientation illustrative';}
 const api={matrix,describe,nominal};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasModelAttitude=api;
})(typeof window==='undefined'?globalThis:window);
