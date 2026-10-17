'use strict';
let engine,bundle,manifest,historyKey=null;const days=new Map(),encoder=new TextEncoder(),decoder=new TextDecoder();
async function jsonFile(path,compressed=false){const response=await fetch(new URL(path,self.location.href),{cache:compressed?'default':'no-store'});if(!response.ok)throw new Error(`Données indisponibles (HTTP ${response.status})`);const bytes=compressed?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():await response.arrayBuffer();return JSON.parse(decoder.decode(bytes));}
function compute(input){const bytes=encoder.encode(JSON.stringify(input)),ptr=engine.atlas_alloc(bytes.length);new Uint8Array(engine.memory.buffer,ptr,bytes.length).set(bytes);let result;
 try{result=engine.atlas_call(ptr,bytes.length);}finally{engine.atlas_free(ptr,bytes.length);}
 const size=new DataView(engine.memory.buffer).getUint32(result,true);let answer;
 try{answer=JSON.parse(decoder.decode(new Uint8Array(engine.memory.buffer,result+4,size)));}finally{engine.atlas_free(result,size+4);}
 if(answer.error)throw new Error(answer.error);return answer.data;
}
async function loadHistory(at){const date=new Date(at);if(!Number.isFinite(+date))throw new Error('Date invalide');const key=date.toISOString().slice(0,10);if(historyKey===key)return;const windowDays=[];date.setUTCHours(12,0,0,0);
 for(let offset=-3;offset<=3;offset++){const day=new Date(+date+offset*86400000).toISOString().slice(0,10);if(!manifest?.days?.[day])continue;windowDays.push(day);}
 const rows=await Promise.all(windowDays.map(async day=>{if(!days.has(day)){let values=[];if(manifest.remote_base&&manifest.remote_days.includes(day))values=await jsonFile(manifest.remote_base+day+'.json.gz',true);else if(!manifest.remote_base&&manifest.remote_days?.includes(day))values=await jsonFile(`data/history/${day}.json.gz`,true);if(manifest.local_days?.includes(day))values=values.concat(await jsonFile(manifest.local_files?.[day]||`data/history/${day}.json.gz`,true));days.set(day,values);}return days.get(day);}));
 compute({op:'history',rows:rows.flat()});historyKey=key;
 for(const day of days.keys())if(!windowDays.includes(day))days.delete(day);
}
async function dispatch(message){if(message.op==='init'){
  if(typeof DecompressionStream!=='function')throw new Error('Ce navigateur doit être mis à jour pour décompresser les archives orbitales.');
  const edition=await jsonFile('edition.json');bundle=await jsonFile(edition.bundle,true);manifest=bundle.catalog_response.history;
  const module=await WebAssembly.instantiate(await(await fetch(new URL('atlas_web_core.wasm?v=0b33a39bbe69',self.location.href))).arrayBuffer(),{});engine=module.instance.exports;compute({op:'init',data:bundle});
  return {catalog_response:bundle.catalog_response,config:bundle.config,sources:bundle.sources};
 }
 if(message.op==='positions'){
  await loadHistory(message.at);const result=compute({op:'positions',at:message.at,now:message.now,id:message.idValue});
  if(!result.points.length&&manifest?.days){const candidates=[result.suggested_at,...Object.keys(manifest.days).map(day=>day+'T12:00:00Z')].filter(v=>v&&Date.parse(v)<=Date.parse(message.now));result.suggested_at=candidates.sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(message.at))-Math.abs(Date.parse(b)-Date.parse(message.at)))[0]||null;}
  return result;
 }
 throw new Error('Opération inconnue');
}
let queue=Promise.resolve();self.onmessage=event=>{const message=event.data;queue=queue.then(async()=>{try{self.postMessage({id:message.id,data:await dispatch(message)});}catch(error){self.postMessage({id:message.id,error:error.message||String(error)});}});};
