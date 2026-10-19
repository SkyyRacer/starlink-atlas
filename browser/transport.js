/* This transport exists only in the GitHub Pages build. No user state is persisted. */
(function(){
 const base=new URL('./',document.currentScript.src),worker=new Worker(new URL('browser-worker.js',base));
 let serial=0;const pending=new Map();
 worker.onmessage=event=>{const {id,data,error}=event.data,p= pending.get(id);if(!p)return;pending.delete(id);error?p.reject(new Error(error)):p.resolve(data);};
 worker.onerror=()=>{for(const p of pending.values())p.reject(new Error('Le moteur de calcul du navigateur a été interrompu. Rechargez la page.'));pending.clear();};
 function call(op,payload={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,op,...payload});});}
 const ready=call('init');
 window.AtlasStatic={async handle(path){const url=new URL(path,base);const bundle=await ready;
  if(url.pathname.endsWith('/api/iss-missions')&&bundle.iss_missions)return bundle.iss_missions;
  if(url.pathname.endsWith('/api/iss-evas')&&bundle.iss_evas)return bundle.iss_evas;
  if(url.pathname.endsWith('/api/catalog'))return bundle.catalog_response;
  if(url.pathname.endsWith('/api/config'))return bundle.config;
  if(url.pathname.endsWith('/api/sources'))return bundle.sources;
  if(url.pathname.endsWith('/api/positions'))return call('positions',{at:url.searchParams.get('at')||new Date().toISOString(),idValue:url.searchParams.has('id')?Number(url.searchParams.get('id')):null,now:new Date().toISOString()});
  throw new Error('Requête non disponible dans cette version.');
 }};
})();
