const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2],origin=process.argv[3]||'http://127.0.0.1:3004/starlink-atlas/';
(async()=>{
 const requests=[],messages=[];
 class Worker{postMessage(message){messages.push(message);}}
 const ctx={window:{},document:{currentScript:{src:new URL('transport.js',origin).href}},location:{pathname:'/starlink-atlas/iss/'},AtlasPages:require('../static/pages.js'),Worker,fetch:async(...args)=>{requests.push(String(args[0]));return fetch(...args);},URL,Map,Promise,Response,DecompressionStream};
 vm.runInNewContext(fs.readFileSync(root+'/transport.js','utf8'),ctx);
 const api=ctx.window.AtlasStatic;
 const quick=promise=>Promise.race([promise,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Metadata blocked by the deliberately unready engine')),1500);timer.unref();})]);
 const config=await quick(api.handle('/api/config'));assert.ok(config.tile_url);
 const catalog=await quick(api.handle('/api/catalog?collection=iss'));assert.equal(catalog.satellites.length,1);assert.equal(catalog.satellites[0].id,25544);
 assert.equal(messages[0].collection,'iss');assert.equal(requests.some(url=>/edition-|orbits-|iss_missions|iss_evas/.test(url)),false);
 const missions=await quick(api.handle('/api/iss-missions'));assert.ok(missions.flights.length>=300);
 const count=requests.length;await api.handle('/api/iss-missions');assert.equal(requests.length,count,'lazy resources must be reused within the visit');
 assert.equal(requests.some(url=>/iss_evas/.test(url)),false,'EVA facts wait for a profile request');
 console.log('Transport : catalogue / configuration indépendants du moteur, ISS isolée, missions / EVA à la demande, cache par visite OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
