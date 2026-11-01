/* Real exported worker + WASM, with Pages-like compressed file responses. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(process.argv[2]),base='https://example.test/starlink-atlas/';
 for(const [collection,id] of [['mir',16609],['skylab',6633],['tiangong-1',37820],['tiangong-2',41765],['salyut',13138]]){
  const edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json')));if(!edition.collections[collection])continue;
  const calls=[],context={console,URL,Request,Response,Headers,DecompressionStream,WebAssembly,TextEncoder,TextDecoder,Map,Set,Date,Promise,AbortController,setTimeout,clearTimeout,location:{href:base+'browser-worker.js'},postMessage(){}};
  context.self=context;
  context.fetch=async input=>{
   const url=new URL(input instanceof Request?input.url:input,base);calls.push(url.href);
   assert.ok(url.href.startsWith(base),'The last-position action needs no external history');
   const file=path.join(root,url.pathname.slice('/starlink-atlas/'.length));
   return fs.existsSync(file)?new Response(fs.readFileSync(file)):new Response('',{status:404});
  };
  vm.createContext(context);context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(root,new URL(file,base).pathname.slice('/starlink-atlas/'.length)),'utf8'),context));
  vm.runInContext(fs.readFileSync(path.join(root,'browser-worker.js'),'utf8'),context);
  await context.dispatch({op:'init',edition,collection});
  const observation=await context.jsonFile('retired-observations/'+id+'.json'),el=observation.elements||observation;
  const at=el.EPOCH.replace(/Z?$/,'Z'),result=await context.dispatch({op:'positions',at,now:new Date().toISOString(),archived:true,idValue:id});
  assert.ok(result.points.some(row=>row.id===id),'The actual last-position action renders '+collection);
  assert.ok(result.track_3d.length,'Historical orbital track available for '+collection);
  assert.ok(calls.some(url=>url.endsWith('/retired-observations/'+id+'.json.gz')),'Worker reads compressed observations');
  console.log(collection+': real archived position and orbit restored by the published worker');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
