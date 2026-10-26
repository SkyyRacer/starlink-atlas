/* Whole-career rides and station stays are separate clocks. */
(function(root){
 const base=typeof document==='undefined'?'./crew-archive.json':new URL('./crew-archive.json',document.currentScript.src).href;
 let request;
 function load(){if(!request)request=fetch(base,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Archives des équipages indisponibles');return r.json();}).then(d=>{if(!d.people||!d.stations)throw Error('Archives invalides');return d;}).catch(e=>{request=null;throw e;});return request;}
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
 function identify(doc,person){
  if(doc.people[person.id])return doc.people[person.id];
  // Match a full first name and surname, never just a surname or initials.
  const name=normalize(person.name),tokens=String(person.name||'').replace(/\([^)]*\)/g,'').trim().split(/\s+/);
  const found=Object.values(doc.people).filter(a=>{
   if([a.name,...(a.aliases||[])].some(v=>normalize(v)===name))return true;
   const first=normalize(a.given_name||a.name.split(/\s+/)[0]),last=normalize(a.family_name);
   return normalize(tokens[0])===first&&normalize(tokens.slice(1).join('')).endsWith(last)||normalize(tokens.at(-1))===first&&normalize(tokens.slice(0,-1).join(''))===last;
  });
  return found.length===1?found[0]:null;
 }
 function format(seconds){if(!Number.isFinite(seconds)||seconds<0)return null;const minutes=Math.floor(seconds/60);return `${Math.floor(minutes/1440)} j ${Math.floor(minutes%1440/60)} h ${String(minutes%60).padStart(2,'0')} min`;}
 function total(doc,person,at,context=null){
  const a=identify(doc,person);if(!a&&!context)return null;
  const seen=new Set(),intervals=[];let missing=a?0:1,ongoing=false;
  for(const f of a?.flights||[]){
   const start=Date.parse(f.launch);if(!Number.isFinite(start)||start>at||seen.has(f.id))continue;seen.add(f.id);
   let end=Date.parse(f.end);
   if(!Number.isFinite(end)){if(f.ongoing){end=Math.min(at,Date.parse(doc.observed_at));ongoing=true;}else{missing++;continue;}}
   if(Number.isFinite(end)&&end>=start)intervals.push([start,Math.min(at,end)]);else missing++;
  }
  if(context){
   const flights=(context.flights||[]).filter(f=>f.status_id===3),matches=list=>(list||[]).some(p=>p.id===person.id);
   for(const f of flights){
    const start=Date.parse(f.launch);if(!matches(f.crew)||!Number.isFinite(start)||start>at)continue;
    const ends=flights.filter(g=>g.landed===true&&matches(g.landing_crew)).map(g=>Date.parse(g.end)).filter(t=>Number.isFinite(t)&&t>=start);
    let end=ends.length?Math.min(...ends):NaN;
    const current=(context.crew||[]).find(p=>p.id===person.id);
    if(!Number.isFinite(end)&&current&&Date.parse(current.arrival)>=start)end=Math.min(at,Date.parse(context.fetched_at));
    if(Number.isFinite(end)&&end>=start)intervals.push([start,Math.min(at,end)]);
   }
  }
  // Union overlapping intervals: duplicate rides, vehicle swaps and station
  // transfers can never add time twice.
  intervals.sort((a,b)=>a[0]-b[0]);let seconds=0,left=null,right=null;
  for(const [start,end] of intervals){if(left===null){left=start;right=end;}else if(start<=right)right=Math.max(right,end);else{seconds+=(right-left)/1000;left=start;right=end;}}
  if(left!==null)seconds+=(right-left)/1000;
  if(!a&&!intervals.length)return null;
  return {seconds,formatted:format(seconds),missing,flights:seen.size,ongoing,through:doc.observed_at,person:a,partial:missing>0||(a?.expected_flights>seen.size&&at>=Date.parse(doc.observed_at))||(at>Date.parse(doc.observed_at)&&ongoing&&!context)};
 }
 function station(doc,key){const value=doc.stations[key];if(!value)return null;return {...value,archive:true,observed_at:doc.observed_at,source:'GCAT · J. McDowell (CC BY 4.0)'};}
 const api={load,identify,total,format,station};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasCrewArchive=api;
})(typeof window==='undefined'?globalThis:window);
