'use strict';
// Only reusable rendering resources. Documents, edition.json, API responses and data stay fresh.
const VERSION='atlas-rendering-v1',ASSETS=VERSION+'-assets',TILES=VERSION+'-tiles',ASSET_LIMIT=256,TILE_LIMIT=128;
const base=new URL('./',self.location.href),inflight=new Map();let maintenance=Promise.resolve();
function category(request){
 if(request.method!=='GET'||request.mode==='navigate')return null;
 const url=new URL(request.url);
 if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)){
  const path=url.pathname.slice(base.pathname.length);
  if(path.startsWith('data/')||path.startsWith('api/')||path==='edition.json'||path==='asset-sw.js'||path==='asset-cache.js'||path==='loading.js')return null;
  if(path.startsWith('vendor/')||path.startsWith('images/')||/\.(js|css|wasm)$/.test(path))return ASSETS;
 }
 if(url.origin!==base.origin&&/^https?:$/.test(url.protocol)&&/\/\d+\/\d+\/\d+\.(png|jpe?g|webp)$/.test(url.pathname))return TILES;
 return null;
}
function remember(cache,request,response,name){
 // Opaque cross-origin images can consume megabytes of quota per tiny tile.
 if(!response.ok||response.type==='opaque')return Promise.resolve();
 if(name===TILES&&!Number.isFinite(Date.parse(response.headers.get('expires'))))return Promise.resolve();
 const copy=response.clone();maintenance=maintenance.catch(()=>{}).then(async()=>{await cache.put(request,copy);const keys=await cache.keys(),limit=name===TILES?TILE_LIMIT:ASSET_LIMIT;for(const key of keys.slice(0,Math.max(0,keys.length-limit)))await cache.delete(key);}).catch(()=>{});return maintenance;
}
async function cached(request,name,event){
 const cache=await caches.open(name),hit=await cache.match(request);if(hit&&(name!==TILES||Date.parse(hit.headers.get('expires'))>Date.now()))return hit;
 let pending=inflight.get(request.url);
 if(!pending){pending=fetch(request);inflight.set(request.url,pending);pending.finally(()=>inflight.delete(request.url)).catch(()=>{});}
 const response=(await pending).clone();event.waitUntil(remember(cache,request,response,name));return response;
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('atlas-rendering-')&&name!==ASSETS&&name!==TILES)await caches.delete(name);for(const name of [ASSETS]){const cache=await caches.open(name);for(const request of await cache.keys()){const path=new URL(request.url).pathname;if(path.endsWith('/loading.js')||path.endsWith('/asset-cache.js'))await cache.delete(request);}}await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),local=url.origin===base.origin&&url.pathname.startsWith(base.pathname),path=local?url.pathname.slice(base.pathname.length):'';
 // Fetch documents and the small progress controller fresh, even when an older
 // document still refers to a previously cached loader query string.
 if(event.request.method==='GET'&&local&&(event.request.mode==='navigate'||['loading.js','asset-cache.js','asset-sw.js'].includes(path))){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
 const name=category(event.request);if(name)event.respondWith(cached(event.request,name,event));
});
self.addEventListener('message',event=>{if(event.data?.type!=='warm-assets')return;event.waitUntil(Promise.all([...new Set(event.data.urls||[])].slice(0,ASSET_LIMIT).map(async value=>{try{const url=new URL(value,base);if(url.origin!==base.origin)return;const request=new Request(url.href);if(category(request)!==ASSETS)return;await cached(request,ASSETS,event);}catch{/* Warming is optional; failures never block the application. */}})));});
