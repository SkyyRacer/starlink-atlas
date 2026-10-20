/* Official vectors interpolated only inside their published time interval. */
(function(root){
 const base=typeof document!=='undefined'?new URL('./',document.currentScript.src):null;
 let cached;
 function vector(data,at){
  const rows=data.samples,t=at/1000;if(!rows?.length||t<rows[0][0]||t>rows.at(-1)[0])return null;
  let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][0]<=t)lo=m;else hi=m;}
  const a=rows[lo],b=rows[hi],dt=b[0]-a[0],u=(t-a[0])/dt,u2=u*u,u3=u2*u;
  return [1,2,3].map(i=>(2*u3-3*u2+1)*a[i]+(u3-2*u2+u)*dt*a[i+3]+(-2*u3+3*u2)*b[i]+(u3-u2)*dt*b[i+3]);
 }
 function point(data,at){
  const xyz=vector(data,at);if(!xyz)return null;
  // IAU 1976 precession J2000 -> equator/equinox of date, then sidereal rotation.
  const jd=at/86400000+2440587.5,T=(jd-2451545)/36525,k=Math.PI/648000;
  const zeta=(2306.2181*T+.30188*T*T+.017998*T*T*T)*k,z=(2306.2181*T+1.09468*T*T+.018203*T*T*T)*k,theta=(2004.3109*T-.42665*T*T-.041833*T*T*T)*k;
  const [x,y,q]=xyz,A=Math.sin(zeta)*x+Math.cos(zeta)*y,B=Math.cos(theta)*(Math.cos(zeta)*x-Math.sin(zeta)*y)-Math.sin(theta)*q,C=Math.sin(theta)*(Math.cos(zeta)*x-Math.sin(zeta)*y)+Math.cos(theta)*q;
  const px=B*Math.cos(z)-A*Math.sin(z),py=B*Math.sin(z)+A*Math.cos(z),r=Math.hypot(px,py);
  const gmst=(280.46061837+360.98564736629*(jd-2451545)+.000387933*T*T-T*T*T/38710000)*Math.PI/180;
  let lat=Math.atan2(C,r),alt=0;
  for(let i=0;i<6;i++){const n=6378.137/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);alt=r/Math.cos(lat)-n;lat=Math.atan2(C,r*(1-.00669437999014*n/(n+alt)));}
  const before=vector(data,Math.max(data.samples[0][0]*1000,at-1000)),after=vector(data,Math.min(data.samples.at(-1)[0]*1000,at+1000));
  const elapsed=Math.min(data.samples.at(-1)[0]*1000,at+1000)-Math.max(data.samples[0][0]*1000,at-1000);
  return {id:data.id,lat:lat*180/Math.PI,lon:((Math.atan2(py,px)-gmst)*180/Math.PI%360+540)%360-180,altitude_km:alt,speed_km_s:Math.hypot(...after.map((v,i)=>v-before[i]))/(elapsed/1000),epoch:data.epoch||data.fetched,age_hours:(at-Date.parse(data.epoch||data.fetched))/3600000,source:data.source};
 }
 function augment(result,data,at,id){
  const p=point(data,at);if(!p)return result;
  const existed=result.points.some(row=>row.id===data.id);result.points=result.points.filter(row=>row.id!==data.id);result.points.push(p);if(!existed)result.missing=Math.max(0,(result.missing||0)-1);result.suggested_at=null;
  if(id===data.id){
   for(const [key,sign] of [['track',-1],['future_track',1]]){
    const rows=[];for(let i=0;i<=160;i++){const t=at+sign*data.period_seconds*1000*i/160,v=point(data,t);if(!v)break;rows.push([v.lat,v.lon,v.altitude_km]);}
    if(sign<0)rows.reverse();result[key]=rows.map(p=>p.slice(0,2));result[key==='track'?'track_3d':'future_track_3d']=rows;
   }
  }return result;
 }
 async function apply(url,result){
  const parsed=new URL(url,base);if(!parsed.pathname.endsWith('/api/positions')||!['all','tess'].includes(parsed.searchParams.get('collection')))return result;
  if(!cached)cached=fetch(new URL('ephemerides/tess.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Éphémérides indisponibles');return r.json();}).catch(()=>null);
  const data=await cached;if(!data)return result;
  return augment(result,data,Date.parse(parsed.searchParams.get('at')),Number(parsed.searchParams.get('id')));
 }
 const api={vector,point,augment,apply};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasEphemeris=api;
})(typeof window==='undefined'?globalThis:window);
