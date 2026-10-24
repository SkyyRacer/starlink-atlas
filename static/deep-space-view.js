/* A mission-centred spatial instrument, aligned with the main camera. */
window.AtlasDeepSpaceView={create({viewer,C,onEarth}){
 const view=viewer.container.closest('.view'),compass=document.getElementById('compass');
 const panel=document.createElement('aside');panel.className='deep-earth-instrument';panel.hidden=true;panel.setAttribute('aria-label','Direction de la Terre depuis la mission');
 panel.innerHTML=`<svg viewBox="24 11 132 132" role="img" aria-label="Direction de la Terre depuis la mission"><defs><radialGradient id="deep-space-glass" cx="35%" cy="25%"><stop stop-color="#20313b" stop-opacity=".55"/><stop offset="1" stop-color="#080b0f" stop-opacity=".8"/></radialGradient><radialGradient id="deep-space-earth" cx="28%" cy="25%"><stop stop-color="#e0f5ff"/><stop offset=".4" stop-color="#65b2d4"/><stop offset="1" stop-color="#154565"/></radialGradient></defs><circle cx="90" cy="77" r="58" fill="url(#deep-space-glass)" stroke="#768b97" stroke-opacity=".65" stroke-width="1"/><circle class="spatial-alignment-wash" cx="90" cy="77" r="57" fill="#72def5" opacity="0"/><circle class="spatial-alignment-halo" cx="90" cy="77" r="58" fill="none" stroke="#b1f2ff" stroke-width="2" opacity="0"/><g class="spatial-grid" fill="none" stroke="#7f9cab" stroke-width=".7" opacity=".42"></g><path class="spatial-earth-line" fill="none" stroke="#c1d8e4" stroke-opacity=".5" stroke-width="1"/><circle class="spatial-alignment-ring" cx="90" cy="77" r="12" fill="none" stroke="#a5e8f4" stroke-width="1.1" opacity=".18"/><g class="spatial-centre" stroke="#edf6fa" stroke-width=".5" stroke-linejoin="round"></g><circle class="spatial-core" cx="90" cy="77" r="1.5" fill="#fff"/><circle class="spatial-earth" r="4.5" fill="url(#deep-space-earth)" stroke="#c9e9f8" stroke-width=".7"/><defs><clipPath id="spatial-earth-clip"><circle r="1"/></clipPath><radialGradient id="spatial-earth-shade" cx="28%" cy="25%"><stop stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient></defs><g class="spatial-earth-surface" clip-path="url(#spatial-earth-clip)"><image class="spatial-earth-texture" x="-2" y="-1" width="4" height="2" preserveAspectRatio="none"/><circle r="1" fill="url(#spatial-earth-shade)"/></g></svg><p class="spatial-alignment-status" role="status" aria-live="polite" hidden>Vue alignée avec la Terre</p>`;
 if(compass)compass.after(panel);else view.append(panel);
 const svg=panel.querySelector('svg'),grid=panel.querySelector('.spatial-grid'),line=panel.querySelector('.spatial-earth-line'),earth=panel.querySelector('.spatial-earth'),centre=panel.querySelector('.spatial-centre');
 const rings=Array.from({length:3},()=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');grid.append(path);return path;});
 const surface=panel.querySelector('.spatial-earth-surface'),alignmentStatus=panel.querySelector('.spatial-alignment-status');
 panel.querySelector('.spatial-earth-texture').setAttribute('href','/images/earth/day.webp');
 const faces=Array.from({length:8},()=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');centre.append(path);return path;});
 const returnControl=document.createElement('div');returnControl.className='deep-earth-return-control';returnControl.hidden=true;
 const returnButton=document.createElement('button');returnButton.type='button';returnButton.className='deep-earth-return';returnButton.textContent='Retour à la Terre';returnButton.addEventListener('click',onEarth);returnControl.append(returnButton);
 const tools=view.querySelector('.globe-tools');if(tools)tools.append(returnControl);
 let enabled=false,active=true,target=null,previousLight=null,lastKey='';
 function worldPosition(){
  if(!target)return null;
  return target.icrf_km?window.AtlasCelestialFrame.position(C,viewer.clock.currentTime,target.icrf_km):C.Cartesian3.fromDegrees(target.lon,target.lat,target.altitude_km*1000);
 }
 function update(){
  if(!enabled||!active||document.hidden)return;
  const satellite=worldPosition(),camera=viewer.camera;
  const distance=satellite?C.Cartesian3.magnitude(satellite):0;
  if(!Number.isFinite(distance)||distance<1){lastKey='';alignmentStatus.hidden=true;svg.setAttribute('hidden','');panel.setAttribute('aria-label','Direction de la Terre indisponible à cette date');return;}
  svg.removeAttribute('hidden');
  // Camera-relative coordinates are shown in an orthographic isometric view.
  // The forward axis stays visible even when Earth is straight ahead or behind.
  const project=v=>{const x=C.Cartesian3.dot(v,camera.rightWC),y=C.Cartesian3.dot(v,camera.upWC),z=C.Cartesian3.dot(v,camera.directionWC);return {x:90+54*(x+z)/Math.sqrt(2),y:77+54*(x-2*y-z)/Math.sqrt(6),z};};
  const direction=C.Cartesian3.normalize(C.Cartesian3.negate(satellite,new C.Cartesian3()),new C.Cartesian3());
  const x=C.Cartesian3.dot(direction,camera.rightWC),y=C.Cartesian3.dot(direction,camera.upWC),z=C.Cartesian3.dot(direction,camera.directionWC);
  const key=[x,y,z,distance,camera.rightWC.x,camera.rightWC.y,camera.rightWC.z,camera.upWC.x,camera.upWC.y,camera.upWC.z].map((v,i)=>i===3?Math.round(v/1000):v.toFixed(4)).join('|');
  if(key!==lastKey){
   lastKey=key;
   const rotation=window.AtlasCelestialFrame.icrfToFixed(C,viewer.clock.currentTime);
   const solid=[];
   for(let x=-1;x<=1;x+=2)for(let y=-1;y<=1;y+=2)for(let z=-1;z<=1;z+=2){
    const vertices=[[x,0,0],[0,y,0],[0,0,z]].map(v=>project(C.Matrix3.multiplyByVector(rotation,new C.Cartesian3(...v),new C.Cartesian3())));
    solid.push({vertices,depth:vertices.reduce((n,v)=>n+v.z,0)/3});
   }
   solid.sort((a,b)=>b.depth-a.depth).forEach((face,i)=>{const points=face.vertices.map(v=>[90+(v.x-90)*.14,77+(v.y-77)*.14]);faces[i].setAttribute('d',points.map(([x,y],n)=>(n?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ')+'Z');faces[i].setAttribute('fill',face.depth<0?'#e4f0f6':'#637c8b');});
   // Angular distance from the viewing axis: ahead is the centre, behind is the rim.
   const transverse=Math.hypot(x,y),angle=Math.atan2(transverse,z),radius=54*angle/Math.PI;
   const marker={x:90+(transverse>1e-8?x/transverse:0)*radius,y:77-(transverse>1e-8?y/transverse:1)*radius};
   const aligned=z>Math.cos(8*Math.PI/180),behind=z<0;
   alignmentStatus.hidden=!aligned;panel.dataset.facingEarth=String(aligned);panel.dataset.earthHemisphere=behind?'behind':'ahead';
   rings[0].setAttribute('d','M90 59a18 18 0 1 1 0 36a18 18 0 1 1 0-36');
   rings[1].setAttribute('d','M90 41a36 36 0 1 1 0 72a36 36 0 1 1 0-72');
   rings[2].setAttribute('d','M90 23v7M90 124v7M36 77h7M137 77h7');
   line.setAttribute('d',`M90 77 L${marker.x.toFixed(2)} ${marker.y.toFixed(2)}`);line.setAttribute('stroke-dasharray',behind?'3 3':'none');
   earth.setAttribute('cx',marker.x.toFixed(2));earth.setAttribute('cy',marker.y.toFixed(2));earth.setAttribute('opacity','1');earth.setAttribute('r',aligned?'9':behind?'4.5':'6');
   earth.setAttribute('fill',behind?'#080d12':'url(#deep-space-earth)');earth.setAttribute('stroke',behind?'#d7a46d':'#c9e9f8');earth.setAttribute('stroke-dasharray',behind?'2 2':'none');
   surface.setAttribute('transform',`translate(${marker.x.toFixed(2)} ${marker.y.toFixed(2)}) scale(${aligned?9:6})`);surface.setAttribute('visibility',behind?'hidden':'visible');
   centre.setAttribute('opacity',aligned?'.15':'1');panel.querySelector('.spatial-core').setAttribute('opacity',aligned?'0':'1');
   panel.querySelector('.spatial-alignment-ring').setAttribute('opacity',aligned?'1':'.18');
   const sides=[aligned?'Face à la Terre':z>=0?'Devant la vue':'Derrière la vue'];if(Math.abs(x)>.2)sides.push(x>0?'à droite':'à gauche');if(Math.abs(y)>.2)sides.push(y>0?'en haut':'en bas');
   const description='Terre depuis la mission : '+sides.join(' · ')+', '+(distance/1000).toLocaleString('fr-FR',{maximumFractionDigits:0})+' km';
   svg.setAttribute('aria-label',description);panel.setAttribute('aria-label',description);
  }
  const sun=window.AtlasCelestialFrame.sun(C,viewer.clock.currentTime);
  if(!(viewer.scene.light instanceof C.DirectionalLight))viewer.scene.light=new C.DirectionalLight({direction:C.Cartesian3.UNIT_X,intensity:1});
  viewer.scene.light.direction=C.Cartesian3.normalize(C.Cartesian3.subtract(satellite,sun,new C.Cartesian3()),new C.Cartesian3());
 }
 viewer.scene.preRender.addEventListener(update);
 const refresh=()=>viewer.scene.requestRender();window.addEventListener('atlas:celestial-frame-ready',()=>{lastKey='';refresh();});
 return {setTarget(point){target=point;},setEnabled(value){
  if(value===enabled)return;enabled=value;view.dataset.deepSpace=String(value);panel.hidden=!value||!active;returnControl.hidden=!value||!active;
  if(value){previousLight=viewer.scene.light;if(compass)compass.hidden=true;update();}else viewer.scene.light=previousLight||new C.SunLight({intensity:1});refresh();
 },setActive(value){active=value;panel.hidden=!value||!enabled;returnControl.hidden=!value||!enabled;},get enabled(){return enabled;}};
}};
