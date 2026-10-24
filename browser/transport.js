/* Immutable edition per visit. Lightweight metadata never waits for the orbital engine. */
(function(){
 const base=new URL('./',document.currentScript.src),worker=new Worker(new URL('browser-worker.js',base));
 const collection=AtlasPages.mode(location.pathname);let serial=0;const pending=new Map(),files=new Map();
 worker.onmessage=event=>{const {id,data,error}=event.data,p=pending.get(id);if(!p)return;pending.delete(id);error?p.reject(new Error(error)):p.resolve(data);};
 worker.onerror=()=>{for(const p of pending.values())p.reject(new Error('Le moteur de calcul du navigateur a été interrompu. Rechargez la page.'));pending.clear();};
 function call(op,payload={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,op,...payload});});}
 async function read(path,compressed=false){const response=await fetch(new URL(path,base),{cache:compressed?'default':'no-store'});if(!response.ok)throw new Error(`Données indisponibles (HTTP ${response.status})`);if(!compressed)return response.json();return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();}
 function file(path){if(!files.has(path))files.set(path,read(path,true).catch(error=>{files.delete(path);throw error;}));return files.get(path);}
 const edition=read('edition.json'),ready=edition.then(e=>call('init',e.collections?{edition:e,collection}:{}));ready.catch(()=>{});
 async function resource(key){const e=await edition;return e.resources?.[key]?file(e.resources[key]):(await ready)[key];}
 window.AtlasStatic={async handle(path){const url=new URL(path,base),e=await edition;
  if(url.pathname.endsWith('/api/tiangong-missions'))return resource('tiangong_missions');
  if(url.pathname.endsWith('/api/tiangong-evas'))return resource('iss_evas');
  if(url.pathname.endsWith('/api/iss-missions'))return resource('iss_missions');
  if(url.pathname.endsWith('/api/iss-evas'))return resource('iss_evas');
  if(url.pathname.endsWith('/api/config'))return resource('config');
  if(url.pathname.endsWith('/api/sources'))return resource('sources');
  if(url.pathname.endsWith('/api/catalog'))return e.collections?file(e.collections[collection].catalog):(await ready).catalog_response;
  if(url.pathname.endsWith('/api/satellite')){const id=Number(url.searchParams.get('id')),path=e.resources?.details?.[String(Math.floor(id/1000))];if(path)return (await file(path))[String(id)]||{};if(!e.collections)return {verification:(await ready).catalog_response.satellites.find(s=>s.id===id)?.verification};return {};}
  if(url.pathname.endsWith('/api/positions')){await ready;return call('positions',{at:url.searchParams.get('at')||new Date().toISOString(),idValue:url.searchParams.has('id')?Number(url.searchParams.get('id')):null,archived:url.searchParams.get('last')==='1',now:new Date().toISOString()});}
  throw new Error('Requête non disponible dans cette version.');
 }};
})();
