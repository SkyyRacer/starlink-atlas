/* Original source materials and textures. No fabricated high-resolution substitutes. */
(function(root){
 const base=new URL('./',document.currentScript.src),definitions=__MANIFEST__,models=new Map(definitions.flatMap(info=>info.ids.map(id=>[id,info])));
 function controller({load,changed=()=>{},progress=()=>{}}){
  const cache=new Map();let target=null,enabled=false,loading=false,error='',serial=0,abort=null;
  const api={get target(){return target;},get enabled(){return enabled;},get loading(){return loading;},get error(){return error;},get model(){return enabled?cache.get(target):null;},
   select(id){if(id===target)return;serial++;abort?.abort();abort=null;target=id;enabled=false;loading=false;error='';changed();},
   fail(message){serial++;abort?.abort();abort=null;cache.delete(target);enabled=false;loading=false;error=message;changed();},
   async toggle(value){
    const token=++serial;abort?.abort();abort=null;enabled=!!value&&models.has(target);error='';loading=enabled&&!cache.has(target);progress(0);changed();
    if(!loading)return;
    const id=target,request=new AbortController();abort=request;
    try{const model=await load(id,request.signal,value=>{if(token===serial)progress(Math.max(0,Math.min(99,Math.floor(value))));});cache.set(id,model);if(token!==serial)return;loading=false;progress(100);changed();}
    catch(reason){if(token!==serial)return;enabled=false;loading=false;if(reason.name!=='AbortError')error='Chargement impossible. Réessaie en cochant cette option.';changed();}
   }
  };return api;
 }
 async function download(info,signal,progress){
  const response=await fetch(new URL(info.url,base),{signal});if(!response.ok)throw Error('HTTP '+response.status);
  if(!response.body){const bytes=new Uint8Array(await response.arrayBuffer());progress(85);return bytes;}
  const reader=response.body.getReader(),chunks=[];let received=0;
  for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;progress(85*Math.min(1,received/info.bytes));}
  if(received!==info.bytes)throw Error('Fichier incomplet');
  const bytes=new Uint8Array(received);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
 }
 function createLayer(C,viewer,container,onChange,onReady=()=>{}){
  const toggle=document.getElementById('detailed-model-toggle'),label=document.getElementById('detailed-model-label'),hint=document.getElementById('detailed-model-hint'),overlay=document.getElementById('model-loader'),bar=document.getElementById('model-progress'),percent=document.getElementById('model-percent'),fill=document.getElementById('model-progress-fill');
  const records=new Map();let data=null,highQuality=false;const originalFxaa=viewer.scene.postProcessStages.fxaa.enabled;
  const state=controller({changed(){sync();onChange();},progress(value){bar.setAttribute('aria-valuenow',String(value));percent.textContent=value+' %';fill.style.transform='scaleX('+(value/100)+')';},async load(id,signal,progress){
   const info=models.get(id),bytes=await download(info,signal,progress);if(signal.aborted)throw new DOMException('Aborted','AbortError');
   const model=await C.Model.fromGltfAsync({gltf:bytes,basePath:base.href,modelMatrix:C.Matrix4.IDENTITY,minimumPixelSize:32,maximumScale:10000000,allowPicking:true,show:true,incrementallyLoadTextures:false,releaseGltfJson:true,lightColor:new C.Cartesian3(1.5,1.5,1.5),imageBasedLighting:new C.ImageBasedLighting({imageBasedLightingFactor:new C.Cartesian2(.5,.8),specularEnvironmentMaps:new URL('images/detailed/environment.ktx2',base).href,sphericalHarmonicCoefficients:[[1.234897375,1.221635103,1.273374081],[1.136140108,1.171419978,1.287894368],[1.245410919,1.245791078,1.283067107],[1.107124329,1.112697005,1.153419137],[1.086415052,1.079904079,1.102125049],[1.190043211,1.186099291,1.214627981],[.017783647,.020140396,.025317270],[1.087014318,1.084779263,1.111417651],[-.052426789,-.048315056,-.041973855]].map(rgb=>new C.Cartesian3(...rgb))})});
   if(signal.aborted){model.destroy();throw new DOMException('Aborted','AbortError');}
   model.id=id;records.set(id,model);viewer.scene.primitives.add(model);move();progress(92);viewer.scene.requestRender();
   try{await new Promise((resolve,reject)=>{
    let stopReady=()=>{},stopError=()=>{},timer;
    const finish=error=>{clearTimeout(timer);stopReady();stopError();signal.removeEventListener('abort',cancel);error?reject(error):resolve();};
    const cancel=()=>finish(new DOMException('Aborted','AbortError'));
    signal.addEventListener('abort',cancel,{once:true});stopReady=model.readyEvent.addEventListener(()=>finish());stopError=model.errorEvent.addEventListener(error=>finish(error));timer=setTimeout(()=>finish(Error('Model timeout')),120000);if(model.ready)finish();
   });}catch(error){if(records.get(id)===model){records.delete(id);viewer.scene.primitives.remove(model);}throw error;}
   return model;
  }});
  function sync(){
   const quality=state.enabled&&!state.loading;
   if(quality!==highQuality){highQuality=quality;viewer.useBrowserRecommendedResolution=!quality;viewer.resolutionScale=quality?Math.min(1,2/(root.devicePixelRatio||1)):1;viewer.scene.postProcessStages.fxaa.enabled=quality||originalFxaa;viewer.resize();}
   const supported=models.has(state.target);
   label.hidden=!supported;toggle.disabled=!supported;toggle.checked=state.enabled;label.dataset.active=String(state.enabled);hint.hidden=!supported;hint.textContent=supported?(state.error||Math.ceil(models.get(state.target).bytes/1000000)+' Mo · '+models.get(state.target).credit):'';
   overlay.hidden=!state.loading;container.dataset.modelLoading=String(state.loading);move();viewer.scene.requestRender();
  }
  function move(){
   for(const [id,model] of records){const p=data?.points.find(p=>p.id===id),satellite=data?.catalog.get(id);model.show=state.enabled&&state.target===id&&!!p&&!!satellite&&data.visible(satellite,id);
    if(model.show){model.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000));const visual=root.AtlasScience.model(id)||root.AtlasStations.model(id);model.minimumPixelSize=visual.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,data.collection==='all'?C.Cartesian3.distance(viewer.camera.positionWC,C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000)):viewer.camera.positionCartographic.height,data.selected===id,data.collection);}
   }
  }
  viewer.scene.preUpdate.addEventListener(move);
  toggle.addEventListener('change',async()=>{const id=state.target,enabled=toggle.checked;await state.toggle(enabled);if(enabled&&state.target===id&&state.enabled&&!state.loading&&state.model)onReady(id,state.model);});
  return {recover(error){
   const id=state.target,model=records.get(id);
   if(!state.enabled||!model||!/shader|WebGL|texture|gltf|GPU|fragment|vertex/i.test(error?.message||String(error)))return false;
   state.fail('Le modèle détaillé n’a pas pu s’afficher. Le dessin blanc a été rétabli.');records.delete(id);viewer.scene.primitives.remove(model);viewer.scene.requestRender();return true;
  },getModel(id){const model=records.get(id);return model?.ready&&model.show?model:null;},get loading(){return state.loading;},update(next){data=next;const id=next.selected??(next.collection!=='all'?next.points.find(p=>models.has(p.id)||root.AtlasScience.has(p.id)||root.AtlasStations.has(p.id))?.id:null);state.select(next.points.some(p=>p.id===id)?id:null);sync();},move(point){const model=records.get(point.id);if(model?.show)model.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(point.lon,point.lat,point.altitude_km*1000));},replaces(id){return state.enabled&&state.target===id;},cancel(){state.toggle(false);}};
 }
 root.AtlasDetailed={definitions,has:id=>models.has(id),controller,createLayer};
})(window);
