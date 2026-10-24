/* Lunar document: no satellite catalogue, worker, positions, station data or model layers. */
(async()=>{
 const $=id=>document.getElementById(id),base=new URL('./',document.currentScript.src);
 let state=AtlasJourney.read()||{at:Date.now(),live:true,playing:true,speed:'1',realistic:false,sky:false},viewer,moon;
 state={...state,...AtlasJourney.preferences()};
 let at=state.live?Date.now():state.at,live=state.live,playing=state.playing,lastTick=performance.now(),viewReady=false;
 $('speed').value=state.speed;AtlasJourney.bind(()=>({...state,at,live,playing,speed:$('speed').value,realistic:viewReady?$('earth-realistic-toggle').getAttribute('aria-checked')==='true':state.realistic,sky:viewReady?$('sky-toggle').getAttribute('aria-checked')==='true':state.sky}));
 function returnEarth(event){event?.preventDefault();AtlasJourney.goEarth();}
 $('return-earth').onclick=returnEarth;$('earth-home').onclick=returnEarth;
 window.AtlasTimeline={get time(){return at;},get live(){return live;}};
 let publishedTime=null;
 function clock(){
  const d=$('date');if(document.activeElement!==d)d.value=AtlasTime.input(at);d.max=AtlasTime.input(Date.now());
  $('clock').textContent=AtlasTime.instant(at);$('clock').dateTime=new Date(at).toISOString();$('time-zone').textContent=AtlasTime.environment().timeZone+' · '+AtlasTime.zoneLabel(at);
  $('play').textContent=playing?'Pause':'Lecture';$('now').disabled=live;
  const key=Math.floor(at/60000)+'|'+live;if(key!==publishedTime){publishedTime=key;window.dispatchEvent(new CustomEvent('atlas:time',{detail:{at,live}}));}
 }
 function update(){if(!viewer)return;viewer.clock.currentTime=Cesium.JulianDate.fromDate(new Date(at));moon?.update(at);viewer.scene.requestRender();}
 $('date').onchange=()=>{const t=AtlasTime.parseInput($('date').value).time;if(!Number.isFinite(t)||t>Date.now()){clock();return;}at=t;live=false;playing=false;clock();update();};
 $('now').onclick=()=>{at=Date.now();live=true;playing=true;$('speed').value='1';clock();update();};
 $('play').onclick=()=>{playing=!playing;if(!playing)live=false;lastTick=performance.now();clock();};
 $('speed').onchange=()=>{if(live&&$('speed').value!=='1')live=false;};clock();
 try{
  window.CESIUM_BASE_URL=new URL('vendor/cesium/',base).href;
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/cesium/Cesium.js',base);script.onload=resolve;script.onerror=()=>reject(Error('Le moteur 3D ne peut pas être chargé.'));document.head.append(script);});
  await AtlasMoon.load();const C=window.Cesium;
  viewer=new C.Viewer($('globe-canvas'),{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,skyAtmosphere:false,shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity});
  document.addEventListener('visibilitychange',()=>{viewer.useDefaultRenderLoop=!document.hidden;if(!document.hidden)viewer.scene.requestRender();});
  viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.scene.screenSpaceCameraController.enableCollisionDetection=false;
  viewer.scene.backgroundColor=C.Color.BLACK;if(viewer.scene.moon)viewer.scene.moon.show=false;if(viewer.scene.sun)viewer.scene.sun.show=false;
  viewer.scene.light=new C.SunLight({intensity:1});viewer.scene.globe.showGroundAtmosphere=false;viewer.scene.fog.enabled=false;
  viewer.scene.globe.lightingFadeOutDistance=0;viewer.scene.globe.lightingFadeInDistance=1;viewer.scene.globe.maximumScreenSpaceError=3;viewer.scene.globe.tileCacheSize=48;
  viewer.clock.shouldAnimate=false;viewer.clock.currentTime=C.JulianDate.fromDate(new Date(at));
  const imagery=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:state.tile_url||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',credit:new C.Credit(state.tile_attribution||'© OpenStreetMap contributors · ODbL',true),maximumLevel:18}));imagery.brightness=.68;imagery.saturation=.45;
  const earth=AtlasEarth.create({viewer,imagery,C,onChange:s=>{$('earth-realistic-toggle').setAttribute('aria-checked',String(s.enabled));$('earth-realistic-toggle').setAttribute('aria-busy',String(s.loading));$('earth-style-status').textContent=s.error||'';$('earth-style-status').hidden=!s.error;}}),sky=AtlasSky.create(viewer,C);
  viewer.scene.renderError.addEventListener((scene,error)=>{AtlasLoading.fail();$('notice').textContent='Rendu indisponible : '+(error?.message||error);});
  moon=AtlasMoon.create({viewer,C,beforeTravel(){},onEarth(){},navigateEarth:()=>AtlasJourney.goEarth(),onViewChange:value=>earth.setLunarView(value)});moon.update(at);
  $('earth-realistic-toggle').onclick=async()=>{const enabled=$('earth-realistic-toggle').getAttribute('aria-checked')!=='true';await earth.setEnabled(enabled);await moon.setRealistic(earth.enabled);};
  $('sky-toggle').onclick=async()=>{const enabled=$('sky-toggle').getAttribute('aria-checked')!=='true';try{await sky.setEnabled(enabled);$('sky-toggle').setAttribute('aria-checked',String(enabled));}catch(error){$('notice').textContent=error.message;}};
  window.AtlasRestoreDisplay=async value=>{await earth.setEnabled(value.realistic);await moon.setRealistic(earth.enabled);if($('sky-toggle').getAttribute('aria-checked')!==String(value.sky))await $('sky-toggle').onclick();};await window.AtlasRestoreDisplay(state);window.AtlasDisplayReady=true;
  $('lunar-shadows-toggle').onclick=()=>{const enabled=$('lunar-shadows-toggle').getAttribute('aria-checked')!=='true';moon.setShadows(enabled);$('lunar-shadows-toggle').setAttribute('aria-checked',String(enabled));};
  $('lunar-recenter').onclick=()=>moon.recenter();$('lunar-plus').onclick=()=>moon.zoom(1);$('lunar-minus').onclick=()=>moon.zoom(-1);
  viewer.canvas.addEventListener('wheel',event=>{event.preventDefault();const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewer.canvas.clientHeight:1);if(pixels)moon.zoom(pixels<0?1:-1,Math.abs(pixels)/100);},{passive:false});
  viewer.canvas.tabIndex=0;viewer.canvas.addEventListener('keydown',event=>{const step={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[event.key];if(step){event.preventDefault();moon.orbit(...step);}});
  viewer.screenSpaceEventHandler.setInputAction(e=>{if(viewer.camera.pickEllipsoid(e.position,viewer.scene.globe.ellipsoid))moon.offerEarth();else if(moon.hit(e.position))moon.open();else moon.close();},C.ScreenSpaceEventType.LEFT_CLICK);
  await moon.enter();viewReady=true;
  setInterval(()=>{if(document.hidden)return;const tick=performance.now(),dt=tick-lastTick;lastTick=tick;if(live)at=Date.now();else if(playing){at=Math.min(Date.now(),at+dt*Number($('speed').value));}clock();if(!document.hidden&&playing)update();},250);
 }catch(error){AtlasLoading.fail();$('notice').textContent='Lune indisponible : '+error.message;}
})();
