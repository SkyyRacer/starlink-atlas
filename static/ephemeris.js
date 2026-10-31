/* Official vectors interpolated only inside their published time interval. */
(function(root){
 const base=typeof document!=='undefined'?new URL('./',document.currentScript.src):null;
 let cached,indexRequest,recent=null,background=null;const archives=new Map(),missionRecent=new Map();
 function vector(data,at){
  const rows=data.samples,t=at/1000;if(!Number.isFinite(t)||!rows?.length||t<rows[0][0]||t>rows.at(-1)[0])return null;
  if(rows.length===1)return rows[0].slice(1,4);
  let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][0]<=t)lo=m;else hi=m;}
  const a=rows[lo],b=rows[hi],dt=b[0]-a[0];if(dt>(data.max_interval_seconds||3600)+1&&t!==a[0]&&t!==b[0])return null;const u=(t-a[0])/dt,u2=u*u,u3=u2*u;
  return [1,2,3].map(i=>(2*u3-3*u2+1)*a[i]+(u3-2*u2+u)*dt*a[i+3]+(-2*u3+3*u2)*b[i]+(u3-u2)*dt*b[i+3]);
 }
 function point(data,at,referenceAt=at){
  const xyz=vector(data,at);if(!xyz)return null;
  // IAU 1976 precession J2000 -> equator/equinox of date, then sidereal rotation.
  const jd=referenceAt/86400000+2440587.5,T=(jd-2451545)/36525,k=Math.PI/648000;
  const zeta=(2306.2181*T+.30188*T*T+.017998*T*T*T)*k,z=(2306.2181*T+1.09468*T*T+.018203*T*T*T)*k,theta=(2004.3109*T-.42665*T*T-.041833*T*T*T)*k;
  const [x,y,q]=xyz,A=Math.sin(zeta)*x+Math.cos(zeta)*y,B=Math.cos(theta)*(Math.cos(zeta)*x-Math.sin(zeta)*y)-Math.sin(theta)*q,C=Math.sin(theta)*(Math.cos(zeta)*x-Math.sin(zeta)*y)+Math.cos(theta)*q;
  const px=B*Math.cos(z)-A*Math.sin(z),py=B*Math.sin(z)+A*Math.cos(z),r=Math.hypot(px,py);
  const gmst=(280.46061837+360.98564736629*(jd-2451545)+.000387933*T*T-T*T*T/38710000)*Math.PI/180;
  let lat=Math.atan2(C,r),alt=0;
  for(let i=0;i<6;i++){const n=6378.137/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);alt=r/Math.cos(lat)-n;lat=Math.atan2(C,r*(1-.00669437999014*n/(n+alt)));}
  const before=vector(data,Math.max(data.samples[0][0]*1000,at-1000)),after=vector(data,Math.min(data.samples.at(-1)[0]*1000,at+1000));
  const elapsed=Math.min(data.samples.at(-1)[0]*1000,at+1000)-Math.max(data.samples[0][0]*1000,at-1000);
  const speed=before&&after&&elapsed>0?Math.hypot(...after.map((v,i)=>v-before[i]))/(elapsed/1000):Math.hypot(...data.samples.find(row=>row[0]===at/1000).slice(4,7));
  let geodetic=null;
  if(root.Cesium&&root.AtlasCelestialFrame){const C=root.Cesium;geodetic=C.Cartographic.fromCartesian(root.AtlasCelestialFrame.position(C,C.JulianDate.fromDate(new Date(referenceAt)),xyz));}
  return {id:data.id,lat:(geodetic?.latitude??lat)*180/Math.PI,lon:geodetic?geodetic.longitude*180/Math.PI:((Math.atan2(py,px)-gmst)*180/Math.PI%360+540)%360-180,altitude_km:geodetic?geodetic.height/1000:alt,speed_km_s:speed,epoch:data.epoch||data.fetched,age_hours:(at-Date.parse(data.epoch||data.fetched))/3600000,source:data.source,icrf_km:xyz};
 }
 function augment(result,data,at,id){
  const p=point(data,at);if(!p)return result;
  const existed=result.points.some(row=>row.id===data.id);result.points=result.points.filter(row=>row.id!==data.id);result.points.push(p);if(!existed)result.missing=Math.max(0,(result.missing||0)-1);result.suggested_at=null;
  if(id===data.id){
   for(const [key,sign] of [['track',-1],['future_track',1]]){
    const rows=[],sample=t=>point(data,t,data.trajectory_span_seconds?at:t);
    const xyz=p=>{const lat=p.lat*Math.PI/180,lon=p.lon*Math.PI/180,n=6378.137/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);return [(n+p.altitude_km)*Math.cos(lat)*Math.cos(lon),(n+p.altitude_km)*Math.cos(lat)*Math.sin(lon),(n*(1-.00669437999014)+p.altitude_km)*Math.sin(lat)];};
    function append(a,left,b,right,depth){
     const mid=(a+b)/2,m=sample(mid);if(!m)return false;
     if(depth<8){const x=xyz(left),y=xyz(right),v=xyz(m),error=Math.hypot(...v.map((n,i)=>n-(x[i]+y[i])/2));if(error>Math.max(.005,data.trajectory_span_seconds?Math.abs(p.altitude_km)*.000002:0)){return append(a,left,mid,m,depth+1)&&append(mid,m,b,right,depth+1);}}
     rows.push([right.lat,right.lon,right.altitude_km]);return true;
    }
    let previous=null,previousTime=at;
    for(let i=0;i<=160;i++){const t=at+sign*(data.period_seconds||data.trajectory_span_seconds)*1000*i/160,v=sample(t);if(!v)break;if(previous){if(!append(previousTime,previous,t,v,0))break;}else rows.push([v.lat,v.lon,v.altitude_km]);previous=v;previousTime=t;}
    if(sign<0)rows.reverse();result[key]=rows.map(p=>p.slice(0,2));result[key==='track'?'track_3d':'future_track_3d']=rows;
   }
  }return result;
 }
 async function load(at){
  if(!cached)cached=fetch(new URL('ephemerides/tess.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Éphémérides indisponibles');return r.json();}).catch(()=>null);
  let data=await cached;
  if(!data||!vector(data,at)){
   if(!indexRequest)indexRequest=fetch(new URL('ephemerides/tess-index.json',base),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
   const index=await indexRequest,entry=index&&Object.values(index.years||{}).find(row=>at>=row.first_epoch*1000&&at<=row.last_epoch*1000);
   if(entry){if(!archives.has(entry.file))archives.set(entry.file,fetch(new URL(entry.file,base)).then(r=>r.ok?r.json():null).catch(()=>null));data=await archives.get(entry.file);}
  }
  return data;
 }
 const missionIds={"spitzer":27871,"kepler":34380,"dscovr":40390,"aditya-l1":57754,"jwst":50463,"gaia":39479,"herschel":34937,"planck":34938,"euclid":57209,"soho":23726,"ace":24912,"voyager-1":10321,"voyager-2":10271,"cassini":25008,"juno":37773,"new-horizons":28928,"bepicolombo":43653,"juice":56176,"spektr-rg":44432},missionIndexes=new Map(),missionIndexTimes=new Map(),missionFailures=new Map();
 let eyesIndex=null;const eyesFiles=new Map();
 async function eyesBackup(key,at){try{eyesIndex??=fetch(new URL('ephemerides/nasa-eyes/index.json',base),{cache:'no-cache'}).then(r=>r.ok?r.json():null);const index=await eyesIndex;if(!index){eyesIndex=null;return null;}const entry=index?.missions?.find(row=>row.mission===key&&row.status==='enabled'&&at/1000>=row.first_epoch&&at/1000<=row.last_epoch);if(!entry)return null;
  if(!eyesFiles.has(entry.file))eyesFiles.set(entry.file,fetch(new URL(entry.file+'?v='+entry.last_epoch,base)).then(r=>r.ok?r.json():null));const data=await eyesFiles.get(entry.file);return data?.id===missionIds[key]&&data.frame==='ICRF'&&data.time_scale==='UTC'&&vector(data,at)?data:null;
 }catch{eyesIndex=null;return null;}}
 async function loadMission(key,at){
  const readIndex=()=>{
   missionIndexTimes.set(key,Date.now());
   const request=fetch(new URL('ephemerides/'+key+'-index.json',base),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
   missionIndexes.set(key,request);return request;
  };
  let index=missionIndexes.has(key)?await missionIndexes.get(key):await readIndex();
  const find=()=>index&&Object.values(index.years||{}).find(row=>at>=row.first_epoch*1000&&at<=row.last_epoch*1000);
  let entry=find();
  // A failed/expired index is retried, so a background repair becomes visible
  // without reopening the application. Avoid retrying on every timeline tick.
  if(!entry&&Date.now()-(missionIndexTimes.get(key)||0)>=30000){index=await readIndex();entry=find();}
  if(!entry)return eyesBackup(key,at);
  const path=entry.file+'?v='+encodeURIComponent(index.source_sha256||entry.last_epoch),failed=missionFailures.get(path);
  if(failed&&Date.now()<failed)return eyesBackup(key,at);
  if(!archives.has(path))archives.set(path,fetch(new URL(path,base),{cache:failed?'reload':'default'}).then(r=>r.ok?r.json():null).catch(()=>null));
  const data=await archives.get(path);
  if(!data||data.id!==missionIds[key]||data.frame!=='ICRF'||data.time_scale!=='UTC'||!Array.isArray(data.samples)){
   archives.delete(path);missionFailures.set(path,Date.now()+30000);return eyesBackup(key,at);
  }
  missionFailures.delete(path);return data;
 }

 async function apply(url,result){
  const parsed=new URL(url,base),collection=parsed.searchParams.get('collection');if(!parsed.pathname.endsWith('/api/positions')||!['all','tess',...Object.keys(missionIds),'spektr-rg','ikaros'].includes(collection))return result;
  const at=Date.parse(parsed.searchParams.get('at')),id=Number(parsed.searchParams.get('id'));
  if(collection==='spektr-rg'||collection==='ikaros')return result;
  if(missionIds[collection]){
   const data=await loadMission(collection,at);if(data)return augment(result,data,at,id);
   const index=await missionIndexes.get(collection),epochs=Object.values(index?.years||{}).flatMap(row=>[row.first_epoch,row.last_epoch]).filter(Number.isFinite);
   if(epochs.length){const nearest=epochs.sort((a,b)=>Math.abs(a-at/1000)-Math.abs(b-at/1000))[0];result.suggested_at=new Date(nearest*1000).toISOString();}
   return result;
  }
  if(collection==='all'){
   if(recent&&vector(recent,at))result=augment(result,recent,at,id);
   for(const data of missionRecent.values())if(vector(data,at))result=augment(result,data,at,id);
   if(!background)background=Promise.all([load(at),...Object.keys(missionIds).map(key=>loadMission(key,at))].map(request=>request.then(data=>{
    if(!data||!vector(data,at))return;let changed=false;
    if(data.id===43435){if(recent!==data){recent=data;changed=true;}}else if(missionRecent.get(data.id)!==data){missionRecent.set(data.id,data);changed=true;}
    // A slow backup must not delay a different mission whose primary is ready.
    if(changed)root.dispatchEvent?.(new CustomEvent('atlas-ephemeris-ready'));
   }))).finally(()=>{background=null;});
   return result;
  }
  if(recent&&vector(recent,at))return augment(result,recent,at,id);
  const data=await load(at);if(!data)return result;recent=data;return augment(result,data,at,id);
 }
 const api={vector,point,augment,apply,loadMission,eyesBackup,missionIds,async index(key){if(!missionIndexes.has(key))await loadMission(key,Date.now());return missionIndexes.has(key)?await missionIndexes.get(key):null;}};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasEphemeris=api;
})(typeof window==='undefined'?globalThis:window);
