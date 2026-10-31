/* Fetch once before playback. Fine encounter states replace the coarser annual
   samples, rather than being discarded when drawing the whole mission. */
(function(root){
 const cache=new Map();async function read(url){const key=String(url);if(!cache.has(key))cache.set(key,fetch(url,{cache:key.includes('index.json')||key.includes('catalog.json')||key.includes('windows.json')?'no-cache':'default'}).then(r=>{if(!r.ok)throw Error('Une archive du trajet n’est pas disponible.');return r.json();}).catch(e=>{cache.delete(key);throw e;}));return cache.get(key);}
 async function pool(items,work,width=4){let cursor=0;const result=new Array(items.length);await Promise.all(Array.from({length:Math.min(width,items.length)},async()=>{while(cursor<items.length){const i=cursor++;result[i]=await work(items[i],i);}}));return result;}
 async function mission(base,key,progress=()=>{}){
  const [index,catalog,windows]=await Promise.all([read(new URL('ephemerides/'+key+'-index.json',base)),read(new URL('mission-events/catalog.json',base)),read(new URL('mission-events/windows.json',base))]);if(!index.years)throw Error('Aucune trajectoire exploitable pour cette mission.');
  const years=Object.values(index.years).sort((a,b)=>a.first_epoch-b.first_epoch),fine=Object.values(windows.events).filter(e=>e.mission===key),all=[...years.map(e=>({...e,annual:true})),...fine];let done=0;
  const records=await pool(all,async entry=>{const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256||index.source_sha256||entry.last_epoch);const record=await read(url);if(record.id!==index.id)throw Error('Identité de la trajectoire incorrecte.');progress(++done/all.length);return record;});
  const vectors=root.AtlasMissionFilm.merge(records.slice(0,years.length),records.slice(years.length)),start=vectors.samples[0][0]*1000,end=Math.min(Date.now(),vectors.samples.at(-1)[0]*1000);return {key,vectors,start,end,events:catalog.missions[key]||[],completeToPresent:end>=Date.now()-60000};
 }
 async function planets(base,start,end,progress=()=>{},only=null){
  const index=await read(new URL('solar/history/index.json',base)),extra=await read(new URL('solar/history/encounters.json',base)),years=[];for(let y=new Date(start).getUTCFullYear();y<=new Date(end).getUTCFullYear();y++)years.push(String(y));
  const ids=only||[10,199,299,399,499,599,699,799,899,999],entries=[];for(const id of ids)for(const y of years){const entry=index.bodies[id]?.[y];if(!entry)throw Error('Les positions historiques des planètes ne couvrent pas toute la mission.');entries.push({...entry,id});}
  for(const e of extra.files)if((!only||only.includes(e.id))&&e.last_epoch*1000>=start&&e.first_epoch*1000<=end)entries.push(e);
  const grouped=new Map();let done=0;await pool(entries,async e=>{const url=new URL(e.file,base);url.searchParams.set('v',e.sha256);const data=await read(url);if(data.id!==e.id||data.origin!==399||data.frame!=='ICRF'||data.time_scale!=='UTC')throw Error('Référentiel des planètes incorrect.');if(!grouped.has(e.id))grouped.set(e.id,[]);grouped.get(e.id).push(data);progress(++done/entries.length);});
  const result=new Map();for(const [id,records] of grouped){records.sort((a,b)=>a.samples[0][0]-b.samples[0][0]);result.set(id,root.AtlasMissionFilm.merge(records));}return result;
 }
 root.AtlasMissionFilmData={mission,planets,read};
})(typeof window==='undefined'?globalThis:window);
