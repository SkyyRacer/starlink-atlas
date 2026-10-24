'use strict';
window.AtlasMoon={
 async load(){if(this.loading)return this.loading;const base=new URL("./",this.base);return this.loading=(async()=>{for(const file of ["vendor/astronomy.browser.min.js","lunar-math.js"]){await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=new URL(file,base);script.onload=resolve;script.onerror=()=>reject(Error("Données lunaires indisponibles"));document.head.append(script);});}})();},
 base:document.currentScript?.src||new URL("moon.js",document.baseURI).href,
 // Text patches use local tangent coordinates, never global longitude UVs.
 mapGeometry(C,map,radius){
  const positions=[],normals=[],uv=[],indices=[];
  for(const f of map.features){
   const lon=f.lon*Math.PI/180,lat=f.lat*Math.PI/180;
   const center=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
   const east=[-Math.sin(lon),Math.cos(lon),0],north=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)];
   const nx=Math.max(2,Math.ceil(f.width/.015)),ny=Math.max(2,Math.ceil(f.height/.015)),base=positions.length/3;
   for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny,x=(u-.5)*f.width,y=(.5-v)*f.height;
    const p=center.map((c,k)=>c+east[k]*x+north[k]*y),length=Math.hypot(...p);
    for(let k=0;k<3;k++){normals.push(p[k]/length);positions.push(p[k]/length*radius);}
    uv.push((f.rect[0]+u*f.rect[2])/map.width,1-(f.rect[1]+v*f.rect[3])/map.height);
   }
   for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const a=base+j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    indices.push(a,c,b,b,c,d);
   }
  }
  const values=new Float64Array(positions);
  return new C.Geometry({attributes:{position:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values}),normal:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:new Float32Array(normals)}),st:new C.GeometryAttribute({componentDatatype:C.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:new Float32Array(uv)})},indices:C.IndexDatatype.createTypedArray(positions.length/3,indices),primitiveType:C.PrimitiveType.TRIANGLES,boundingSphere:C.BoundingSphere.fromVertices(values)});
 },
 create({viewer,C,beforeTravel,onEarth,onViewChange=()=>{},navigateMoon=null,navigateEarth=null,allowOrbit=true}){
  const math=AtlasLunarMath,R=C.Ellipsoid.MOON.maximumRadius,maximumRange=4e9;
  if(viewer.scene.moon)viewer.scene.moon.show=false;
  const lunarMaterial=new C.Material({fabric:{type:'AtlasLunarSurface',uniforms:{image:C.Material.DefaultImageId,shadowEnabled:1},source:`
   czm_material czm_getMaterial(czm_materialInput inputData){
    czm_material material=czm_getDefaultMaterial(inputData);
    vec3 surface=texture(image,inputData.st).rgb;
    float sunlight=dot(normalize(inputData.normalEC),normalize(czm_sunDirectionEC));
    float daylight=pow(max(sunlight,0.0),0.55)*smoothstep(0.0,0.012,sunlight);
    material.diffuse=surface*mix(1.0,daylight,shadowEnabled);
    material.alpha=1.0;
    return material;
   }`},translucent:false});
  const namesMaterial=new C.Material({fabric:{type:'AtlasLunarNames',uniforms:{image:C.Material.DefaultImageId,namesEnabled:0,cartographicDetail:0,shadowEnabled:1},source:`
   czm_material czm_getMaterial(czm_materialInput inputData){
    czm_material material=czm_getDefaultMaterial(inputData);
    vec3 lettering=texture(image,inputData.st).rgb;
    float marking=max(lettering.r,max(lettering.g*step(1.0,cartographicDetail),lettering.b*step(2.0,cartographicDetail)))*namesEnabled;
    if(marking<0.03)discard;
    vec3 ink=mix(vec3(0.025),vec3(0.94,0.94,0.91),smoothstep(0.4,0.9,marking));
    float sunlight=dot(normalize(inputData.normalEC),normalize(czm_sunDirectionEC));
    float daylight=pow(max(sunlight,0.0),0.55)*smoothstep(0.0,0.012,sunlight);
    material.diffuse=ink*mix(1.0,daylight,shadowEnabled);
    material.alpha=smoothstep(0.03,0.24,marking);
    return material;
   }`},translucent:true});
  let namesPrimitive=null;
  function setShadows(value){lunarMaterial.uniforms.shadowEnabled=value?1:0;namesMaterial.uniforms.shadowEnabled=value?1:0;viewer.scene.requestRender();}
  // A triangulated surface stays stable across near/far frusta while orbiting the Moon.
  const moon=viewer.scene.primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({id:'atlas-moon',geometry:new C.EllipsoidGeometry({radii:C.Ellipsoid.MOON.radii,vertexFormat:C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,stackPartitions:navigateMoon?24:96,slicePartitions:navigateMoon?48:192})}),appearance:new C.MaterialAppearance({material:lunarMaterial,translucent:false,closed:true,flat:true}),asynchronous:false}));
  let active=false,realistic=false,now=Date.now(),center=null,orbitAt=null,phases=null,phaseAt=null,lastPanel=0,showNames=false,namesReady=false,namesRequest=null,pointer=null,lastData=null,travelling=false,drag=null;
  const axes=new C.IauOrientationAxes();
  const cameraControls=viewer.scene.screenSpaceCameraController;let savedInputs=true;
  function rotateCamera(dx,dy){
   if(!active)return false;
   const p=viewer.camera.position,radius=C.Cartesian3.magnitude(p),distance=Math.max(R+20000,Math.min(maximumRange,radius));
   if(!Number.isFinite(radius)||radius<1||!Number.isFinite(distance)||!Number.isFinite(dx)||!Number.isFinite(dy))return false;
   const longitude=Math.atan2(p.y,p.x)-dx*.005;
   const latitude=Math.max(-Math.PI/2+.025,Math.min(Math.PI/2-.025,Math.asin(Math.max(-1,Math.min(1,p.z/radius)))+dy*.005));
   const horizontal=distance*Math.cos(latitude);
   viewer.camera.lookAtTransform(C.Matrix4.fromTranslation(center),new C.Cartesian3(horizontal*Math.cos(longitude),horizontal*Math.sin(longitude),distance*Math.sin(latitude)));
   viewer.scene.requestRender();return true;
  }
  viewer.canvas.addEventListener('pointerdown',event=>{
   if(!active||event.button!==0||travelling)return;
   drag={id:event.pointerId,x:event.clientX,y:event.clientY};viewer.camera.cancelFlight();viewer.canvas.setPointerCapture?.(event.pointerId);event.preventDefault();
  });
  viewer.canvas.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id||!active)return;
   rotateCamera(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;hover.hidden=true;jump.hidden=true;
  });
  function endDrag(event){if(drag&&event.pointerId===drag.id){drag=null;if(viewer.canvas.hasPointerCapture?.(event.pointerId))viewer.canvas.releasePointerCapture(event.pointerId);}}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewer.canvas.addEventListener(type,endDrag);
  const labels=viewer.scene.primitives.add(new C.LabelCollection());
  const title=labels.add({id:'atlas-moon',text:'Lune',font:'13px Arial, sans-serif',fillColor:C.Color.fromCssColorString('#d3c6ff'),outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(12,-12),disableDepthTestDistance:Infinity,show:false});
  const lineCollection=viewer.scene.primitives.add(new C.PolylineCollection());
  const orbitMaterial=C.Material.fromType('Color',{color:C.Color.fromCssColorString('#79bce5').withAlpha(.8)});
  const orbit=lineCollection.add({positions:[],width:1.3,material:orbitMaterial,show:false});
  const card=document.createElement('aside');card.id='lunar-detail';card.hidden=true;card.setAttribute('aria-label','Fiche de la Lune');
  card.innerHTML='<header><div><small>SATELLITE NATUREL</small><h2>Lune</h2></div><button type="button" class="lunar-close" aria-label="Fermer la fiche de la Lune"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button></header><p>Satellite naturel de la Terre</p><dl><div><dt>Distance Terre–Lune</dt><dd data-lunar="distance"></dd></div><div><dt>Phase</dt><dd data-lunar="phase"></dd></div><div><dt>Surface éclairée</dt><dd data-lunar="illumination"></dd></div><div><dt>Prochaine pleine lune</dt><dd data-lunar="full"></dd></div><div><dt>Prochaine nouvelle lune</dt><dd data-lunar="new"></dd></div></dl><label class="lunar-orbit"><input type="checkbox"> Afficher l’orbite de la Lune</label><button type="button" class="lunar-travel">Explorer la Lune en 3D</button><button type="button" class="lunar-earth" hidden>Revenir à la Terre</button><p class="lunar-note">Distance entre les centres à la date consultée. Horaires des phases estimés, en heure locale.</p><p class="lunar-credit"><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener">NASA LRO</a> · <a href="https://planetarynames.wr.usgs.gov/Page/MOON/target" target="_blank" rel="noopener">Noms UAI / USGS</a></p>';
  const view=viewer.container.closest('.view');view.append(card);
  const jump=document.createElement('button');jump.id='lunar-jump';jump.type='button';jump.hidden=true;view.append(jump);
  let jumpTarget=null;
  const hover=document.createElement('div');hover.id='celestial-hover';hover.hidden=true;view.append(hover);
  const callout=document.createElement('div');callout.id='celestial-callout';callout.append(hover,jump);view.append(callout);
  hover.setAttribute('role','tooltip');
  let calloutHideTimer=null;
  function keepCallout(){if(calloutHideTimer!==null){clearTimeout(calloutHideTimer);calloutHideTimer=null;}}
  function dismissMoonCallout(){
   if(active||calloutHideTimer!==null)return;
   calloutHideTimer=setTimeout(()=>{calloutHideTimer=null;hover.hidden=true;jump.hidden=true;title.show=false;viewer.scene.requestRender();},180);
  }
  callout.addEventListener('pointerenter',keepCallout);
  callout.addEventListener('pointerleave',dismissMoonCallout);

  function hoverBody(target){
   const distance=(lastData?.distance||0).toLocaleString('fr-FR',{maximumFractionDigits:0});
   hover.textContent=(target==='earth'?'Terre':'Lune')+' · '+distance+' km';hover.hidden=false;
   offer(target);
  }
  function placeJump(){
   if(jump.hidden&&hover.hidden)return;
   const world=jumpTarget==='earth'?C.Cartesian3.ZERO:center;
   const xy=world&&C.SceneTransforms.worldToWindowCoordinates(viewer.scene,world);if(!xy){jump.hidden=true;hover.hidden=true;return;}
   const width=callout.offsetWidth||220,height=callout.offsetHeight||90;
   const topLimit=Math.max(12,(document.querySelector('body>header')?.getBoundingClientRect().bottom||80)+12);
   callout.style.left=Math.max(12,Math.min(viewer.canvas.clientWidth-width-12,xy.x+22))+'px';
   callout.style.top=Math.max(topLimit,Math.min(viewer.canvas.clientHeight-height-12,xy.y-42))+'px';
  }
  function offer(target){keepCallout();jumpTarget=target;jump.textContent=target==='earth'?'Aller vers la Terre':'Aller vers la Lune';jump.hidden=false;placeJump();viewer.scene.requestRender();}
  jump.onclick=()=>{jump.hidden=true;if(jumpTarget==='earth')returnEarth();else if(navigateMoon)navigateMoon();else travel();};
  const controls=document.createElement('div');controls.id='lunar-controls';controls.dataset.active='false';
  controls.innerHTML='<button type="button" id="lunar-destination">Aller vers la Lune</button><label class="lunar-names" hidden><input type="checkbox"> Afficher les noms des cratères et régions lunaires</label>';
  (document.querySelector('.globe-tools')||viewer.container).append(controls);
  const destination=controls.querySelector('button'),names=controls.querySelector('label');
  destination.hidden=Boolean(window.AtlasSatelliteVisibility?.hasSelection);
  const orbitControl=card.querySelector('.lunar-orbit');orbitControl.hidden=true;controls.append(orbitControl);
  function syncNames(){
   const input=names.querySelector('input');input.checked=showNames;input.disabled=false;
   names.title='Afficher les noms des cratères et régions sur la surface lunaire';
   names.style.opacity='';
   namesMaterial.uniforms.namesEnabled=active&&showNames&&namesReady?1:0;if(namesPrimitive)namesPrimitive.show=!!namesMaterial.uniforms.namesEnabled;
  }
  syncNames();
  names.querySelector('input').onchange=e=>{showNames=e.target.checked;syncNames();if(showNames)loadNames();viewer.scene.requestRender();};
  function syncControls(){destination.hidden=!active&&Boolean(window.AtlasSatelliteVisibility?.hasSelection);syncNames();controls.dataset.active=String(active);destination.textContent=active?'Retour à la Terre':'Aller vers la Lune';names.hidden=!active;orbitControl.hidden=!active||!allowOrbit;}
  destination.onclick=()=>{if(active)returnEarth();else if(navigateMoon)navigateMoon();else travel();};
  const field=k=>card.querySelector('[data-lunar="'+k+'"]');
  const dateFormatter=new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'});
  const date=ms=>dateFormatter.format(new Date(ms));
  function fill(){
   const data=lastData||math.sample(C,now);
   if(!phases||now<phaseAt||Math.abs(now-phaseAt)>86400000||now>=Math.min(phases.full,phases.new)){phases={full:math.nextPhase(C,now,Math.PI),new:math.nextPhase(C,now,0)};phaseAt=now;}
   field('distance').textContent=Math.round(data.distance).toLocaleString('fr-FR')+' km';field('phase').textContent=data.phase;field('illumination').textContent=(data.illumination*100).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %';field('full').textContent=date(phases.full);field('new').textContent=date(phases.new);
  }
  function open(){if(active){card.hidden=false;fill();}else offer('moon');}
  card.querySelector('.lunar-close').onclick=()=>{card.hidden=true;};
  orbitControl.querySelector('input').onchange=e=>{orbit.show=allowOrbit&&e.target.checked;e.target.checked=orbit.show;if(orbit.show)update(now);viewer.scene.requestRender();};
  function leave(){hover.hidden=true;jump.hidden=true;card.hidden=true;if(active){active=false;drag=null;cameraControls.enableInputs=savedInputs;onViewChange(false);viewer.camera.cancelFlight();viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);viewer.scene.screenSpaceCameraController.enableCollisionDetection=true;}card.querySelector('.lunar-earth').hidden=true;card.querySelector('.lunar-travel').hidden=false;syncControls();}
  card.querySelector('.lunar-earth').onclick=returnEarth;
  function rendered(){return new Promise((resolve,reject)=>{
   let frames=0,finished=false,timer,stopFrame=()=>{},stopError=()=>{};
   const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);stopFrame();stopError();error?reject(error):resolve();};
   stopFrame=viewer.scene.postRender.addEventListener(()=>{if(++frames>=2&&moon.ready!==false)finish();else viewer.scene.requestRender();});
   stopError=viewer.scene.renderError.addEventListener((scene,error)=>finish(error||Error('Le rendu lunaire est indisponible.')));
   timer=setTimeout(()=>finish(Error('Le rendu lunaire n’a pas pu se terminer.')),20000);viewer.scene.requestRender();
  });}
  async function returnEarth(){
   if(navigateEarth){navigateEarth();return;}
   if(travelling)return;travelling=true;const progress=globalThis.AtlasLoading?.begin('Retour à la Terre · chargement des satellites…',{positions:70,scene:30});
   try{leave();await onEarth();await rendered();progress?.done('scene');}
   catch(error){progress?.fail();console.warn(error.message);}finally{travelling=false;}
  }
  function recenter(){if(!active||!center)return;drag=null;
   const distance=R/Math.sin(viewer.camera.frustum.fovy*.32);
   const outward=C.Cartesian3.normalize(center,new C.Cartesian3());
   const side=C.Cartesian3.normalize(C.Cartesian3.cross(outward,C.Cartesian3.UNIT_Z,new C.Cartesian3()),new C.Cartesian3());
   C.Cartesian3.add(outward,C.Cartesian3.multiplyByScalar(side,0.38,side),outward);C.Cartesian3.normalize(outward,outward);
   const offset=C.Cartesian3.multiplyByScalar(outward,distance,new C.Cartesian3());
   viewer.camera.cancelFlight();viewer.camera.lookAtTransform(C.Matrix4.fromTranslation(center),offset);viewer.scene.requestRender();
  }
  async function travel(){
   if(!center||travelling)return;travelling=true;
   const progress=globalThis.AtlasLoading?.begin('Voyage vers la Lune · chargement du relief…',{textures:65,scene:35});
   try{
   beforeTravel();viewer.camera.cancelFlight();savedInputs=cameraControls.enableInputs!==false;active=true;cameraControls.enableInputs=false;onViewChange(true);jump.hidden=true;card.hidden=true;
   await Promise.all([setRealistic(realistic),showNames?loadNames():Promise.resolve()]);progress?.done('textures');fill();
   recenter();update(now);
   card.querySelector('.lunar-earth').hidden=false;card.querySelector('.lunar-travel').hidden=true;syncControls();viewer.scene.requestRender();await rendered();card.hidden=false;progress?.done('scene');
   }catch(error){progress?.fail();const notice=document.getElementById('notice');if(notice)notice.textContent='Lune indisponible : '+error.message;leave();Promise.resolve(onEarth()).catch(console.warn);}finally{travelling=false;}
  }
  card.querySelector('.lunar-travel').onclick=()=>navigateMoon?navigateMoon():travel();
  const credit=new C.Credit('Lune : NASA LRO / SVS · noms UAI / USGS',true);viewer.creditDisplay.addStaticCredit(credit);
  const images=new Map();let textureRevision=0;
  async function setRealistic(value){
   realistic=!!value;syncNames();const revision=++textureRevision;
   const image=realistic&&active?'/images/moon/lroc-4k.webp':'/images/moon/map-4k.webp';
   if(!images.has(image))images.set(image,new Promise((resolve,reject)=>{const bitmap=new Image();bitmap.onload=()=>resolve(bitmap);bitmap.onerror=()=>{images.delete(image);reject(Error('La texture lunaire est indisponible.'));};bitmap.src=image;}));
   const bitmap=await images.get(image);if(revision!==textureRevision)return;
   lunarMaterial.uniforms.image=bitmap;if(active&&showNames)await loadNames();viewer.scene.requestRender();
  }
  setRealistic(false).catch(error=>console.warn(error.message));
  function loadNames(){
   if(namesRequest)return namesRequest;
   namesRequest=Promise.all([
    fetch('/images/moon/map-names.json?v=503ea3159168').then(r=>{if(!r.ok)throw Error('Géométrie des noms lunaires indisponible.');return r.json();}),
    new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('La carte des noms lunaires est indisponible.'));image.src='/images/moon/map-names.webp?v=acea13ff9c7c';})
   ]).then(([map,image])=>{
    namesMaterial.uniforms.image=image;
    namesPrimitive=viewer.scene.primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry:window.AtlasMoon.mapGeometry(C,map,R+150)}),appearance:new C.MaterialAppearance({material:namesMaterial,translucent:true,closed:false,flat:true,faceForward:false}),asynchronous:false,compressVertices:false,allowPicking:false,show:false}));
    namesPrimitive.modelMatrix=C.Matrix4.clone(moon.modelMatrix);
    namesReady=true;syncNames();viewer.scene.requestRender();
   }).catch(error=>{namesRequest=null;console.warn(error.message);});return namesRequest;
  }
  function update(ms){
   now=ms;const data=lastData=math.sample(C,now);center=math.fixed(C,data.time,data.moon);title.position=center;title.text='Lune · '+Math.round(data.distance).toLocaleString('fr-FR')+' km';
   const rotation=C.Transforms.computeIcrfToFixedMatrix(data.time)||C.Transforms.computeTemeToPseudoFixedMatrix(data.time);
   if(orbit.show&&(orbitAt===null||Math.abs(now-orbitAt)>21600000)){
    const points=[];for(let i=0;i<=180;i++){const time=C.JulianDate.fromDate(new Date(now+(i/180-.5)*27.321661*86400000));const p=C.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(time);points.push(C.Matrix3.multiplyByVector(rotation,p,new C.Cartesian3()));}
    orbit.positions=points;lineCollection.modelMatrix=C.Matrix4.clone(C.Matrix4.IDENTITY);orbitAt=now;
   }else if(orbit.show&&orbitAt!==now){
    // Move the inertial orbital plane with Earth's rotation between full resamples.
    const oldTime=C.JulianDate.fromDate(new Date(orbitAt));const old=C.Transforms.computeIcrfToFixedMatrix(oldTime)||C.Transforms.computeTemeToPseudoFixedMatrix(oldTime);
    lineCollection.modelMatrix=C.Matrix4.fromRotationTranslation(C.Matrix3.multiply(rotation,C.Matrix3.transpose(old,new C.Matrix3()),new C.Matrix3()));
   }
   if(active){
    const camera=viewer.camera,p=C.Cartesian3.clone(camera.position),d=C.Cartesian3.clone(camera.direction),u=C.Cartesian3.clone(camera.up);
    camera.lookAtTransform(C.Matrix4.fromTranslation(center));C.Cartesian3.clone(p,camera.position);C.Cartesian3.clone(d,camera.direction);C.Cartesian3.clone(u,camera.up);C.Cartesian3.cross(d,u,camera.right);
   }
   const body=C.Matrix3.multiply(rotation,C.Matrix3.transpose(axes.evaluate(data.time),new C.Matrix3()),new C.Matrix3());
   moon.modelMatrix=C.Matrix4.fromRotationTranslation(body,center);if(namesPrimitive)namesPrimitive.modelMatrix=moon.modelMatrix;
   if(!card.hidden&&Math.abs(now-lastPanel)>1000){fill();lastPanel=now;}
  }
  function projected(){return center&&C.SceneTransforms.worldToWindowCoordinates(viewer.scene,center);}
  viewer.canvas.addEventListener('pointermove',event=>{
   const rect=viewer.canvas.getBoundingClientRect();pointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
   if(drag)return;
   const overMoon=!active&&center&&nearMoon(pointer)&&visible(),overEarth=active&&!!viewer.camera.pickEllipsoid(new C.Cartesian2(pointer.x,pointer.y),viewer.scene.globe.ellipsoid);
   if(overMoon||overEarth)hoverBody(overEarth?'earth':'moon');else if(!active)dismissMoonCallout();else hover.hidden=true;
   viewer.scene.requestRender();
  },{passive:true});
  viewer.canvas.addEventListener('pointerleave',event=>{if(event.relatedTarget&&callout.contains(event.relatedTarget))return;pointer=null;if(!active)dismissMoonCallout();else hover.hidden=true;title.show=false;viewer.scene.requestRender();},{passive:true});
  function visible(){const to=C.Cartesian3.subtract(center,viewer.camera.positionWC,new C.Cartesian3());return C.Cartesian3.dot(to,viewer.camera.directionWC)>0&&new C.EllipsoidalOccluder(viewer.scene.globe.ellipsoid,viewer.camera.positionWC).isPointVisible(center);}
  function nearMoon(point){
   const xy=projected();if(!xy)return false;
   const distance=C.Cartesian3.distance(center,viewer.camera.positionWC),radius=R/Math.max(R,distance)*viewer.canvas.clientHeight/(2*Math.tan(viewer.camera.frustum.fovy/2));
   return Math.hypot(xy.x-point.x,xy.y-point.y)<Math.max(18,radius+12);
  }
  viewer.scene.preRender.addEventListener(()=>{
   if(!center)return;
   placeJump();
   title.show=false;
   if(active&&showNames&&namesReady){
    const distance=C.Cartesian3.distance(viewer.camera.positionWC,center);
    const diameter=R*viewer.canvas.clientHeight/(Math.max(20000,distance-R)*Math.tan(viewer.camera.frustum.fovy/2));
    namesMaterial.uniforms.namesEnabled=diameter>=480?1:0;namesPrimitive.show=!!namesMaterial.uniforms.namesEnabled;
    namesMaterial.uniforms.cartographicDetail=diameter>=2400?2:diameter>=1150?1:0;
   }else{namesMaterial.uniforms.namesEnabled=0;if(namesPrimitive)namesPrimitive.show=false;}
  });
  function hit(click){
   if(!center)return false;
   const pick=viewer.scene.pick(click);if(pick?.id==='atlas-moon')return true;
   const ray=viewer.camera.getPickRay(click),sphere=new C.BoundingSphere(center,R),interval=C.IntersectionTests.raySphere(ray,sphere);if(interval){const earth=C.IntersectionTests.rayEllipsoid(ray,viewer.scene.globe.ellipsoid);if(!earth||earth.start>interval.start)return true;}
   return !active&&nearMoon(click)&&visible();
  }
  return {get active(){return active;},orbit:rotateCamera,recenter,enter:travel,returnEarth,update,open,hit,setRealistic,setShadows,leave,offerEarth(){if(active)offer('earth');},close(){card.hidden=true;jump.hidden=true;hover.hidden=true;},zoom(direction,strength=1){if(!active)return false;const p=viewer.camera.position,r=C.Cartesian3.magnitude(p),next=Math.max(R+20000,Math.min(maximumRange,r*Math.pow(1.35,-direction*Math.min(2,strength))));C.Cartesian3.multiplyByScalar(p,next/r,p);viewer.scene.requestRender();return true;}};
 }
};
