// Run with node --wasm-max-mem-pages=2048 tests/wasm-memory.cjs <local static export>.
// The previous whole-edition init aborts under this 128 MiB WASM limit.
const fs=require('node:fs'),zlib=require('node:zlib'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(process.argv[2]),edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json')));
 const read=file=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,file))));
 const payload=read(edition.collections.all.engine),module=await WebAssembly.compile(fs.readFileSync('web-core/target/wasm32-unknown-unknown/release/atlas_web_core.wasm'));
 const exports=new WebAssembly.Instance(module,{}).exports,context={AtlasCollections:require('../static/constellations.js'),TextEncoder,TextDecoder,Map,Date,Promise,console,self:{},exports};vm.createContext(context);vm.runInContext(fs.readFileSync('browser/browser-worker.js','utf8'),context);vm.runInContext('engine=exports',context);
 context.initialize(payload);const initial=exports.memory.buffer.byteLength;console.log('Initialized MiB',initial/1048576);
 const at=new Date(Date.parse(payload.live_window.from)+60000).toISOString();
 const points=context.compute({op:'positions',at,now:at});assert.ok(points.points.length>20000);
 for(let i=0;i<20;i++){const result=context.compute({op:'positions',at,now:at,id:i%2?25544:null});assert.equal(result.points.length,points.points.length);}
 const live=exports.memory.buffer.byteLength;console.log('Positions MiB',live/1048576);context.compute({op:'orbits-start',target:'live'});
 const manifest=read(edition.resources.history),current=read(edition.collections.all.observations);
 const days=Object.keys(manifest.local_files).filter(d=>d>='2026-10-15'&&d<='2026-10-21').map(day=>read(manifest.local_files[day]));
 context.combinedHistory(current,days,'2026-10-18T12:00:00Z');
 const past=context.compute({op:'positions',at:'2026-10-18T12:00:00Z',now:at,id:25544});assert.ok(past.points.length>10000);
 console.log(JSON.stringify({initial_MiB:initial/1048576,live_MiB:live/1048576,historical_MiB:exports.memory.buffer.byteLength/1048576,points:points.points.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
