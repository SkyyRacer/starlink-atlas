// Exercise the complete scene controller and event wiring without a GPU.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),real=require('../static/vendor/cesium/index.cjs');
async function check(mode){
 const skyCalls=[];let tick=0,stationRequests=0,motionSamples=0,labelMeasures=0,projectCalls=0;const windowEvents=new Map();const benchmark=!!process.env.ATLAS_RENDER_BENCH;const deferredMoon=!!process.env.ATLAS_DEFER_MOON_TEST;const sourceRoot=process.env.ATLAS_RENDER_BASE||'static';
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document;document.body.dataset.collection=mode;
 const originalCreate=document.createElement.bind(document);document.createElement=tag=>{const el=originalCreate(tag);if(tag==='canvas')el.getContext=()=>({measureText:t=>(labelMeasures++,{width:t.length*7})});return el;};
 class Collection{constructor(){this.items=[];this.show=true;}add(o){this.items.push(o);return o;}remove(o){this.items=this.items.filter(x=>x!==o);}}
 let modelPending=false,whitePending=false;const loadingPhases=[];let selections=0,emptyClicks=0;let loadingFailures=0;let detailedReady,visibleDetailedModel=null,visibleWhiteModel=null;let viewer,moonOptions,moonLoads=0,moonCreated=0,picked=42;
 const C={...real,SceneTransforms:{worldToWindowCoordinates:()=>(projectCalls++,new real.Cartesian2(400,300))},PointPrimitiveCollection:Collection,LabelCollection:Collection,BillboardCollection:Collection,PolylineCollection:Collection,PrimitiveCollection:Collection,Material:{fromType:()=>({})},Credit:class{},UrlTemplateImageryProvider:class{},SunLight:class{},Viewer:class{constructor(container){viewer=this;this.container=container;this.canvas=document.createElement('canvas');this.canvas.clientWidth=1400;this.canvas.clientHeight=900;this.clock={};this.imageryLayers={addImageryProvider:()=>({})};this.actions=new Map();this.screenSpaceEventHandler={setInputAction:(fn,key)=>this.actions.set(key,fn)};this.scene={sun:{},moon:{show:true},globe:{ellipsoid:C.Ellipsoid.WGS84},fog:{},postProcessStages:{fxaa:{}},screenSpaceCameraController:{},primitives:new Collection(),preUpdate:new C.Event(),preRender:new C.Event(),postRender:new C.Event(),renderError:new C.Event(),requestRender(){},pick:()=>({id:picked})};const camera=this.camera={changed:new C.Event(),moveEnd:new C.Event(),position:new C.Cartesian3(1e7,0,1e7),direction:new C.Cartesian3(-1,0,0),right:new C.Cartesian3(0,1,0),up:new C.Cartesian3(0,0,1),positionCartographic:{height:3e7},frustum:{fovy:.7},cancelFlight(){},setView(){},flyTo(o){o.complete?.();},pickEllipsoid:()=>C.Cartesian3.ZERO,lookAt(target,offset){this.lastLookAt={target,offset};},lookAtTransform(){}};for(const key of ['position','direction','right','up'])Object.defineProperty(camera,key+'WC',{get:()=>camera[key]});}resize(){}}};
 const science={has:()=>false,model:()=>null,createLayer:()=>({get loading(){return whitePending;},begin(){},update:()=>false,move(){},getModel:()=>visibleWhiteModel,suppress(){},*hits(){},count:0})};
 const detailed={createLayer:(engine,scene,container,onChange,onReady)=>(detailedReady=onReady,({get loading(){return modelPending;},cancel(){},recover:()=>false,update(){},replaces:()=>!!visibleDetailedModel,getModel:()=>visibleDetailedModel,move(){}}))};
 const station={screenSize:()=>4,createModel:async()=>{stationRequests++;return {};},iconURI:'icon',pointIconURI:'dot'};
 let navigation=null;
 const ctx={location:{assign:url=>{navigation=url;}},AtlasLoading:{missionFrameReady:false,done(key){loadingPhases.push(key);},fail(){loadingFailures++;}},navigator:{language:'fr-FR'},CustomEvent:window.CustomEvent,window:{Cesium:C,addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);},devicePixelRatio:1},document,console,performance:benchmark?{now:()=>tick}:performance,queueMicrotask,setTimeout,setInterval(){},requestAnimationFrame:fn=>(queueMicrotask(fn),1),matchMedia:()=>({matches:false}),AtlasPages:require('../static/pages.js'),AtlasGeometry:require('../static/geometry.js'),AtlasISS:station,AtlasTiangong:station,AtlasStations:{model:()=>null},AtlasScience:science,AtlasDetailed:detailed,AtlasSky:{create:()=>({setEnabled:async value=>skyCalls.push(value)})},AtlasEarth:{create:()=>({enabled:false,update(){},setLunarView(){},setEnabled:async()=>true,recover:()=>false})},AtlasMoon:{load:async()=>{moonLoads++;if(deferredMoon)await new Promise(()=>{});},create:options=>{moonOptions=options;moonCreated++;let active=false;return {get active(){return active;},update(){},setRealistic(){},leave(){if(active){active=false;options.onViewChange(false);}},close(){},hit:()=>false,zoom:()=>false,enter(){active=true;options.beforeTravel();options.onViewChange(true);}};}}};
 document.hasFocus=()=>true;vm.createContext(ctx);vm.runInContext(fs.readFileSync('static/render-budget.js','utf8'),ctx);vm.runInContext(fs.readFileSync(sourceRoot+'/motion.js','utf8'),ctx);ctx.SatelliteMotion=ctx.window.SatelliteMotion;const originalSet=ctx.SatelliteMotion.prototype.set;ctx.SatelliteMotion.prototype.set=function(rows,...args){motionSamples=rows.length;return originalSet.call(this,rows,...args);};if(process.env.ATLAS_GPU_BENCH){vm.runInContext(fs.readFileSync('static/point-cloud.js','utf8'),ctx);}vm.runInContext(fs.readFileSync(sourceRoot+'/globe.js','utf8'),ctx);const globe=ctx.window.AtlasGlobe;ctx.AtlasGlobe=globe;globe.load=async()=>{};
 const api=await globe.create(document.getElementById('globe-canvas'),{tile_url:'local',tile_attribution:''},()=>{selections++;},()=>{emptyClicks++;});await Promise.resolve();
 if(require('../static/pages.js').definition(mode)?.trajectory){assert.deepEqual(skyCalls,[true],'Deep mission stars load on entry');const sky=document.getElementById('sky-toggle');assert.equal(sky.disabled,true);await sky.onclick();assert.equal(sky.getAttribute('aria-checked'),'true');assert.deepEqual(skyCalls,[true],'Permanent stars cannot be toggled off');}
 const data={collection:mode,selected:null,selectionRequest:0,points:[{id:42,lon:10,lat:20,altitude_km:500}],catalog:new Map([[42,{id:42,name:'Satellite test',family:'starlink'}]]),visible:()=>true,at:Date.now(),playing:false,track:[],future:[],night:true,basemap:true,orbits:true};api.update(data);
 if(benchmark){
  const points=Array.from({length:25000},(_,i)=>({id:i+1,lon:i%360-180,lat:i%160-80,altitude_km:500})),catalog=new Map(points.map(p=>[p.id,{id:p.id,name:'Satellite '+p.id,family:'starlink'}]));
  api.update({...data,points,catalog,visible:(s,id)=>id<=13500,at:0});tick=1000;
  const moving={...data,points:points.map(p=>({...p,lon:p.lon+.01})),catalog,visible:(s,id)=>id<=13500,at:1000,playing:true};const snapshotBegin=performance.now();api.update(moving);const snapshotMs=performance.now()-snapshotBegin,bulkMotionSamples=motionSamples;
  const original=C.Cartesian3.fromDegrees;let conversions=0;C.Cartesian3.fromDegrees=(...args)=>{conversions++;return original(...args);};
  const begin=performance.now();for(let i=1;i<=60;i++){tick=1000+i*1000/60;viewer.scene.preUpdate.raiseEvent();}const movingMs=performance.now()-begin,movingConversions=conversions;
  api.update({...moving,points:moving.points.slice(),selected:1,playing:false});conversions=0;const pauseBegin=performance.now();for(let i=1;i<=60;i++){tick+=1000/60;viewer.scene.preUpdate.raiseEvent();}const pausedMs=performance.now()-pauseBegin;C.Cartesian3.fromDegrees=original;
  console.log(JSON.stringify({sourceRoot,points:25000,visible:13500,frames:60,stationRequests,snapshotMs:+snapshotMs.toFixed(2),bulkMotionSamples,movingConversions,movingMs:+movingMs.toFixed(2),pausedConversions:conversions,pausedMs:+pausedMs.toFixed(2)}));
  if(!process.env.ATLAS_RENDER_BASE){assert.equal(stationRequests,0,'No station GLB in a distant overview');assert.equal(viewer.container.dataset.points,'13500','Performance tuning preserves every visible satellite');if(process.env.ATLAS_GPU_BENCH)assert.equal(bulkMotionSamples,0,'Ordinary GPU points are not copied into the CPU motion system');assert.ok(movingConversions<=(process.env.ATLAS_GPU_BENCH?100:420000),'Bulk GPU symbols never require CPU transforms per frame');assert.ok(conversions<1000,'Paused tracking never revisits all points');}
  return;
 }
 if(deferredMoon){assert.equal(moonCreated,0);assert.ok(api);console.log('Earth scene ready even while lunar resources never resolve.');return;}
 const distantPage=!!require('../static/pages.js').definition(mode)?.trajectory;
 const click=viewer.actions.get(C.ScreenSpaceEventType.LEFT_CLICK),cameraBefore=C.Cartesian3.clone(viewer.camera.position);
 if(mode==='all'){
  for(const mission of require('../static/pages.js').definitions.filter(d=>d.trajectory)){
   api.update({...data,catalog:new Map([[42,{id:42,name:mission.label,family:mission.id}]])});
   navigation=null;click({position:{x:400,y:300}});assert.equal(navigation,require('../static/pages.js').url(mission.id),'Atlas click opens '+mission.id);assert.equal(selections,0,'Navigate without starting Earth tracking');
  }
  api.update(data);
 }
 click({position:{x:400,y:300}});assert.equal(selections,distantPage?0:1,'Point clicks cannot start distant-mission tracking on '+mode);assert.equal(emptyClicks,0);assert.ok(C.Cartesian3.equals(viewer.camera.position,cameraBefore));
 if(distantPage){
  let closures=0;const detail=document.getElementById('detail');detail.hidden=false;detail.dataset.collapsed='false';const cross=document.createElement('button');cross.id='close';detail.append(cross);cross.onclick=()=>{closures++;detail.dataset.collapsed='true';};
  click({position:{x:400,y:300}});assert.equal(closures,0,'Clicking the mission leaves its card open');
  picked=null;click({position:{x:5,y:5}});assert.equal(closures,1,'Empty space folds the card exactly like its cross');assert.equal(emptyClicks,0,'Empty space never deselects a distant mission');
  click({position:{x:5,y:5}});assert.equal(closures,1,'Further empty clicks preserve the collapsed mission and camera');assert.ok(C.Cartesian3.equals(viewer.camera.position,cameraBefore));picked=42;
 }
 assert.equal(moonLoads,mode==='all'?1:0);assert.equal(moonCreated,mode==='all'?1:0);assert.equal(viewer.scene.moon.show,false,'No default Moon on dedicated pages');
 viewer.actions.get(C.ScreenSpaceEventType.MOUSE_MOVE)({endPosition:{x:400,y:300}});await Promise.resolve();const group=viewer.scene.primitives.items[0],label=group.items[2].items[1];assert.equal(label.show,true);assert.equal(label.text,'Satellite test');
 const beforeDrag=projectCalls;for(const fn of windowEvents.get('pointerdown')||[])fn({pointerId:7});viewer.actions.get(C.ScreenSpaceEventType.MOUSE_MOVE)({endPosition:{x:410,y:310}});await Promise.resolve();assert.equal(projectCalls,beforeDrag,'Dragging never scans and projects the satellite cloud');for(const fn of windowEvents.get('pointerup')||[])fn({pointerId:7});

 api.update({...data,selected:42});assert.equal(label.show,false,'Selected objects do not receive a duplicate hover label');
 if(require('../static/pages.js').definition(mode)?.trajectory){
  viewer.camera.position=new C.Cartesian3(2.6e13,0,0);
  const wheel=new window.Event('wheel',{cancelable:true});wheel.deltaY=-100;wheel.deltaMode=0;
  viewer.canvas.dispatchEvent(wheel);viewer.scene.preUpdate.raiseEvent();
  assert.equal(viewer.scene.screenSpaceCameraController.enableZoom,false,'No competing native Earth zoom on '+mode);
  const range=C.Cartesian3.magnitude(viewer.camera.position);
  assert.ok(range>1.8e13&&range<2.6e13,'Progressive camera zoom at Voyager distance on '+mode);
  assert.equal(wheel.defaultPrevented,true);
 }

 if(require('../static/pages.js').definition(mode)?.trajectory){
  detailedReady(42,{boundingSphere:{radius:75}});
  assert.ok(viewer.camera.lastLookAt,'Ready distant models receive an initial close framing');
  const framing=viewer.camera.lastLookAt.offset.range,halfAngle=Math.atan(Math.tan(viewer.camera.frustum.fovy/2)*Math.min(1,viewer.canvas.clientWidth/viewer.canvas.clientHeight));
  const fraction=Math.tan(Math.asin(75/framing))/Math.tan(halfAngle);
  assert.ok(fraction>.55&&fraction<.7,'Mission fills roughly 60 percent of the short viewport dimension on '+mode);
 }
 viewer.scene.preRender.raiseEvent();
 const caption=document.querySelector('.distant-satellite-label');
 if(require('../static/pages.js').definition(mode)?.trajectory){
  assert.equal(caption.hidden,false,'Distant caption is drawn in screen space');assert.match(caption.textContent,/Satellite test.*km/);
  assert.equal(group.items[2].items[0].show,false,'Native large-coordinate glyphs stay disabled on distant pages');
  const text=caption.textContent,placement=caption.style.transform;
  for(let i=0;i<20;i++){viewer.scene.preUpdate.raiseEvent();viewer.scene.preRender.raiseEvent();assert.equal(caption.hidden,false);assert.equal(caption.textContent,text);assert.equal(caption.style.transform,placement);}
  api.update({...data,selected:42});assert.equal(caption.hidden,false,'Ordinary position refresh does not blink an already visible caption');
 }else assert.equal(caption.hidden,true,'Earth labels retain the existing rendering');
 const measurements=labelMeasures;for(let i=0;i<60;i++)viewer.scene.preRender.raiseEvent();assert.equal(labelMeasures,measurements,'A stable satellite caption is measured only once, rather than each frame');assert.equal(viewer.targetFrameRate,undefined,'RAF is not capped a second time');assert.equal(viewer.scene.msaaSamples,1);

 if(mode==='all'){
  const track=Array.from({length:61},(_,i)=>[20,9.4+i*.01,500]),future=Array.from({length:61},(_,i)=>[20,10+i*.01,500]);
  api.update({...data,selected:42,playing:true,points:[{...data.points[0],speed_km_s:7.5}],track,future,at:data.at+1000});
  const lines=group.items[1].items,[past,predicted,pastJoin,futureJoin]=lines;
  assert.ok(pastJoin.positions.length>2);assert.ok(futureJoin.positions.length>2);
  const marker=real.Cartesian3.fromDegrees(10,20,500000);
  assert.ok(real.Cartesian3.distance(past.positions.at(-1),marker)>=15000,'Trim stale near-marker vertices before animation');
  assert.ok(real.Cartesian3.distance(predicted.positions[0],marker)>=15000);
  const stablePast=past.positions,stableFuture=predicted.positions;viewer.scene.preUpdate.raiseEvent();
  assert.equal(past.positions,stablePast,'Animating never rebuilds the entire dense orbit');assert.equal(predicted.positions,stableFuture);
  const delayedTrack=Array.from({length:301},(_,i)=>[20,7.7+i*.01,500]),delayedFuture=Array.from({length:301},(_,i)=>[20,10.7+i*.01,500]);
  api.update({...data,selected:42,playing:true,points:[{...data.points[0],lon:10.7,speed_km_s:7.5}],track:delayedTrack,future:delayedFuture,at:data.at+11000});
  const displayed=pastJoin.positions.at(-1);
  assert.ok(past.positions.at(-1).y<displayed.y,'The past anchor stays behind the displayed satellite after a delayed snapshot');
  assert.ok(predicted.positions[0].y>displayed.y,'The future anchor stays ahead of the whole animation span');

 }
 if(mode==='all'){assert.equal(moonOptions.allowOrbit,false,'Lunar orbit is always disabled in the Earth document');assert.equal(typeof moonOptions.navigateMoon,'function','Earth uses a full document navigation to the Moon');moonOptions.onViewChange(true);assert.equal(group.show,false);assert.equal(document.querySelector('.view').dataset.lunarView,'true');moonOptions.onViewChange(false);assert.equal(group.show,true);assert.match(document.getElementById('earth-realistic-toggle').textContent,/Lune/);}else assert.doesNotMatch(document.getElementById('earth-realistic-toggle').textContent,/Lune/);
 viewer.scene.renderError.raiseEvent(viewer.scene,Error('Simulated GPU error'));assert.equal(loadingFailures,1,'Rendering failure must release the progress overlay so the error is readable');
 if(['iss','hubble','kepler','spitzer','jwst','voyager-1','voyager-2'].includes(mode)){
  visibleDetailedModel={show:true,ready:true,boundingSphere:new C.BoundingSphere(C.Cartesian3.ZERO,75),computedScale:1,scale:1};
  api.update({...data,selected:42});
  viewer.canvas.getBoundingClientRect=()=>({left:30,top:40,width:700,height:450});
  viewer.scene.pick=(pixel,w=1,h=1)=>Math.abs(pixel.x-400)<=(w-1)/2&&Math.abs(pixel.y-300)<=(h-1)/2?{id:42}:undefined;
  let surfacePixel;viewer.scene.pickPositionSupported=true;viewer.scene.pickPosition=pixel=>{surfacePixel=pixel;return new C.Cartesian3(100,50,0);};
  viewer.camera.position=new C.Cartesian3(0,0,1000);
  const event=new window.Event('wheel',{cancelable:true});Object.assign(event,{deltaY:-20,deltaMode:0,clientX:230,clientY:190});viewer.canvas.dispatchEvent(event);viewer.scene.preUpdate.raiseEvent();
  assert.equal(surfacePixel.x,400);assert.equal(surfacePixel.y,300,'Pointer maps through CSS-scaled canvas coordinates');
  assert.ok(viewer.camera.position.x>0&&viewer.camera.position.y>0&&viewer.camera.position.z<1000,'HD zoom moves toward the pointed component on '+mode);
  const shift=viewer.camera.position.x/100;assert.ok(Math.abs(viewer.camera.position.y-50*shift)<1e-7);assert.ok(Math.abs(viewer.camera.position.z-1000*(1-shift))<1e-7,'The picked point stays on its original screen ray');
  const outside=new window.Event('wheel',{cancelable:true});Object.assign(outside,{deltaY:-20,deltaMode:0,clientX:380,clientY:265});viewer.canvas.dispatchEvent(outside);viewer.scene.preUpdate.raiseEvent();assert.equal(surfacePixel.x,400);assert.equal(surfacePixel.y,300,'Outside pointer uses actual nearest visible model pixel');
  if(document.getElementById('globe-follow').getAttribute('aria-pressed')==='true')document.getElementById('globe-follow').onclick();
  viewer.camera.position=new C.Cartesian3(0,0,1000);const freeWheel=new window.Event('wheel',{cancelable:true});Object.assign(freeWheel,{deltaY:-20,deltaMode:0,clientX:230,clientY:190});viewer.canvas.dispatchEvent(freeWheel);viewer.scene.preUpdate.raiseEvent();assert.ok(viewer.camera.position.x>0&&viewer.camera.position.z<1000,'Pointer zoom also works after stopping follow');
  const mouse=(type,props)=>{const event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:81,button:0,clientX:230,clientY:190,...props});viewer.canvas.dispatchEvent(event);return event;};
  const key=key=>{const event=new window.Event('keydown',{cancelable:true});event.key=key;viewer.canvas.dispatchEvent(event);return event;};
  key('f');viewer.camera.position=new C.Cartesian3(0,-500,200);viewer.camera.direction=C.Cartesian3.normalize(C.Cartesian3.negate(viewer.camera.position,new C.Cartesian3()),new C.Cartesian3());viewer.camera.right=C.Cartesian3.normalize(C.Cartesian3.cross(viewer.camera.direction,C.Cartesian3.UNIT_Z,new C.Cartesian3()),new C.Cartesian3());viewer.camera.up=C.Cartesian3.cross(viewer.camera.right,viewer.camera.direction,new C.Cartesian3());
  viewer.scene.preUpdate.raiseEvent();assert.equal(viewer.scene.screenSpaceCameraController.enableRotate,false,'Native Earth rotation is disabled only for HD inspection');assert.equal(viewer.scene.screenSpaceCameraController.enableCollisionDetection,false);
  const initial=C.Cartesian3.clone(viewer.camera.position),orbitRange=C.Cartesian3.magnitude(initial),selectedBefore=selections,emptyBefore=emptyClicks;
  assert.equal(mouse('pointerdown',{}).defaultPrevented,true);mouse('pointermove',{clientX:232});assert.ok(C.Cartesian3.equals(viewer.camera.position,initial),'Small pointer tremors do not rotate the view');
  mouse('pointermove',{clientX:260});mouse('pointerup',{clientX:260});assert.ok(C.Cartesian3.distance(viewer.camera.position,initial)>1);assert.ok(Math.abs(C.Cartesian3.magnitude(viewer.camera.position)-orbitRange)<1e-7,'Left drag orbits without changing zoom');assert.equal(selections,selectedBefore);assert.equal(emptyClicks,emptyBefore,'Releasing an orbit cannot act as an empty-space click');
  const beforePan=C.Cartesian3.clone(viewer.camera.position),beforeDirection=C.Cartesian3.clone(viewer.camera.direction);
  mouse('pointerdown',{button:2});mouse('pointermove',{button:2,clientY:220});mouse('pointerup',{button:2,clientY:220});assert.ok(C.Cartesian3.distance(beforePan,viewer.camera.position)>1);assert.ok(C.Cartesian3.equals(beforeDirection,viewer.camera.direction),'Right drag pans without rotating');
  mouse('pointerdown',{shiftKey:true});mouse('pointermove',{shiftKey:true,clientX:250});mouse('pointercancel',{shiftKey:true});const cancelled=C.Cartesian3.clone(viewer.camera.position);mouse('pointermove',{clientX:350});assert.ok(C.Cartesian3.equals(cancelled,viewer.camera.position),'Cancelled pointers never leave a stuck orbit');
  const menu=new window.Event('contextmenu',{cancelable:true});viewer.canvas.dispatchEvent(menu);assert.equal(menu.defaultPrevented,true);
  const previousFrame=viewer.camera.lastLookAt;key('f');assert.notEqual(viewer.camera.lastLookAt,previousFrame,'F frames the complete current model');document.getElementById('globe-home').onclick();assert.ok(viewer.camera.lastLookAt.offset.range<1000,'Recenter frames the model rather than Earth');
  if(require('../static/pages.js').definition(mode)?.trajectory){const detail=document.getElementById('detail');detail.hidden=false;detail.dataset.collapsed='false';let folds=0;document.getElementById('close').onclick=()=>{folds++;detail.dataset.collapsed='true';};mouse('pointerdown',{clientX:35,clientY:45});mouse('pointerup',{clientX:35,clientY:45});assert.equal(folds,1,'A genuine empty-space click still folds a distant card');}
  visibleWhiteModel=visibleDetailedModel;visibleDetailedModel=null;
  visibleWhiteModel.modelMatrix=C.Matrix4.fromTranslation(new C.Cartesian3(1,2,3));const fixedModel=C.Matrix4.clone(visibleWhiteModel.modelMatrix);
  viewer.scene.preUpdate.raiseEvent();assert.equal(viewer.scene.screenSpaceCameraController.enableRotate,false,'White models use the same inspection controls');
  const beforeWhitePan=C.Cartesian3.clone(viewer.camera.position);
  mouse('pointerdown',{button:2});mouse('pointermove',{button:2,clientX:310,clientY:230});mouse('pointerup',{button:2,clientX:310,clientY:230});
  const afterWhitePan=C.Cartesian3.clone(viewer.camera.position);assert.ok(C.Cartesian3.distance(beforeWhitePan,afterWhitePan)>1,'Right drag translates the camera with white models too');
  viewer.scene.preUpdate.raiseEvent();assert.ok(C.Cartesian3.equals(afterWhitePan,viewer.camera.position),'Tracking does not cancel camera translation on the next frame');assert.ok(C.Matrix4.equals(fixedModel,visibleWhiteModel.modelMatrix),'Camera dragging leaves the spacecraft matrix untouched');
  key('f');assert.ok(viewer.camera.lastLookAt.offset.range<1000,'F also frames the white model without a missing-HD crash');
  visibleWhiteModel=null;viewer.scene.preUpdate.raiseEvent();assert.equal(viewer.scene.screenSpaceCameraController.enableRotate,true,'Earth controls return when model inspection ends');
 }
 if(require('../static/pages.js').definition(mode)?.trajectory){api.update({...data,selected:42,points:[{...data.points[0],icrf_km:[3e8,4e8,0]}]});assert.match(document.getElementById('globe-measure').textContent,/^Distance de la Terre/);assert.ok(!document.getElementById('globe-measure').textContent.includes('Altitude estimée'));}
 viewer.scene.postRender.raiseEvent();assert.ok(!loadingPhases.includes('visuals'),'A frame before data readiness cannot dismiss loading');
 ctx.AtlasLoading.missionFrameReady=true;modelPending=true;viewer.scene.postRender.raiseEvent();assert.ok(!loadingPhases.includes('visuals'),'Wait for the detailed model');
 modelPending=false;whitePending=true;viewer.scene.postRender.raiseEvent();assert.ok(!loadingPhases.includes('visuals'),'Wait for any scientific model resources');
 whitePending=false;viewer.scene.postRender.raiseEvent();assert.equal(loadingPhases.includes('visuals'),!!require('../static/pages.js').definition(mode)?.trajectory,'Only a complete rendered distant scene releases its mission splash');
 api.setActive(false);assert.equal(caption.hidden,true);api.setActive(true);
 if(require('../static/pages.js').definition(mode)?.trajectory){api.update({...data,selected:null});viewer.scene.preRender.raiseEvent();assert.equal(caption.hidden,true,'Deselecting removes the distant caption');}
}
(async()=>{for(const mode of (process.env.ATLAS_RENDER_BENCH?['all']:['all','iss','tiangong','starlink','galileo','hubble',...require('../static/pages.js').definitions.filter(row=>row.trajectory).map(row=>row.id)]))await check(mode);console.log('Scene controller: Atlas-only Moon, dedicated pages, suspend/restore all satellite primitives, hover and selected-label exclusion OK.');})().catch(error=>{console.error(error);process.exitCode=1;});
