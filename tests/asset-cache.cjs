const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Cache{
 constructor(){this.entries=new Map();}
 async match(request){return this.entries.get(request.url)?.clone();}
 async put(request,response){this.entries.set(request.url,response.clone());}
 async keys(){return [...this.entries.keys()].map(url=>new Request(url));}
 async delete(request){return this.entries.delete(request.url);}
}
(async()=>{
 const stores=new Map(),listeners={};let downloads=0,claimed=false;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Cache());return stores.get(name);},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
 const self={location:{href:'https://example.test/starlink-atlas/asset-sw.js'},clients:{async claim(){claimed=true;}},async skipWaiting(){},addEventListener(type,fn){listeners[type]=fn;}};
 const context={self,caches,URL,Request,Promise,Map,Set,fetch:async request=>{downloads++;return new Response(request.url,{headers:{Expires:new Date(Date.now()+86400000).toUTCString()}});}};
 vm.runInNewContext(fs.readFileSync('static/asset-sw.js','utf8'),context);
 async function request(path,options={}){const waits=[];let response;const req=new Request(new URL(path,'https://example.test/starlink-atlas/'),options);listeners.fetch({request:req,waitUntil:p=>waits.push(p),respondWith:p=>response=p});const answer=response?await response:null;await Promise.all(waits);return answer;}
 const engine='vendor/cesium/Cesium.js';assert.ok(await request(engine));assert.equal(downloads,1);assert.ok(await request(engine));assert.equal(downloads,1,'another page must reuse the same engine');
 await request('app.js?v=one');await request('app.js?v=two');assert.equal(downloads,3,'new code hashes must fetch the updated asset');
 for(const file of ['edition.json','data/catalog-iss-hash.json.gz','api/catalog','atlas','iss','starlink'])assert.equal(await request(file),null,file+' must stay outside the shared rendering cache');
 for(let i=0;i<140;i++)await request('https://tiles.example.test/5/'+i+'/0.png');
 const tileCache=await caches.open('atlas-rendering-v1-tiles');assert.equal((await tileCache.keys()).length,128);
 const opaqueWaits=[],opaqueRequest=new Request('https://tiles.example.test/0/0/0.png');
 context.fetch=async()=>({ok:false,type:'opaque',clone(){return this;}});
 assert.ok(await request(opaqueRequest.url));assert.equal(await tileCache.match(opaqueRequest),undefined,'opaque images must not consume padded storage quota');
 await caches.open('atlas-rendering-old-assets');await caches.open('another-app-cache');
 const activation=[];listeners.activate({waitUntil:p=>activation.push(p)});await Promise.all(activation);
 assert.equal(stores.has('atlas-rendering-old-assets'),false);assert.equal(stores.has('another-app-cache'),true);assert.equal(claimed,true);
 console.log('Cache partagé : moteur téléchargé une fois, versions distinctes, données / pages exclues, 128 tuiles maximum, réponses opaques exclues, anciennes versions nettoyées OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
