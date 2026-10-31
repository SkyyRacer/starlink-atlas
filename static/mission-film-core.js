/* A short, nonlinear viewing timeline over measured state vectors. Orbital time
   is never used as a constant-rate movie clock. No missing interval is invented. */
(function(root){
 const math=typeof module==='object'&&module.exports?require('./solar-math.js'):root.AtlasSolarMath;
 const DAY=86400000,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,u)=>a+(b-a)*u;
 function merge(records,windows=[]){
  if(!records.length)throw Error('Archives orbitales absentes.');const base=records[0],rows=new Map();let interval=0;
  for(const record of [...records,...windows]){if(record.id!==base.id||record.frame!=='ICRF'||record.time_scale!=='UTC'||record.origin!=null&&record.origin!==399)throw Error('Référentiel des archives incorrect.');interval=Math.max(interval,record.max_interval_seconds||21600);}
  const ranges=windows.map(w=>[w.samples[0][0],w.samples.at(-1)[0]]);
  for(const record of records)for(const r of record.samples)if(!ranges.some(([a,b])=>r[0]>=a&&r[0]<=b))rows.set(r[0],r);
  for(const record of windows)for(const r of record.samples)rows.set(r[0],r);
  const samples=[...rows.values()].sort((a,b)=>a[0]-b[0]);for(let i=0;i<samples.length;i++){const r=samples[i];if(r.length!==7||!r.every(Number.isFinite)||i&&r[0]-samples[i-1][0]>interval+1)throw Error('Une période du trajet ne dispose pas d’archives continues.');}
  return {...base,origin:399,max_interval_seconds:interval,samples};
 }
 function targetId(key){return {soleil:10,mercure:199,venus:299,terre:399,lune:301,mars:499,jupiter:599,saturne:699,uranus:799,neptune:899,pluton:999,arrokoth:2486958}[key]||null;}
 function refineEvents(events,vectors,planet){return events.map(e=>{let at=e.at;if(['flyby','orbit'].includes(e.kind)&&e.precision==='day'){const id=targetId(e.target);if(!id||id===10)return {...e,published_at:e.at};let distance=Infinity;for(const row of vectors.samples){const t=row[0]*1000;if(Math.abs(t-e.at)>DAY)continue;const p=planet(id,t);if(!p)continue;const d=Math.hypot(...row.slice(1,4).map((x,i)=>x-p[i]));if(d<distance){distance=d;at=t;}}}return {...e,at,published_at:e.at};});}
 // Detect sustained measured revolutions, rather than attaching the camera
 // to a spacecraft for years of halo/planetary orbits played in seconds.
 function repeatedOrbit(vectors,segment,planet){
  if(segment.end-segment.start<60*DAY)return null;const all=vectors.samples.filter(r=>r[0]*1000>=segment.start&&r[0]*1000<=segment.end);if(all.length<12)return null;const step=Math.max(1,Math.ceil(all.length/768)),rows=all.filter((r,i)=>i%step===0);if(rows.at(-1)!==all.at(-1))rows.push(all.at(-1));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
  for(const id of [399,599,699,10]){let bounded=0,extent=0;const points=[];for(const row of rows){const t=row[0]*1000,p=planet(id,t),sun=planet(10,t);if(!p||!sun)continue;const xyz=row.slice(1,4),r=xyz.map((v,i)=>v-p[i]);if(id===10||math.nearBody(xyz,p,sun,id))bounded++;extent=Math.max(extent,Math.hypot(...r));points.push(r);}if(points.length<12||bounded<points.length*.95)continue;let normal=cross(points[0],points[1]);if(Math.hypot(...normal)<1e-8)continue;normal=unit(normal);if(normal[2]<0)normal=normal.map(v=>-v);const x=unit(points[0]),y=cross(normal,x);let swept=0,last=Math.atan2(dot(points[0],y),dot(points[0],x));for(const p of points.slice(1)){const angle=Math.atan2(dot(p,y),dot(p,x));swept+=Math.abs(Math.atan2(Math.sin(angle-last),Math.cos(angle-last)));last=angle;}if(swept>Math.PI*3)return {id,extent,direction:normal,swept};}
  return null;
 }
 function plan(start,end,events,options={}){
  if(!(end>start))throw Error('La durée des archives est insuffisante.');const relevant=events.filter(e=>e.at<=end&&e.at>=start-DAY&&!e.unavailable),windows=[];
  for(const event of relevant){const at=clamp(event.at,start,end),span=event.kind==='orbit'?(event.before_hours||72)*3600000:event.kind==='flyby'?4*3600000:event.kind==='launch'?12*3600000:event.precision==='day'?12*3600000:Math.max(1800000,(event.before_hours||1)*3600000);const left=clamp(at-(event.kind==='launch'?0:span),start,end),right=clamp(at+span,start,end);if(right<=left)continue;
   const window={start:left,end:right,event,weight:event.kind==='launch'?3:event.kind==='orbit'?3:event.kind==='flyby'?2.6:1.3};const prior=windows.at(-1);if(prior&&window.start<=prior.end){prior.end=Math.max(prior.end,window.end);if(window.weight>prior.weight){prior.event=event;prior.weight=window.weight;}}else windows.push(window);
  }
  if(!windows.length||windows[0].start>start)windows.unshift({start,end:Math.min(end,start+DAY,windows[0]?.start??end),event:{id:'archive-start',title:'Début du trajet archivé',target:'terre',kind:'launch'},weight:3});
  const segments=[];let cursor=start;for(const window of windows){if(window.start>cursor)segments.push({start:cursor,end:window.start,kind:'cruise',weight:1.1+Math.min(1,Math.log10(1+(window.start-cursor)/DAY)/3)});segments.push({...window,kind:window.event.kind==='launch'?'launch':window.event.kind==='flyby'||window.event.kind==='orbit'?'encounter':'milestone'});cursor=window.end;}
  if(cursor<end)segments.push({start:cursor,end,kind:'cruise',weight:2});segments.push({start:end,end,kind:'arrival',weight:2});
  // Give each encounter enough screen time; decades of cruise no longer
  // squeeze a planetary flyby into a fraction of a 30-second global budget.
  for(const segment of segments)segment.seconds=segment.kind==='encounter'?(segment.event?.kind==='orbit'?14:11):segment.kind==='launch'?7:segment.kind==='milestone'?4:segment.kind==='arrival'?4:Math.min(30,12+3*Math.log10(1+(segment.end-segment.start)/DAY));
  if(options.departure)segments.unshift({start,end:start,kind:'departure',seconds:5,event:{id:'surface-departure',title:'Départ de la Terre',target:'terre',schematic:true}});
  const scale=Math.max(1,15/segments.reduce((sum,s)=>sum+s.seconds,0));let elapsed=0;for(const segment of segments){segment.from=elapsed;elapsed+=segment.seconds*scale;segment.to=elapsed;}const duration=elapsed;
  const markers=relevant.map(event=>({...event,elapsed:elapsedAt({segments,duration},clamp(event.at,start,end))}));return {start,end,duration,segments,markers};
 }
 function warp(u){const v=u*2-1;return .5+.5*(.35*v+.65*v*v*v);}
 function unwarp(value){let a=0,b=1;for(let i=0;i<36;i++){const m=(a+b)/2;if(warp(m)<value)a=m;else b=m;}return (a+b)/2;}
 function segmentTime(segment,u){
  if(segment.kind==='encounter'&&segment.event?.kind==='flyby'){const centre=clamp(segment.event.at,segment.start,segment.end),a=Math.max(segment.start,centre-900000),b=Math.min(segment.end,centre+900000);if(u<.2)return mix(segment.start,a,u/.2);if(u<=.8)return mix(a,b,warp((u-.2)/.6));return mix(b,segment.end,(u-.8)/.2);}
  if(segment.kind==='encounter'&&segment.event?.kind==='orbit'){const centre=clamp(segment.event.at,segment.start,segment.end),a=Math.max(segment.start,centre-7200000),b=Math.min(segment.end,centre+7200000);if(u<.25)return mix(segment.start,a,u/.25);if(u<=.75)return mix(a,b,warp((u-.25)/.5));return mix(b,segment.end,(u-.75)/.25);}
  if(segment.kind==='launch'){const early=Math.min(segment.end,segment.start+7200000);return u<.6?mix(segment.start,early,u/.6):mix(early,segment.end,(u-.6)/.4);}
  return mix(segment.start,segment.end,['encounter','milestone'].includes(segment.kind)?warp(u):u);
 }
 function sample(plan,elapsed){elapsed=clamp(elapsed,0,plan.duration);const index=plan.segments.findIndex(s=>elapsed<s.to),segment=plan.segments[index<0?plan.segments.length-1:index],u=clamp((elapsed-segment.from)/(segment.to-segment.from||1));return {at:segmentTime(segment,u),segment,u,index:index<0?plan.segments.length-1:index,elapsed};}
 function elapsedAt(plan,time){const segment=plan.segments.find(s=>time>=s.start&&time<=s.end&&s.end>s.start)||plan.segments.at(-1);let a=0,b=1;for(let i=0;i<40;i++){const m=(a+b)/2;if(segmentTime(segment,m)<time)a=m;else b=m;}return mix(segment.from,segment.to,(a+b)/2);}

 const api={merge,targetId,refineEvents,repeatedOrbit,plan,sample,elapsedAt,warp,clamp,mix,DAY};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasMissionFilm=api;
})(typeof window==='undefined'?globalThis:window);
