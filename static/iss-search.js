/* Text-only search over the edition already loaded for this visit. */
(function(root){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function build(data){
  const people=new Map(),visits=new Map();
  for(const f of data.flights){
   for(const a of [...(f.crew||[]),...(f.landing_crew||[])]){
    if(a.id==null||!a.name)continue;
    if(!people.has(a.id))people.set(a.id,a);
    if(!visits.has(a.id))visits.set(a.id,new Map());visits.get(a.id).set(f.id,f);
   }
  }
  for(const a of data.crew||[])if(a.id!=null)people.set(a.id,a);
  const flights=data.flights.map(f=>({kind:'flight',id:f.id,name:f.name,detail:f.spacecraft||'Mission / vol',value:f}));
  const astronauts=[...people.values()].map(a=>({kind:'person',id:a.id,name:a.name,detail:a.agency_abbrev||a.agency||'Astronaute',value:a,flights:[...(visits.get(a.id)?.values()||[])]}));
  return [...flights,...astronauts].map(item=>({...item,key:normalize(item.name),search:normalize(item.name+' '+item.detail)}));
 }
 function find(index,query,limit=30){
  const q=normalize(query);if(!q)return {items:[],total:0};const tokens=q.split(' '),compact=q.replace(/ /g,'');
  const matches=index.filter(i=>tokens.every(t=>i.search.includes(t))||i.key.replace(/ /g,'').includes(compact));
  matches.sort((a,b)=>Number(b.key===q)-Number(a.key===q)||Number(b.key.startsWith(q))-Number(a.key.startsWith(q))||a.name.localeCompare(b.name,'fr',{numeric:true}));
  return {items:matches.slice(0,limit),total:matches.length};
 }
 const api={build,find,normalize};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasISSSearch=api;
})(typeof window!=='undefined'?window:globalThis);
