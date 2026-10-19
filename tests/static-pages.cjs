// Real HTTP + real WASM, served under the GitHub Project Pages subpath.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const root=path.resolve(process.argv[2]),origin=process.argv[3]||'http://127.0.0.1:3004/starlink-atlas/';
function engine(exports){return value=>{const bytes=Buffer.from(JSON.stringify(value)),p=exports.atlas_alloc(bytes.length);new Uint8Array(exports.memory.buffer,p,bytes.length).set(bytes);const out=exports.atlas_call(p,bytes.length);exports.atlas_free(p,bytes.length);const n=new DataView(exports.memory.buffer).getUint32(out,true);const result=JSON.parse(Buffer.from(new Uint8Array(exports.memory.buffer,out+4,n)));exports.atlas_free(out,n+4);if(result.error)throw Error(result.error);return result.data;};}
function read(file){return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,file))));}
(async()=>{
 const edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json'))),legacy=read(edition.bundle);
 for(const page of ['atlas','iss','starlink']){
  const url=new URL(page+'/',origin),r=await fetch(url);assert.equal(r.status,200);const html=await r.text();assert.match(html,/<base href="\.\.\/">/);
  for(const [,src] of html.matchAll(/<script src="([^"]+)"/g))assert.equal((await fetch(new URL(src,new URL('../',url)))).status,200,src);
 }
 const reference=engine((await WebAssembly.instantiate(fs.readFileSync(path.join(root,'atlas_web_core.wasm')),{})).instance.exports);
 const history=read(edition.resources.history);
 function archivedRows(at){const rows=[],date=new Date(at);date.setUTCHours(12,0,0,0);for(let offset=-3;offset<=3;offset++){const day=new Date(+date+offset*86400000).toISOString().slice(0,10);if(history.remote_days.includes(day)){throw Error('Test date requires external archive: '+day);}if(history.local_days.includes(day))rows.push(...read(history.local_files[day]));}return rows;}
 const measurements=[];
 for(const collection of ['all','iss','starlink']){
  const requested=[];const fetchRecorded=async(...args)=>{requested.push(String(args[0]));return fetch(...args);};
  const self={location:{href:new URL('browser-worker.js',origin).href},postMessage(){}};
  const ctx={self,fetch:fetchRecorded,Response,DecompressionStream,WebAssembly,TextEncoder,TextDecoder,URL,Map,Date,Promise,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'browser-worker.js'),'utf8'),ctx);
  const start=performance.now();assert.equal((await ctx.dispatch({op:'init',edition,collection})).ready,true);
  const payload=read(edition.collections[collection].engine);assert.ok(payload.live_window);
  const at=new Date(Date.parse(payload.live_window.from)+60000).toISOString();
  const points=await ctx.dispatch({op:'positions',at,now:at,idValue:null});
  assert.ok(points.points.length>0);
  assert.ok(!requested.some(url=>/history|observations-|iss_missions|iss_evas|edition-/.test(url)),'first positions must not fetch archives, legacy bundle, missions or EVA');
  const initialRequests=requested.length;
  for(const date of [at,'2026-10-18T12:00:00Z']){
   reference({op:'init',data:legacy});reference({op:'history',rows:archivedRows(date)});
   const all=reference({op:'positions',at:date,now:at});const expected=all.points.filter(p=>collection==='all'||((p.id===25544)===(collection==='iss')));
   const actual=await ctx.dispatch({op:'positions',at:date,now:at,idValue:null});
   assert.equal(actual.points.length,expected.length);for(let i=0;i<expected.length;i++)assert.deepEqual(JSON.parse(JSON.stringify(actual.points[i])),expected[i],collection+' exact orbital results '+date+' '+expected[i].id);
   const id=expected[0]?.id;if(id){const old=reference({op:'positions',at:date,now:at,id}),next=await ctx.dispatch({op:'positions',at:date,now:at,idValue:id});for(const key of ['track','future_track','track_3d','future_track_3d'])assert.deepEqual(JSON.parse(JSON.stringify(next[key])),old[key],key);}
  }
  measurements.push({collection,initial_engine_requests:initialRequests,catalog_bytes:fs.statSync(path.join(root,edition.collections[collection].catalog)).size,engine_bytes:fs.statSync(path.join(root,edition.collections[collection].engine)).size});
 }
 assert.ok(read(edition.resources.iss_missions).flights.length>=300);assert.ok(read(edition.resources.iss_evas).spacewalks.length>=500);
 const pages={document:{baseURI:origin},URL,module:{exports:{}}};vm.createContext(pages);vm.runInContext(fs.readFileSync(path.join(root,'pages.js'),'utf8'),pages);assert.equal(pages.module.exports.url('iss'),new URL('iss/',origin).href);
 console.log(JSON.stringify({static_pages:'OK',exact_positions_and_tracks:'live + historical, all / ISS / Starlink',measurements}));
})().catch(e=>{console.error(e);process.exit(1)});
