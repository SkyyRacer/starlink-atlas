/* Calculated Sun tracking through two shared SARJ alpha joints and eight BGAs.
 * Carrier segments follow their real hierarchy; central modules and camera stay fixed.
 * This is nominal solar pointing, not measured motor telemetry or parking modes.
 */
(function(root){
 const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
 function angleToSun(normal,sun,previous=0){
  // Both source joint types rotate around their own local Z. Alpha points
  // the carrier plane; beta supplies the remaining independent wing angle.
  const n=Math.hypot(normal.x,normal.y),s=Math.hypot(sun.x,sun.y);
  if(n<1e-8||s<1e-5)return previous;
  return Math.atan2(normal.x*sun.y-normal.y*sun.x,normal.x*sun.x+normal.y*sun.y);
 }
 function create(C,viewer,model,rig,{sunPosition,now=()=>performance.now()}={}){
  if(!rig?.length||!model.getNode)return null;
  const joints=[];
  for(const info of rig){
   const node=model.getNode(info.name);if(!node)return null;
   const bodyFromJoint=C.Matrix4.fromArray(info.body_from_joint),inverse=C.Matrix4.inverse(bodyFromJoint,new C.Matrix4());
   const normal=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(inverse,new C.Cartesian3(...info.normal_body),new C.Cartesian3()),new C.Cartesian3());
   joints.push({minimum:info.minimum_angle,maximum:info.maximum_angle,name:info.name,kind:info.kind||'beta',alpha:info.alpha,node,inverse,bodyFromJoint,normal,base:C.Matrix4.fromArray(info.base_matrix),angle:null,goal:0,matrix:new C.Matrix4(),inverseDelta:new C.Matrix4()});
  }
  const alphas=joints.filter(joint=>joint.kind==='alpha'),betas=joints.filter(joint=>joint.kind==='beta'),byName=new Map(joints.map(joint=>[joint.name,joint]));
  let previous=null,sunStamp=null,sunFixed=null;
  return {update(){
   const time=viewer.clock.currentTime;
   const stamp=C.JulianDate.toDate(time).getTime();
   if(!Number.isFinite(stamp))return;
   if(stamp!==sunStamp){
    const provider=sunPosition||root.AtlasCelestialFrame?.sun;
    if(!provider)return;
    sunFixed=provider(C,time);sunStamp=stamp;
   }
   if(!sunFixed||![sunFixed.x,sunFixed.y,sunFixed.z].every(Number.isFinite))return;
   const position=C.Matrix4.getTranslation(model.modelMatrix,new C.Cartesian3());
   const direction=C.Cartesian3.subtract(sunFixed,position,new C.Cartesian3());
   if(C.Cartesian3.magnitudeSquared(direction)<1)return;
   const inverse=C.Matrix4.inverse(model.modelMatrix,new C.Matrix4());
   const bodySun=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(inverse,direction,new C.Cartesian3()),new C.Cartesian3());
   const tick=now(),dt=previous===null?0:Math.max(0,(tick-previous)/1000),blend=-Math.expm1(-dt/.2);previous=tick;
   let pending=false;
   function step(joint,sun){
    const before=joint.angle;
    const localSun=C.Cartesian3.normalize(C.Matrix4.multiplyByPointAsVector(joint.inverse,sun,new C.Cartesian3()),new C.Cartesian3());
    let desired=angleToSun(joint.normal,localSun,joint.goal);
    if(Number.isFinite(joint.minimum)&&Number.isFinite(joint.maximum)){desired=Math.max(joint.minimum,Math.min(joint.maximum,desired));joint.goal=desired;}
    else joint.goal+=wrap(desired-joint.goal);
    if(joint.angle===null)joint.angle=joint.goal;
    else joint.angle+=(joint.goal-joint.angle)*blend;
    if(Math.abs(joint.goal-joint.angle)<1e-5)joint.angle=joint.goal;else pending=true;
    const rotation=C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(joint.angle),C.Cartesian3.ZERO,new C.Matrix4());
    if(before===null||Math.abs(joint.angle-before)>1e-10){
     C.Matrix4.multiply(joint.base,rotation,joint.matrix);joint.node.matrix=joint.matrix;
    }
    if(joint.kind==='alpha'){
     // Delta in body coordinates, about the actual SARJ pivot. Its inverse
     // expresses Sun direction in the carrier's CURRENT (smoothed) pose.
     const delta=C.Matrix4.multiply(C.Matrix4.multiply(joint.bodyFromJoint,rotation,new C.Matrix4()),joint.inverse,new C.Matrix4());
     C.Matrix4.inverse(delta,joint.inverseDelta);
    }
   }
   for(const alpha of alphas)step(alpha,bodySun);
   for(const beta of betas){
    const alpha=byName.get(beta.alpha);
    const sun=alpha?C.Matrix4.multiplyByPointAsVector(alpha.inverseDelta,bodySun,new C.Cartesian3()):bodySun;
    step(beta,sun);
   }
   if(pending)viewer.scene.requestRender();
  }};
 }
 const api={create,angleToSun,wrap};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasISSSolar=api;
})(typeof window==='undefined'?globalThis:window);
