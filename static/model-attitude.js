/* Position is not attitude. Only calibrated body frames may use a nominal mode.
 * ISS: NASA SSP LVLH +X along velocity, +Z nadir; this is not live telemetry.
 * Mir: reference gravity-gradient mode; Skylab: solar-inertial reference;
 * Tiangong: nominal Earth-pointing mode. None is historical attitude telemetry.
 */
(function(root){
 const reconstructedStations=new Set([5160,6398,7342,7591,8911,10382,13138,37820,41765]);
 function nominal(point){return point?.id===25544&&Array.isArray(point.velocity_inertial_fixed_km_s)&&point.velocity_inertial_fixed_km_s.length===3&&point.velocity_inertial_fixed_km_s.every(Number.isFinite)&&Math.hypot(...point.velocity_inertial_fixed_km_s)>1e-8;}
 function matrix(C,viewer,point,position,variant='realistic'){
  // These white outlines are baked from calibrated detailed body frames.
  // Reusing the old ENU placement turns their +Z nadir away from Earth.
  // Share only the body attitude; white panels remain in their fixed pose.
  if(variant==='white'&&[16609,37820,41765,48274].includes(point?.id))return matrix(C,viewer,point,position,'realistic');
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
  const frame=C.Transforms.eastNorthUpToFixedFrame(position);
  const heading=point?.velocity_inertial_fixed_km_s,validHeading=Array.isArray(heading)&&heading.length===3&&heading.every(Number.isFinite)&&Math.hypot(...heading)>1e-8;
  if([37820,41765,48274].includes(point?.id)&&C.Cartesian3.magnitudeSquared(position)>1){
   // Calibrated +Z remains Earth-facing throughout the orbit. Solar hinges
   // supply Sun tracking separately; the complete station does not spin at it.
   const V=C.Cartesian3,z=V.normalize(V.negate(position,new V()),new V());
   const east=C.Matrix4.getColumn(frame,0,new C.Cartesian4());
   const velocity=validHeading?new V(...heading):new V(east.x,east.y,east.z);
   let x=V.subtract(velocity,V.multiplyByScalar(z,V.dot(velocity,z),new V()),new V());
   if(V.magnitudeSquared(x)<1e-12)x=new V(east.x,east.y,east.z);
   V.normalize(x,x);const y=V.normalize(V.cross(z,x,new V()),new V());V.normalize(V.cross(y,z,x),x);
   return C.Matrix4.fromRotationTranslation(C.Matrix3.fromColumnMajorArray([x.x,x.y,x.z,y.x,y.y,y.z,z.x,z.y,z.z]),position,new C.Matrix4());
  }

  if(point?.id===16609&&C.Cartesian3.magnitudeSquared(position)>1){
   // Three-axis gravity-gradient reference. Use the actual inertial velocity
   // expressed in Earth-fixed axes, never geographic east as the flight heading.
   const V=C.Cartesian3,down=V.normalize(V.negate(position,new V()),new V());
   const v=validHeading?new V(...heading):V.cross(Math.abs(down.z)<.99?V.UNIT_Z:V.UNIT_X,down,new V());
   let along=V.subtract(v,V.multiplyByScalar(down,V.dot(v,down),new V()),new V());
   if(V.magnitudeSquared(along)<1e-12)along=V.cross(Math.abs(down.z)<.99?V.UNIT_Z:V.UNIT_X,down,new V());
   V.normalize(along,along);const side=V.normalize(V.cross(along,down,new V()),new V());
   V.normalize(V.cross(down,side,along),along);
   const world=C.Matrix3.fromColumnMajorArray([down.x,down.y,down.z,side.x,side.y,side.z,along.x,along.y,along.z]);
   const basis=C.Matrix3.IDENTITY;
   return C.Matrix4.fromRotationTranslation(C.Matrix3.multiply(world,C.Matrix3.transpose(basis,new C.Matrix3()),new C.Matrix3()),position,new C.Matrix4());
  }
  // Fixed panels follow the Sun through station attitude, only in realistic mode.
  // Salyut 1 cell faces are body -Z; Skylab uses its existing calibrated ATM basis.
  if(variant==='realistic'&&[5160,6633].includes(point?.id)){
   const time=viewer?.clock?.currentTime,sun=time&&root.AtlasCelestialFrame?.sun?.(C,time);
   if(sun){
    const V=C.Cartesian3,z=V.normalize(V.subtract(sun,position,new V()),new V());
    if(point.id===5160)V.negate(z,z);
    const velocity=validHeading?new V(...heading):V.cross(V.UNIT_Z,position,new V());
    let orbitNormal=V.cross(position,velocity,new V()),x=V.cross(orbitNormal,z,new V());
    if(V.magnitudeSquared(x)<1e-12)x=V.cross(Math.abs(z.z)<.99?V.UNIT_Z:V.UNIT_X,z,new V());
    V.normalize(x,x);const y=V.normalize(V.cross(z,x,new V()),new V());V.normalize(V.cross(y,z,x),x);
    const world=C.Matrix3.fromColumnMajorArray([x.x,x.y,x.z,y.x,y.y,y.z,z.x,z.y,z.z]),h=Math.SQRT1_2;
    const basis=point.id===6633?C.Matrix3.fromColumnMajorArray([1,0,0,0,h,h,0,-h,h]):C.Matrix3.IDENTITY;
    return C.Matrix4.fromRotationTranslation(C.Matrix3.multiply(world,C.Matrix3.transpose(basis,new C.Matrix3()),new C.Matrix3()),position,new C.Matrix4());
   }
  }
  if(point?.id===6633&&variant==='white')return frame;
  if(!([16609,6633,48274].includes(point?.id)||reconstructedStations.has(point?.id))||!point.velocity_inertial_fixed_km_s?.every(Number.isFinite)||Math.hypot(...point.velocity_inertial_fixed_km_s)<1e-8)return frame;
  const V=C.Cartesian3,unit=v=>V.normalize(v,v),cross=(a,b)=>V.cross(a,b,new V()),project=(a,z)=>V.subtract(a,V.multiplyByScalar(z,V.dot(a,z),new V()),new V());
  const velocity=new V(...point.velocity_inertial_fixed_km_s),nadir=unit(V.negate(position,new V()));let x,z;
  if(point.id===6633){
   const time=viewer?.clock?.currentTime;if(!time||!root.AtlasCelestialFrame?.sun)return frame;
   z=unit(V.subtract(root.AtlasCelestialFrame.sun(C,time),position,new V()));
   x=cross(cross(position,velocity),z);
  }else if(point.id===16609){x=nadir;z=project(velocity,x);}else{z=nadir;x=project(velocity,z);}
  if(V.magnitudeSquared(x)<1e-12||V.magnitudeSquared(z)<1e-12)return frame;
  unit(x);unit(z);const y=unit(cross(z,x));x=unit(cross(y,z));
  const world=C.Matrix3.fromColumnMajorArray([x.x,x.y,x.z,y.x,y.y,y.z,z.x,z.y,z.z]),h=Math.SQRT1_2;
  // Engine-local bases include each asset's root and Cesium glTF axis conversion.
  // Mir white edges are baked from this same Celestia presentation transform.
  let basis;
  if(reconstructedStations.has(point.id)||point.id===48274&&variant==='realistic')basis=[1,0,0,0,1,0,0,0,1];
  else if(point.id===6633)basis=[1,0,0,0,h,h,0,-h,h];
  else if(point.id===48274&&variant==='white')basis=[0,1,0,1,0,0,0,0,-1];
  else basis=[0,h,-h,1,0,0,0,-h,-h];
  const rotation=C.Matrix3.multiply(world,C.Matrix3.transpose(C.Matrix3.fromColumnMajorArray(basis),new C.Matrix3()),new C.Matrix3());
  return C.Matrix4.fromRotationTranslation(rotation,position,new C.Matrix4());
 }
 function describe(point){if(reconstructedStations.has(point?.id))return 'Reconstitution · orientation orbitale de référence, attitude historique non mesurée';if([16609,6633,48274].includes(point?.id))return ({16609:'Repère orbital à trois axes · orientation gravitationnelle nominale',6633:'Pointage solaire nominal',48274:'Orientation orbitale nominale'})[point.id]+' · attitude historique non mesurée';return nominal(point)?'Alignement orbital nominal · attitude réelle indisponible':point?.id===25544?'Nadir vers la Terre · cap de vol indisponible':'Attitude réelle indisponible · orientation illustrative';}
 const api={matrix,describe,nominal};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasModelAttitude=api;
})(typeof window==='undefined'?globalThis:window);
