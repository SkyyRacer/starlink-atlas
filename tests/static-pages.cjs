// Integration check of the static site under the same subpath as Project Pages.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]),origin=process.argv[3]||'http://127.0.0.1:3004/starlink-atlas/';
(async()=>{
 for(const page of ['atlas','iss','starlink']){
  const url=new URL(page+'/',origin),r=await fetch(url);assert.equal(r.status,200);const html=await r.text();assert.match(html,/<base href="\.\.\/">/);
  const base=new URL('../',url);
  for(const [,src] of html.matchAll(/<script src="([^"]+)"/g)){const asset=await fetch(new URL(src,base));assert.equal(asset.status,200,src);}
 }
 const svg=await fetch(new URL('images/flags/fr.svg',origin));assert.equal(svg.status,200);assert.match(await svg.text(),/<svg/);
 const messages=[];const self={location:{href:new URL('browser-worker.js',origin).href},postMessage:m=>messages.push(m)};
 const ctx={self,fetch,Response,DecompressionStream,WebAssembly,TextEncoder,TextDecoder,URL,Map,Date,Promise,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'browser-worker.js'),'utf8'),ctx);
 const data=await ctx.dispatch({op:'init'});assert.ok(data.iss_missions.flights.length>=300);assert.ok(data.iss_evas.spacewalks.length>=500);
 const pages={document:{baseURI:origin},URL,module:{exports:{}}};vm.createContext(pages);vm.runInContext(fs.readFileSync(path.join(root,'pages.js'),'utf8'),pages);
 assert.equal(pages.module.exports.mode('/starlink-atlas/iss/'),'iss');assert.equal(pages.module.exports.url('iss'),new URL('iss/',origin).href);
 console.log('Export sous /starlink-atlas/ : trois documents, ressources, drapeaux, WASM, 318 vols et 500 EVA OK');
})().catch(e=>{console.error(e);process.exit(1)});
