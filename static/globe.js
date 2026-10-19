'use strict';
/* Cesium stays lazy and local. No access token, terrain service, or geolocation. */
window.AtlasGlobe={
  idleController({now,canStart,start,stop,delay=10000}){
    let last=now(),active=false;
    return {get active(){return active;},activity(){last=now();},cancel(){last=now();if(!active)return false;active=false;stop();return true;},tick(){if(!active&&now()-last>=delay&&canStart()){active=true;start();}}};
  },
  lighting(height,distance,fadeOut,fadeIn){
    const x=Math.max(0,Math.min(1,(height-5000000)/10000000)),far=x*x*(3-2*x);
    return {shadow:.3+.12*far,fadeIn:Math.max(fadeIn,fadeOut+Math.max(0,distance-fadeOut)/(1-.1*far))};
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
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#000000');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#1d3443');
    viewer.scene.globe.preloadSiblings=false;viewer.scene.globe.preloadAncestors=false;viewer.scene.globe.tileCacheSize=100;viewer.scene.globe.maximumScreenSpaceError=3;
    if(viewer.scene.sun)viewer.scene.sun.show=false;if(viewer.scene.moon)viewer.scene.moon.show=false;viewer.clock.shouldAnimate=false;
    const imagery=viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({url:config.tile_url,credit:new C.Credit(config.tile_attribution,true),maximumLevel:18}));imagery.brightness=.57;imagery.contrast=1.2;imagery.saturation=.35;
    const defaultFadeOut=viewer.scene.globe.lightingFadeOutDistance,defaultFadeIn=viewer.scene.globe.lightingFadeInDistance;
    const controls=viewer.scene.screenSpaceCameraController;
    controls.inertiaSpin=.72;controls.inertiaTranslate=.72;controls.inertiaZoom=.65;controls.zoomFactor=2;controls.maximumMovementRatio=.08;controls.minimumZoomDistance=150000;controls.maximumZoomDistance=80000000;
    // Native surface-anchored rotation: the grabbed ground point follows the pointer.
    controls.enableRotate=true;
    let globeDrag=null,pendingX=0,pendingY=0;
    viewer.canvas.style.touchAction='none';
    viewer.scene.preUpdate.addEventListener(()=>{
      const height=Math.max(150000,viewer.camera.positionCartographic.height);
      const lighting=this.lighting(height,C.Cartesian3.magnitude(viewer.camera.positionWC),defaultFadeOut,defaultFadeIn);
      viewer.scene.globe.vertexShadowDarkness=lighting.shadow;viewer.scene.globe.lightingFadeInDistance=lighting.fadeIn;
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
    viewer.targetFrameRate=60;viewer.useBrowserRecommendedResolution=true;
    const satellites=viewer.scene.primitives.add(new C.PointPrimitiveCollection()), lines=viewer.scene.primitives.add(new C.PolylineCollection()), labels=viewer.scene.primitives.add(new C.LabelCollection());
    const past=lines.add({positions:[],width:1.5,material:C.Material.fromType('Color',{color:C.Color.fromCssColorString('#e0e0e0')})});
    const future=lines.add({positions:[],width:2,material:C.Material.fromType('PolylineDash',{color:C.Color.fromCssColorString('#a9c5df'),dashLength:12})});
    const heightLine=lines.add({positions:[],width:2,material:C.Material.fromType('Color',{color:C.Color.WHITE})});
    const label=labels.add({text:'',show:false,font:'14px sans-serif',fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(12,-12)});
    const extraLabels=viewer.scene.primitives.add(new C.LabelCollection()),nameItems=new Map();
    const issFallback=viewer.scene.primitives.add(new C.BillboardCollection()).add({id:25544,image:AtlasISS.iconURI,width:64,height:44,show:false});
    let issModel=null,issVisible=false;AtlasISS.createModel(C,viewer.scene).then(model=>{issModel=model;if(lastData)api.update({...lastData,focus:false});}).catch(error=>{container.dataset.modelError=error.message;console.error('Modèle ISS :',error);});
    function sizeISS(){
      if(!lastData)return;
      const size=AtlasISS.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,viewer.camera.positionCartographic.height,lastData.selected===25544,lastData.collection);
      issFallback.width=size;issFallback.height=size*.7;if(issModel)issModel.minimumPixelSize=size;
    }
    viewer.scene.preUpdate.addEventListener(sizeISS);
    const items=new Map(),lime=C.Color.fromCssColorString('#dce4ec'),white=C.Color.WHITE;let active=true,lastSelection=null,lastData=null,paletteKey='',palette={iss:white,starlink:lime};
    let followPitch=-.8,following=false,followReady=false,followCurrent=null,lastSelectionRequest=null;
    let idleController=null,idleFlight=false,ignoreOverviewClick=false,overviewPosition=null;
        const followButton=document.getElementById('globe-follow');
    const releaseFollow=()=>{if(followReady)viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);followReady=false;};
    const stopFollowing=()=>{following=false;releaseFollow();followButton.setAttribute('aria-pressed','false');followButton.textContent='Suivre le satellite';document.getElementById('follow-state').textContent=lastData?.selected!==null&&lastData?'Suivre la lecture, même accélérée':'Sélectionne un satellite';};
    const updateFollowControl=chosen=>{
      const idle=!!idleController?.active;
      followButton.disabled=!chosen&&!idle;followButton.setAttribute('aria-pressed',String(following||idle));
      followButton.textContent=following||idle?'Arrêter le suivi':'Suivre le satellite';
      document.getElementById('follow-state').textContent=idle?'Vue globale · suivi automatique de l’ISS':following?(chosen?'Caméra centrée · zoom et rotation disponibles':'Suivi suspendu : position indisponible'):(chosen?'Suivre la lecture, même accélérée':'Sélectionne un satellite');
    };
    const position=p=>C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000);
    const motion=new SatelliteMotion();let motionAt=null;
    const orbit=rows=>rows.map(p=>C.Cartesian3.fromDegrees(p[1],p[0],p[2]*1000));
    const homeView=station=>{
      const radius=7500000,aspect=Math.max(.1,viewer.canvas.clientWidth/viewer.canvas.clientHeight);
      const fovy=viewer.camera.frustum.fovy||Math.PI/3;
      const halfAngle=Math.atan(.74*Math.tan(fovy/2)*Math.min(1,aspect));
      const centre=station||(lastData?.collection==='iss'?lastData.points.find(p=>p.id===25544):null);
      return {destination:C.Cartesian3.fromDegrees(centre?.lon??0,centre?.lat??20,radius/Math.sin(halfAngle)-6378137),orientation:{heading:0,pitch:-Math.PI/2,roll:0}};
    };
    const resetButton=document.getElementById('globe-reset');
    let homePose=null,returningHome=false;
    const rememberHome=()=>{homePose={position:C.Cartesian3.clone(viewer.camera.positionWC),direction:C.Cartesian3.clone(viewer.camera.directionWC),up:C.Cartesian3.clone(viewer.camera.upWC)};};
    const updateHomeState=()=>{
      const camera=viewer.camera;
      const isHome=homePose&&C.Cartesian3.distance(camera.positionWC,homePose.position)<100&&C.Cartesian3.dot(camera.directionWC,homePose.direction)>.999999&&C.Cartesian3.dot(camera.upWC,homePose.up)>.999999;
      resetButton.disabled=returningHome||!!isHome;
    };
    const home=()=>{idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;globeDrag=null;stopFollowing();returningHome=true;updateHomeState();viewer.camera.flyTo({...homeView(),duration:.65,complete:()=>{returningHome=false;rememberHome();updateHomeState();},cancel:()=>{returningHome=false;updateHomeState();}});};
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
      const x=C.Cartesian3.dot(northVector,viewer.camera.rightWC),y=C.Cartesian3.dot(northVector,viewer.camera.upWC);
      return Math.hypot(x,y)<1e-8?null:Math.atan2(x,y);
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
      for(const p of rows){if(p.id===25544)station=p;if(p.id===25544&&issVisible){issFallback.position=position(p);if(issModel)issModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}const point=items.get(p.id);if(point?.show){point.position=position(p);const name=nameItems.get(p.id);if(name?.show)name.position=point.position;}if(p.id===lastData.selected)chosen=p;}
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
    viewer.screenSpaceEventHandler.setInputAction(event=>{const picked=viewer.scene.pick(event.position);if(ignoreOverviewClick){ignoreOverviewClick=false;if(!(picked&&typeof picked.id==='number')&&!viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid))onEmptySpace?.();return;}if(picked&&typeof picked.id==='number'){onSelect(picked.id);return;}const surface=viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid);if(!surface)onEmptySpace?.();},C.ScreenSpaceEventType.LEFT_CLICK);
    const api={
      update(data){
        if(!active)return;lastData=data;
        // A click starts tracking, including a second click on a released target.
        // Ordinary position updates preserve a deliberate camera release.
        if(data.selected!==null&&(data.selected!==lastSelection||data.selectionRequest!==lastSelectionRequest)){idleController?.cancel();releaseFollow();following=true;}
        if(motion.source!==data.points){motion.set(data.points,performance.now(),data.playing&&!data.focus&&motionAt!==null&&Math.abs(data.at-motionAt)<150000);motionAt=data.at;}
        viewer.clock.currentTime=C.JulianDate.fromDate(new Date(data.at));viewer.scene.globe.enableLighting=data.night;imagery.show=data.basemap;
        const nextPalette=data.collection==='all'?data.colors:null,key=nextPalette?nextPalette.iss+nextPalette.starlink:'';if(key!==paletteKey){paletteKey=key;palette={iss:nextPalette?C.Color.fromCssColorString(nextPalette.iss):white,starlink:nextPalette?C.Color.fromCssColorString(nextPalette.starlink):lime};}
        issFallback.color=palette.iss;if(issModel)issModel.color=palette.iss;
        issVisible=false;issFallback.show=false;if(issModel)issModel.show=false;sizeISS();for(const item of items.values())item.show=false;for(const item of nameItems.values())item.show=false;let nameCount=0;
        for(const p of data.points){
          const satellite=data.catalog.get(p.id);if(!satellite||!data.visible(satellite,p.id))continue;
          if(p.id===25544){issVisible=true;issFallback.position=position(p);issFallback.show=!issModel;if(issModel){issModel.show=true;issModel.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(position(p));}continue;}
          let item=items.get(p.id);if(!item){item=satellites.add({id:p.id,pixelSize:3,color:lime,outlineWidth:0});items.set(p.id,item);}
          item.show=true;item.position=position(p);item.color=p.id===data.selected?white:palette.starlink;item.pixelSize=p.id===data.selected?9:3;item.outlineWidth=p.id===data.selected?2:0;item.outlineColor=C.Color.fromCssColorString(p.id===data.selected?'#a9c5df':'#1a1d25');
          if(data.names&&p.id!==data.selected&&viewer.camera.positionCartographic.height<2500000&&nameCount<200&&C.Cartesian3.distance(viewer.camera.positionWC,item.position)<3000000){const screen=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,item.position);if(screen&&screen.x>=0&&screen.y>=0&&screen.x<=viewer.canvas.clientWidth&&screen.y<=viewer.canvas.clientHeight){let text=nameItems.get(p.id);if(!text){text=extraLabels.add({id:p.id,font:'11px sans-serif',fillColor:lime,outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(5,-5)});nameItems.set(p.id,text);}text.show=true;text.position=item.position;text.text=satellite.name;nameCount++;}}
        }
        past.positions=data.orbits?orbit(data.track):[];future.positions=data.orbits?orbit(data.future):[];
        const chosen=data.points.find(p=>p.id===data.selected);label.show=!!chosen;heightLine.positions=[];
        if(data.selected===null)stopFollowing();
        document.getElementById('satellite-views').hidden=data.selected===null;
        document.getElementById('view-above').disabled=!chosen;document.getElementById('view-side').disabled=!chosen;
        updateFollowControl(chosen);
        if(!chosen)releaseFollow();
        document.getElementById('globe-measure').textContent=lastData?.selected!==null?'Altitude estimée : indisponible':'Altitude estimée : sélectionnez un satellite';
        if(chosen){const xyz=position(chosen);heightLine.positions=[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),xyz];label.position=xyz;label.text=`${data.catalog.get(chosen.id)?.name||chosen.id} · ${chosen.altitude_km.toFixed(1)} km`;
          document.getElementById('globe-measure').textContent=`Altitude estimée : ${chosen.altitude_km.toLocaleString(navigator.language,{maximumFractionDigits:1})} km`;
          if(following){
            const snap=!followReady||data.focus||data.selected!==lastSelection;
            if(snap){viewer.camera.cancelFlight();viewer.camera.lookAt(xyz,new C.HeadingPitchRange(0,followPitch,3500000));followReady=true;}
          }else if(data.focus||data.selected!==lastSelection)viewer.camera.flyToBoundingSphere(new C.BoundingSphere(xyz,1000000),{duration:.6,offset:new C.HeadingPitchRange(viewer.camera.heading,-.8,3500000)});
        }
        lastSelection=data.selected;lastSelectionRequest=data.selectionRequest;container.dataset.points=String([...items.values()].filter(p=>p.show).length+(issVisible?1:0));container.dataset.altitudeScale='1';viewer.scene.requestRender();
      },
      setActive(value){if(!value){idleController?.cancel();stopJoystick();pendingX=0;pendingY=0;globeDrag=null;releaseFollow();}active=value;viewer.useDefaultRenderLoop=value;if(value){viewer.resize();viewer.scene.requestRender();}},
      resize(){if(active){const atHome=resetButton.disabled&&!returningHome;viewer.resize();if(atHome){viewer.camera.setView(homeView());rememberHome();updateHomeState();}viewer.scene.requestRender();}},
      home,
      north(){idleController?.cancel();pendingX=0;pendingY=0;viewer.camera.cancelFlight();const angle=northAngle();if(angle!==null)viewer.camera.twistRight(angle);updateCompass();viewer.scene.requestRender();},
      zoom(direction){idleController?.cancel();const height=viewer.camera.positionCartographic.height;const distance=Math.max(0,Math.min(Math.max(10000,height*.12),direction>0?height-150000:80000000-height));direction>0?viewer.camera.zoomIn(distance):viewer.camera.zoomOut(distance);viewer.scene.requestRender();}
    };
    viewer.camera.moveEnd.addEventListener(()=>{if(active&&lastData&&lastData.names)api.update({...lastData,focus:false});});
    const compass=document.getElementById('compass');let compassDrag=null,suppressCompassClick=false;
    compass.onclick=()=>{if(suppressCompassClick){suppressCompassClick=false;return;}api.north();};
    compass.addEventListener('pointerdown',event=>{if(event.button!==0)return;idleController?.cancel();viewer.camera.cancelFlight();compassDrag={x:event.clientX,moved:false};compass.setPointerCapture(event.pointerId);});
    compass.addEventListener('pointermove',event=>{if(!compassDrag)return;const dx=event.clientX-compassDrag.x;if(!compassDrag.moved&&Math.abs(dx)<3)return;compassDrag.moved=true;compassDrag.x=event.clientX;viewer.camera.twistRight(C.Math.toRadians(dx*.5));updateCompass();viewer.scene.requestRender();});
    compass.addEventListener('pointerup',()=>{suppressCompassClick=!!compassDrag?.moved;compassDrag=null;});
    compass.addEventListener('pointercancel',()=>{compassDrag=null;suppressCompassClick=false;});document.getElementById('globe-home').onclick=home;document.getElementById('globe-reset').onclick=home;
    followButton.onclick=()=>{if(idleController?.cancel())return;if(following){stopFollowing();if(lastData)api.update({...lastData,focus:false});}else if(lastData){following=true;api.update({...lastData,focus:true});}};
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
      canStart:()=>active&&!document.hidden&&document.hasFocus()&&!heldPointers.size&&lastData?.collection==='iss'&&!!lastData.points.find(p=>p.id===25544)&&!document.querySelector('dialog[open]'),
      start:()=>{stopJoystick();stopFollowing();overviewPosition=null;idleFlight=true;viewer.camera.cancelFlight();viewer.camera.flyTo({...homeView(),duration:.8,complete:()=>{idleFlight=false;viewer.scene.requestRender();},cancel:()=>{idleFlight=false;}});container.dataset.idleFollow='true';updateFollowControl(lastData?.points.find(p=>p.id===lastData.selected));},
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
