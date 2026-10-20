'use strict';
/* Cesium stays lazy and local. No access token, terrain service, or geolocation. */
window.AtlasGlobe={
  compassAngle(north,right,up){
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    const x=dot(north,right),y=dot(north,up);
    return Math.hypot(x,y)<1e-8?null:Math.atan2(x,y);
  },
  followTarget(data){
    if(!data)return null;
    if(data.selected!==null)return data.points.find(p=>p.id===data.selected)||null;
    const available=new Map(data.points.map(p=>[p.id,p]));let fallback=null,unknown=null;
    for(const satellite of data.catalog.values()){
      const point=available.get(satellite.id);if(!point||!data.visible(satellite,satellite.id))continue;
      fallback ||= point;
      if(['+','P','X'].includes(satellite.ops))return point;
      if(!['-','D','B','S'].includes(satellite.ops))unknown ||= point;
    }
    return unknown||fallback;
  },
  idleController({now,canStart,start,stop,delay=10000}){
    let last=now(),active=false;
    return {get active(){return active;},activity(){last=now();},cancel(){last=now();if(!active)return false;active=false;stop();return true;},tick(){if(!active&&now()-last>=delay&&canStart()){active=true;start();}}};
  },
  lighting(){
    // Keep the day/night contrast identical at every camera distance.
    return {shadow:.35,fadeOut:0,fadeIn:1};
  },
  modelZoomRange(range,direction,strength=1,radius=50){
    const minimum=Math.max(2,radius*1.5),factor=range>radius*12?4:1.8;
    return Math.max(minimum,Math.min(4e9,range*Math.pow(factor,-direction*Math.min(2,Math.max(.01,strength)))));
  },
  overviewZoomHeight(height,direction,strength=1){
    const current=Math.max(150000,height);
    const t=Math.min(1,Math.max(0,Math.log(current/150000)/Math.log(20000000/150000)));
    const factor=1.12+.78*t*t*(3-2*t);
    return Math.max(150000,Math.min(4e9,current*Math.pow(factor,-direction*Math.min(2,Math.max(.001,strength)))));
  },
  detailedRange(radius,width,height,fovy=Math.PI/3){
    const halfAngle=Math.atan(.62*Math.tan(fovy/2)*Math.min(1,Math.max(.15,width/height)));
    return Math.max(2,Math.max(1,radius)/Math.sin(halfAngle));
  },
  satelliteRange(altitudeKm,width,height,fovy=Math.PI/3){
    const altitude=Math.max(0,altitudeKm)*1000;
    if(altitude<=6378137)return 3500000;
    const halfAngle=Math.atan(.74*Math.tan(fovy/2)*Math.min(1,Math.max(.1,width/height)));
    // A sphere centred on the target enclosing the entire Earth stays inside both view angles.
    return Math.max(3500000,(altitude+2*6378137)/Math.sin(halfAngle));
  },
  loading:null,
  load(){
    if(this.loading)return this.loading;
    window.CESIUM_BASE_URL='/vendor/cesium/';
    const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/cesium/Widgets/widgets.css';document.head.append(css);
    this.loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/cesium/Cesium.js';script.onload=resolve;script.onerror=()=>reject(new Error('Le moteur 3D local ne peut pas être chargé.'));document.head.append(script);});return this.loading;
  },
  async create(container,config,onSelect,onEmptySpace){
    await this.load();const C=window.Cesium;
    const viewer=new C.Viewer(container,{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,skyAtmosphere:false,shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,contextOptions:{webgl:{alpha:false,antialias:true}}});
    viewer.camera.constrainedAxis=C.Cartesian3.UNIT_Z;
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#000000');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#1d3443');
    viewer.scene.globe.preloadSiblings=false;viewer.scene.globe.preloadAncestors=false;viewer.scene.globe.tileCacheSize=100;viewer.scene.globe.maximumScreenSpaceError=3;
    if(viewer.scene.sun)viewer.scene.sun.show=false;viewer.scene.sunBloom=false;if(viewer.scene.moon)viewer.scene.moon.show=false;viewer.clock.shouldAnimate=false;
    const skyToggle=document.getElementById('sky-toggle');
    const skyCredit=new C.Credit('Ciel : NASA/Goddard SVS · Hipparcos, Tycho, Gaia',true);
    if(skyToggle)skyToggle.onclick=()=>{
      const enabled=skyToggle.getAttribute('aria-checked')!=='true';
      if(enabled&&!viewer.scene.skyBox){
        const sources={};
        for(const face of ['positiveX','negativeX','positiveY','negativeY','positiveZ','negativeZ'])
          sources[face]='/images/sky/nasa-2020-clean-v4-'+face+'.webp';
        viewer.scene.skyBox=new C.SkyBox({sources});
      }
      if(enabled&&!viewer.scene.sun){viewer.scene.sun=new C.Sun();viewer.scene.sun.glowFactor=1.1;}
      if(viewer.scene.skyBox)viewer.scene.skyBox.show=enabled;
      if(viewer.scene.sun)viewer.scene.sun.show=enabled;
      // Keep the halo local to the Sun, without brightening the whole scene.
      viewer.scene.sunBloom=false;
      skyToggle.setAttribute('aria-checked',String(enabled));
      if(enabled)viewer.creditDisplay.addStaticCredit(skyCredit);
      else viewer.creditDisplay.removeStaticCredit(skyCredit);
      viewer.scene.requestRender();
    };
    const imagery=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:config.tile_url,credit:new C.Credit(config.tile_attribution,true),maximumLevel:18}));imagery.brightness=.68;imagery.contrast=1.05;imagery.saturation=.45;
    const lighting=this.lighting();
    viewer.scene.light=new C.SunLight({intensity:1});
    viewer.scene.globe.showGroundAtmosphere=false;viewer.scene.fog.enabled=false;
    viewer.scene.globe.vertexShadowDarkness=lighting.shadow;
    viewer.scene.globe.lightingFadeOutDistance=lighting.fadeOut;viewer.scene.globe.lightingFadeInDistance=lighting.fadeIn;
    viewer.scene.globe.lambertDiffuseMultiplier=.65;
    viewer.scene.postProcessStages.fxaa.enabled=true;
    const earthLayer=AtlasEarth.create({viewer,imagery,C,onChange:state=>{
      const button=document.getElementById('earth-realistic-toggle'),hint=document.getElementById('earth-style-status');
      button.setAttribute('aria-checked',String(state.enabled));button.setAttribute('aria-busy',String(state.loading));
      hint.textContent=state.loading?'Chargement…':state.error||'';hint.hidden=!hint.textContent;
    }});
    const controls=viewer.scene.screenSpaceCameraController;
    controls.inertiaSpin=.72;controls.inertiaTranslate=.72;controls.inertiaZoom=.65;controls.zoomFactor=2;controls.maximumMovementRatio=.08;controls.minimumZoomDistance=150000;controls.maximumZoomDistance=4000000000;
    // Native surface-anchored rotation: the grabbed ground point follows the pointer.
    controls.enableRotate=true;
    let globeDrag=null,pendingX=0,pendingY=0;
    viewer.canvas.style.touchAction='none';
    viewer.scene.preUpdate.addEventListener(()=>{
      const height=Math.max(150000,viewer.camera.positionCartographic.height);
      controls.zoomFactor=.9+1.5*Math.min(1,Math.max(0,Math.log10(height/150000)/2));
    });
    const stick=document.getElementById('globe-stick'),joystick=document.getElementById('globe-joystick');
    let joyX=0,joyY=0,joyPointer=null,joyTime=performance.now();
    const stopJoystick=()=>{joyX=0;joyY=0;joyPointer=null;stick.style.transform='';};
    const rotateJoystick=(x,y,degrees)=>{
      idleController?.cancel();viewer.camera.cancelFlight();
      if(controls.enableRotate)viewer.camera.rotateLeft(C.Math.toRadians(-x*degrees));
      else viewer.camera.twistRight(C.Math.toRadians(x*degrees));
      viewer.camera.rotateUp(C.Math.toRadians(y*degrees*.5));viewer.scene.requestRender();
    };
    viewer.scene.preUpdate.addEventListener(()=>{
      const now=performance.now(),dt=Math.min(.05,(now-joyTime)/1000);joyTime=now;
      if(active&&(joyX||joyY))rotateJoystick(joyX,joyY,dt*30);
    });
    const startJoystick=(event,x,y)=>{
      if(event.button!==0)return;event.preventDefault();pendingX=0;pendingY=0;
      joyPointer=event.pointerId;joyX=x;joyY=y;joyTime=performance.now();
      event.currentTarget.setPointerCapture(event.pointerId);viewer.scene.requestRender();
    };
    joystick.querySelectorAll('[data-x]').forEach(button=>{
      const x=Number(button.dataset.x),y=Number(button.dataset.y);
      button.addEventListener('pointerdown',event=>startJoystick(event,x,y));
      button.addEventListener('click',()=>rotateJoystick(x,y,3));
    });
    const moveStick=event=>{
      const box=joystick.getBoundingClientRect(),x=event.clientX-box.left-box.width/2,y=event.clientY-box.top-box.height/2;
      const length=Math.hypot(x,y),scale=length>20?20/length:1;
      joyX=x*scale/20;joyY=y*scale/20;
      stick.style.transform=`translate(${joyX*18}px,${joyY*18}px)`;viewer.scene.requestRender();
    };
    stick.addEventListener('pointerdown',event=>{startJoystick(event,0,0);if(joyPointer===event.pointerId)moveStick(event);});
    stick.addEventListener('pointermove',event=>{if(joyPointer===event.pointerId)moveStick(event);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>joystick.addEventListener(type,stopJoystick));
    window.addEventListener('blur',stopJoystick);
    stick.addEventListener('keydown',event=>{
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if(directions[event.key]){event.preventDefault();rotateJoystick(...directions[event.key],3);}
    });
    viewer.targetFrameRate=60;viewer.useBrowserRecommendedResolution=false;
    viewer.resolutionScale=Math.min(1,2/(window.devicePixelRatio||1));
    const satellites=viewer.scene.primitives.add(new C.PointPrimitiveCollection()), lines=viewer.scene.primitives.add(new C.PolylineCollection()), labels=viewer.scene.primitives.add(new C.LabelCollection());
    const past=lines.add({positions:[],width:1.5,material:C.Material.fromType('Color',{color:C.Color.fromCssColorString('#e0e0e0')})});
    const future=lines.add({positions:[],width:2,material:C.Material.fromType('PolylineDash',{color:C.Color.fromCssColorString('#a9c5df'),dashLength:12})});
    const heightLine=lines.add({positions:[],width:2,material:C.Material.fromType('Color',{color:C.Color.WHITE})});
    const label=labels.add({text:'',show:false,horizontalOrigin:C.HorizontalOrigin.LEFT,verticalOrigin:C.VerticalOrigin.CENTER,showBackground:true,backgroundColor:C.Color.fromCssColorString('#080b10').withAlpha(.82),backgroundPadding:new C.Cartesian2(6,4),disableDepthTestDistance:Infinity,font:'14px sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(12,-12)});
    const extraLabels=viewer.scene.primitives.add(new C.LabelCollection()),nameItems=new Map();
    const issFallback=viewer.scene.primitives.add(new C.BillboardCollection()).add({id:25544,image:AtlasISS.iconURI,width:64,height:44,show:false});
    let issModel=null,issVisible=false;AtlasISS.createModel(C,viewer.scene).then(model=>{issModel=model;if(lastData)api.update({...lastData,focus:false});}).catch(error=>{container.dataset.modelError=error.message;console.error('Modèle ISS :',error);});
    const tiangongFallback=viewer.scene.primitives.add(new C.BillboardCollection()).add({id:48274,image:AtlasTiangong.iconURI,width:64,height:44,show:false});
    let tiangongModel=null,tiangongVisible=false;
    AtlasTiangong.createModel(C,viewer.scene).then(model=>{tiangongModel=model;if(lastData)api.update({...lastData,focus:false});}).catch(error=>{container.dataset.tiangongModelError=error.message;});
    function sizeISS(){
      if(!lastData)return;
      const size=AtlasISS.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,lastData.collection==='all'&&issFallback.position?C.Cartesian3.distance(viewer.camera.positionWC,issFallback.position):viewer.camera.positionCartographic.height,lastData.selected===25544,lastData.collection);
      issFallback.width=size;issFallback.height=size*.7;if(issModel)issModel.minimumPixelSize=size;
      const issDot=lastData.collection==='all'&&size<=7;issFallback.image=issDot?AtlasISS.pointIconURI:AtlasISS.iconURI;issFallback.show=issVisible&&!detailedLayer.replaces(25544)&&(issDot||!issModel);if(issModel)issModel.show=issVisible&&!detailedLayer.replaces(25544)&&!issDot;
      const tgSize=AtlasTiangong.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,lastData.collection==='all'&&tiangongFallback.position?C.Cartesian3.distance(viewer.camera.positionWC,tiangongFallback.position):viewer.camera.positionCartographic.height,lastData.selected===48274,lastData.collection);
      tiangongFallback.width=tgSize;tiangongFallback.height=tgSize*.7;if(tiangongModel)tiangongModel.minimumPixelSize=tgSize;
      const tgDot=lastData.collection==='all'&&tgSize<=7;tiangongFallback.image=tgDot?AtlasISS.pointIconURI:AtlasTiangong.iconURI;tiangongFallback.show=tiangongVisible&&!detailedLayer.replaces(48274)&&(tgDot||!tiangongModel);if(tiangongModel)tiangongModel.show=tiangongVisible&&!detailedLayer.replaces(48274)&&!tgDot;
    }
    viewer.scene.preUpdate.addEventListener(sizeISS);
    const scienceLayer=AtlasScience.createLayer(C,viewer,()=>{if(lastData)api.update({...lastData,focus:false});});
    let detailRefreshQueued=false;
    const detailedLayer=AtlasDetailed.createLayer(C,viewer,container,()=>{
      if(detailRefreshQueued)return;detailRefreshQueued=true;queueMicrotask(()=>{detailRefreshQueued=false;if(detailedLayer.loading){modelZoomTarget=null;stopJoystick();pendingX=0;pendingY=0;globeDrag=null;viewer.camera.cancelFlight();idleController?.cancel();}else idleController?.activity();if(lastData)api.update({...lastData,focus:false});});
    },(id,model)=>{
      if(!active||!lastData?.points.some(p=>p.id===id))return;
      // Select first so position updates maintain the same close tracking frame.
      if(lastData.selected!==id)onSelect(id);
      const chosen=lastData.points.find(p=>p.id===id);if(!chosen)return;
      idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;globeDrag=null;releaseFollow();
      following=true;followPitch=-.5;viewer.camera.cancelFlight();
      const radius=Math.max(1,model.boundingSphere?.radius||AtlasScience.model(id)?.radius||75);
      viewer.camera.lookAt(position(chosen),new C.HeadingPitchRange(0,followPitch,AtlasGlobe.detailedRange(radius,viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy)));
      followReady=true;updateFollowControl(chosen);viewer.scene.requestRender();
    });
    viewer.scene.renderError.addEventListener((scene,error)=>{
      if(!earthLayer.recover(error)&&!detailedLayer.recover(error))return;
      const rethrow=scene.rethrowRenderErrors;scene.rethrowRenderErrors=false;
      queueMicrotask(()=>{scene.rethrowRenderErrors=rethrow;if(active){viewer.useDefaultRenderLoop=true;scene.requestRender();}});
    });
    const items=new Map(),lime=C.Color.fromCssColorString('#afe1f3'),white=C.Color.WHITE;let active=true,lastSelection=null,lastData=null,paletteKey='',palette=Object.fromEntries(AtlasPages.definitions.map(row=>[row.id,white]));let firstOverview=true;
    let modelZoomTarget=null,overviewZoomTarget=null;
    let followPitch=-.8,following=false,followReady=false,followCurrent=null,lastSelectionRequest=null;
    let idleController=null,idleFlight=false,ignoreOverviewClick=false,overviewPosition=null;
        const followButton=document.getElementById('globe-follow');
    const releaseFollow=()=>{modelZoomTarget=null;overviewZoomTarget=null;if(followReady)viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);followReady=false;};
    const modelFollow=()=>following&&followReady&&(AtlasScience.has(lastData?.selected)||[25544,48274].includes(lastData?.selected));
    const zoomModel=(direction,strength=1)=>{
      if(!modelFollow())return false;
      const radius=AtlasScience.model(lastData.selected)?.radius||([25544,48274].includes(lastData.selected)?75:60);
      modelZoomTarget=AtlasGlobe.modelZoomRange(modelZoomTarget??C.Cartesian3.magnitude(viewer.camera.position),direction,strength,radius);
      viewer.scene.requestRender();return true;
    };
    const overviewRange=()=>followReady?C.Cartesian3.magnitude(viewer.camera.position):viewer.camera.positionCartographic.height;
    const zoomOverview=(direction,strength=1)=>{
      viewer.camera.cancelFlight();
      overviewZoomTarget=AtlasGlobe.overviewZoomHeight(overviewZoomTarget??overviewRange(),direction,strength);
      viewer.scene.requestRender();
    };
    viewer.canvas.addEventListener('pointerdown',()=>{overviewZoomTarget=null;},{passive:true});
    viewer.canvas.addEventListener('wheel',event=>{
      if(!active)return;
      event.preventDefault();event.stopImmediatePropagation();idleController?.cancel();
      const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewer.canvas.clientHeight:1);
      if(pixels&&!detailedLayer.loading){const direction=pixels<0?1:-1,strength=Math.abs(pixels)/100;if(!zoomModel(direction,strength))zoomOverview(direction,strength);}
    },{capture:true,passive:false});
    viewer.scene.preUpdate.addEventListener(()=>{
      controls.enableInputs=!detailedLayer.loading;controls.enableZoom=!modelFollow();controls.minimumZoomDistance=modelFollow()?1:150000;
      if(overviewZoomTarget!==null&&!detailedLayer.loading){
        const height=overviewRange(),delta=(height-overviewZoomTarget)*.28;
        if(Math.abs(delta)<1)overviewZoomTarget=null;
        else{if(followReady)C.Cartesian3.multiplyByScalar(viewer.camera.position,(height-delta)/height,viewer.camera.position);else delta>0?viewer.camera.zoomIn(delta):viewer.camera.zoomOut(-delta);viewer.scene.requestRender();}
      }
      if(modelZoomTarget===null||!modelFollow())return;
      const camera=viewer.camera,range=C.Cartesian3.magnitude(camera.position),next=range+(modelZoomTarget-range)*.35;
      C.Cartesian3.multiplyByScalar(camera.position,next/range,camera.position);
      if(Math.abs(next-modelZoomTarget)<.05)modelZoomTarget=null;
      viewer.scene.requestRender();
    });
    const debrisTarget=()=>lastData?.collection==='debris'||(lastData?.selected!==null&&lastData?.catalog.get(lastData?.selected)?.family==='debris')||document.body.dataset.collection==='debris';
    const stopFollowing=()=>{following=false;releaseFollow();document.getElementById('compass').hidden=true;document.getElementById('satellite-views').hidden=true;if(lastData?.collection==='all'){followButton.hidden=true;document.getElementById('follow-state').hidden=true;}document.getElementById('advanced-model-options').dataset.following='false';followButton.setAttribute('aria-pressed','false');followButton.textContent=debrisTarget()?'Suivre l’objet':'Suivre le satellite';document.getElementById('follow-state').textContent=lastData?.selected!==null&&lastData?'Suivre la lecture, même accélérée':debrisTarget()?'Sélectionne un objet':'Sélectionne un satellite';};
    const updateFollowControl=chosen=>{
      const idle=!!idleController?.active;
      const inSatelliteView=following&&!!chosen&&!idle;
      document.getElementById('compass').hidden=!inSatelliteView;
      document.getElementById('satellite-views').hidden=!inSatelliteView;
      followButton.hidden=lastData?.collection==='all'&&!inSatelliteView;
      document.getElementById('follow-state').hidden=followButton.hidden;
      const target=chosen||AtlasGlobe.followTarget(lastData);
      followButton.disabled=!target&&!idle&&!following;
      followButton.title=target?'Suivre '+(lastData.catalog.get(target.id)?.name||target.id):'Aucun objet disponible à cette date';
      document.getElementById('advanced-model-options').dataset.following=String(following&&!!chosen);followButton.setAttribute('aria-pressed',String(following||idle));
      followButton.textContent=following||idle?'Arrêter le suivi':debrisTarget()?'Suivre l’objet':'Suivre le satellite';
      document.getElementById('follow-state').textContent=idle?'Vue globale · suivi automatique de '+(lastData?.collection==='tiangong'?'Tiangong':'l’ISS'):following?(chosen?'Caméra centrée · zoom et rotation disponibles':'Suivi suspendu : position indisponible'):(chosen?'Suivre la lecture, même accélérée':target?'Centrer sur '+(lastData.catalog.get(target.id)?.name||target.id):debrisTarget()?'Sélectionne un objet':'Sélectionne un satellite');
    };
    const position=p=>C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000);
    const motion=new SatelliteMotion();let motionAt=null;
    const orbit=rows=>rows.map(p=>C.Cartesian3.fromDegrees(p[1],p[0],p[2]*1000));
    let overviewAnchor=null;
    const homeView=station=>{
      const collection=lastData?.collection||document.body.dataset.collection;
      let radius=['all','debris'].includes(collection)?9600000:!lastData?(AtlasPages.definition(collection)?.frame_radius||7500000):7500000;
      const scopedAtlas=collection==='all'&&lastData?.groups&&AtlasPages.definitions.some(row=>row.id!=='debris'&&!lastData.groups.has(row.id));
      if(lastData&&(!['all','debris'].includes(collection)||scopedAtlas))for(const p of lastData.points){const satellite=lastData.catalog.get(p.id);if(satellite&&lastData.visible(satellite,p.id))radius=Math.max(radius,(6378137+p.altitude_km*1000)*1.08);}
      const anchor=overviewAnchor&&(lastData?.points.find(p=>p.id===overviewAnchor.id)||overviewAnchor);
      if(Number.isFinite(anchor?.altitude_km))radius=Math.max(radius,(6378137+anchor.altitude_km*1000)*1.08);
      const aspect=Math.max(.1,viewer.canvas.clientWidth/viewer.canvas.clientHeight);
      const fovy=viewer.camera.frustum.fovy||Math.PI/3;
      const halfAngle=Math.atan(.74*Math.tan(fovy/2)*Math.min(1,aspect));
      const centre=station||(AtlasPages.isStation(lastData?.collection)?lastData.points.find(p=>p.id===AtlasPages.station(lastData.collection)):null)||anchor;
      return {destination:C.Cartesian3.fromDegrees(centre?.lon??0,centre?.lat??20,radius/Math.sin(halfAngle)-6378137),orientation:{heading:0,pitch:-Math.PI/2,roll:0}};
    };
    const resetButton=document.getElementById('globe-home');
    let homePose=null,returningHome=false;
    const rememberHome=()=>{homePose={position:C.Cartesian3.clone(viewer.camera.positionWC),direction:C.Cartesian3.clone(viewer.camera.directionWC),up:C.Cartesian3.clone(viewer.camera.upWC)};};
    const updateHomeState=()=>{
      const camera=viewer.camera;
      const isHome=homePose&&C.Cartesian3.distance(camera.positionWC,homePose.position)<100&&C.Cartesian3.dot(camera.directionWC,homePose.direction)>.999999&&C.Cartesian3.dot(camera.upWC,homePose.up)>.999999;
      resetButton.disabled=returningHome||!!isHome;
    };
    const home=()=>{detailedLayer.cancel();idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;globeDrag=null;stopFollowing();returningHome=true;updateHomeState();viewer.camera.flyTo({...homeView(),duration:.65,complete:()=>{returningHome=false;rememberHome();updateHomeState();},cancel:()=>{returningHome=false;updateHomeState();}});};
    viewer.resize();viewer.camera.setView(homeView());rememberHome();updateHomeState();
    viewer.camera.changed.addEventListener(updateHomeState);
    viewer.camera.moveEnd.addEventListener(updateHomeState);
    // Project geographic north into the screen plane at the centre of the view.
    // This also handles camera roll; heading alone loses this information.
    const northVector=new C.Cartesian3(), enu=new C.Matrix4();
    let previousAngle=null,continuousAngle=0,displayedAngle=null;
    const northAngle=()=>{
      const centre=new C.Cartesian2(viewer.canvas.clientWidth/2,viewer.canvas.clientHeight/2);
      const anchor=viewer.camera.pickEllipsoid(centre,viewer.scene.globe.ellipsoid)||viewer.camera.positionWC;
      C.Transforms.eastNorthUpToFixedFrame(anchor,viewer.scene.globe.ellipsoid,enu);
      C.Matrix4.multiplyByPointAsVector(enu,C.Cartesian3.UNIT_Y,northVector);
      return AtlasGlobe.compassAngle(northVector,viewer.camera.rightWC,viewer.camera.upWC);
    };
    const updateCompass=()=>{
      const angle=northAngle();if(angle===null)return;
      const degrees=C.Math.toDegrees(angle);
      if(previousAngle===null)continuousAngle=degrees;else continuousAngle+=((degrees-previousAngle+540)%360)-180;
      previousAngle=degrees;
      if(displayedAngle===null||Math.abs(continuousAngle-displayedAngle)>.01){
        document.getElementById('compass-dial').style.transform=`rotate(${continuousAngle}deg)`;
        const bearing=Math.round((360-degrees)%360)%360;
        document.getElementById('compass-bearing').textContent=`${bearing}°`;
        document.getElementById('compass').setAttribute('aria-label',`Orientation ${bearing} degrés. Cliquer pour remettre le nord en haut`);
        displayedAngle=continuousAngle;
      }
    };
    viewer.scene.postRender.addEventListener(updateCompass);
    viewer.camera.percentageChanged=.001;
    viewer.camera.changed.addEventListener(updateCompass);
    viewer.scene.preUpdate.addEventListener(()=>{
      if(!active||!lastData||(!motion.active&&!following&&!idleController?.active))return;
      const rows=motion.sample(performance.now());let chosen=null,station=null;
      for(const p of rows){detailedLayer.move(p);scienceLayer.move(p);if(p.id===AtlasPages.station(lastData.collection))station=p;if(p.id===48274&&tiangongVisible){tiangongFallback.position=position(p);if(tiangongModel)tiangongModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}if(p.id===25544&&issVisible){issFallback.position=position(p);if(issModel)issModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}const point=items.get(p.id);if(point?.show){point.position=position(p);const name=nameItems.get(p.id);if(name?.show)name.position=point.position;}if(p.id===lastData.selected)chosen=p;}
      if(chosen){followCurrent=position(chosen);label.position=followCurrent;
        if(heightLine.positions.length)heightLine.positions=[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),followCurrent];
        if(past.positions.length){const line=past.positions.slice();line[line.length-1]=followCurrent;past.positions=line;}
        if(future.positions.length){const line=future.positions.slice();line[0]=followCurrent;future.positions=line;}
      }
      if(idleController?.active&&!idleFlight&&station){
        const key=[station.lon,station.lat,viewer.canvas.clientWidth,viewer.canvas.clientHeight].join(':');
        if(key!==overviewPosition){overviewPosition=key;viewer.camera.setView(homeView(station));rememberHome();updateHomeState();}
      }
      if(motion.active)viewer.scene.requestRender();
      if(!following||!followReady||!chosen)return;
      // Changing transforms alone preserves the world camera. Retain its local
      // offset and orientation instead so the reference frame follows the target.
      const camera=viewer.camera,offset=C.Cartesian3.clone(camera.position),direction=C.Cartesian3.clone(camera.direction),up=C.Cartesian3.clone(camera.up),right=C.Cartesian3.clone(camera.right);
      camera.lookAtTransform(C.Transforms.eastNorthUpToFixedFrame(followCurrent));
      C.Cartesian3.clone(offset,camera.position);C.Cartesian3.clone(direction,camera.direction);C.Cartesian3.clone(up,camera.up);C.Cartesian3.clone(right,camera.right);
    });
    const labelMeasure=document.createElement('canvas').getContext('2d');labelMeasure.font='14px sans-serif';
    function placeSatelliteLabel(){
      if(!label.show||!lastData)return;
      const anchor=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,label.position);if(!anchor)return;
      const id=lastData.selected,width=viewer.canvas.clientWidth,height=viewer.canvas.clientHeight;
      const visual=AtlasScience.model(id)||AtlasStations.model(id),model=detailedLayer.getModel(id)||scienceLayer.getModel(id)||(id===25544?issModel:id===48274?tiangongModel:null);
      let radius=visual?visual.screenSize(width,height,lastData.collection==='all'?C.Cartesian3.distance(viewer.camera.positionWC,label.position):viewer.camera.positionCartographic.height,true,lastData.collection)/2:6;
      let center=anchor;
      if(model?.ready&&model.show){
        const sphere=model.boundingSphere,scale=Math.max(1,model.computedScale/(model.scale||1)),size=sphere.radius*scale;
        center=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,sphere.center)||anchor;
        const edge=C.Cartesian3.add(sphere.center,C.Cartesian3.multiplyByScalar(viewer.camera.rightWC,size,new C.Cartesian3()),new C.Cartesian3());
        const projected=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,edge);
        if(projected&&Number.isFinite(projected.x))radius=Math.max(radius,Math.abs(projected.x-center.x));
      }
      const raw=`${lastData.catalog.get(id)?.name||id} · ${lastData.points.find(p=>p.id===id)?.altitude_km.toFixed(1)||'—'} km`;
      const maxWidth=Math.max(80,width-32),lines=[];let line='';
      for(const word of raw.split(' ')){const next=line?line+' '+word:word;if(line&&labelMeasure.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}
      lines.push(line);label.text=lines.join('\n');const textWidth=Math.min(maxWidth,Math.max(...lines.map(text=>labelMeasure.measureText(text).width))+12),textHeight=lines.length*18+8;
      const layout=AtlasGeometry.labelPlacement({anchor,bounds:{left:center.x-radius,right:center.x+radius,top:center.y-radius,bottom:center.y+radius},width,height,textWidth,textHeight});
      label.pixelOffset=new C.Cartesian2(layout.x-anchor.x,layout.y+textHeight/2-anchor.y);
    }
    viewer.scene.preRender.addEventListener(placeSatelliteLabel);
    function satelliteAtGlobeClick(click){
      const exact=viewer.scene.pick(click);if(exact&&typeof exact.id==='number')return exact.id;
      const radius=AtlasGeometry.pickRadius({mode:'3d',collection:lastData?.collection,height:viewer.camera.positionCartographic.height,touch:matchMedia('(pointer: coarse)').matches});
      const occluder=new C.EllipsoidalOccluder(viewer.scene.globe.ellipsoid,viewer.camera.positionWC),offset=new C.Cartesian3();
      function* projected(){
        function project(id,xyz){
          if(!xyz||!occluder.isPointVisible(xyz))return null;
          C.Cartesian3.subtract(xyz,viewer.camera.positionWC,offset);if(C.Cartesian3.dot(offset,viewer.camera.directionWC)<=0)return null;
          const xy=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,xyz);
          return xy?{id,x:xy.x,y:xy.y}:null;
        }
        for(const [id,item] of items){if(!item.show)continue;const hit=project(id,item.position);if(hit)yield hit;}
        for(const marker of scienceLayer.hits()){const hit=project(marker.id,marker.position);if(hit)yield hit;}
        if(issVisible){const hit=project(25544,issFallback.position);if(hit)yield hit;}
        if(tiangongVisible){const hit=project(48274,tiangongFallback.position);if(hit)yield hit;}
      }
      return AtlasGeometry.nearestHit(projected(),click,radius);
    }
    const closeFromSky=()=>{detailedLayer.cancel();onEmptySpace?.();};
    viewer.screenSpaceEventHandler.setInputAction(event=>{const id=satelliteAtGlobeClick(event.position);if(ignoreOverviewClick){ignoreOverviewClick=false;if(id===null&&!viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid))closeFromSky();return;}if(id!==null){onSelect(id);return;}const surface=viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid);if(!surface)closeFromSky();},C.ScreenSpaceEventType.LEFT_CLICK);
    const api={
      update(data){
        if(!active)return;lastData=data;
        // A click starts tracking, including a second click on a released target.
        // Ordinary position updates preserve a deliberate camera release.
        if(data.selected!==null&&(data.selected!==lastSelection||data.selectionRequest!==lastSelectionRequest)){idleController?.cancel();if(data.selected!==lastSelection)followPitch=-.8;releaseFollow();following=true;}
        if(motion.source!==data.points){motion.set(data.points,performance.now(),data.playing&&!data.focus&&motionAt!==null&&Math.abs(data.at-motionAt)<150000);motionAt=data.at;}
        viewer.clock.currentTime=C.JulianDate.fromDate(new Date(data.at));earthLayer.update(data);
        const nextPalette=data.collection==='all'?data.colors:null,key=JSON.stringify(nextPalette);if(key!==paletteKey){paletteKey=key;palette=Object.fromEntries(AtlasPages.definitions.map(row=>[row.id,nextPalette?C.Color.fromCssColorString(nextPalette[row.id]||'#afe1f3'):row.id==='debris'?C.Color.fromCssColorString('#d9a15f'):['stations','science'].includes(row.category)?white:lime]));}
        issFallback.color=palette.iss;if(issModel)issModel.color=palette.iss;tiangongFallback.color=palette.tiangong;if(tiangongModel)tiangongModel.color=palette.tiangong;
        scienceLayer.begin();
        issVisible=false;issFallback.show=false;if(issModel)issModel.show=false;tiangongVisible=false;tiangongFallback.show=false;if(tiangongModel)tiangongModel.show=false;sizeISS();for(const item of items.values())item.show=false;for(const item of nameItems.values())item.show=false;let nameCount=0;
        for(const p of data.points){
          const satellite=data.catalog.get(p.id);if(!satellite||!data.visible(satellite,p.id))continue;
          if(scienceLayer.update(p,{selected:data.selected,collection:data.collection,color:p.id===data.selected?white:palette[AtlasPages.displayFamily(satellite,data.colors,data.groups)]}))continue;
          if(p.id===48274){tiangongVisible=true;tiangongFallback.position=position(p);tiangongFallback.show=!tiangongModel;if(tiangongModel){tiangongModel.show=true;tiangongModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}continue;}
          if(p.id===25544){issVisible=true;issFallback.position=position(p);issFallback.show=!issModel;if(issModel){issModel.show=true;issModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}continue;}
          let item=items.get(p.id);if(!item){item=satellites.add({id:p.id,pixelSize:3,color:lime,outlineWidth:0});items.set(p.id,item);}
          item.show=true;item.position=position(p);item.color=p.id===data.selected?white:palette[AtlasPages.displayFamily(satellite,data.colors,data.groups)];item.pixelSize=p.id===data.selected?9:3*AtlasGeometry.markerScale(data.collection);item.outlineWidth=p.id===data.selected?2:0;item.outlineColor=C.Color.fromCssColorString(p.id===data.selected?'#a9c5df':'#1a1d25');
          if(data.names&&p.id!==data.selected&&viewer.camera.positionCartographic.height<2500000&&nameCount<200&&C.Cartesian3.distance(viewer.camera.positionWC,item.position)<3000000){const screen=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,item.position);if(screen&&screen.x>=0&&screen.y>=0&&screen.x<=viewer.canvas.clientWidth&&screen.y<=viewer.canvas.clientHeight){let text=nameItems.get(p.id);if(!text){text=extraLabels.add({id:p.id,font:'11px sans-serif',fillColor:lime,outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(5,-5)});nameItems.set(p.id,text);}text.show=true;text.position=item.position;text.text=satellite.name;nameCount++;}}
        }
        detailedLayer.update(data);
        for(const p of data.points)if(detailedLayer.replaces(p.id)){
          scienceLayer.suppress(p.id);
          if(p.id===25544){issFallback.show=false;if(issModel)issModel.show=false;}
          if(p.id===48274){tiangongFallback.show=false;if(tiangongModel)tiangongModel.show=false;}
        }
        past.positions=data.orbits?orbit(data.track):[];future.positions=data.orbits?orbit(data.future):[];
        const chosen=data.points.find(p=>p.id===data.selected);label.show=!!chosen;heightLine.positions=[];
        if(data.selected===null)stopFollowing();
        document.getElementById('satellite-views').hidden=data.selected===null;
        document.getElementById('view-above').disabled=!chosen;document.getElementById('view-side').disabled=!chosen;
        updateFollowControl(chosen);
        if(!chosen)releaseFollow();
        document.getElementById('globe-measure').textContent=lastData?.selected!==null?'Altitude estimée : indisponible':debrisTarget()?'Altitude estimée : sélectionnez un objet':'Altitude estimée : sélectionnez un satellite';
        if(chosen){const xyz=position(chosen);heightLine.positions=data.groundLink!==false?[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),xyz]:[];label.position=xyz;label.text=`${data.catalog.get(chosen.id)?.name||chosen.id} · ${chosen.altitude_km.toFixed(1)} km`;
          document.getElementById('globe-measure').textContent=`Altitude estimée : ${chosen.altitude_km.toLocaleString(navigator.language,{maximumFractionDigits:1})} km`;
          if(following){
            const snap=!followReady||data.focus||data.selected!==lastSelection;
            if(snap){
              let range=AtlasGlobe.satelliteRange(chosen.altitude_km,viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy);
              if(data.closeFocus){
                const model=scienceLayer.getModel(chosen.id)||(chosen.id===25544?issModel:chosen.id===48274?tiangongModel:null);
                const visual=AtlasScience.model(chosen.id)||AtlasStations.model(chosen.id);
                range=visual?AtlasGlobe.detailedRange(Math.max(1,model?.boundingSphere?.radius||visual.radius||75),viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy):250000;
                followPitch=-.5;
              }
              viewer.camera.cancelFlight();viewer.camera.lookAt(xyz,new C.HeadingPitchRange(0,followPitch,range));followReady=true;
            }
          }else if(data.focus||data.selected!==lastSelection)viewer.camera.flyToBoundingSphere(new C.BoundingSphere(xyz,1000000),{duration:.6,offset:new C.HeadingPitchRange(viewer.camera.heading,-.8,AtlasGlobe.satelliteRange(chosen.altitude_km,viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy))});
        }
        lastSelection=data.selected;lastSelectionRequest=data.selectionRequest;container.dataset.points=String([...items.values()].filter(p=>p.show).length+(issVisible?1:0)+(tiangongVisible?1:0)+scienceLayer.count);container.dataset.altitudeScale='1';if(firstOverview&&data.points.length){firstOverview=false;if(data.selected===null&&data.points.some(p=>(AtlasPages.definition(AtlasPages.family(data.catalog.get(p.id)||p))?.frame_radius||0)>9000000&&data.visible(data.catalog.get(p.id)||p,p.id)))home();}viewer.scene.requestRender();
      },
      setActive(value){if(!value){detailedLayer.cancel();idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;globeDrag=null;releaseFollow();}active=value;viewer.useDefaultRenderLoop=value;if(value){viewer.resize();viewer.scene.requestRender();}},
      resize(){if(active){const atHome=resetButton.disabled&&!returningHome;viewer.resize();if(atHome){viewer.camera.setView(homeView());rememberHome();updateHomeState();}viewer.scene.requestRender();}},
      home,
      detailedActive(id){return detailedLayer.replaces(id);},
      orientOverview(point){overviewAnchor=point?{id:point.id,lon:point.lon,lat:point.lat,altitude_km:point.altitude_km}:null;home();},
      north(){idleController?.cancel();pendingX=0;pendingY=0;viewer.camera.cancelFlight();const angle=northAngle();if(angle!==null)viewer.camera.twistRight(angle);updateCompass();viewer.scene.requestRender();},
      setRealistic(enabled){return earthLayer.setEnabled(enabled);},
      zoom(direction){if(detailedLayer.loading)return;idleController?.cancel();if(zoomModel(direction))return;zoomOverview(direction);}
    };
    viewer.camera.moveEnd.addEventListener(()=>{if(active&&lastData&&lastData.names)api.update({...lastData,focus:false});});
    const compass=document.getElementById('compass');let compassDrag=null,suppressCompassClick=false;
    compass.onclick=()=>{if(suppressCompassClick){suppressCompassClick=false;return;}api.north();};
    compass.addEventListener('pointerdown',event=>{if(event.button!==0)return;idleController?.cancel();viewer.camera.cancelFlight();compassDrag={x:event.clientX,moved:false};compass.setPointerCapture(event.pointerId);});
    compass.addEventListener('pointermove',event=>{if(!compassDrag)return;const dx=event.clientX-compassDrag.x;if(!compassDrag.moved&&Math.abs(dx)<3)return;compassDrag.moved=true;compassDrag.x=event.clientX;viewer.camera.twistRight(C.Math.toRadians(dx*.5));updateCompass();viewer.scene.requestRender();});
    compass.addEventListener('pointerup',()=>{suppressCompassClick=!!compassDrag?.moved;compassDrag=null;});
    compass.addEventListener('pointercancel',()=>{compassDrag=null;suppressCompassClick=false;});document.getElementById('globe-home').onclick=home;
    followButton.onclick=()=>{
      idleController?.cancel();
      if(following){stopFollowing();if(lastData)api.update({...lastData,focus:false});return;}
      const target=AtlasGlobe.followTarget(lastData);if(!target)return;
      following=true;
      if(lastData.selected!==target.id)onSelect(target.id);
      else api.update({...lastData,focus:true});
    };
    const satelliteView=pitch=>{idleController?.cancel();if(!lastData?.points.some(p=>p.id===lastData.selected))return;pendingX=0;pendingY=0;globeDrag=null;followPitch=pitch;following=true;api.update({...lastData,focus:true});updateCompass();};
    document.getElementById('view-above').onclick=()=>satelliteView(-Math.PI/2);
    document.getElementById('view-side').onclick=()=>satelliteView(0);
    document.getElementById('globe-plus').onclick=()=>api.zoom(1);document.getElementById('globe-minus').onclick=()=>api.zoom(-1);
    viewer.canvas.tabIndex=0;viewer.canvas.setAttribute('aria-label','Globe terrestre 3D interactif');
    viewer.canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();let heading=viewer.camera.heading,pitch=viewer.camera.pitch;const step=C.Math.toRadians(5);if(event.key==='ArrowLeft')heading-=step;if(event.key==='ArrowRight')heading+=step;if(event.key==='ArrowUp')pitch=Math.min(-.05,pitch+step);if(event.key==='ArrowDown')pitch=Math.max(-Math.PI/2,pitch-step);viewer.camera.setView({orientation:{heading,pitch,roll:0}});viewer.scene.requestRender();});
    // Overview tracking is independent of selection: it opens no profile and never zooms in on the station.
    const heldPointers=new Set();
    idleController=this.idleController({
      now:()=>performance.now(),
      canStart:()=>active&&!detailedLayer.loading&&!document.hidden&&document.hasFocus()&&!heldPointers.size&&AtlasPages.isStation(lastData?.collection)&&!!lastData.points.find(p=>p.id===AtlasPages.station(lastData.collection))&&!document.querySelector('dialog[open]'),
      start:()=>{detailedLayer.cancel();stopJoystick();stopFollowing();overviewPosition=null;idleFlight=true;viewer.camera.cancelFlight();viewer.camera.flyTo({...homeView(),duration:.8,complete:()=>{idleFlight=false;viewer.scene.requestRender();},cancel:()=>{idleFlight=false;}});container.dataset.idleFollow='true';updateFollowControl(lastData?.points.find(p=>p.id===lastData.selected));},
      stop:()=>{idleFlight=false;overviewPosition=null;viewer.camera.cancelFlight();container.dataset.idleFollow='false';viewer.scene.requestRender();}
    });
    window.addEventListener('pointermove',()=>idleController.activity(),{passive:true});
    window.addEventListener('pointerdown',event=>{heldPointers.add(event.pointerId);idleController.activity();},{passive:true});
    for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>{heldPointers.delete(event.pointerId);idleController.activity();},{passive:true});
    for(const type of ['wheel','keydown'])window.addEventListener(type,()=>idleController.activity(),{passive:true});
    window.addEventListener('blur',()=>{heldPointers.clear();idleController.cancel();});
    document.addEventListener('visibilitychange',()=>idleController.cancel());
    viewer.canvas.addEventListener('pointerdown',event=>{if(event.button===0){ignoreOverviewClick=idleController.cancel();}},{capture:true,passive:true});
    viewer.canvas.addEventListener('pointerup',()=>setTimeout(()=>{ignoreOverviewClick=false;},0),{passive:true});
    viewer.canvas.addEventListener('pointercancel',()=>{ignoreOverviewClick=false;},{passive:true});
    setInterval(()=>idleController.tick(),250);
    return api;
  }
};
