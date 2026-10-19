/* EVA statistics use source event durations, never duration × crew size. */
(function(root){
 function seconds(value){
  if(typeof value!=='string')return null;
  const m=/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if(!m||!m.slice(1).some(v=>v!==undefined))return null;
  return Number(m[1]||0)*86400+Number(m[2]||0)*3600+Number(m[3]||0)*60+Number(m[4]||0);
 }
 function duration(e){const s=seconds(e.duration);if(s!==null)return s;const a=Date.parse(e.start),b=Date.parse(e.end);return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?(b-a)/1000:null;}
 function format(value){if(value===null||!Number.isFinite(value))return 'Non renseignée';const min=Math.floor(value/60);return `${Math.floor(min/60)} h ${String(min%60).padStart(2,'0')} min`;}
 function stats(doc,id,now=Date.now()){
  const unique=new Map();for(const e of doc.spacewalks||[])if((e.crew||[]).some(a=>a.id===id))unique.set(e.id,e);
  const rows=[...unique.values()].filter(e=>Number.isFinite(Date.parse(e.start))&&Date.parse(e.start)<=now).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
  const completed=rows.filter(e=>Number.isFinite(Date.parse(e.end))&&Date.parse(e.end)<=now);
  const known=completed.filter(e=>duration(e)!==null),ongoing=rows.filter(e=>!e.end);
  return {rows,completed:completed.length,ongoing:ongoing.length,known:known.length,total:known.length?known.reduce((s,e)=>s+duration(e),0):null,complete:doc.complete===true};
 }
 let request;
 function load(){const station=typeof AtlasPages!=='undefined'&&AtlasPages.mode(location.pathname)==='tiangong'?'tiangong':'iss';const endpoint='/api/'+station+'-evas';if(!request)request=(typeof window!=='undefined'&&window.AtlasStatic?window.AtlasStatic.handle(endpoint):fetch(endpoint).then(r=>{if(!r.ok)throw Error('Historique indisponible');return r.json();})).then(v=>{if(!Array.isArray(v.spacewalks))throw Error('Réponse invalide');return v;});return request;}
 const api={seconds,duration,format,stats,load};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasEVA=api;
})(typeof window!=='undefined'?window:globalThis);
