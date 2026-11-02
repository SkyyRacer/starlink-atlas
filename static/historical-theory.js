/* Optional educational reconstruction. No observational orbit angles are invented:
   RAAN, argument of perigee and initial phase are explicitly conventional. */
(function(root){
 'use strict';
 const catalogSource='https://www.lib.cas.cz/space.40/';
 const profiles=[
  {id:2,name:'Spoutnik 1',start:'1957-10-04T19:33:48.500Z',end:'1958-01-03T00:00:00Z',source:catalogSource+'1957/001B.HTM',note:'Fin limitée au 3 janvier 1958 par prudence : les sources divergent avec le 4 janvier indiqué par la NASA.',samples:[['1957-10-04',.8,65.10,96.20,215,939],['1957-10-25',.8,65.10,95.40,213,863],['1957-12-25',.1,65,91,190,458]]},
  {id:3,name:'Spoutnik 2',start:'1957-11-03T02:30:42Z',end:'1958-04-14T00:00:00Z',source:catalogSource+'1957/002A.HTM',samples:[['1957-11-03',.1,65.33,103.75,212,1660],['1958-01-04',0,65.29,100.50,210,1356],['1958-04-09',0,65.21,90.78,166,460]]},
  {id:8,name:'Spoutnik 3',start:'1958-05-15T07:00:35.500Z',end:'1960-04-06T00:00:00Z',source:catalogSource+'1958/004B.HTM',samples:[['1958-05-15',.3,65.18,105.90,214,1860]]},
  {id:4,name:'Explorer 1',start:'1958-02-01T03:48:16Z',end:'1970-03-31T00:00:00Z',source:catalogSource+'1958/001A.HTM',samples:[['1958-02-01',.2,33.24,114.80,356,2548],['1959-07-09',.93,33.18,110.23,357,2117],['1960-02-07',.87,33.22,109.06,349,2018],['1961-01-28',.51,33.21,107.03,354,1825],['1962-01-18',.18,33.19,106.11,349,1744],['1963-02-13',.81,33.20,105.35,351,1671],['1967-03-22',.13,33.20,102.58,340,1421],['1968-01-01',.09,33.18,100.76,335,1254],['1969-01-06',.93,33.18,98.02,326,1002],['1970-01-05',.86,33.15,93.54,301,595],['1970-03-11',.49,33.15,91.57,268,435],['1970-03-31',.04,33.15,88.48,183,215]]},
  {id:5,name:'Vanguard 1',start:'1958-03-17T12:15:41Z',end:null,source:catalogSource+'1958/002B.HTM',samples:[['1958-03-17',.5,34.25,134.18,650,3968],['1960-01-07',.51,34.25,134.13,657,3946],['1967-01-01',.69,34.23,133.97,650,3940],['1978-01-02',.99,34.24,133.81,655,3921],['1990-03-29',.92,34.24,133.30,652,3880],['2000-07-18',.65,34.25,133.03,650,3859],['2009-01-02',.68,34.25,132.84,649,3843]]}
 ];
 const day=86400000,tau=2*Math.PI,rad=Math.PI/180,R=6378.137,J2=.00108262668;
 for(const p of profiles){p.start=Date.parse(p.start);p.end=p.end?Date.parse(p.end):Infinity;p.samples=p.samples.map(([date,f,...values])=>[Date.parse(date+'T00:00:00Z')+f*day,...values]);}
 const byId=new Map(profiles.map(p=>[p.id,p]));let enabled=false,visit=null;
 function parameters(profile,at){const rows=profile.samples;if(at<=rows[0][0])return rows[0].slice(1);if(at>=rows.at(-1)[0])return rows.at(-1).slice(1);const i=rows.findIndex(row=>row[0]>at),a=rows[i-1],b=rows[i],u=(at-a[0])/(b[0]-a[0]);return a.slice(1).map((value,j)=>value+(b[j+1]-value)*u);}
 function rates(values){const [inc,period,perigee,apogee]=values,a=R+(perigee+apogee)/2,e=(apogee-perigee)/(2*a),n=tau/(period*60),factor=J2*n*(R/(a*(1-e*e)))**2,c=Math.cos(inc*rad);return [n,-1.5*factor*c,.75*factor*(5*c*c-1)];}
 function angles(profile,at){const start=profile.start,knots=[start,...profile.samples.map(row=>row[0]).filter(t=>t>start&&t<at),at],sum=[0,0,0];
  for(let i=1;i<knots.length;i++){const a=knots[i-1],b=knots[i],seconds=(b-a)/1000,pa=parameters(profile,a),pb=parameters(profile,b),na=tau/(pa[1]*60),delta=pb[1]-pa[1];
   // Integral of 1 / linearly interpolated period: continuous across data epochs.
   sum[0]+=Math.abs(delta)<1e-9?seconds*na:seconds*tau/60*Math.log(pb[1]/pa[1])/delta;
   const ra=rates(pa),rb=rates(pb),rm=rates(parameters(profile,(a+b)/2));for(let j=1;j<3;j++)sum[j]+=seconds*(ra[j]+4*rm[j]+rb[j])/6;
  }return sum.map(x=>((x%tau)+tau)%tau);
 }
 function point(id,at,referenceAt=at){const profile=byId.get(id);if(!profile||!Number.isFinite(at)||at<profile.start||at>=profile.end||at>Date.now())return null;
  const [inc,period,perigee,apogee]=parameters(profile,at),a=R+(perigee+apogee)/2,e=(apogee-perigee)/(2*a),[mean,node,omega]=angles(profile,at);let E=mean;
  for(let i=0;i<12;i++){const step=(E-e*Math.sin(E)-mean)/(1-e*Math.cos(E));E-=step;if(Math.abs(step)<1e-12)break;}
  const x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E),cw=Math.cos(omega),sw=Math.sin(omega),cn=Math.cos(node),sn=Math.sin(node),ci=Math.cos(inc*rad),si=Math.sin(inc*rad),u=cw*x-sw*y,v=sw*x+cw*y;
  const inertial=[cn*u-sn*ci*v,sn*u+cn*ci*v,si*v],jd=referenceAt/day+2440587.5,T=(jd-2451545)/36525,theta=(280.46061837+360.98564736629*(jd-2451545)+.000387933*T*T-T*T*T/38710000)*rad;
  const fixed=[inertial[0]*Math.cos(theta)+inertial[1]*Math.sin(theta),-inertial[0]*Math.sin(theta)+inertial[1]*Math.cos(theta),inertial[2]],r=Math.hypot(fixed[0],fixed[1]);let lat=Math.atan2(fixed[2],r),N=R;
  for(let i=0;i<8;i++){N=R/Math.sqrt(1-.00669437999014*Math.sin(lat)**2);lat=Math.atan2(fixed[2]+N*.00669437999014*Math.sin(lat),r);}
  const altitude=Math.abs(Math.cos(lat))>1e-8?r/Math.cos(lat)-N:Math.abs(fixed[2])-6356.752314;
  const angular=tau/(period*60),denom=1-e*Math.cos(E),speed=angular*a*Math.sqrt(Math.sin(E)**2+(1-e*e)*Math.cos(E)**2)/denom;
  return {id,lat:lat/rad,lon:Math.atan2(fixed[1],fixed[0])/rad,altitude_km:altitude,speed_km_s:speed,epoch:new Date(profile.samples[0][0]).toISOString(),age_hours:(at-profile.samples[0][0])/3600000,source:'Reconstitution théorique · SPACE-40 / Académie des sciences tchèque',theoretical:true,theory_source:profile.source};
 }
 function eligible(rows){return rows.filter(s=>byId.has(s.id));}
 function apply(url,result,rows){if(!enabled)return result;const request=new URL(url,'http://atlas.local/');if(!request.pathname.endsWith('/api/positions'))return result;const at=Date.parse(request.searchParams.get('at')),id=request.searchParams.has('id')?Number(request.searchParams.get('id')):null;if(request.searchParams.get('collection')==='all'&&id===null)return result;const candidates=eligible(rows).filter(s=>id===null||s.id===id),existing=new Set(result.points.map(p=>p.id)),added=candidates.filter(s=>!existing.has(s.id)).map(s=>point(s.id,at)).filter(Boolean);if(!added.length)return result;
  const next={...result,points:[...result.points,...added],missing:Math.max(0,(result.missing||0)-added.length)};
  const chosen=added.find(p=>p.id===id)||(id===null&&candidates.length===1?added[0]:null);
  if(chosen){const profile=byId.get(chosen.id),period=parameters(profile,at)[1]*60000;
   for(const [name,sign] of [['track',-1],['future_track',1]]){const values=[];for(let i=0;i<=180;i++){const p=point(chosen.id,at+sign*period*i/180,at);if(!p)break;values.push([p.lat,p.lon,p.altitude_km]);}if(sign<0)values.reverse();next[name]=values.map(p=>p.slice(0,2));next[name==='track'?'track_3d':'future_track_3d']=values;}
  }return next;
 }
 function offer(parent,rows,at){const profile=byId.get(eligible(rows)[0]?.id);if(!profile||!visit)return false;const button=document.createElement('button');button.type='button';button.className='historical-theory-action';button.textContent='Voir une trajectoire théorique';button.onclick=()=>{enabled=true;const time=point(profile.id,at)?at:Math.max(profile.start,profile.samples[0][0])+60000;visit(profile.id,time);};parent.append(button);return true;}
 function create(parent,onChange,onVisit){visit=onVisit;const box=document.createElement('section');box.className='historical-theory-control';box.hidden=true;
  const label=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.id='historical-theory-toggle';label.append(toggle,document.createTextNode(' Position théorique'));const note=document.createElement('p');note.textContent='Reconstitution indicative : orientation et phase initiales conventionnelles. La position exacte n’est pas connue.';
  const status=document.createElement('p');status.setAttribute('role','status');const sources=document.createElement('div');sources.className='historical-theory-sources';box.append(label,note,status,sources);parent.append(box);
  toggle.onchange=()=>{enabled=toggle.checked;onChange();};
  return {update(rows,at,selected,points,collection){const candidates=collection==='all'&&selected===null?[]:eligible(selected===null?rows:rows.filter(s=>s.id===selected));box.hidden=!candidates.length;if(box.hidden)return;toggle.checked=enabled;const estimates=points.filter(p=>p.theoretical&&candidates.some(s=>s.id===p.id));box.dataset.active=String(estimates.length>0);status.textContent=estimates.length?'Estimation théorique affichée · archives prioritaires':enabled?'Aucune estimation affichée : archives disponibles ou date hors période orbitale.':'Option désactivée · positions archivées uniquement';sources.replaceChildren();for(const s of candidates){const p=byId.get(s.id),link=document.createElement('a');link.href=p.source;link.target='_blank';link.rel='noopener';link.textContent='Sources · '+p.name;link.title='Paramètres datés ; interpolation entre relevés, derniers paramètres conservés hors relevés. Pas de calcul précis de rentrée.';sources.append(link);if(p.note){const text=document.createElement('small');text.textContent=p.note;sources.append(text);}}}}
 }
 const api={profiles,parameters,point,apply,offer,create,get enabled(){return enabled;},setEnabled(value){enabled=value===true;}};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasTheory=api;
})(typeof window==='undefined'?globalThis:window);
