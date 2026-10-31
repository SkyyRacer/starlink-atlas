/* Probe models share the solar scene's floating origin. Never place a spacecraft
   at absolute interplanetary GPU coordinates, or invent a different position. */
(function(root){
 function create({C,viewer,base,onChange=()=>{}}){
  let manifest=null,current=null,model=null,loading=false,selected=null,error='',serial=0,abort=null,last=null,activeLight=false;
  const physicalRadii=new WeakMap(),cache=new Map(),originalLight=viewer.scene.light,probeLight=C.DirectionalLight?new C.DirectionalLight({direction:new C.Cartesian3(0,0,-1),intensity:1.4}):null;
  const infoFor=id=>manifest?.models.find(m=>m.ids.includes(id));
  function notify(){onChange({loading,error,progress:loading?progress:100});viewer.scene.requestRender();}
  let progress=0;
  async function metadata(){if(!manifest){const r=await fetch(new URL('solar/probe-models.json',base),{cache:'no-cache'});if(!r.ok)throw Error('Catalogue des modèles indisponible');manifest=await r.json();}return manifest;}
  function hide(){if(model){model.show=false;model.minimumPixelSize=0;model.maximumScale=1;}if(activeLight){viewer.scene.light=originalLight;activeLight=false;}}
  async function load(info){const token=++serial;abort?.abort();const request=abort=new AbortController();loading=true;error='';progress=0;notify();
   try{
    const r=await fetch(new URL(info.url,base),{signal:request.signal});if(!r.ok)throw Error('Modèle 3D indisponible');let bytes;
    if(r.body?.getReader){const reader=r.body.getReader(),chunks=[];let count=0;for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);count+=value.length;if(token!==serial){await reader.cancel();return;}progress=Math.min(85,85*count/info.bytes);notify();}bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}}
    else bytes=new Uint8Array(await r.arrayBuffer());
    if(token!==serial)return;if(bytes.length!==info.bytes)throw Error('Fichier 3D incomplet');progress=90;notify();
    const axes=info.body_axes?{upAxis:C.Axis.Z,forwardAxis:C.Axis.X}:{};
    const instance=await C.Model.fromGltfAsync({...axes,gltf:bytes,basePath:base.href,scale:(info.physical_span_m||100)/100,minimumPixelSize:0,maximumScale:1,modelMatrix:C.Matrix4.IDENTITY,id:{mission:current.key},show:false,allowPicking:true,incrementallyLoadTextures:false,lightColor:new C.Cartesian3(1.15,1.12,1.08),imageBasedLighting:new C.ImageBasedLighting({imageBasedLightingFactor:new C.Cartesian2(.55,.8),specularEnvironmentMaps:new URL('images/detailed/environment.ktx2',base).href,sphericalHarmonicCoefficients:[[1.2,1.2,1.2],...[...Array(8)].map(()=>[0,0,0])].map(v=>new C.Cartesian3(...v))})});
    if(token!==serial){instance.destroy();return;}viewer.scene.primitives.add(instance);cache.set(current.id,instance);model=instance;loading=false;progress=100;if(last)update(last);notify();
   }catch(e){if(token!==serial)return;loading=false;if(e.name!=='AbortError')error='Le modèle 3D n’a pas pu être chargé. Cliquez sur la sonde pour réessayer.';notify();}
  }
  function select(key,id){if(current?.id===id&&!error)return Promise.resolve();hide();serial++;abort?.abort();loading=false;error='';current={key,id};selected=infoFor(id);model=cache.get(id)||null;return metadata().then(()=>{if(current?.id!==id)return;selected=infoFor(id);if(last)update(last);}).catch(()=>{error='Catalogue des modèles indisponible';notify();});}
  function update(state){last=state;hide();if(!state.focused||!state.position||!current)return false;
   if(selected&&!model&&!loading&&!error&&(state.range<50000||state.contextModel))void load(selected);
   if(!model||model.ready===false||state.range>50000&&!state.contextModel)return false;if(!physicalRadii.has(model))physicalRadii.set(model,model.boundingSphere.radius);model.minimumPixelSize=state.contextModel?160:0;model.maximumScale=state.contextModel?undefined:1;
   model.modelMatrix=C.Matrix4.fromRotationTranslation(state.rotation,state.position);model.show=true;
   if(state.sunDirection&&probeLight){probeLight.direction=C.Cartesian3.negate(state.sunDirection,new C.Cartesian3());viewer.scene.light=probeLight;activeLight=true;}
   return true;
  }
  return {select,update,async preload(){if(current){await metadata();selected=infoFor(current.id);if(selected&&!model&&!loading)await load(selected);if(model?.ready===false)await new Promise((resolve,reject)=>{let stopReady=()=>{},stopError=()=>{};const finish=reason=>{clearTimeout(timer);stopReady();stopError();reason?reject(reason):resolve();},timer=setTimeout(()=>finish(Error('Le modèle 3D ne peut pas terminer son chargement.')),30000);stopReady=model.readyEvent.addEventListener(()=>finish());stopError=model.errorEvent.addEventListener(()=>finish(Error('Le modèle 3D ne peut pas être affiché.')));viewer.scene.requestRender();});}},clear(){hide();serial++;abort?.abort();loading=false;current=null;selected=null;last=null;notify();},get minimumRange(){return model?.ready?Math.max(1,(physicalRadii.get(model)||model.boundingSphere.radius)*1.35):Math.max(2,(selected?.physical_span_m||100)*.8);},get radius(){return model?.ready?(physicalRadii.get(model)||model.boundingSphere.radius):Math.max(1,(selected?.physical_span_m||100)*.65);},get supported(){return !!selected;},get model(){return model;}};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasSystemProbe=api;
})(typeof window==='undefined'?globalThis:window);
