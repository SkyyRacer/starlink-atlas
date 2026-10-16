'use strict';
/* Cesium stays lazy and local. No access token, terrain service, or geolocation. */
window.AtlasGlobe={
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
    const controls=viewer.scene.screenSpaceCameraController;
    controls.inertiaSpin=.72;controls.inertiaTranslate=.72;controls.inertiaZoom=.65;controls.zoomFactor=2;controls.maximumMovementRatio=.08;controls.minimumZoomDistance=150000;controls.maximumZoomDistance=80000000;
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
      viewer.camera.cancelFlight();
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
    const items=new Map(),lime=C.Color.fromCssColorString('#dce4ec'),white=C.Color.WHITE;let active=true,lastSelection=null,lastData=null;
    let followPitch=-.8,following=false,followReady=false,followCurrent=null;
        const followButton=document.getElementById('globe-follow');
    const releaseFollow=()=>{if(followReady)viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);followReady=false;};
    const stopFollowing=()=>{following=false;releaseFollow();followButton.setAttribute('aria-pressed','false');followButton.textContent='Suivre le satellite';document.getElementById('follow-state').textContent=lastData?.selected!==null&&lastData?'Suivre la lecture, même accélérée':'Sélectionne un satellite';};
    const position=p=>C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000);
    const motion=new SatelliteMotion();let motionAt=null;
    const orbit=rows=>rows.map(p=>C.Cartesian3.fromDegrees(p[1],p[0],p[2]*1000));
    const homeView=()=>{
      const radius=7500000,aspect=Math.max(.1,viewer.canvas.clientWidth/viewer.canvas.clientHeight);
      const fovy=viewer.camera.frustum.fovy||Math.PI/3;
      const halfAngle=Math.atan(.74*Math.tan(fovy/2)*Math.min(1,aspect));
      return {destination:C.Cartesian3.fromDegrees(0,20,radius/Math.sin(halfAngle)-6378137),orientation:{heading:0,pitch:-Math.PI/2,roll:0}};
    };
    const resetButton=document.getElementById('globe-reset');
    let homePose=null,returningHome=false;
    const rememberHome=()=>{homePose={position:C.Cartesian3.clone(viewer.camera.positionWC),direction:C.Cartesian3.clone(viewer.camera.directionWC),up:C.Cartesian3.clone(viewer.camera.upWC)};};
    const updateHomeState=()=>{
      const camera=viewer.camera;
      const isHome=homePose&&C.Cartesian3.distance(camera.positionWC,homePose.position)<100&&C.Cartesian3.dot(camera.directionWC,homePose.direction)>.999999&&C.Cartesian3.dot(camera.upWC,homePose.up)>.999999;
      resetButton.disabled=returningHome||!!isHome;
    };
    const home=()=>{stopJoystick();pendingX=0;pendingY=0;globeDrag=null;stopFollowing();returningHome=true;updateHomeState();viewer.camera.flyTo({...homeView(),duration:.65,complete:()=>{returningHome=false;rememberHome();updateHomeState();},cancel:()=>{returningHome=false;updateHomeState();}});};
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
      if(!active||!lastData||(!motion.active&&!following))return;
      const rows=motion.sample(performance.now());let chosen=null;
      for(const p of rows){const point=items.get(p.id);if(point?.show){point.position=position(p);const name=nameItems.get(p.id);if(name?.show)name.position=point.position;}if(p.id===lastData.selected)chosen=p;}
      if(chosen){followCurrent=position(chosen);label.position=followCurrent;
        if(heightLine.positions.length)heightLine.positions=[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),followCurrent];
        if(past.positions.length){const line=past.positions.slice();line[line.length-1]=followCurrent;past.positions=line;}
        if(future.positions.length){const line=future.positions.slice();line[0]=followCurrent;future.positions=line;}
      }
      if(motion.active)viewer.scene.requestRender();
      if(!following||!followReady||!chosen)return;
      // Changing transforms alone preserves the world camera. Retain its local
      // offset and orientation instead so the reference frame follows the target.
      const camera=viewer.camera,offset=C.Cartesian3.clone(camera.position),direction=C.Cartesian3.clone(camera.direction),up=C.Cartesian3.clone(camera.up),right=C.Cartesian3.clone(camera.right);
      camera.lookAtTransform(C.Transforms.eastNorthUpToFixedFrame(followCurrent));
      C.Cartesian3.clone(offset,camera.position);C.Cartesian3.clone(direction,camera.direction);C.Cartesian3.clone(up,camera.up);C.Cartesian3.clone(right,camera.right);
    });
    viewer.screenSpaceEventHandler.setInputAction(event=>{const picked=viewer.scene.pick(event.position);if(picked&&typeof picked.id==='number'){onSelect(picked.id);return;}const surface=viewer.camera.pickEllipsoid(event.position,viewer.scene.globe.ellipsoid);if(!surface)onEmptySpace?.();},C.ScreenSpaceEventType.LEFT_CLICK);
    const api={
      update(data){
        if(!active)return;lastData=data;
        if(motion.source!==data.points){motion.set(data.points,performance.now(),data.playing&&!data.focus&&motionAt!==null&&Math.abs(data.at-motionAt)<150000);motionAt=data.at;}
        viewer.clock.currentTime=C.JulianDate.fromDate(new Date(data.at));viewer.scene.globe.enableLighting=data.night;imagery.show=data.basemap;
        for(const item of items.values())item.show=false;for(const item of nameItems.values())item.show=false;let nameCount=0;
        for(const p of data.points){
          const satellite=data.catalog.get(p.id);if(!satellite||!data.visible(satellite,p.id))continue;
          let item=items.get(p.id);if(!item){item=satellites.add({id:p.id,pixelSize:3,color:lime,outlineWidth:0});items.set(p.id,item);}
          item.show=true;item.position=position(p);item.color=p.id===data.selected?white:lime;item.pixelSize=p.id===data.selected?9:3;item.outlineWidth=p.id===data.selected?2:0;item.outlineColor=C.Color.fromCssColorString(p.id===data.selected?'#a9c5df':'#1a1d25');
          if(data.names&&p.id!==data.selected&&viewer.camera.positionCartographic.height<2500000&&nameCount<200&&C.Cartesian3.distance(viewer.camera.positionWC,item.position)<3000000){const screen=C.SceneTransforms.worldToWindowCoordinates(viewer.scene,item.position);if(screen&&screen.x>=0&&screen.y>=0&&screen.x<=viewer.canvas.clientWidth&&screen.y<=viewer.canvas.clientHeight){let text=nameItems.get(p.id);if(!text){text=extraLabels.add({id:p.id,font:'11px sans-serif',fillColor:lime,outlineColor:C.Color.BLACK,outlineWidth:2,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(5,-5)});nameItems.set(p.id,text);}text.show=true;text.position=item.position;text.text=satellite.name;nameCount++;}}
        }
        past.positions=data.orbits?orbit(data.track):[];future.positions=data.orbits?orbit(data.future):[];
        const chosen=data.points.find(p=>p.id===data.selected);label.show=!!chosen;heightLine.positions=[];
        if(data.selected===null)stopFollowing();
        document.getElementById('satellite-views').hidden=data.selected===null;
        document.getElementById('view-above').disabled=!chosen;document.getElementById('view-side').disabled=!chosen;
        followButton.disabled=!chosen;followButton.setAttribute('aria-pressed',String(following));
        followButton.textContent=following?'Libérer la caméra':'Suivre le satellite';
        document.getElementById('follow-state').textContent=following?(chosen?'Caméra centrée · zoom et rotation disponibles':'Suivi suspendu : position indisponible'):(chosen?'Suivre la lecture, même accélérée':'Sélectionne un satellite');
        if(!chosen)releaseFollow();
        document.getElementById('globe-measure').textContent=lastData?.selected!==null?'Altitude estimée : indisponible':'Altitude estimée : sélectionnez un satellite';
        if(chosen){const xyz=position(chosen);heightLine.positions=[C.Cartesian3.fromDegrees(chosen.lon,chosen.lat,0),xyz];label.position=xyz;label.text=`${data.catalog.get(chosen.id)?.name||chosen.id} · ${chosen.altitude_km.toFixed(1)} km`;
          document.getElementById('globe-measure').textContent=`Altitude estimée : ${chosen.altitude_km.toLocaleString(navigator.language,{maximumFractionDigits:1})} km`;
          if(following){
            const snap=!followReady||data.focus||data.selected!==lastSelection;
            if(snap){viewer.camera.cancelFlight();viewer.camera.lookAt(xyz,new C.HeadingPitchRange(0,followPitch,3500000));followReady=true;}
          }else if(data.focus||data.selected!==lastSelection)viewer.camera.flyToBoundingSphere(new C.BoundingSphere(xyz,1000000),{duration:.6,offset:new C.HeadingPitchRange(viewer.camera.heading,-.8,3500000)});
        }
        lastSelection=data.selected;container.dataset.points=String([...items.values()].filter(p=>p.show).length);container.dataset.altitudeScale='1';viewer.scene.requestRender();
      },
      setActive(value){if(!value){stopJoystick();pendingX=0;pendingY=0;globeDrag=null;releaseFollow();}active=value;viewer.useDefaultRenderLoop=value;if(value){viewer.resize();viewer.scene.requestRender();}},
      resize(){if(active){const atHome=resetButton.disabled&&!returningHome;viewer.resize();if(atHome){viewer.camera.setView(homeView());rememberHome();updateHomeState();}viewer.scene.requestRender();}},
      home,
      north(){pendingX=0;pendingY=0;viewer.camera.cancelFlight();const angle=northAngle();if(angle!==null)viewer.camera.twistRight(angle);updateCompass();viewer.scene.requestRender();},
      zoom(direction){const height=viewer.camera.positionCartographic.height;const distance=Math.max(0,Math.min(Math.max(10000,height*.12),direction>0?height-150000:80000000-height));direction>0?viewer.camera.zoomIn(distance):viewer.camera.zoomOut(distance);viewer.scene.requestRender();}
    };
    viewer.camera.moveEnd.addEventListener(()=>{if(active&&lastData&&lastData.names)api.update({...lastData,focus:false});});
    const compass=document.getElementById('compass');let compassDrag=null,suppressCompassClick=false;
    compass.onclick=()=>{if(suppressCompassClick){suppressCompassClick=false;return;}api.north();};
    compass.addEventListener('pointerdown',event=>{if(event.button!==0)return;viewer.camera.cancelFlight();compassDrag={x:event.clientX,moved:false};compass.setPointerCapture(event.pointerId);});
    compass.addEventListener('pointermove',event=>{if(!compassDrag)return;const dx=event.clientX-compassDrag.x;if(!compassDrag.moved&&Math.abs(dx)<3)return;compassDrag.moved=true;compassDrag.x=event.clientX;viewer.camera.twistRight(C.Math.toRadians(dx*.5));updateCompass();viewer.scene.requestRender();});
    compass.addEventListener('pointerup',()=>{suppressCompassClick=!!compassDrag?.moved;compassDrag=null;});
    compass.addEventListener('pointercancel',()=>{compassDrag=null;suppressCompassClick=false;});document.getElementById('globe-home').onclick=home;document.getElementById('globe-reset').onclick=home;
    followButton.onclick=()=>{if(following){stopFollowing();if(lastData)api.update({...lastData,focus:false});}else if(lastData){following=true;api.update({...lastData,focus:true});}};
    const satelliteView=pitch=>{if(!lastData?.points.some(p=>p.id===lastData.selected))return;pendingX=0;pendingY=0;globeDrag=null;followPitch=pitch;following=true;api.update({...lastData,focus:true});updateCompass();};
    document.getElementById('view-above').onclick=()=>satelliteView(-Math.PI/2);
    document.getElementById('view-side').onclick=()=>satelliteView(0);
    document.getElementById('globe-plus').onclick=()=>api.zoom(1);document.getElementById('globe-minus').onclick=()=>api.zoom(-1);
    viewer.canvas.tabIndex=0;viewer.canvas.setAttribute('aria-label','Globe terrestre 3D interactif');
    viewer.canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();let heading=viewer.camera.heading,pitch=viewer.camera.pitch;const step=C.Math.toRadians(5);if(event.key==='ArrowLeft')heading-=step;if(event.key==='ArrowRight')heading+=step;if(event.key==='ArrowUp')pitch=Math.min(-.05,pitch+step);if(event.key==='ArrowDown')pitch=Math.max(-Math.PI/2,pitch-step);viewer.camera.setView({orientation:{heading,pitch,roll:0}});viewer.scene.requestRender();});
    return api;
  }
};
