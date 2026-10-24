// Real HTTP + real WASM, served under the GitHub Project Pages subpath.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const root=path.resolve(process.argv[2]),origin=process.argv[3]||'http://127.0.0.1:3004/starlink-atlas/';
function engine(exports){return value=>{const bytes=Buffer.from(JSON.stringify(value)),p=exports.atlas_alloc(bytes.length);new Uint8Array(exports.memory.buffer,p,bytes.length).set(bytes);const out=exports.atlas_call(p,bytes.length);exports.atlas_free(p,bytes.length);const n=new DataView(exports.memory.buffer).getUint32(out,true);const result=JSON.parse(Buffer.from(new Uint8Array(exports.memory.buffer,out+4,n)));exports.atlas_free(out,n+4);if(result.error)throw Error(result.error);return result.data;};}
function read(file){return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,file))));}
(async()=>{
 const edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json'))),legacy=read(edition.bundle);const scopes=new Map(legacy.catalog_response.satellites.map(s=>[s.id,s.collections||[s.family||'starlink']]));
 const checkedAssets=new Set();
 for(const page of ['atlas',...require('../static/pages.js').definitions.map(row=>row.id)]){
  const url=new URL(page+'/',origin),r=await fetch(url);assert.equal(r.status,200);const html=await r.text();assert.match(html,/<base href="\.\.\/">/);
  for(const [,src] of html.matchAll(/<script src="([^"]+)"/g)){const asset=new URL(src,new URL('../',url)).href;if(checkedAssets.has(asset))continue;const response=await fetch(asset);assert.equal(response.status,200,src);await response.arrayBuffer();checkedAssets.add(asset);}
 }
 const wasmModule=await WebAssembly.compile(fs.readFileSync(path.join(root,'atlas_web_core.wasm')));const references=new Map();let reference;
 let history=read(edition.resources.history);
 function archivedRows(at){const rows=[],date=new Date(at);date.setUTCHours(12,0,0,0);for(let offset=-3;offset<=3;offset++){const day=new Date(+date+offset*86400000).toISOString().slice(0,10);if(history.remote_days.includes(day)){throw Error('Test date requires external archive: '+day);}if(history.local_days.includes(day))rows.push(...read(history.local_files[day]));}return rows;}
 const measurements=[];const referenceCache=new Map();
 function expectedAt(date,now){if(!referenceCache.has(date)){reference=engine(new WebAssembly.Instance(wasmModule,{}).exports);references.set(date,reference);history=read(edition.resources.history);reference({op:'init',data:legacy});reference({op:'history',rows:archivedRows(date)});referenceCache.set(date,reference({op:'positions',at:date,now}));}reference=references.get(date);return referenceCache.get(date);}

 for(const collection of ['all',...require('../static/pages.js').definitions.map(row=>row.id)]){
  history=read(edition.resources[collection+'_history']||edition.resources.history);
  const requested=[];const fetchRecorded=async(...args)=>{requested.push(String(args[0]));return fetch(...args);};
  const self={location:{href:new URL('browser-worker.js',origin).href},postMessage(){}};
  const ctx={AtlasCollections:require('../static/constellations.js'),self,fetch:fetchRecorded,Response,DecompressionStream,WebAssembly,TextEncoder,TextDecoder,URL,Map,Date,Promise,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'browser-worker.js'),'utf8'),ctx);
  const start=performance.now();assert.equal((await ctx.dispatch({op:'init',edition,collection})).ready,true);
  const payload=read(edition.collections[collection].engine);assert.ok(payload.live_window);
  const at=new Date(Date.parse(payload.live_window.from)+60000).toISOString();
  const points=await ctx.dispatch({op:'positions',at,now:at,idValue:null});
  if(collection==='all')assert.ok(points.points.length>1000,'Atlas retains its current catalogue');
  if(points.points.length&&!['tess','xposat'].includes(collection))assert.ok(!requested.some(url=>/history|observations-|iss_missions|iss_evas|edition-/.test(url)),'first positions must not fetch archives, legacy bundle, missions or EVA');
  const initialRequests=requested.length;
  for(const date of [at,'2026-10-18T12:00:00Z']){
   const all=expectedAt(date,at);const expected=all.points.filter(p=>collection==='all'||scopes.get(p.id)?.includes(collection));
   const actual=await ctx.dispatch({op:'positions',at:date,now:at,idValue:null});
   assert.equal(actual.points.length,expected.length);for(let i=0;i<expected.length;i++)assert.deepEqual(JSON.parse(JSON.stringify(actual.points[i])),expected[i],collection+' exact orbital results '+date+' '+expected[i].id);
   const id=expected[0]?.id;if(id){const old=reference({op:'positions',at:date,now:at,id}),next=await ctx.dispatch({op:'positions',at:date,now:at,idValue:id});for(const key of ['track','future_track','track_3d','future_track_3d'])assert.deepEqual(JSON.parse(JSON.stringify(next[key])),old[key],key);}
  }
  if(collection==='tess'){const date='2026-09-21T15:00:00Z';const actual=await ctx.dispatch({op:'positions',at:date,now:at,idValue:43435});assert.equal(actual.points.length,1);assert.equal(actual.points[0].id,43435);assert.ok(actual.track_3d.length);assert.ok(actual.track_3d.length<=30721,'Adaptive orbit sampling remains bounded');assert.ok(Math.abs(actual.points[0].age_hours)<=72,'TESS observation respects the validity limit');}
  measurements.push({collection,initial_engine_requests:initialRequests,catalog_bytes:fs.statSync(path.join(root,edition.collections[collection].catalog)).size,engine_bytes:fs.statSync(path.join(root,edition.collections[collection].engine)).size});
 }
 assert.ok(read(edition.resources.iss_missions).flights.length>=300);assert.ok(read(edition.resources.iss_evas).spacewalks.length>=500);
 const pages={AtlasCollections:require('../static/constellations.js'),document:{baseURI:origin},URL,module:{exports:{}},require:path=>require('../static/constellations.js')};vm.createContext(pages);vm.runInContext(fs.readFileSync(path.join(root,'pages.js'),'utf8'),pages);for(const [mode,route] of [['all','atlas'],...require('../static/pages.js').definitions.map(row=>[row.id,row.id])])assert.equal(pages.module.exports.url(mode),new URL(route+'/',origin).href);
 console.log(JSON.stringify({static_pages:'OK',exact_positions_and_tracks:'live + historical, all collection pages',measurements}));
})().catch(e=>{console.error(e);process.exit(1)});
