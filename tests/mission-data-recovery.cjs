const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const config=JSON.parse(fs.readFileSync('resources/mission-ephemerides.json')),requests=[];
 const context={URL,document:{currentScript:{src:'https://atlas.test/starlink-atlas/ephemeris.js'}},window:{},fetch:async(url,options)=>{const path=new URL(url).pathname.replace('/starlink-atlas/','');requests.push({path,options});try{return {ok:true,json:async()=>JSON.parse(fs.readFileSync('static/'+path))};}catch{return {ok:false};}}};vm.runInNewContext(fs.readFileSync('static/ephemeris.js','utf8'),context);const api=context.window.AtlasEphemeris;
 for(const mission of config.missions){
  const index=JSON.parse(fs.readFileSync('static/ephemerides/'+mission.key+'-index.json'));let at=Date.now();
  if(mission.stop)at=Math.min(Date.now(),Math.max(...Object.values(index.years).map(row=>row.last_epoch))*1000-1000);
  const result=await api.apply('https://atlas.test/api/positions?collection='+mission.key+'&id='+mission.id+'&at='+new Date(at).toISOString(),{points:[],missing:1});
  assert.equal(result.points.length,1,mission.key+' must have a real position at its applicable current/historical date');assert.ok(result.points[0].icrf_km.every(Number.isFinite));assert.ok(Number.isFinite(result.points[0].speed_km_s));
 }
 // An expired cached index must recover after a background source repair.
 const index=JSON.parse(fs.readFileSync('static/ephemerides/kepler-index.json')),entry=Object.values(index.years).at(-1),data=JSON.parse(fs.readFileSync('static/'+entry.file)),at=data.samples.at(-10)[0]*1000;
 let clock=100000,indexReads=0,repaired=false;class Time extends Date{static now(){return clock;}}
 const recovery={...context,Date:Time,window:{},fetch:async url=>{const path=new URL(url).pathname;if(path.endsWith('-index.json')){indexReads++;return {ok:true,json:async()=>repaired?index:{...index,years:{old:{...entry,last_epoch:at/1000-86400}}}};}return {ok:true,json:async()=>data};}};
 vm.runInNewContext(fs.readFileSync('static/ephemeris.js','utf8'),recovery);const e=recovery.window.AtlasEphemeris,url='https://atlas.test/api/positions?collection=kepler&at='+new Date(at).toISOString();
 assert.equal((await e.apply(url,{points:[],missing:1})).points.length,0);repaired=true;clock+=1000;assert.equal((await e.apply(url,{points:[],missing:1})).points.length,0);assert.equal(indexReads,1,'A temporary outage cannot hammer the source every second');clock+=30000;assert.equal((await e.apply(url,{points:[],missing:1})).points.length,1,'A repaired index becomes usable without reopening the site');assert.equal(indexReads,2);
 console.log('All 17 sourced distant missions: current vectors, historical Cassini, finite physical data and expired-index recovery without reload OK.');
})().catch(error=>{console.error(error);process.exitCode=1;});
