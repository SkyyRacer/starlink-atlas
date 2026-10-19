'use strict';
let engine,bundle,edition,liveWindow,manifest,historyKey=null,currentLoaded=false,collection='all';const days=new Map(),encoder=new TextEncoder(),decoder=new TextDecoder();
async function jsonFile(path,compressed=false){const response=await fetch(new URL(path,self.location.href),{cache:compressed?'default':'no-store'});if(!response.ok)throw new Error(`Données indisponibles (HTTP ${response.status})`);const bytes=compressed?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():await response.arrayBuffer();return JSON.parse(decoder.decode(bytes));}
function compute(input){const bytes=encoder.encode(JSON.stringify(input)),ptr=engine.atlas_alloc(bytes.length);new Uint8Array(engine.memory.buffer,ptr,bytes.length).set(bytes);let result;
 try{result=engine.atlas_call(ptr,bytes.length);}finally{engine.atlas_free(ptr,bytes.length);}
 const size=new DataView(engine.memory.buffer).getUint32(result,true);let answer;
 try{answer=JSON.parse(decoder.decode(new Uint8Array(engine.memory.buffer,result+4,size)));}finally{engine.atlas_free(result,size+4);}
 if(answer.error)throw new Error(answer.error);return answer.data;
}
async function loadHistory(at){if(!manifest&&edition?.resources?.history)manifest=await jsonFile(edition.resources.history,true);const date=new Date(at);if(!Number.isFinite(+date))throw new Error('Date invalide');const key=date.toISOString().slice(0,10);if(historyKey===key)return;const windowDays=[];date.setUTCHours(12,0,0,0);
 for(let offset=-3;offset<=3;offset++){const day=new Date(+date+offset*86400000).toISOString().slice(0,10);if(!manifest?.days?.[day])continue;windowDays.push(day);}
 const rows=await Promise.all(windowDays.map(async day=>{if(!days.has(day)){let values=[];if(manifest.remote_base&&manifest.remote_days.includes(day))values=await jsonFile(manifest.remote_base+day+'.json.gz',true);else if(!manifest.remote_base&&manifest.remote_days?.includes(day))values=await jsonFile(`data/history/${day}.json.gz`,true);if(manifest.local_days?.includes(day))values=values.concat(await jsonFile(manifest.local_files?.[day]||`data/history/${day}.json.gz`,true));days.set(day,values);}return days.get(day);}));
 compute({op:'history',rows:rows.flat().filter(row=>collection==='all'||(((row.elements||row).NORAD_CAT_ID===25544)===(collection==='iss')))});historyKey=key;
 for(const day of days.keys())if(!windowDays.includes(day))days.delete(day);
}
async function loadCurrent(){if(currentLoaded||!edition.collections)return;const data=await jsonFile(edition.collections[collection].observations,true);compute({op:'current',data});currentLoaded=true;}
async function dispatch(message){if(message.op==='init'){
  historyKey=null;manifest=null;currentLoaded=false;days.clear();
  if(typeof DecompressionStream!=='function')throw new Error('Ce navigateur doit être mis à jour pour décompresser les archives orbitales.');
  edition=message.edition||await jsonFile('edition.json');collection=message.collection||'all';
  // Fetch the page's elements and WASM in parallel; no mission or EVA data here.
  const modulePromise=(async()=>WebAssembly.instantiate(await(await fetch(new URL('atlas_web_core.wasm',self.location.href))).arrayBuffer(),{}))();
  bundle=await jsonFile(edition.collections?edition.collections[collection].engine:edition.bundle,true);
  const module=await modulePromise;engine=module.instance.exports;compute({op:'init',data:bundle});
  liveWindow=bundle.live_window;
  if(edition.collections)return {ready:true};
  manifest=bundle.catalog_response.history;
  return {catalog_response:bundle.catalog_response,config:bundle.config,sources:bundle.sources,iss_missions:bundle.iss_missions,iss_evas:bundle.iss_evas};
 }
 if(message.op==='positions'){
  const live=liveWindow&&Date.parse(message.at)>=Date.parse(liveWindow.from)&&Date.parse(message.at)<Date.parse(liveWindow.until);
  if(!live)await Promise.all([loadCurrent(),loadHistory(message.at)]);let result=compute({op:'positions',at:message.at,now:message.now,id:message.idValue});
  if(live&&!result.points.length){await Promise.all([loadCurrent(),loadHistory(message.at)]);result=compute({op:'positions',at:message.at,now:message.now,id:message.idValue,use_history:true});}
  if(!result.points.length&&manifest?.days){const candidates=[result.suggested_at,...Object.keys(manifest.days).map(day=>day+'T12:00:00Z')].filter(v=>v&&Date.parse(v)<=Date.parse(message.now));result.suggested_at=candidates.sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(message.at))-Math.abs(Date.parse(b)-Date.parse(message.at)))[0]||null;}
  return result;
 }
 throw new Error('Opération inconnue');
}
let queue=Promise.resolve();self.onmessage=event=>{const message=event.data;queue=queue.then(async()=>{try{self.postMessage({id:message.id,data:await dispatch(message)});}catch(error){self.postMessage({id:message.id,error:error.message||String(error)});}});};
