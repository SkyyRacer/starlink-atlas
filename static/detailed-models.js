/* Original source materials and textures. No fabricated high-resolution substitutes. */
(function(root){
 const base=new URL('./',document.currentScript.src),definitions=[{"key":"hubble","ids":[20580],"url":"images/detailed/hubble.glb?v=cde447ffa790","bytes":11463724,"source":"https://science.nasa.gov/resource/hubble-space-telescope-3d-model/","download":"https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/h/Hubble.glb","sha256":"e6a40640d6846e8f5d9438821ebe2d7de730c8dadba1cc9dfdbcc148ff1052cd","uv_repairs":[{"mesh":10,"primitive":0,"texcoord":0,"reason":"clear.png.001 is a uniform RGBA (255,255,255,0) image; constant UV preserves full transparency.","count":24}],"credit":"NASA VTAD","original_file":"resources/detailed-originals/hubble-vtad.glb","version":"NASA VTAD texturé","triangles":21129,"textures":10,"materials":10},{"key":"chandra","ids":[25867],"url":"images/detailed/chandra.glb?v=1d9d7c9b3893","bytes":998740,"source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Chandra%20X-ray%20Observatory","download":"https://raw.githubusercontent.com/nasa/NASA-3D-Resources/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Chandra%20X-ray%20Observatory/Chandra%20X-ray%20Observatory.glb","sha256":"9383f44fc4c6eba73c40b0c2cfe33c08c90f1fb5230274bfdaa98e0c9f116a34","uv_repairs":[],"credit":"NASA 3D Resources · adaptation filaire Atlas","original_file":"resources/science-originals/chandra.glb","version":"NASA original","triangles":30132,"textures":6,"materials":5},{"key":"fermi","ids":[33053],"url":"images/detailed/fermi.glb?v=5338f88c8bea","bytes":1379236,"source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Fermi%20Gamma-ray%20Large%20Area%20Space%20Telescope","download":"https://raw.githubusercontent.com/nasa/NASA-3D-Resources/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Fermi%20Gamma-ray%20Large%20Area%20Space%20Telescope/Fermi%20Gamma-ray%20Large%20Area%20Space%20Telescope.glb","sha256":"d345f3b0595f7792f699acf33b28d7401cb53cc2a20b735bca00e95644e3813c","uv_repairs":[],"credit":"NASA 3D Resources · adaptation filaire Atlas","original_file":"resources/science-originals/fermi.glb","version":"NASA original","triangles":172788,"textures":0,"materials":27},{"key":"tess","ids":[43435],"url":"images/detailed/tess.glb?v=a3b4bba3dff8","bytes":1693880,"source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Transiting%20Exoplanet%20Survey%20Satellite%20%28TESS%29%20%28B%29","download":"https://raw.githubusercontent.com/nasa/NASA-3D-Resources/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Transiting%20Exoplanet%20Survey%20Satellite%20%28TESS%29%20%28B%29/Transiting%20Exoplanet%20Survey%20Satellite%20%28TESS%29%20%28B%29.glb","sha256":"94e9ce15b02924175f1c0b33c0aaa7a33ee5e1fcbf933642ab933c1b04a1a238","uv_repairs":[],"credit":"NASA 3D Resources","original_file":"resources/detailed-originals/tess-b.glb","version":"NASA B texturé","triangles":16161,"textures":6,"materials":5},{"key":"iss","ids":[25544],"url":"images/detailed/iss.glb?v=ccf3a2a7279e","bytes":95875884,"source":"https://www.nasa.gov/integrated-graphics-operations-and-analysis-laboratory/","download":"https://raw.githubusercontent.com/nasa/NASA-3D-Resources/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/International%20Space%20Station%20%28ISS%29%20%28D%29%20%28IGOAL%29/International%20Space%20Station%20%28ISS%29.glb","sha256":"57cecfaf332efb2127d07796c4b65ca570d95a11516c8e046feb5a12efee491d","uv_repairs":[],"credit":"NASA IGOAL","original_file":"resources/detailed-originals/iss-igoal.glb","version":"NASA IGOAL D","triangles":2707621,"textures":220,"materials":49},{"key":"tiangong","ids":[48274],"url":"images/detailed/tiangong.glb?v=82d45acbc3e6","bytes":980084,"source":"https://sketchfab.com/3d-models/tiangong-aca22b1dd6d242c1ae7b88de2f483b77","download":"https://raw.githubusercontent.com/Buggy1111/earth-pulse/be3a16addde8a5d59c73e7a1c5e512f3f8963ae0/public/models/sats/tiangong.glb","sha256":"d0e2ee481e63dfd28397346ce3802508136187e10263a2c3e1d203825eb2a3b5","uv_repairs":[],"credit":"w29572227 · CC BY 4.0","original_file":"resources/detailed-originals/tiangong-sketchfab.glb","version":"tianGong — maillage et matériaux de w29572227","triangles":128932,"textures":1,"materials":22}],models=new Map(definitions.flatMap(info=>info.ids.map(id=>[id,info])));
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
