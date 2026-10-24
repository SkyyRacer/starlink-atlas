const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const requests=[],context={URL,document:{currentScript:{src:'https://atlas.test/starlink-atlas/ephemeris.js'}},window:{},fetch:async url=>{const path=new URL(url).pathname.replace('/starlink-atlas/','');requests.push(path);try{return {ok:true,json:async()=>JSON.parse(fs.readFileSync('static/'+path))};}catch{return {ok:false};}}};
 vm.runInNewContext(fs.readFileSync('static/ephemeris.js','utf8'),context);const e=context.window.AtlasEphemeris;
 for(const key of ['spitzer','kepler','dscovr','aditya-l1']){
  const index=JSON.parse(fs.readFileSync('static/ephemerides/'+key+'-index.json')),entry=Object.values(index.years).find(y=>y.first_epoch<Date.parse('2026-06-01')/1000&&y.last_epoch>Date.parse('2026-06-01')/1000),data=JSON.parse(fs.readFileSync('static/'+entry.file));
  const row=data.samples[200],at=row[0]*1000+60000,result=await e.apply('https://atlas.test/api/positions?collection='+key+'&id='+index.id+'&at='+new Date(at).toISOString(),{points:[],missing:1});
  assert.equal(result.points.length,1);const p=result.points[0];assert.equal(p.id,index.id);assert.ok(Number.isFinite(p.altitude_km)&&p.altitude_km>500000);assert.ok(result.track_3d.length>1&&result.future_track_3d.length>1);assert.deepEqual(result.track_3d.at(-1),result.future_track_3d[0]);assert.ok(e.vector(data,at));assert.equal(e.vector(data,data.samples[0][0]*1000-1),null);
  const before=requests.length;await e.apply('https://atlas.test/api/positions?collection='+key+'&at='+new Date(at).toISOString(),{points:[],missing:1});assert.equal(requests.length,before);
 }
 const keplerIndex=JSON.parse(fs.readFileSync('static/ephemerides/kepler-index.json')),last=Math.max(...Object.values(keplerIndex.years).map(row=>row.last_epoch));const expired=await e.apply('https://atlas.test/api/positions?collection=kepler&at='+new Date((last+86400)*1000).toISOString(),{points:[],missing:1});assert.equal(expired.points.length,0,'No extrapolation beyond Kepler coverage');assert.equal(expired.suggested_at,new Date(last*1000).toISOString(),'Offer the actual last available epoch instead of an empty dead-end');
 const before=requests.length;for(const key of ['spektr-rg','ikaros'])assert.equal((await e.apply('https://atlas.test/api/positions?collection='+key+'&at=2026-06-01T00:00:00Z',{points:[],missing:1})).points.length,0);assert.equal(requests.length,before,'No invented orbits for unverified ephemerides');
 console.log('Four official deep-space missions: lazy year files, real vector bounds, Hermite interpolation, open tracks and no invented unsupported positions OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
