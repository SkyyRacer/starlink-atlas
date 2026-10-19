if(typeof AtlasCollections==='undefined')importScripts('constellations.js');
'use strict';
let engine,edition,liveWindow,manifest,historyKey=null,currentData=null,collection='all',catalogIds=new Set();const days=new Map(),encoder=new TextEncoder(),decoder=new TextDecoder();
async function jsonFile(path,compressed=false){const response=await fetch(new URL(path,self.location.href),{cache:compressed?'default':'no-store'});if(!response.ok)throw new Error(`Données indisponibles (HTTP ${response.status})`);const bytes=compressed?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():await response.arrayBuffer();return JSON.parse(decoder.decode(bytes));}
function compute(input){const bytes=encoder.encode(JSON.stringify(input)),ptr=engine.atlas_alloc(bytes.length);new Uint8Array(engine.memory.buffer,ptr,bytes.length).set(bytes);let result;
 try{result=engine.atlas_call(ptr,bytes.length);}finally{engine.atlas_free(ptr,bytes.length);}
 const size=new DataView(engine.memory.buffer).getUint32(result,true);let answer;
 try{answer=JSON.parse(decoder.decode(new Uint8Array(engine.memory.buffer,result+4,size)));}finally{engine.atlas_free(result,size+4);}
 if(answer.error)throw new Error(answer.error);return answer.data;
}
// Bound each ABI call: JSON decoding must not duplicate an entire Atlas edition in WASM memory.
const BATCH=256;
function loadPacked(data,target){compute({op:'orbits-start',target});const rows=data.packed_orbits||[];for(let i=0;i<rows.length;i+=BATCH)compute({op:'orbits-add',target,data:{orbit_fields:data.orbit_fields,orbit_sources:data.orbit_sources,packed_orbits:rows.slice(i,i+BATCH)}});}
function loadRows(rows,target,reset=true){if(reset)compute({op:'orbits-start',target});for(let i=0;i<rows.length;i+=BATCH)compute({op:'orbits-add',target,rows:rows.slice(i,i+BATCH)});}
function initialize(data){catalogIds=new Set((data.raw_catalog||[]).map(r=>r.NORAD_CAT_ID));
 if(!data.orbit_fields){compute({op:'init',data:{...data,orbits:[],raw_catalog:[],gcat:{}}});}
 else compute({op:'init',data:{orbit_fields:data.orbit_fields,orbit_sources:data.orbit_sources,packed_orbits:[],packed_live:[],raw_catalog:[],gcat:{},live_window:data.live_window}});
 const rows=data.raw_catalog||[],gcat=Object.entries(data.gcat||{});
 for(let i=0;i<rows.length;i+=BATCH)compute({op:'catalog-add',rows:rows.slice(i,i+BATCH)});
 for(let i=0;i<gcat.length;i+=BATCH)compute({op:'catalog-add',rows:[],gcat:Object.fromEntries(gcat.slice(i,i+BATCH))});
 if(data.orbit_fields){loadPacked(data,'current');loadPacked({...data,packed_orbits:data.packed_live||[]},'live');}
 else loadRows(data.orbits||[],'current');
}
// For any instant in this UTC window, only the nearest element before/after its boundaries
// and the elements inside it can win source selection. Preserve near-equal source epochs.
function historyBatches(dayRows,at,consume,windowMs=86400000){
 const day=Date.parse(new Date(at).toISOString().slice(0,10)+'T00:00:00Z'),start=day+Math.floor((Date.parse(at)-day)/windowMs)*windowMs,end=start+windowMs,bounds=new Map();
 const stamp=row=>{const e=(row.elements||row).EPOCH;return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(e)?e:e+'Z');};
 const identity=row=>String((row.elements||row).NORAD_CAT_ID)+'|'+(row.source||'Archive publique Julien Simon / Space-Track');
 for(const rows of dayRows)for(const row of rows){const key=identity(row),time=stamp(row);if(!Number.isFinite(time))throw Error('Époque orbitale invalide');let b=bounds.get(key);if(!b){b={before:-Infinity,after:Infinity};bounds.set(key,b);}if(time<start)b.before=Math.max(b.before,time);if(time>=end)b.after=Math.min(b.after,time);}
 const emitted=new Set();
 for(const rows of dayRows){let batch=[];for(const row of rows){const time=stamp(row),b=bounds.get(identity(row));if(time>b.before-1000&&time<b.after+1000){const unique=identity(row)+'|'+(row.elements||row).EPOCH.replace(/(?:Z|\+00:00)$/,'');if(emitted.has(unique))continue;emitted.add(unique);batch.push(row);if(batch.length===BATCH){consume(batch);batch=[];}}}if(batch.length)consume(batch);}
}
function combinedHistory(current,dayRows,at){
 const fields=current.orbit_fields||[],idIndex=fields.indexOf('NORAD_CAT_ID')+1,epochIndex=fields.indexOf('EPOCH')+1;
 const candidates=current.packed_orbits?current.packed_orbits.map(row=>({NORAD_CAT_ID:row[idIndex],EPOCH:row[epochIndex],source:current.orbit_sources[row[0]],packed:row})):current.orbits||[];
 for(const target of ['current','history','live'])compute({op:'orbits-start',target});
 historyBatches([candidates,...dayRows],at,batch=>{
  const packed=batch.filter(row=>row.packed).map(row=>row.packed),raw=batch.filter(row=>!row.packed);
  if(packed.length)compute({op:'orbits-add',target:'history',data:{orbit_fields:fields,orbit_sources:current.orbit_sources,packed_orbits:packed}});
  if(raw.length)loadRows(raw,'history',false);
 },3600000);
 liveWindow=null;
}
async function loadHistory(at){const currentPromise=loadCurrent();if(!manifest&&edition?.resources?.history)manifest=await jsonFile(edition.resources[collection+'_history']||edition.resources.history,true);const date=new Date(at);if(!Number.isFinite(+date))throw new Error('Date invalide');const key=date.toISOString().slice(0,13);if(historyKey===key)return;const windowDays=[];date.setUTCHours(12,0,0,0);
 for(let offset=-3;offset<=3;offset++){const day=new Date(+date+offset*86400000).toISOString().slice(0,10);if(!manifest?.days?.[day])continue;windowDays.push(day);}
 const rows=await Promise.all(windowDays.map(async day=>{if(!days.has(day)){let values=[];if(manifest.remote_base&&manifest.remote_days.includes(day))values=await jsonFile(manifest.remote_base+day+'.json.gz',true);else if(!manifest.remote_base&&manifest.remote_days?.includes(day))values=await jsonFile(`data/history/${day}.json.gz`,true);if(manifest.local_days?.includes(day))values=values.concat(await jsonFile(manifest.local_files?.[day]||`data/history/${day}.json.gz`,true));days.set(day,values);}return days.get(day);}));
 combinedHistory(await currentPromise,rows.map(dayRows=>dayRows.filter(row=>collection==='all'||catalogIds.has((row.elements||row).NORAD_CAT_ID)||AtlasCollections.belongs(row.elements||row,collection))),at);historyKey=key;
 for(const day of days.keys())if(!windowDays.includes(day))days.delete(day);
}
async function loadCurrent(){if(!currentData){currentData=edition.collections?await jsonFile(edition.collections[collection].observations,true):{};}return currentData;}
async function dispatch(message){if(message.op==='init'){
  historyKey=null;manifest=null;currentData=null;days.clear();
  if(typeof DecompressionStream!=='function')throw new Error('Ce navigateur doit être mis à jour pour décompresser les archives orbitales.');
  edition=message.edition||await jsonFile('edition.json');collection=message.collection||'all';
  // Fetch the page's elements and WASM in parallel; no mission or EVA data here.
  const modulePromise=(async()=>WebAssembly.instantiate(await(await fetch(new URL('atlas_web_core.wasm',self.location.href))).arrayBuffer(),{}))();
  let bundle=await jsonFile(edition.collections?edition.collections[collection].engine:edition.bundle,true);
  const module=await modulePromise;engine=module.instance.exports;initialize(bundle);
  liveWindow=bundle.live_window;if(!edition.collections)currentData=bundle;
  if(edition.collections){bundle=null;return {ready:true};}
  manifest=bundle.catalog_response.history;
  return {catalog_response:bundle.catalog_response,config:bundle.config,sources:bundle.sources,iss_missions:bundle.iss_missions,iss_evas:bundle.iss_evas};
 }
 if(message.op==='positions'){
  const live=liveWindow&&Date.parse(message.at)>=Date.parse(liveWindow.from)&&Date.parse(message.at)<Date.parse(liveWindow.until);
  if(!live)await loadHistory(message.at);let result=compute({op:'positions',at:message.at,now:message.now,id:message.idValue,use_history:!live});
  if(live&&!result.points.length){await loadHistory(message.at);result=compute({op:'positions',at:message.at,now:message.now,id:message.idValue,use_history:true});}
  if(!result.points.length&&manifest?.days){const candidates=[result.suggested_at,...Object.keys(manifest.days).map(day=>day+'T12:00:00Z')].filter(v=>v&&Date.parse(v)<=Date.parse(message.now));result.suggested_at=candidates.sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(message.at))-Math.abs(Date.parse(b)-Date.parse(message.at)))[0]||null;}
  return result;
 }
 throw new Error('Opération inconnue');
}
let queue=Promise.resolve();self.onmessage=event=>{const message=event.data;queue=queue.then(async()=>{try{self.postMessage({id:message.id,data:await dispatch(message)});}catch(error){self.postMessage({id:message.id,error:error.message||String(error)});}});};
