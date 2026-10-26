/* Refuse to replace a usable public edition with a severely incomplete live catalogue. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
function coverage(catalog,points,now){
 const active=s=>(!s.launch||Date.parse(s.launch)<=now)&&(!s.decay||Date.parse(s.decay)>now);
 const expected=catalog.satellites.filter(s=>(s.name||'').startsWith('STARLINK')&&active(s));
 const available=new Set(points.map(p=>p.id)),count=expected.filter(s=>available.has(s.id)).length;
 const minimum=expected.length>=1000?Math.ceil(expected.length*.8):0;
 if(count<minimum)throw Error(`Publication suspendue : seulement ${count} / ${expected.length} Starlink ont une position actuelle (minimum ${minimum}). Vérifier les sources et le secret KEEPTRACK_API_KEY ; conserver la publication précédente.`);
 const groups={};
 for(const family of ['gps','galileo','glonass','beidou','oneweb','iridium']){
  const members=catalog.satellites.filter(s=>active(s)&&(s.family===family||s.collections?.includes(family)));
  if(members.length<10)continue;
  const visible=members.filter(s=>available.has(s.id)).length,required=Math.ceil(members.length*.7);
  if(visible<required)throw Error(`Publication suspendue : ${family} ne dispose que de ${visible} / ${members.length} positions actuelles (minimum ${required}). Publication précédente conservée.`);
  groups[family]={available:visible,expected:members.length,minimum:required};
 }
 for(const id of [25544,48274]){
  const station=catalog.satellites.find(s=>s.id===id&&active(s));
  if(station&&!available.has(id))throw Error(`Publication suspendue : position actuelle de ${station.name} absente. Publication précédente conservée.`);
 }
 return {starlink:count,expected:expected.length,minimum,total:points.length,groups};
}
module.exports={coverage};
if(require.main===module)(async()=>{
 const root=path.resolve(process.argv[2]||'public'),edition=JSON.parse(fs.readFileSync(path.join(root,'edition.json')));
 const read=file=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,file))));
 const data=read(edition.collections.all.engine),catalog=read(edition.collections.all.catalog),{instance}=await WebAssembly.instantiate(fs.readFileSync(path.join(root,'atlas_web_core.wasm')),{}),e=instance.exports;
 function call(input){const bytes=Buffer.from(JSON.stringify(input)),p=e.atlas_alloc(bytes.length);new Uint8Array(e.memory.buffer,p,bytes.length).set(bytes);const result=e.atlas_call(p,bytes.length);e.atlas_free(p,bytes.length);const n=new DataView(e.memory.buffer).getUint32(result,true);let reply;try{reply=JSON.parse(Buffer.from(new Uint8Array(e.memory.buffer,result+4,n)));}finally{e.atlas_free(result,n+4);}if(reply.error)throw Error(reply.error);return reply.data;}
 const empty={...data,raw_catalog:[],gcat:{},packed_orbits:[],packed_live:[]};call({op:'init',data:empty});
 for(let i=0;i<data.raw_catalog.length;i+=256)call({op:'catalog-add',rows:data.raw_catalog.slice(i,i+256)});
 const gcat=Object.entries(data.gcat||{});for(let i=0;i<gcat.length;i+=256)call({op:'catalog-add',rows:[],gcat:Object.fromEntries(gcat.slice(i,i+256))});
 for(const [field,target] of [['packed_live','live'],['packed_orbits','current']])for(let i=0;i<(data[field]||[]).length;i+=256)call({op:'orbits-add',target,data:{orbit_fields:data.orbit_fields,orbit_sources:data.orbit_sources,packed_orbits:data[field].slice(i,i+256)}});
 const now=new Date().toISOString(),result=call({op:'positions',at:now,now});assert.ok(result.points.length,'No current positions: never publish an empty edition');console.log('Publication coverage:',coverage(catalog,result.points,Date.parse(now)));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
