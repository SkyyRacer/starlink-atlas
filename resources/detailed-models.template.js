/* Original source materials and textures. No fabricated high-resolution substitutes. */
(function(root){
 const base=new URL('./',document.currentScript.src),definitions=__MANIFEST__,models=new Map(definitions.flatMap(info=>info.ids.map(id=>[id,info])));
 function controller({load,changed=()=>{},progress=()=>{},dispose=()=>{}}){
  const cache=new Map();let target=null,enabled=false,loading=false,error='',serial=0,abort=null;
  const api={get target(){return target;},get enabled(){return enabled;},get loading(){return loading;},get error(){return error;},get model(){return enabled?cache.get(target):null;},
   select(id){if(id===target)return;serial++;abort?.abort();abort=null;for(const [key,model] of cache)if(key!==id){cache.delete(key);dispose(key,model);}target=id;enabled=false;loading=false;error='';changed();},
   fail(message){serial++;abort?.abort();abort=null;cache.delete(target);enabled=false;loading=false;error=message;changed();},
   async toggle(value){
    const token=++serial;abort?.abort();abort=null;enabled=!!value&&models.has(target);error='';loading=enabled&&!cache.has(target);progress(0);changed();
    if(!loading)return;
    const id=target,request=new AbortController();abort=request;
    try{const model=await load(id,request.signal,value=>{if(token===serial)progress(Math.max(0,Math.min(99,Math.floor(value))));});if(token!==serial){dispose(id,model);return;}cache.set(id,model);loading=false;progress(100);changed();}
    catch(reason){if(token!==serial)return;enabled=false;loading=false;if(reason.name!=='AbortError')error='Chargement impossible. Réessaie en cochant cette option.';changed();}
   }
  };return api;
 }
 async function download(info,signal,progress){
  const response=await fetch(new URL(info.url,base),{signal});if(!response.ok)throw Error('HTTP '+response.status);
  if(!response.body){const bytes=new Uint8Array(await response.arrayBuffer());progress(85);return bytes;}
  const reader=response.body.getReader(),expected=info.bytes,bytes=new Uint8Array(expected);let received=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(received+value.length>expected)throw Error('Taille de fichier invalide');bytes.set(value,received);received+=value.length;progress(85*Math.min(1,received/expected));}
   if(received!==expected)throw Error('Fichier incomplet');return bytes;
  }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock?.();}

 }
 function createLayer(C,viewer,container,onChange,onReady=()=>{},parent=viewer.scene.primitives){
  const toggle=document.getElementById('detailed-model-toggle'),label=document.getElementById('detailed-model-label'),hint=document.getElementById('detailed-model-hint'),overlay=document.getElementById('model-loader'),bar=document.getElementById('model-progress'),percent=document.getElementById('model-percent'),fill=document.getElementById('model-progress-fill');
  const records=new Map();let data=null,targetPoint=null,qualityTarget=null,highQuality=false;const originalFxaa=viewer.scene.postProcessStages.fxaa.enabled,originalRecommendedResolution=viewer.useBrowserRecommendedResolution,originalResolutionScale=viewer.resolutionScale;
  const state=controller({dispose(id,model){if(records.get(id)===model)records.delete(id);parent.remove(model);},changed(){sync();onChange();},progress(value){bar.setAttribute('aria-valuenow',String(value));percent.textContent=String(value);fill.style.transform='scaleX('+(value/100)+')';},async load(id,signal,progress){
   const info=models.get(id),bytes=await download(info,signal,progress);if(signal.aborted)throw new DOMException('Aborted','AbortError');
   const model=await C.Model.fromGltfAsync({gltf:bytes,basePath:base.href,modelMatrix:C.Matrix4.IDENTITY,minimumPixelSize:32,maximumScale:10000000,allowPicking:true,show:false,incrementallyLoadTextures:true,releaseGltfJson:true,lightColor:new C.Cartesian3(1,1,1),imageBasedLighting:new C.ImageBasedLighting({imageBasedLightingFactor:new C.Cartesian2(.7,.35),specularEnvironmentMaps:new URL('images/detailed/environment.ktx2',base).href,sphericalHarmonicCoefficients:[[1.2,1.2,1.2],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]].map(rgb=>new C.Cartesian3(...rgb))})});
   if(signal.aborted){model.destroy();throw new DOMException('Aborted','AbortError');}
   model.id=id;records.set(id,model);parent.add(model);move();progress(92);viewer.scene.requestRender();
   try{await new Promise((resolve,reject)=>{
    let stopReady=()=>{},stopError=()=>{},timer;
    const finish=error=>{clearTimeout(timer);stopReady();stopError();signal.removeEventListener('abort',cancel);error?reject(error):resolve();};
    const cancel=()=>finish(new DOMException('Aborted','AbortError'));
    signal.addEventListener('abort',cancel,{once:true});stopReady=model.readyEvent.addEventListener(()=>finish());stopError=model.errorEvent.addEventListener(error=>finish(error));timer=setTimeout(()=>finish(Error('Model timeout')),120000);if(model.ready)finish();
   });}catch(error){if(records.get(id)===model){records.delete(id);parent.remove(model);}throw error;}
   return model;
  }});
  function sync(){
   const quality=state.enabled&&!state.loading;
   if(quality!==highQuality){highQuality=quality;if(!viewer.atlasRenderQuality){viewer.useBrowserRecommendedResolution=quality?false:originalRecommendedResolution;viewer.resolutionScale=quality?Math.min(1,2/(root.devicePixelRatio||1)):originalResolutionScale;viewer.resize();}viewer.scene.postProcessStages.fxaa.enabled=quality||originalFxaa;}
   const supported=models.has(state.target);
   label.hidden=!supported;toggle.disabled=!supported;toggle.checked=state.enabled;label.dataset.active=String(state.enabled);hint.hidden=!supported;hint.textContent=supported?(state.error||'Modèle détaillé · '+Math.ceil(models.get(state.target).bytes/1000000)+' Mo · '+models.get(state.target).credit):'';
   overlay.hidden=!state.loading;container.dataset.modelLoading=String(state.loading);move();viewer.scene.requestRender();
  }
  function move(){
   for(const [id,model] of records){if(!state.enabled||state.target!==id){model.show=false;continue;}const p=targetPoint,satellite=data?.catalog.get(id);model.show=state.enabled&&!state.loading&&state.model===model&&state.target===id&&!!p&&!!satellite&&data.visible(satellite,id);
    if(model.show){model.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000));const visual=root.AtlasScience.model(id)||root.AtlasStations.model(id);model.minimumPixelSize=visual.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,data.collection==='all'?C.Cartesian3.distance(viewer.camera.positionWC,C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000)):viewer.camera.positionCartographic.height,data.selected===id,data.collection);}
   }
  }
  viewer.scene.preUpdate.addEventListener(move);
  toggle.addEventListener('change',async()=>{const id=state.target,enabled=toggle.checked;if(!enabled){state.select(null);state.select(id);}await state.toggle(enabled);if(enabled&&state.target===id&&state.enabled&&!state.loading&&state.model)onReady(id,state.model);});
  return {recover(error){
   const id=state.target,model=records.get(id);
   if(!state.enabled||!model||!/shader|WebGL|texture|gltf|GPU|fragment|vertex/i.test(error?.message||String(error)))return false;
   state.fail('Le modèle détaillé n’a pas pu s’afficher. Le dessin 3D blanc a été rétabli.');records.delete(id);parent.remove(model);viewer.scene.requestRender();return true;
  },credit(id){const info=models.get(id);return info?.credit;},getModel(id){const model=records.get(id);return model?.ready&&model.show?model:null;},get loading(){return state.loading;},update(next){data=next;const id=next.selected??(next.collection!=='all'?next.points.find(p=>models.has(p.id)||root.AtlasScience.has(p.id)||root.AtlasStations.has(p.id))?.id:null);if(qualityTarget!==id){qualityTarget=id;}targetPoint=next.points.find(p=>p.id===id)||null;state.select(targetPoint?id:null);sync();},move(point){if(point.id===state.target)targetPoint=point;const model=records.get(point.id);if(model?.show)model.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(point.lon,point.lat,point.altitude_km*1000));},replaces(id){return state.enabled&&!state.loading&&!!state.model&&state.target===id;},cancel(){state.select(null);}};
 }
 root.AtlasDetailed={definitions,has:id=>models.has(id),controller,createLayer};
})(window);
