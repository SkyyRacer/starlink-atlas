'use strict';
/* Cesium stays lazy and local. No access token, terrain service, or geolocation. */
window.AtlasGlobe={
  compassAngle(north,right,up){
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    const x=dot(north,right),y=dot(north,up);
    return Math.hypot(x,y)<1e-8?null:Math.atan2(x,y);
  },
  cardinalAngles(north,east,right,up){
    const n=this.compassAngle(north,right,up),e=this.compassAngle(east,right,up);
    const opposite=angle=>angle===null?null:Math.atan2(-Math.sin(angle),-Math.cos(angle));
    return {north:n,south:opposite(n),east:e,west:opposite(e)};
  },
  compassAnchor(C,camera,ellipsoid,width,height,target=null){
    return target||camera.pickEllipsoid(new C.Cartesian2(width/2,height/2),ellipsoid)||camera.positionWC;
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
  modelZoomRange(range,direction,strength=1,radius=50,detailed=false,distant=false){
    const minimum=Math.max(2,radius*(detailed ? .35 : 1.5)),factor=range>radius*12?4:detailed&&range<radius*2?1.22:1.8;
    return Math.max(minimum,Math.min(distant?1e15:4e9,range*Math.pow(factor,-direction*Math.min(2,Math.max(.01,strength)))));
  },
  overviewZoomHeight(height,direction,strength=1){
    const current=Math.max(150000,height);
    const t=Math.min(1,Math.max(0,Math.log(current/150000)/Math.log(20000000/150000)));
    const factor=1.12+.78*t*t*(3-2*t);
    return Math.max(150000,Math.min(4e9,current*Math.pow(factor,-direction*Math.min(2,Math.max(.001,strength)))));
  },
  distantZoomRange(range,direction,strength=1){
    const current=Math.max(1000,range),t=Math.min(1,Math.max(0,Math.log10(current/1000)/8));
    const factor=1.14+.9*t*t*(3-2*t);
    return Math.max(1000,Math.min(1e15,current*Math.pow(factor,-direction*Math.min(2,Math.max(.001,strength)))));
  },
  inspectionControls(C,camera,{pivot=C.Cartesian3.ZERO,up=C.Cartesian3.UNIT_Z,height=()=>900}){
    const target=C.Cartesian3.clone(pivot),vertical=C.Cartesian3.normalize(up,new C.Cartesian3());
    const rotate=(value,axis,angle)=>C.Matrix3.multiplyByVector(C.Matrix3.fromQuaternion(C.Quaternion.fromAxisAngle(axis,angle)),value,value);
    function orthogonalize(){C.Cartesian3.normalize(camera.direction,camera.direction);C.Cartesian3.normalize(C.Cartesian3.cross(camera.direction,camera.up,new C.Cartesian3()),camera.right);C.Cartesian3.normalize(C.Cartesian3.cross(camera.right,camera.direction,new C.Cartesian3()),camera.up);}
    return {pivot:target,
      orbit(dx,dy){
        const offset=C.Cartesian3.subtract(camera.position,target,new C.Cartesian3()),turn=2*Math.PI/Math.max(1,height());
        const yaw=-dx*turn;for(const value of [offset,camera.direction,camera.up,camera.right])rotate(value,vertical,yaw);
        const elevation=Math.asin(Math.max(-1,Math.min(1,C.Cartesian3.dot(camera.direction,vertical)))),limit=Math.PI/2-.005;
        const pitch=Math.max(-limit-elevation,Math.min(limit-elevation,-dy*turn)),axis=C.Cartesian3.clone(camera.right);
        for(const value of [offset,camera.direction,camera.up])rotate(value,axis,pitch);
        C.Cartesian3.add(target,offset,camera.position);orthogonalize();
      },
      view(pitch){
        const range=Math.max(2,C.Cartesian3.distance(camera.position,target));
        let north=C.Cartesian3.subtract(C.Cartesian3.UNIT_Y,C.Cartesian3.multiplyByScalar(vertical,C.Cartesian3.dot(C.Cartesian3.UNIT_Y,vertical),new C.Cartesian3()),new C.Cartesian3());
        if(C.Cartesian3.magnitudeSquared(north)<1e-8)north=C.Cartesian3.subtract(C.Cartesian3.UNIT_X,C.Cartesian3.multiplyByScalar(vertical,C.Cartesian3.dot(C.Cartesian3.UNIT_X,vertical),new C.Cartesian3()),north);
        C.Cartesian3.normalize(north,north);const above=pitch<-.7,offset=C.Cartesian3.multiplyByScalar(above?vertical:C.Cartesian3.negate(north,new C.Cartesian3()),range,new C.Cartesian3());
        C.Cartesian3.add(target,offset,camera.position);C.Cartesian3.normalize(C.Cartesian3.negate(offset,camera.direction),camera.direction);C.Cartesian3.clone(above?north:vertical,camera.up);orthogonalize();
      },
      pan(dx,dy){
        const distance=Math.max(2,C.Cartesian3.distance(camera.position,target)),unit=2*distance*Math.tan((camera.frustum.fovy||Math.PI/3)/2)/Math.max(1,height());
        const delta=C.Cartesian3.add(C.Cartesian3.multiplyByScalar(camera.right,-dx*unit,new C.Cartesian3()),C.Cartesian3.multiplyByScalar(camera.up,dy*unit,new C.Cartesian3()),new C.Cartesian3());
        C.Cartesian3.add(camera.position,delta,camera.position);
      },
      shiftAfterZoom(before){const delta=C.Cartesian3.subtract(camera.position,before,new C.Cartesian3()),along=C.Cartesian3.multiplyByScalar(camera.direction,C.Cartesian3.dot(delta,camera.direction),new C.Cartesian3());C.Cartesian3.add(target,C.Cartesian3.subtract(delta,along,delta),target);}
    };
  },
  nearestModelPixel(point,width,height,hit,bounds=null,maxProbes=128){
    const distance=box=>Math.hypot(Math.max(box.left-point.x,0,point.x-(box.right-1)),Math.max(box.top-point.y,0,point.y-(box.bottom-1)));
    const root={left:Math.max(0,Math.floor(bounds?.left??0)),top:Math.max(0,Math.floor(bounds?.top??0)),right:Math.min(width,Math.ceil(bounds?.right??width)),bottom:Math.min(height,Math.ceil(bounds?.bottom??height))};
    if(root.right<=root.left||root.bottom<=root.top)return null;
    const direct={x:Math.round(point.x),y:Math.round(point.y)};
    if(direct.x>=0&&direct.y>=0&&direct.x<width&&direct.y<height&&hit(direct,1,1))return direct;
    const queue=[root];let best=null,bestDistance=Infinity,probes=1;
    while(queue.length&&probes<maxProbes){
      queue.sort((a,b)=>distance(a)-distance(b));const box=queue.shift();
      if(distance(box)>=bestDistance)break;
      const w=box.right-box.left,h=box.bottom-box.top,center={x:(box.left+box.right-1)/2,y:(box.top+box.bottom-1)/2};
      probes++;if(!hit(center,w,h))continue;
      if(w===1&&h===1){best=center;bestDistance=Math.hypot(center.x-point.x,center.y-point.y);continue;}
      const xs=w>1?[box.left,box.left+Math.floor(w/2),box.right]:[box.left,box.right],ys=h>1?[box.top,box.top+Math.floor(h/2),box.bottom]:[box.top,box.bottom];
      for(let x=0;x<xs.length-1;x++)for(let y=0;y<ys.length-1;y++)queue.push({left:xs[x],right:xs[x+1],top:ys[y],bottom:ys[y+1]});
    }
    return best;
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
    await this.load();const C=window.Cesium;let moonLayer=null;const hasMoon=document.body.dataset.collection==='all';
    const viewer=new C.Viewer(container,{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,skyBox:false,skyAtmosphere:false,shouldAnimate:false,requestRenderMode:true,maximumRenderTimeChange:Infinity,showRenderLoopErrors:false,orderIndependentTranslucency:false,contextOptions:{webgl:{alpha:false,antialias:false}}});
    viewer.camera.constrainedAxis=C.Cartesian3.UNIT_Z;
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#000000');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#1d3443');
    viewer.scene.globe.preloadSiblings=false;viewer.scene.globe.preloadAncestors=false;viewer.scene.globe.tileCacheSize=100;viewer.scene.globe.maximumScreenSpaceError=3;
    if(viewer.scene.sun)viewer.scene.sun.show=false;viewer.scene.sunBloom=false;if(viewer.scene.moon)viewer.scene.moon.show=false;viewer.clock.shouldAnimate=false;
    const permanentSky=Boolean(AtlasPages.definition(document.body.dataset.collection)?.trajectory);
    const skyToggle=document.getElementById('sky-toggle');
    const skyLayer=AtlasSky.create(viewer,C);
    if(skyToggle)skyToggle.onclick=async()=>{
      if(permanentSky)return;
      const enabled=skyToggle.getAttribute('aria-checked')!=='true';
      skyToggle.setAttribute('aria-checked',String(enabled));
      skyToggle.setAttribute('aria-busy','true');
      try{await skyLayer.setEnabled(enabled);}
      catch(error){skyToggle.setAttribute('aria-checked','false');await skyLayer.setEnabled(false);console.warn('Ciel indisponible',error);}
      finally{skyToggle.setAttribute('aria-busy','false');}
    };
    if(permanentSky){
      if(skyToggle){skyToggle.disabled=true;skyToggle.setAttribute('aria-checked','true');skyToggle.title='Ciel étoilé permanent pour les missions lointaines';}
      await skyLayer.setEnabled(true);
    }
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
    controls.inertiaSpin=.72;controls.inertiaTranslate=.72;controls.inertiaZoom=.65;controls.zoomFactor=2;controls.maximumMovementRatio=.08;controls.minimumZoomDistance=150000;controls.maximumZoomDistance=AtlasPages.definition(document.body.dataset.collection)?.trajectory?1000000000000000:4000000000;
    if(AtlasPages.definition(document.body.dataset.collection)?.trajectory)viewer.camera.frustum.far=Math.max(viewer.camera.frustum.far||0,2000000000000000);
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
      if(moonLayer?.orbit(x*degrees*4,y*degrees*4))return;
      idleController?.cancel();viewer.camera.cancelFlight();
      const inspection=modelInspection();if(inspection){inspection.orbit(-x*degrees*viewer.canvas.clientHeight/360,-y*degrees*viewer.canvas.clientHeight/360);viewer.scene.requestRender();return;}
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
    // Let requestAnimationFrame follow the monitor, without a second 60 Hz limiter.
    viewer.targetFrameRate=undefined;viewer.useBrowserRecommendedResolution=false;
    viewer.scene.msaaSamples=1;
    viewer.resolutionScale=1/(window.devicePixelRatio||1);
    const renderBudget=window.AtlasRenderBudget?.create({width:viewer.canvas.clientWidth,height:viewer.canvas.clientHeight,devicePixelRatio:window.devicePixelRatio||1,apply:quality=>{
      viewer.resolutionScale=quality.resolutionScale;viewer.scene.globe.maximumScreenSpaceError=quality.pixelRatio<.85?5:3;viewer.resize();viewer.scene.requestRender();
    }});
    viewer.atlasRenderQuality=renderBudget;
    let lastCameraActivity=-Infinity;
    viewer.camera.changed.addEventListener(()=>{lastCameraActivity=performance.now();});
    viewer.scene.postRender.addEventListener(()=>renderBudget?.sample(performance.now(),active&&!document.hidden&&(motion.active||satellites.active||performance.now()-lastCameraActivity<150||!!viewer.scene.tweens?.length)));
    const satellitePrimitives=viewer.scene.primitives.add(new C.PrimitiveCollection());
    const satellites=satellitePrimitives.add(window.AtlasPointCloud?window.AtlasPointCloud.create(C,viewer):new C.PointPrimitiveCollection()), lines=satellitePrimitives.add(new C.PolylineCollection()), labels=satellitePrimitives.add(new C.LabelCollection());
    // Latch one instant before camera tracking; GPU uniforms keep it through every frustum pass.
    viewer.scene.preUpdate.addEventListener(()=>satellites.setFrameTime?.(performance.now()));
    const past=lines.add({positions:[],width:1.5,material:C.Material.fromType('Color',{color:C.Color.fromCssColorString('#e0e0e0')})});
    const future=lines.add({positions:[],width:2,material:C.Material.fromType('PolylineDash',{color:C.Color.fromCssColorString('#a9c5df'),dashLength:12})});
    const pastJoin=lines.add({positions:[],width:1.5,material:past.material});
    const futureJoin=lines.add({positions:[],width:2,material:future.material});
    const heightLine=lines.add({positions:[],width:2,material:C.Material.fromType('Color',{color:C.Color.WHITE})});
    const label=labels.add({text:'',show:false,horizontalOrigin:C.HorizontalOrigin.LEFT,verticalOrigin:C.VerticalOrigin.BASELINE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#080b10').withAlpha(.82),backgroundPadding:new C.Cartesian2(6,4),disableDepthTestDistance:Infinity,font:'14px Arial, sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(12,-12)});
    // Screen-space text avoids large-coordinate precision loss in Cesium glyphs.
    const distantCaption=document.createElement('div');distantCaption.className='distant-satellite-label';distantCaption.hidden=true;viewer.container.append(distantCaption);let captionEnabled=false;
    const extraLabels=satellitePrimitives.add(new C.LabelCollection()),nameItems=new Map();
    const selectedOutline=C.Color.fromCssColorString('#a9c5df'),unselectedOutline=C.Color.fromCssColorString('#1a1d25');
    const selectedMarker=satellitePrimitives.add(new C.PointPrimitiveCollection()).add({show:false,pixelSize:9,outlineWidth:2,outlineColor:C.Color.fromCssColorString('#a9c5df'),color:C.Color.WHITE});
    const issIcon=AtlasISS.iconURI,tiangongIcon=AtlasTiangong.iconURI;
    const issFallback=satellitePrimitives.add(new C.BillboardCollection()).add({id:25544,image:issIcon,width:64,height:44,show:false});
    let issModel=null,issVisible=false,issRequested=false;function loadISS(){if(issRequested)return;issRequested=true;AtlasISS.createModel(C,{primitives:satellitePrimitives}).then(model=>{issModel=model;if(lastData)api.update({...lastData,focus:false});}).catch(error=>{container.dataset.modelError=error.message;console.error('Modèle ISS :',error);});}
    const tiangongFallback=satellitePrimitives.add(new C.BillboardCollection()).add({id:48274,image:tiangongIcon,width:64,height:44,show:false});
    let tiangongModel=null,tiangongVisible=false,tiangongRequested=false;
    function loadTiangong(){if(tiangongRequested)return;tiangongRequested=true;
    AtlasTiangong.createModel(C,{primitives:satellitePrimitives}).then(model=>{tiangongModel=model;if(lastData)api.update({...lastData,focus:false});}).catch(error=>{container.dataset.tiangongModelError=error.message;});}
    function sizeISS(){
      if(!lastData||moonLayer?.active)return;
      const size=AtlasISS.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,lastData.collection==='all'&&issFallback.position?C.Cartesian3.distance(viewer.camera.positionWC,issFallback.position):viewer.camera.positionCartographic.height,lastData.selected===25544,lastData.collection);
      const issPixels=Math.max(16,size);issFallback.width=issPixels;issFallback.height=issPixels*.7;if(issModel)issModel.minimumPixelSize=issPixels;
      if(issVisible&&size>7)loadISS();
      const issSymbol=lastData.collection==='all'&&size<=7;issFallback.image=issIcon;issFallback.show=issVisible&&!detailedLayer.replaces(25544)&&(issSymbol||!issModel);if(issModel)issModel.show=issVisible&&!detailedLayer.replaces(25544)&&!issSymbol;
      const tgSize=AtlasTiangong.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,lastData.collection==='all'&&tiangongFallback.position?C.Cartesian3.distance(viewer.camera.positionWC,tiangongFallback.position):viewer.camera.positionCartographic.height,lastData.selected===48274,lastData.collection);
      const tgPixels=Math.max(16,tgSize);tiangongFallback.width=tgPixels;tiangongFallback.height=tgPixels*.7;if(tiangongModel)tiangongModel.minimumPixelSize=tgPixels;
      if(tiangongVisible&&tgSize>7)loadTiangong();
      const tgSymbol=lastData.collection==='all'&&tgSize<=7;tiangongFallback.image=tiangongIcon;tiangongFallback.show=tiangongVisible&&!detailedLayer.replaces(48274)&&(tgSymbol||!tiangongModel);if(tiangongModel)tiangongModel.show=tiangongVisible&&!detailedLayer.replaces(48274)&&!tgSymbol;
    }
    viewer.scene.preUpdate.addEventListener(sizeISS);
    const scienceLayer=AtlasScience.createLayer(C,viewer,()=>{if(lastData)api.update({...lastData,focus:false});},satellitePrimitives);
    let detailRefreshQueued=false;
    const detailedLayer=AtlasDetailed.createLayer(C,viewer,container,()=>{
      if(detailRefreshQueued)return;detailRefreshQueued=true;queueMicrotask(()=>{detailRefreshQueued=false;if(detailedLayer.loading){modelZoomTarget=null;stopJoystick();pendingX=0;pendingY=0;stopModelDrag();viewer.camera.cancelFlight();idleController?.cancel();}else idleController?.activity();if(lastData)api.update({...lastData,focus:false});});
    },focusDetailedModel,satellitePrimitives);
    function focusDetailedModel(id,model){
      if(!active||!lastData?.points.some(p=>p.id===id))return;
      // Select first so position updates maintain the same close tracking frame.
      if(lastData.selected!==id)onSelect(id);
      const chosen=lastData.points.find(p=>p.id===id);if(!chosen)return;
      idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;stopModelDrag();releaseFollow();
      following=true;followPitch=-.5;viewer.camera.cancelFlight();
      const radius=Math.max(1,model.boundingSphere?.radius||AtlasScience.model(id)?.radius||75);
      viewer.camera.lookAt(position(chosen),new C.HeadingPitchRange(0,followPitch,AtlasGlobe.detailedRange(radius,viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy)));
      followReady=true;updateFollowControl(chosen);viewer.scene.requestRender();
    }
    // Resolve visibility after both layers' animation callbacks, including models
    // whose asynchronous loading finished between two position snapshots.
    viewer.scene.preUpdate.addEventListener(()=>{
      if(!active||!lastData)return;
      sizeISS();
      for(const {id} of scienceLayer.hits())scienceLayer.suppress(id,detailedLayer.replaces(id));
    });
    viewer.scene.renderError.addEventListener((scene,error)=>{
      globalThis.AtlasLoading?.fail();
      if(!earthLayer.recover(error)&&!detailedLayer.recover(error)&&!satellites.recover?.(error)){document.getElementById('notice').textContent='Rendu 3D indisponible : '+(error?.message||error)+'. Le planisphère reste accessible.';return;}
      const rethrow=scene.rethrowRenderErrors;scene.rethrowRenderErrors=false;
      queueMicrotask(()=>{scene.rethrowRenderErrors=rethrow;if(active){viewer.useDefaultRenderLoop=true;scene.requestRender();}});
    });
    const items=new Map(),lime=C.Color.fromCssColorString('#c8efff'),white=C.Color.WHITE;let active=true,lastSelection=null,lastData=null,paletteKey='',pointColors=new WeakMap(),palette=Object.fromEntries(AtlasPages.definitions.map(row=>[row.id,white]));let firstOverview=true;
    let modelZoomTarget=null,overviewZoomTarget=null,modelZoomAnchor=null,zoomPointer=null,zoomPointerAt=-Infinity,inspectionState=null,inspectionModel=null,inspectionFrame=null;
    let followPitch=-.8,following=false,followReady=false,followCurrent=null,lastSelectionRequest=null;
    let idleController=null,idleFlight=false,ignoreOverviewClick=false,overviewPosition=null;
        const followButton=document.getElementById('globe-follow');
    const releaseFollow=()=>{inspectionState=null;inspectionModel=null;modelZoomTarget=null;modelZoomAnchor=null;zoomPointer=null;overviewZoomTarget=null;if(followReady)viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);followReady=false;};
    const distantView=()=>Boolean(AtlasPages.definition(lastData?.collection||document.body.dataset.collection)?.trajectory||AtlasPages.definition(AtlasPages.family(lastData?.catalog.get(lastData?.selected)||{}))?.trajectory);
    const measurementTitle=()=>distantView()?'Distance de la Terre':'Altitude estimée';
    const measurementValue=point=>distantView()&&point?.icrf_km?Math.hypot(...point.icrf_km):point?.altitude_km;
    const modelFollow=()=>following&&followReady&&(!!detailedLayer.getModel(lastData?.selected)||AtlasScience.has(lastData?.selected)||[25544,48274].includes(lastData?.selected));
    const modelZoomAvailable=()=>modelFollow()||!!detailedLayer.getModel(lastData?.selected);
    function modelInspection(){
      const id=lastData?.selected;
      const model=active&&!moonLayer?.active&&!detailedLayer.loading?(detailedLayer.getModel(id)||scienceLayer.getModel(id)||(id===25544&&issModel?.show&&issModel.ready?issModel:id===48274&&tiangongModel?.show&&tiangongModel.ready?tiangongModel:null)):null;
      if(!model){inspectionState=null;inspectionModel=null;return null;}
      if(!inspectionState||inspectionModel!==model||inspectionFrame!==followReady){
        const matrix=model.modelMatrix||C.Matrix4.IDENTITY,inverse=C.Matrix4.inverseTransformation(viewer.camera.transform||C.Matrix4.IDENTITY,new C.Matrix4());
        const pivot=followReady?C.Cartesian3.ZERO:C.Matrix4.multiplyByPoint(inverse,C.Matrix4.getTranslation(matrix,new C.Cartesian3()),new C.Cartesian3());
        // Camera orbit keeps its own vertical; the station body +Z may point nadir.
        const worldCentre=C.Matrix4.getTranslation(matrix,new C.Cartesian3());
        const up=followReady?C.Cartesian3.UNIT_Z:C.Cartesian3.magnitudeSquared(worldCentre)>1?C.Matrix4.multiplyByPointAsVector(inverse,C.Cartesian3.normalize(worldCentre,new C.Cartesian3()),new C.Cartesian3()):C.Cartesian3.UNIT_Z;
        inspectionState=AtlasGlobe.inspectionControls(C,viewer.camera,{pivot,up,height:()=>viewer.canvas.clientHeight});inspectionModel=model;inspectionFrame=followReady;
      }
      return inspectionState;
    }
    const inspectionHelp='Glisser : tourner · Maj + glisser ou clic droit : déplacer · Molette : zoomer · F : cadrer';
    function stopModelDrag(){
      if(!globeDrag)return;const pointer=globeDrag.pointerId;globeDrag=null;heldPointers.delete(pointer);if(viewer.canvas.hasPointerCapture?.(pointer))viewer.canvas.releasePointerCapture(pointer);viewer.canvas.style.cursor=modelInspection()?'grab':'';
    }
    viewer.canvas.addEventListener('pointerdown',event=>{
      const inspection=modelInspection();if(!inspection||globeDrag||![0,1,2].includes(event.button))return;
      event.preventDefault();event.stopImmediatePropagation();idleController?.cancel();viewer.camera.cancelFlight();stopJoystick();
      overviewZoomTarget=modelZoomTarget=null;modelZoomAnchor=null;zoomPointer=null;
      globeDrag={pointerId:event.pointerId,button:event.button,pan:event.button!==0||event.shiftKey,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false};
      heldPointers.add(event.pointerId);viewer.canvas.setPointerCapture?.(event.pointerId);viewer.canvas.style.cursor='grabbing';viewer.canvas.focus({preventScroll:true});
    },{capture:true,passive:false});
    viewer.canvas.addEventListener('pointermove',event=>{
      if(!globeDrag||event.pointerId!==globeDrag.pointerId)return;
      event.preventDefault();event.stopImmediatePropagation();const inspection=modelInspection();if(!inspection){stopModelDrag();return;}
      if(!globeDrag.moved&&Math.hypot(event.clientX-globeDrag.startX,event.clientY-globeDrag.startY)<3)return;
      const box=viewer.canvas.getBoundingClientRect(),sx=viewer.canvas.clientWidth/Math.max(1,box.width),sy=viewer.canvas.clientHeight/Math.max(1,box.height);
      const dx=(event.clientX-globeDrag.x)*sx,dy=(event.clientY-globeDrag.y)*sy;globeDrag.x=event.clientX;globeDrag.y=event.clientY;globeDrag.moved=true;
      modelZoomTarget=null;modelZoomAnchor=null;zoomPointer=null;
      if(globeDrag.pan||event.shiftKey)inspection.pan(dx,dy);else inspection.orbit(dx,dy);
      idleController?.activity();viewer.scene.requestRender();
    },{capture:true,passive:false});
    viewer.canvas.addEventListener('pointerup',event=>{
      if(!globeDrag||event.pointerId!==globeDrag.pointerId)return;
      event.preventDefault();event.stopImmediatePropagation();const click=!globeDrag.moved&&globeDrag.button===0&&!globeDrag.pan&&Math.hypot(event.clientX-globeDrag.startX,event.clientY-globeDrag.startY)<3;stopModelDrag();
      if(click){const box=viewer.canvas.getBoundingClientRect();clickScene({position:new C.Cartesian2((event.clientX-box.left)*viewer.canvas.clientWidth/Math.max(1,box.width),(event.clientY-box.top)*viewer.canvas.clientHeight/Math.max(1,box.height))});}
    },{capture:true,passive:false});
    for(const type of ['pointercancel','lostpointercapture'])viewer.canvas.addEventListener(type,stopModelDrag);
    viewer.canvas.addEventListener('contextmenu',event=>{if(modelInspection())event.preventDefault();});
    viewer.canvas.addEventListener('dblclick',event=>{if(modelInspection()){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
    window.addEventListener('blur',stopModelDrag);

    const pointerModelAnchor=(pointer,model)=>{
      const canvas=viewer.canvas,box=canvas.getBoundingClientRect(),scaleX=canvas.clientWidth/Math.max(1,box.width),scaleY=canvas.clientHeight/Math.max(1,box.height);
      const mouse={x:(pointer.clientX-box.left)*scaleX,y:(pointer.clientY-box.top)*scaleY};
      if(!Number.isFinite(mouse.x)||!Number.isFinite(mouse.y)||!viewer.scene.pick)return null;
      const now=performance.now();
      if(followReady&&modelZoomAnchor&&zoomPointer?.id===lastData.selected&&Math.hypot(mouse.x-zoomPointer.x,mouse.y-zoomPointer.y)<2&&now-zoomPointerAt<200){zoomPointerAt=now;return modelZoomAnchor;}
      const matches=pick=>pick&&(pick.primitive===model||pick.id===lastData.selected);
      let bounds=null;
      const sphere=model.boundingSphere;
      if(sphere){const center=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,sphere.center);if(center){const edge=C.Cartesian3.add(sphere.center,C.Cartesian3.multiplyByScalar(viewer.camera.rightWC,sphere.radius*Math.max(1,model.computedScale/(model.scale||1)||1),new C.Cartesian3()),new C.Cartesian3()),projected=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,edge);if(projected){const r=Math.abs(projected.x-center.x)+4;bounds={left:center.x-r,right:center.x+r,top:center.y-r,bottom:center.y+r};}}}
      const pixel=AtlasGlobe.nearestModelPixel(mouse,canvas.clientWidth,canvas.clientHeight,(p,w,h)=>matches(viewer.scene.pick(new C.Cartesian2(p.x,p.y),w,h)),bounds);
      if(!pixel)return null;
      let world;
      if(viewer.scene.pickPositionSupported){try{world=viewer.scene.pickPosition(new C.Cartesian2(pixel.x,pixel.y));}catch{}}
      // Depth reconstruction is optional; the visible surface pixel still defines
      // the zoom ray on browsers without a depth texture.
      if(!world&&sphere&&viewer.camera.getPickRay){const ray=viewer.camera.getPickRay(new C.Cartesian2(pixel.x,pixel.y));if(ray){const delta=C.Cartesian3.subtract(sphere.center,ray.origin,new C.Cartesian3()),denominator=C.Cartesian3.dot(ray.direction,viewer.camera.directionWC);if(Math.abs(denominator)>1e-8){const t=C.Cartesian3.dot(delta,viewer.camera.directionWC)/denominator;if(t>0)world=C.Ray.getPoint(ray,t,new C.Cartesian3());}}}
      if(!world||![world.x,world.y,world.z].every(Number.isFinite))return null;
      const inverse=C.Matrix4.inverseTransformation(viewer.camera.transform||C.Matrix4.IDENTITY,new C.Matrix4());
      zoomPointer={...mouse,id:lastData.selected};zoomPointerAt=now;
      return C.Matrix4.multiplyByPoint(inverse,world,new C.Cartesian3());
    };
    const zoomModel=(direction,strength=1,pointer=null)=>{
      if(!modelZoomAvailable())return false;
      const detailed=detailedLayer.getModel(lastData?.selected);
      let anchor=pointer&&detailed?pointerModelAnchor(pointer,detailed):(!pointer&&detailed?modelInspection()?.pivot:null);
      if(!pointer&&detailed&&!followReady&&!anchor){const world=detailed.modelMatrix?C.Matrix4.getTranslation(detailed.modelMatrix,new C.Cartesian3()):detailed.boundingSphere?.center;if(world)anchor=C.Matrix4.multiplyByPoint(C.Matrix4.inverseTransformation(viewer.camera.transform||C.Matrix4.IDENTITY,new C.Matrix4()),world,new C.Cartesian3());}
      if(pointer&&detailed&&!anchor)return true;
      if(anchor){
        if(anchor!==modelZoomAnchor)modelZoomTarget=null;
        modelZoomAnchor=anchor;
        const range=C.Cartesian3.distance(viewer.camera.position,anchor);
        modelZoomTarget=AtlasGlobe.modelZoomRange(modelZoomTarget??range,direction,strength,5,true,distantView());
        viewer.scene.requestRender();return true;
      }
      modelZoomAnchor=null;zoomPointer=null;
      const radius=AtlasScience.model(lastData.selected)?.radius||([25544,48274].includes(lastData.selected)?75:60);
      modelZoomTarget=AtlasGlobe.modelZoomRange(modelZoomTarget??C.Cartesian3.magnitude(viewer.camera.position),direction,strength,radius,detailedLayer.replaces(lastData.selected),distantView());
      viewer.scene.requestRender();return true;
    };
    const overviewRange=()=>followReady?C.Cartesian3.magnitude(viewer.camera.position):viewer.camera.positionCartographic.height;
    const zoomOverview=(direction,strength=1)=>{
      viewer.camera.cancelFlight();
      overviewZoomTarget=(distantView()?AtlasGlobe.distantZoomRange:AtlasGlobe.overviewZoomHeight)(overviewZoomTarget??overviewRange(),direction,strength);
      viewer.scene.requestRender();
    };
    viewer.canvas.addEventListener('pointerdown',()=>{overviewZoomTarget=null;modelZoomTarget=null;modelZoomAnchor=null;zoomPointer=null;},{passive:true});
    viewer.canvas.addEventListener('wheel',event=>{
      if(!active)return;
      event.preventDefault();event.stopImmediatePropagation();idleController?.cancel();
      const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewer.canvas.clientHeight:1);
      if(pixels&&!detailedLayer.loading){const direction=pixels<0?1:-1,strength=Math.abs(pixels)/100;if(moonLayer?.zoom(direction,strength))return;if(!zoomModel(direction,strength,event))zoomOverview(direction,strength);}
    },{capture:true,passive:false});
    viewer.scene.preUpdate.addEventListener(()=>{
      const inspection=modelInspection();controls.enableRotate=controls.enableTranslate=controls.enableTilt=controls.enableLook=!inspection;
      viewer.camera.constrainedAxis=inspection||moonLayer?.active?undefined:C.Cartesian3.UNIT_Z;
      viewer.canvas.dataset.modelInspection=String(!!inspection);viewer.canvas.title=inspection?inspectionHelp:'';
      if(!globeDrag)viewer.canvas.style.cursor=inspection?'grab':'';
      controls.enableCollisionDetection=!moonLayer?.active&&!inspection;
      if(moonLayer?.active){controls.enableInputs=false;controls.enableZoom=false;controls.minimumZoomDistance=1;return;}
      controls.enableInputs=!detailedLayer.loading;controls.enableZoom=!modelZoomAvailable()&&!distantView();controls.minimumZoomDistance=modelFollow()?1:distantView()?1000:150000;
      if(overviewZoomTarget!==null&&!detailedLayer.loading){
        const height=overviewRange(),delta=(height-overviewZoomTarget)*.28;
        if(Math.abs(delta)<1)overviewZoomTarget=null;
        else{if(followReady)C.Cartesian3.multiplyByScalar(viewer.camera.position,(height-delta)/height,viewer.camera.position);else delta>0?viewer.camera.zoomIn(delta):viewer.camera.zoomOut(-delta);viewer.scene.requestRender();}
      }
      if(modelFollow()&&!detailedLayer.replaces(lastData.selected)){
        const radius=AtlasScience.model(lastData.selected)?.radius||([25544,48274].includes(lastData.selected)?75:60),minimum=Math.max(2,radius*1.5);
        if(C.Cartesian3.magnitude(viewer.camera.position)<minimum-.1)modelZoomTarget=Math.max(modelZoomTarget??minimum,minimum);
      }
      if(modelZoomTarget===null||!modelZoomAvailable())return;
      const camera=viewer.camera,anchor=modelZoomAnchor||C.Cartesian3.ZERO,offset=C.Cartesian3.subtract(camera.position,anchor,new C.Cartesian3()),range=C.Cartesian3.magnitude(offset);
      if(range<1e-8){modelZoomTarget=null;return;}
      const next=range+(modelZoomTarget-range)*.35;
      const before=C.Cartesian3.clone(camera.position);
      C.Cartesian3.add(anchor,C.Cartesian3.multiplyByScalar(offset,next/range,offset),camera.position);
      inspection?.shiftAfterZoom(before);
      if(Math.abs(next-modelZoomTarget)<.05)modelZoomTarget=null;
      viewer.scene.requestRender();
    });
    const debrisTarget=()=>lastData?.collection==='debris'||(lastData?.selected!==null&&lastData?.catalog.get(lastData?.selected)?.family==='debris')||document.body.dataset.collection==='debris';
    const stopFollowing=()=>{following=false;releaseFollow();document.getElementById('compass').hidden=true;document.getElementById('satellite-views').hidden=true;if(lastData?.collection==='all'){followButton.hidden=true;document.getElementById('follow-state').hidden=true;}document.getElementById('advanced-model-options').dataset.following='false';followButton.setAttribute('aria-pressed','false');followButton.textContent=debrisTarget()?'Suivre l’objet':'Suivre le satellite';document.getElementById('follow-state').textContent=lastData?.selected!==null&&lastData?'Suivre la lecture, même accélérée':debrisTarget()?'Sélectionne un objet':'Sélectionne un satellite';};
    const updateFollowControl=chosen=>{
      const idle=!!idleController?.active;
      const inSatelliteView=following&&!!chosen&&!idle;
      document.getElementById('compass').hidden=!inSatelliteView||viewer.container.closest('.view').dataset.deepSpace==='true';
      document.getElementById('satellite-views').hidden=!inSatelliteView;
      followButton.hidden=lastData?.collection==='all'&&!inSatelliteView;
      document.getElementById('follow-state').hidden=followButton.hidden;
      const target=chosen||AtlasGlobe.followTarget(lastData);
      followButton.disabled=!target&&!idle&&!following;
      followButton.title=target?'Suivre '+(lastData.catalog.get(target.id)?.name||target.id):'Aucun objet disponible à cette date';
      document.getElementById('advanced-model-options').dataset.following=String(following&&!!chosen);followButton.setAttribute('aria-pressed',String(following||idle));
      followButton.textContent=following||idle?'Arrêter le suivi':debrisTarget()?'Suivre l’objet':'Suivre le satellite';
      document.getElementById('follow-state').textContent=detailedLayer.getModel(lastData?.selected)?inspectionHelp:idle?'Vue globale · suivi automatique de '+(lastData?.collection==='tiangong'?'Tiangong':'l’ISS'):following?(chosen?'Caméra centrée · zoom et rotation disponibles':'Suivi suspendu : position indisponible'):(chosen?'Suivre la lecture, même accélérée':target?'Centrer sur '+(lastData.catalog.get(target.id)?.name||target.id):debrisTarget()?'Sélectionne un objet':'Sélectionne un satellite');
    };
    const position=(p,result)=>p.icrf_km&&window.AtlasCelestialFrame?window.AtlasCelestialFrame.position(C,viewer.clock.currentTime,p.icrf_km,result):AtlasGeometry.geodeticPosition(p.lon,p.lat,p.altitude_km*1000,result||new C.Cartesian3());
    const motion=new SatelliteMotion();let motionAt=null,motionSource=null,motionSmooth=false,animatedPoints=[],lastPointFrame=-Infinity;
    const orbit=rows=>rows.map(p=>AtlasGeometry.geodeticPosition(p[1],p[0],p[2]*1000,new C.Cartesian3()));
    let bridgePosition=null;
    function updateOrbitConnectors(xyz){
      if(bridgePosition&&C.Cartesian3.equals(bridgePosition,xyz))return;
      bridgePosition=C.Cartesian3.clone(xyz,bridgePosition||new C.Cartesian3());
      const a=past.positions.at(-1),b=future.positions[0];
      const array=p=>[p.x,p.y,p.z],subtract=(p,q)=>[p.x-q.x,p.y-q.y,p.z-q.z];
      const fallback=a&&b?subtract(b,a):a?subtract(xyz,a):b?subtract(b,xyz):[0,0,0];
      const before=a&&past.positions.length>1?subtract(a,past.positions.at(-2)):fallback;
      const after=b&&future.positions.length>1?subtract(future.positions[1],b):fallback;
      const normalize=v=>{const n=Math.hypot(...v);return v.map(x=>n?x/n:0);},start=normalize(before),end=normalize(after);
      const u=a&&b?C.Cartesian3.distance(a,xyz)/Math.max(1,C.Cartesian3.distance(a,xyz)+C.Cartesian3.distance(b,xyz)):.5;
      const direction=start.map((v,i)=>v*(1-u)+end[i]*u);
      const curve=(p,q,first,last)=>AtlasGeometry.orbitConnector(array(p),array(q),first,last).map(v=>new C.Cartesian3(...v));
      pastJoin.positions=a?curve(a,xyz,before,direction):[];
      futureJoin.positions=b?curve(xyz,b,direction,after):[];
    }
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
    const home=()=>{moonLayer?.leave();detailedLayer.cancel();idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;stopModelDrag();stopFollowing();returningHome=true;updateHomeState();return new Promise(resolve=>viewer.camera.flyTo({...homeView(),duration:.65,complete:()=>{returningHome=false;rememberHome();updateHomeState();resolve();},cancel:()=>{returningHome=false;updateHomeState();resolve();}}));};
    viewer.resize();viewer.camera.setView(homeView());rememberHome();updateHomeState();
    viewer.camera.changed.addEventListener(updateHomeState);
    viewer.camera.moveEnd.addEventListener(updateHomeState);
    // Project geographic cardinal directions at the tracked object. In overview,
    // use the viewed Earth surface. Heading alone loses roll and below-object views.
    const northVector=new C.Cartesian3(),eastVector=new C.Cartesian3(),enu=new C.Matrix4();
    let previousAngle=null,continuousAngle=0,displayedAngle=null;
    const northAngle=()=>{
      const chosen=following&&followReady&&lastData?.selected!=null?motion.get(lastData.selected):null;
      const tracked=following&&followReady?(followCurrent||(chosen?position(chosen):null)):null;
      const anchor=AtlasGlobe.compassAnchor(C,viewer.camera,viewer.scene.globe.ellipsoid,viewer.canvas.clientWidth,viewer.canvas.clientHeight,tracked);
      C.Transforms.eastNorthUpToFixedFrame(anchor,viewer.scene.globe.ellipsoid,enu);
      C.Matrix4.multiplyByPointAsVector(enu,C.Cartesian3.UNIT_Y,northVector);
      C.Matrix4.multiplyByPointAsVector(enu,C.Cartesian3.UNIT_X,eastVector);
      return AtlasGlobe.compassAngle(northVector,viewer.camera.rightWC,viewer.camera.upWC);
    };
    const updateCompass=()=>{
      if(viewer.container.closest('.view').dataset.deepSpace==='true')return;
      const angle=northAngle(),angles=AtlasGlobe.cardinalAngles(northVector,eastVector,viewer.camera.rightWC,viewer.camera.upWC);
      const dial=document.getElementById('compass-dial');dial.style.transform='none';
      const near=angle!==null&&angles.east!==null&&Math.abs(Math.sin(angle-angles.east))<.4;
      for(const [name,value] of Object.entries(angles)){
        const mark=dial.querySelector('.'+name);if(!mark)continue;mark.hidden=value===null;
        if(value===null)continue;
        const radius=(Math.max(1,dial.clientWidth||65)/2-8)*(near&&['east','west'].includes(name)?.65:1);
        mark.style.left=mark.style.top='50%';mark.style.right=mark.style.bottom='auto';
        const transform=`translate(-50%,-50%) translate(${(Math.sin(value)*radius).toFixed(2)}px,${(-Math.cos(value)*radius).toFixed(2)}px)`;
        if(mark.style.transform!==transform)mark.style.transform=transform;
      }
      const pointer=dial.querySelector('i');if(pointer){pointer.hidden=angle===null;if(angle!==null)pointer.style.transform=`rotate(${C.Math.toDegrees(angle)}deg)`;}
      if(angle===null){document.getElementById('compass-bearing').textContent='—';document.getElementById('compass').setAttribute('aria-label','Nord géographique dans l’axe de vue');previousAngle=displayedAngle=null;return;}
      const degrees=C.Math.toDegrees(angle);
      if(previousAngle===null)continuousAngle=degrees;else continuousAngle+=((degrees-previousAngle+540)%360)-180;
      previousAngle=degrees;
      if(displayedAngle===null||Math.abs(continuousAngle-displayedAngle)>.01){
        const bearing=Math.round((360-degrees)%360)%360;
        document.getElementById('compass-bearing').textContent=`${bearing}°`;
        document.getElementById('compass').setAttribute('aria-label',`Nord géographique : orientation ${bearing} degrés. Cliquer pour remettre le nord en haut`);
        displayedAngle=continuousAngle;
      }
    };
    viewer.scene.postRender.addEventListener(updateCompass);
    window.addEventListener('atlas:mission-loading-check',()=>viewer.scene.requestRender());
    viewer.scene.postRender.addEventListener(()=>{if(permanentSky&&active&&lastData&&globalThis.AtlasLoading?.missionFrameReady&&!detailedLayer.loading&&!scienceLayer.loading)globalThis.AtlasLoading.done('visuals');});
    viewer.camera.percentageChanged=.001;
    viewer.camera.changed.addEventListener(updateCompass);
    viewer.scene.preUpdate.addEventListener(()=>{
      if(!active||moonLayer?.active||!lastData||(!motion.active&&!satellites.active&&!following&&!idleController?.active))return;
      const tick=performance.now(),bulk=motion.active&&(tick-lastPointFrame>=1000/30-1||tick>=motion.started+motion.duration);
      // Bulk symbols update at 30 Hz. Camera and selected target retain 60 Hz.
      let rows;
      if(bulk){lastPointFrame=tick;rows=motion.sampleRows(tick,animatedPoints);}
      else{rows=[];for(const id of new Set([lastData.selected,AtlasPages.station(lastData.collection)])){const row=motion.get(id);if(row)rows.push(row);}motion.sampleRows(tick,rows);}
      let chosen=null,station=null;
      for(const p of rows){detailedLayer.move(p);scienceLayer.move(p);if(p.id===AtlasPages.station(lastData.collection))station=p;if(p.id===48274&&tiangongVisible){tiangongFallback.position=position(p);if(tiangongModel)tiangongModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}if(p.id===25544&&issVisible){issFallback.position=position(p);if(issModel)issModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}const point=items.get(p.id);if(point?.show){if(!satellites.commit)point.position=position(p);const name=nameItems.get(p.id);if(name?.show)name.position=point.position;}if(p.id===lastData.selected)chosen=p;}
      if(chosen){
        const marker=items.get(chosen.id);
        // Follow the displayed GPU interpolation, not its next observation endpoint.
        followCurrent=marker?.show&&!marker.skipGPU&&satellites.samplePosition?satellites.samplePosition(marker,new C.Cartesian3()):position(chosen);
        label.position=followCurrent;if(selectedMarker.show)selectedMarker.position=followCurrent;
        if(heightLine.positions.length)heightLine.positions=[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),followCurrent];
        updateOrbitConnectors(followCurrent);
      }
      if(idleController?.active&&!idleFlight&&station){
        const key=[station.lon,station.lat,viewer.canvas.clientWidth,viewer.canvas.clientHeight].join(':');
        if(key!==overviewPosition){overviewPosition=key;viewer.camera.setView(homeView(station));rememberHome();updateHomeState();}
      }
      if(motion.active||satellites.active)viewer.scene.requestRender();
      if(!following||!followReady||!chosen)return;
      // Changing transforms alone preserves the world camera. Retain its local
      // offset and orientation instead so the reference frame follows the target.
      const camera=viewer.camera,offset=C.Cartesian3.clone(camera.position),direction=C.Cartesian3.clone(camera.direction),up=C.Cartesian3.clone(camera.up),right=C.Cartesian3.clone(camera.right);
      camera.lookAtTransform(C.Transforms.eastNorthUpToFixedFrame(followCurrent));
      C.Cartesian3.clone(offset,camera.position);C.Cartesian3.clone(direction,camera.direction);C.Cartesian3.clone(up,camera.up);C.Cartesian3.clone(right,camera.right);
    });
    const labelMeasure=document.createElement('canvas').getContext('2d');labelMeasure.font='14px Arial, sans-serif';
    let labelTextKey=null,labelMetrics=null;
    function placeSatelliteLabel(){
      if((!label.show&&!captionEnabled)||!lastData)return;
      if(!active||moonLayer?.active){distantCaption.hidden=true;return;}
      const anchor=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,label.position);if(!anchor||!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y)){distantCaption.hidden=true;return;}
      const id=lastData.selected,width=viewer.canvas.clientWidth,height=viewer.canvas.clientHeight;
      const visual=AtlasScience.model(id)||AtlasStations.model(id),model=detailedLayer.getModel(id)||scienceLayer.getModel(id)||(id===25544?issModel:id===48274?tiangongModel:null);
      let radius=visual?visual.screenSize(width,height,(lastData.collection==='all'||visual?.key==='lageos')?C.Cartesian3.distance(viewer.camera.positionWC,label.position):viewer.camera.positionCartographic.height,true,lastData.collection)/2:6;
      let center=anchor;
      if(model?.ready&&model.show){
        const sphere=model.boundingSphere,scale=Math.max(1,model.computedScale/(model.scale||1)),size=sphere.radius*scale;
        center=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,sphere.center)||anchor;
        const edge=C.Cartesian3.add(sphere.center,C.Cartesian3.multiplyByScalar(viewer.camera.rightWC,size,new C.Cartesian3()),new C.Cartesian3());
        const projected=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,edge);
        if(projected&&Number.isFinite(projected.x))radius=Math.max(radius,Math.abs(projected.x-center.x));
      }
      const raw=`${lastData.catalog.get(id)?.name||id} · ${measurementValue(motion.get(id))?.toFixed(1)||'—'} km`;
      const maxWidth=Math.max(80,width-32),key=raw+'|'+maxWidth;
      if(key!==labelTextKey){
        labelTextKey=key;const lines=[];let line='';
        for(const word of raw.split(' ')){const next=line?line+' '+word:word;if(line&&labelMeasure.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}
        lines.push(line);label.text=lines.join('\n');labelMetrics={textWidth:Math.min(maxWidth,Math.max(...lines.map(text=>labelMeasure.measureText(text).width))+12),textHeight:lines.length*18+8,text:lines.join('\n')};
      }
      const {textWidth,textHeight}=labelMetrics;
      const layout=AtlasGeometry.labelPlacement({anchor,bounds:{left:center.x-radius,right:center.x+radius,top:center.y-radius,bottom:center.y+radius},width,height,textWidth,textHeight});
      if(captionEnabled){
        if(distantCaption.textContent!==labelMetrics.text)distantCaption.textContent=labelMetrics.text;
        distantCaption.style.width=textWidth+'px';distantCaption.style.transform=`translate(${Math.round(layout.x)}px,${Math.round(layout.y)}px)`;distantCaption.hidden=false;
      }else label.pixelOffset=new C.Cartesian2(layout.x-anchor.x,layout.y+textHeight/2-anchor.y);
    }
    viewer.scene.preRender.addEventListener(placeSatelliteLabel);
    function satelliteAtGlobeClick(click,precise=true){
      const exact=precise?viewer.scene.pick(click):null;if(exact&&typeof exact.id==='number')return exact.id;
      const radius=AtlasGeometry.pickRadius({mode:'3d',collection:lastData?.collection,height:viewer.camera.positionCartographic.height,touch:matchMedia('(pointer: coarse)').matches});
      const occluder=new C.EllipsoidalOccluder(viewer.scene.globe.ellipsoid,viewer.camera.positionWC),offset=new C.Cartesian3(),pickPosition=new C.Cartesian3();
      const ray=viewer.camera.getPickRay?.(click);
      let cone=0;
      if(ray){cone=1;for(const dx of [-radius,radius])for(const dy of [-radius,radius]){const edge=viewer.camera.getPickRay({x:click.x+dx,y:click.y+dy});cone=Math.min(cone,C.Cartesian3.dot(ray.direction,edge.direction));}cone=Math.max(0,cone-1e-9);}
      const pickTime=satellites.samplePosition?performance.now():0;
      function* projected(){
        function project(id,xyz){
          if(!xyz)return null;
          C.Cartesian3.subtract(xyz,viewer.camera.positionWC,offset);
          if(ray){const along=C.Cartesian3.dot(offset,ray.direction);if(along<=0||along*along<C.Cartesian3.dot(offset,offset)*cone*cone)return null;}
          if(C.Cartesian3.dot(offset,viewer.camera.directionWC)<=0||!occluder.isPointVisible(xyz))return null;
          const xy=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,xyz);
          return xy?{id,x:xy.x,y:xy.y}:null;
        }
        for(const [id,item] of items){if(!item.show)continue;const hit=project(id,satellites.samplePosition?satellites.samplePosition(item,pickPosition,pickTime):item.position);if(hit)yield hit;}
        for(const marker of scienceLayer.hits()){const hit=project(marker.id,marker.position);if(hit)yield hit;}
        if(issVisible){const hit=project(25544,issFallback.position);if(hit)yield hit;}
        if(tiangongVisible){const hit=project(48274,tiangongFallback.position);if(hit)yield hit;}
      }
      return AtlasGeometry.nearestHit(projected(),click,radius);
    }
    if(hasMoon){
      document.getElementById('earth-realistic-toggle').querySelector('span').textContent='Terre / Lune réaliste';
      // Lunar ephemerides must never hold up the first Earth frame.
      AtlasMoon.load().then(()=>{moonLayer=AtlasMoon.create({viewer,C,allowOrbit:false,navigateMoon:()=>globalThis.AtlasJourney.goMoon(),beforeTravel:()=>{onEmptySpace?.();idleController?.cancel();detailedLayer.cancel();stopFollowing();overviewZoomTarget=null;modelZoomTarget=null;},onEarth:home,onViewChange:lunar=>{
        satellitePrimitives.show=!lunar;viewer.camera.constrainedAxis=lunar?undefined:C.Cartesian3.UNIT_Z;earthLayer.setLunarView(lunar);hoverLabel.show=false;
        container.closest('.view').dataset.lunarView=String(lunar);updateFollowControl(null);
        document.dispatchEvent(new CustomEvent('atlas:lunar-view',{detail:{active:lunar}}));
      }});
      moonLayer.update(lastData?.at??Date.now());globalThis.AtlasCelestial={get active(){return moonLayer.active;}};viewer.scene.requestRender();if(earthLayer.enabled)return moonLayer.setRealistic(true);}).catch(error=>{document.getElementById('notice').textContent=error.message;});
    }
    const deepView=window.AtlasDeepSpaceView?.create({viewer,C,onEarth:()=>globalThis.AtlasJourney.goEarth()});
    const closeFromSky=(onSurface=false)=>{if(moonLayer?.active){moonLayer.close();return;}moonLayer?.close();if(onEmptySpace?.(onSurface)!==false)detailedLayer.cancel();};
    function clickScene(event){
      // Mission points never retarget the camera; empty space only folds the card.
      if(AtlasPages.definition(lastData?.collection||document.body.dataset.collection)?.trajectory){
        if(satelliteAtGlobeClick(event.position)===null){const detail=document.getElementById('detail');if(detail&&!detail.hidden&&detail.dataset.collapsed!=='true')document.getElementById('close')?.click();}
        return;
      }
      if(moonLayer?.active){if(moonLayer.hit(event.position))moonLayer.open();else if(viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid))moonLayer.offerEarth();else moonLayer.close();return;}
      if(moonLayer?.hit(event.position)){moonLayer.open();return;}
      const id=satelliteAtGlobeClick(event.position);
      if(id!==null&&AtlasPages.definition(AtlasPages.family(lastData?.catalog.get(id)||{}))?.trajectory)return;
      if(ignoreOverviewClick){ignoreOverviewClick=false;if(id===null&&!viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid))closeFromSky();return;}
      if(id!==null){hoverLabel.show=false;moonLayer?.close();if(modelInspection()&&id===lastData?.selected){const reopen=document.getElementById('detail-reopen');if(reopen&&!reopen.hidden)reopen.click();return;}onSelect(id);return;}
      closeFromSky(Boolean(viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid)));
    }
    viewer.screenSpaceEventHandler.setInputAction(clickScene,C.ScreenSpaceEventType.LEFT_CLICK);
    const hoverLabel=labels.add({show:false,font:'13px Arial, sans-serif',fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString('#080808').withAlpha(.9),backgroundPadding:new C.Cartesian2(6,4),pixelOffset:new C.Cartesian2(14,-18),disableDepthTestDistance:Infinity});
    let hoverId=null,hoverFrame=null,hoverPosition=null,lastHoverSample=-Infinity,hoverBlockedUntil=0;
    const hoverBlocked=()=>heldPointers.size>0||globeDrag!==null||joyPointer!==null||performance.now()<hoverBlockedUntil;
    viewer.canvas.addEventListener('wheel',()=>{hoverBlockedUntil=performance.now()+160;hoverLabel.show=false;},{passive:true});
    function hoverSatellite(){hoverFrame=null;lastHoverSample=performance.now();if(!active||moonLayer?.active||!lastData||!hoverPosition||hoverBlocked()){hoverLabel.show=false;return;}const id=satelliteAtGlobeClick(hoverPosition,false);hoverId=id;
      const point=id!==null&&id!==lastData.selected?lastData.points.find(p=>p.id===id):null;
      hoverLabel.show=!!point;if(point){hoverLabel.position=position(point);hoverLabel.text=lastData.catalog.get(id)?.name||String(id);}viewer.scene.requestRender();
    }
    viewer.screenSpaceEventHandler.setInputAction(event=>{if(hoverBlocked()){hoverLabel.show=false;return;}hoverPosition=event.endPosition;if(hoverFrame===null&&performance.now()-lastHoverSample>=40)hoverFrame=requestAnimationFrame(hoverSatellite);},C.ScreenSpaceEventType.MOUSE_MOVE);
    viewer.canvas.addEventListener('pointerleave',()=>{hoverPosition=null;hoverId=null;hoverLabel.show=false;viewer.scene.requestRender();});
    const api={
      get lunarActive(){return !!moonLayer?.active;},
      updateTime(at){if(!active)return;viewer.clock.currentTime=C.JulianDate.fromDate(new Date(at));moonLayer?.update(at);if(lastData)lastData={...lastData,at};viewer.scene.requestRender();},
      update(data){
        if(!active)return;lastData=data;if(hoverId===data.selected)hoverLabel.show=false;
        // A click starts tracking, including a second click on a released target.
        // Ordinary position updates preserve a deliberate camera release.
        if(data.selected!==null&&(data.selected!==lastSelection||data.selectionRequest!==lastSelectionRequest)){idleController?.cancel();if(data.selected!==lastSelection)followPitch=-.8;releaseFollow();following=true;}
        const motionChanged=motionSource!==data.points;
        if(motionChanged){
          motionSmooth=data.playing&&!data.focus&&motionAt!==null&&Math.abs(data.at-motionAt)<150000;
          const rows=satellites.commit?data.points.filter(p=>p.id===data.selected||p.id===25544||p.id===48274||AtlasScience.has(p.id)):data.points;
          motion.set(rows,performance.now(),motionSmooth);motionSource=data.points;motionAt=data.at;lastPointFrame=performance.now();
        }else if(data.selected!==null&&!motion.get(data.selected)){
          const point=data.points.find(p=>p.id===data.selected);if(point)motion.set([...motion.source,point],performance.now(),false);
        }
        viewer.clock.currentTime=C.JulianDate.fromDate(new Date(data.at));deepView?.setTarget(data.points.find(p=>p.id===data.selected)||(AtlasPages.definition(data.collection)?.trajectory?data.points[0]:null));deepView?.setEnabled(Boolean(AtlasPages.definition(data.collection)?.trajectory||(data.selected!==null&&AtlasPages.definition(AtlasPages.family(data.catalog.get(data.selected)||{}))?.trajectory)));if(deepView?.enabled){controls.maximumZoomDistance=1e15;viewer.camera.frustum.far=Math.max(viewer.camera.frustum.far||0,2e15);}earthLayer.update(data);moonLayer?.update(data.at);if(moonLayer?.active){viewer.scene.requestRender();return;}
        const nextPalette=data.collection==='all'?data.colors:null,key=JSON.stringify(nextPalette)+'|'+[...(data.groups||[])].join(',');if(key!==paletteKey){paletteKey=key;pointColors=new WeakMap();palette=Object.fromEntries(AtlasPages.definitions.map(row=>[row.id,nextPalette?C.Color.fromCssColorString(nextPalette[row.id]||'#c8efff'):row.id==='debris'?C.Color.fromCssColorString('#d9a15f'):['stations','science'].includes(row.category)?white:lime]));}
        issFallback.color=palette.iss;if(issModel)issModel.color=palette.iss;tiangongFallback.color=palette.tiangong;if(tiangongModel)tiangongModel.color=palette.tiangong;
        animatedPoints=motion.rows.filter(p=>{const satellite=data.catalog.get(p.id);return satellite&&data.visible(satellite,p.id)&&(!satellites.commit||p.id===data.selected||p.id===25544||p.id===48274||AtlasScience.has(p.id));});
        scienceLayer.begin();
        issVisible=false;issFallback.show=false;if(issModel)issModel.show=false;tiangongVisible=false;tiangongFallback.show=false;if(tiangongModel)tiangongModel.show=false;sizeISS();for(const item of items.values())item.show=false;for(const item of nameItems.values())item.show=false;let nameCount=0;
        const colorFor=satellite=>{let color=pointColors.get(satellite);if(!color){color=palette[AtlasPages.displayFamily(satellite,data.colors,data.groups)];pointColors.set(satellite,color);}return color;};
        const markerPixels=4.5*AtlasGeometry.markerScale(data.collection,viewer.canvas.clientWidth,viewer.canvas.clientHeight);
        for(const p of data.points){
          const satellite=data.catalog.get(p.id);if(!satellite||!data.visible(satellite,p.id))continue;
          if(detailedLayer.replaces(p.id))continue;
          if(scienceLayer.update(p,{selected:data.selected,collection:data.collection,color:p.id===data.selected?white:colorFor(satellite)}))continue;
          if(p.id===48274){tiangongVisible=true;tiangongFallback.position=position(p);tiangongFallback.show=!tiangongModel;if(tiangongModel){tiangongModel.show=true;tiangongModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}continue;}
          if(p.id===25544){issVisible=true;issFallback.position=position(p);issFallback.show=!issModel;if(issModel){issModel.show=true;issModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}continue;}
          let item=items.get(p.id);if(!item){item=satellites.add({id:p.id,pixelSize:3,color:lime,outlineWidth:0});items.set(p.id,item);}
          item.show=true;item.skipGPU=p.id===data.selected&&!distantView();item.cameraRelative=p.id===data.selected&&distantView();item.position=position(p,satellites.commit?item.target:undefined);item.color=p.id===data.selected?white:colorFor(satellite);item.pixelSize=p.id===data.selected?9:markerPixels;item.outlineWidth=p.id===data.selected?2:0;item.outlineColor=p.id===data.selected?selectedOutline:unselectedOutline;
          if(data.names&&p.id!==data.selected&&viewer.camera.positionCartographic.height<2500000&&nameCount<200&&C.Cartesian3.distance(viewer.camera.positionWC,item.position)<3000000){const screen=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,item.position);if(screen&&screen.x>=0&&screen.y>=0&&screen.x<=viewer.canvas.clientWidth&&screen.y<=viewer.canvas.clientHeight){let text=nameItems.get(p.id);if(!text){text=extraLabels.add({id:p.id,font:'11px Arial, sans-serif',fillColor:lime,outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(5,-5)});nameItems.set(p.id,text);}text.show=true;text.position=item.position;text.text=satellite.name;nameCount++;}}
        }
        const pickedItem=items.get(data.selected);selectedMarker.show=!!satellites.commit&&!!pickedItem?.show&&!!pickedItem.skipGPU;if(selectedMarker.show){selectedMarker.id=data.selected;selectedMarker.position=pickedItem.target;}
        satellites.commit?.(motionChanged?motion.started:performance.now(),motionSmooth,!motionChanged);
        detailedLayer.update(data);
        for(const p of data.points)if(detailedLayer.replaces(p.id)){
          scienceLayer.suppress(p.id);
          if(p.id===25544){issFallback.show=false;if(issModel)issModel.show=false;}
          if(p.id===48274){tiangongFallback.show=false;if(tiangongModel)tiangongModel.show=false;}
        }
        past.positions=data.orbits?orbit(data.track):[];future.positions=data.orbits?orbit(data.future):[];
        pastJoin.positions=[];futureJoin.positions=[];bridgePosition=null;
        const orbitPoint=data.points.find(p=>p.id===data.selected);
        if(orbitPoint&&data.orbits){
          // Bracket the whole interpolation span, including delayed snapshots.
          // Only the small curved connectors animate; the complete orbit stays static.
          const xyz=position(orbitPoint),displayed=motion.get(orbitPoint.id);
          const lag=displayed?C.Cartesian3.distance(position(displayed),xyz):0;
          const margin=Math.max(1000,(orbitPoint.speed_km_s||8)*2000)+lag;
          let a=past.positions.length-1,b=0;
          while(a>0&&C.Cartesian3.distance(past.positions[a],xyz)<margin)a--;
          while(b<future.positions.length-1&&C.Cartesian3.distance(future.positions[b],xyz)<margin)b++;
          past.positions=past.positions.slice(0,a+1);future.positions=future.positions.slice(b);
          updateOrbitConnectors(displayed?position(displayed):xyz);
        }
        const chosen=data.points.find(p=>p.id===data.selected);captionEnabled=!!chosen&&distantView();if(!captionEnabled)distantCaption.hidden=true;label.show=!!chosen&&!captionEnabled;heightLine.positions=[];
        if(data.selected===null)stopFollowing();
        document.getElementById('satellite-views').hidden=data.selected===null;
        document.getElementById('view-above').disabled=!chosen;document.getElementById('view-side').disabled=!chosen;
        updateFollowControl(chosen);
        if(!chosen)releaseFollow();
        document.getElementById('globe-measure').textContent=measurementTitle()+(lastData?.selected!==null?' : indisponible':debrisTarget()?' : sélectionnez un objet':' : sélectionnez un satellite');
        if(chosen){const xyz=position(chosen);heightLine.positions=data.groundLink!==false?[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),xyz]:[];label.position=xyz;label.text=`${data.catalog.get(chosen.id)?.name||chosen.id} · ${measurementValue(chosen).toFixed(1)} km`;
          document.getElementById('globe-measure').textContent=`${measurementTitle()} : ${measurementValue(chosen).toLocaleString(navigator.language,{maximumFractionDigits:1})} km`;
          if(following){
            const snap=!followReady||data.focus||data.selected!==lastSelection;
            if(snap){
              let range=AtlasGlobe.satelliteRange(chosen.altitude_km,viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy);
              if(data.closeFocus){
                const model=detailedLayer.getModel(chosen.id)||scienceLayer.getModel(chosen.id)||(chosen.id===25544?issModel:chosen.id===48274?tiangongModel:null);
                const visual=AtlasScience.model(chosen.id)||AtlasStations.model(chosen.id);
                range=(model||visual)?AtlasGlobe.detailedRange(Math.max(1,model?.boundingSphere?.radius||visual?.radius||75),viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy):250000;
                followPitch=-.5;
              }
              viewer.camera.cancelFlight();viewer.camera.lookAt(xyz,new C.HeadingPitchRange(0,followPitch,range));followReady=true;
            }
          }else if(data.focus||data.selected!==lastSelection)viewer.camera.flyToBoundingSphere(new C.BoundingSphere(xyz,1000000),{duration:.6,offset:new C.HeadingPitchRange(viewer.camera.heading,-.8,AtlasGlobe.satelliteRange(chosen.altitude_km,viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.frustum.fovy))});
        }
        lastSelection=data.selected;lastSelectionRequest=data.selectionRequest;container.dataset.points=String([...items.values()].filter(p=>p.show).length+(issVisible?1:0)+(tiangongVisible?1:0)+scienceLayer.count);container.dataset.altitudeScale='1';if(firstOverview&&data.points.length){firstOverview=false;if(data.selected===null&&data.points.some(p=>(AtlasPages.definition(AtlasPages.family(data.catalog.get(p.id)||p))?.frame_radius||0)>9000000&&data.visible(data.catalog.get(p.id)||p,p.id)))home();}viewer.scene.requestRender();
      },
      setRendering(value){renderBudget?.reset();if(!value&&detailedLayer.loading)detailedLayer.cancel();viewer.useDefaultRenderLoop=active&&value;if(active&&value)viewer.scene.requestRender();},
      setActive(value){if(!value)distantCaption.hidden=true;deepView?.setActive(value);renderBudget?.reset();if(!value){satellites.suspend?.();scienceLayer.release?.();moonLayer?.leave();moonLayer?.close();hoverLabel.show=false;detailedLayer.cancel();idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;stopModelDrag();releaseFollow();}active=value;viewer.useDefaultRenderLoop=value;if(value){viewer.resize();viewer.scene.requestRender();}},
      resize(){if(active){const atHome=resetButton.disabled&&!returningHome&&!moonLayer?.active;renderBudget?.resize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,window.devicePixelRatio||1);viewer.resize();if(atHome){viewer.camera.setView(homeView());rememberHome();updateHomeState();}viewer.scene.requestRender();}},
      home,
      detailedCredit(id){return detailedLayer.credit?.(id);},
      detailedActive(id){return detailedLayer.replaces(id);},
      orientOverview(point){overviewAnchor=point?{id:point.id,lon:point.lon,lat:point.lat,altitude_km:point.altitude_km}:null;home();},
      north(){idleController?.cancel();pendingX=0;pendingY=0;viewer.camera.cancelFlight();const angle=northAngle();if(angle!==null)viewer.camera.twistRight(angle);updateCompass();viewer.scene.requestRender();},
      async setRealistic(enabled){const result=await earthLayer.setEnabled(enabled);try{await moonLayer?.setRealistic(result);}catch(error){document.getElementById("earth-style-status").textContent=error.message;document.getElementById("earth-style-status").hidden=false;}return result;},
      zoom(direction){if(moonLayer?.zoom(direction))return;idleController?.cancel();if(zoomModel(direction))return;zoomOverview(direction);}
    };
    viewer.camera.moveEnd.addEventListener(()=>{if(active&&lastData&&lastData.names)api.update({...lastData,focus:false});});
    const compass=document.getElementById('compass');let compassDrag=null,suppressCompassClick=false;
    compass.onclick=()=>{if(suppressCompassClick){suppressCompassClick=false;return;}api.north();};
    compass.addEventListener('pointerdown',event=>{if(event.button!==0)return;idleController?.cancel();viewer.camera.cancelFlight();compassDrag={x:event.clientX,moved:false};compass.setPointerCapture(event.pointerId);});
    compass.addEventListener('pointermove',event=>{if(!compassDrag)return;const dx=event.clientX-compassDrag.x;if(!compassDrag.moved&&Math.abs(dx)<3)return;compassDrag.moved=true;compassDrag.x=event.clientX;viewer.camera.twistRight(C.Math.toRadians(dx*.5));updateCompass();viewer.scene.requestRender();});
    compass.addEventListener('pointerup',()=>{suppressCompassClick=!!compassDrag?.moved;compassDrag=null;});
    compass.addEventListener('pointercancel',()=>{compassDrag=null;suppressCompassClick=false;});document.getElementById('globe-home').onclick=()=>{if(modelInspection())focusDetailedModel(lastData.selected,inspectionModel);else home();};
    followButton.onclick=()=>{
      idleController?.cancel();
      if(following){stopFollowing();if(lastData)api.update({...lastData,focus:false});return;}
      const target=AtlasGlobe.followTarget(lastData);if(!target)return;
      following=true;
      if(lastData.selected!==target.id)onSelect(target.id);
      else api.update({...lastData,focus:true});
    };
    const satelliteView=pitch=>{idleController?.cancel();if(!lastData?.points.some(p=>p.id===lastData.selected))return;pendingX=0;pendingY=0;stopModelDrag();const inspection=modelInspection();if(inspection){modelZoomTarget=null;modelZoomAnchor=null;zoomPointer=null;inspection.view(pitch);updateCompass();viewer.scene.requestRender();return;}followPitch=pitch;following=true;api.update({...lastData,focus:true});updateCompass();};
    document.getElementById('view-above').onclick=()=>satelliteView(-Math.PI/2);
    document.getElementById('view-side').onclick=()=>satelliteView(0);
    document.getElementById('globe-plus').onclick=()=>api.zoom(1);document.getElementById('globe-minus').onclick=()=>api.zoom(-1);
    viewer.canvas.tabIndex=0;viewer.canvas.setAttribute('aria-label','Globe terrestre 3D interactif');
    viewer.canvas.addEventListener('keydown',event=>{const inspection=modelInspection();if(inspection&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==='f'){event.preventDefault();focusDetailedModel(lastData.selected,inspectionModel);return;}if(inspection&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();inspection.orbit(event.key==='ArrowLeft'?-18:event.key==='ArrowRight'?18:0,event.key==='ArrowUp'?-18:event.key==='ArrowDown'?18:0);viewer.scene.requestRender();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(moonLayer?.active){moonLayer.orbit(event.key==='ArrowLeft'?-12:event.key==='ArrowRight'?12:0,event.key==='ArrowUp'?-12:event.key==='ArrowDown'?12:0);return;}let heading=viewer.camera.heading,pitch=viewer.camera.pitch;const step=C.Math.toRadians(5);if(event.key==='ArrowLeft')heading-=step;if(event.key==='ArrowRight')heading+=step;if(event.key==='ArrowUp')pitch=Math.min(-.05,pitch+step);if(event.key==='ArrowDown')pitch=Math.max(-Math.PI/2,pitch-step);viewer.camera.setView({orientation:{heading,pitch,roll:0}});viewer.scene.requestRender();});
    // Overview tracking is independent of selection: it opens no profile and never zooms in on the station.
    const heldPointers=new Set();
    idleController=this.idleController({
      now:()=>performance.now(),
      canStart:()=>active&&!moonLayer?.active&&!(following&&lastData?.selected!==null)&&!detailedLayer.loading&&!document.hidden&&document.hasFocus()&&!heldPointers.size&&AtlasPages.isStation(lastData?.collection)&&!!lastData.points.find(p=>p.id===AtlasPages.station(lastData.collection))&&!document.querySelector('dialog[open]'),
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
