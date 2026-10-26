/* Reconstruct station visits only from documented arrivals and departures. */
(function(root){
 const epoch=value=>typeof value==='string'?Date.parse(value):NaN;
 function crewAt(doc,at,live=false){
  if(Array.isArray(doc.visits)){
   const members=new Map();
   for(const v of doc.visits){const start=epoch(v.arrival),end=epoch(v.departure);if(!Number.isFinite(start)||start>at)continue;if(!Number.isFinite(end)||at>=end)continue;const previous=members.get(v.person.id);if(!previous||epoch(previous.arrival)<start)members.set(v.person.id,{...v.person,arrival:v.arrival,mission:v.mission,role:v.role,approximate:v.approximate});}
   return {crew:[...members.values()],current:live,incomplete:!doc.history_complete};
  }
  if(live)return {crew:doc.crew||[],current:true,incomplete:false};
  const confirmed=(doc.flights||[]).filter(f=>f.status_id===3),flights=confirmed.filter(f=>epoch(f.launch)<=at),members=new Map();let incomplete=false;
  const current=new Map((doc.crew||[]).map(a=>[a.id,a]));
  for(const flight of flights){
   const arrival=epoch(flight.arrival);if(!Number.isFinite(arrival)||arrival>at)continue;
   for(const person of flight.crew||[]){
    // Crew can return aboard a different vehicle (e.g. Soyuz or Shenzhou swaps).
    const returns=confirmed.filter(f=>(Array.isArray(f.landing_crew)?f.landing_crew:f.crew||[]).some(a=>a.id===person.id));
    const ends=returns.map(f=>Number.isFinite(epoch(f.departure))?epoch(f.departure):f.landed===true?epoch(f.end):NaN).filter(t=>Number.isFinite(t)&&t>=arrival);
    let departure=ends.length?Math.min(...ends):NaN;
    if(!Number.isFinite(departure)){const active=current.get(person.id),knownArrival=epoch(active?.arrival);if(!active||!Number.isFinite(knownArrival)||Math.abs(knownArrival-arrival)>60000){incomplete=true;continue;}}
    if(Number.isFinite(departure)&&at>=departure)continue;
    const previous=members.get(person.id);if(!previous||epoch(previous.arrival)<arrival)members.set(person.id,{...person,arrival:flight.arrival,mission:flight.name});
   }
  }
  return {crew:[...members.values()],current:false,incomplete:incomplete||!doc.history_complete};
 }
 const api={crewAt};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasStationHistory=api;
})(typeof window!=='undefined'?window:globalThis);
