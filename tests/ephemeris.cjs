const assert=require('node:assert/strict'),fs=require('node:fs'),e=require('../static/ephemeris.js');
const data=JSON.parse(fs.readFileSync('static/ephemerides/tess.json')),row=data.samples[500],at=row[0]*1000;
assert.deepEqual(e.vector(data,at),row.slice(1,4));assert.equal(e.vector(data,data.samples[0][0]*1000-1),null);assert.equal(e.vector(data,data.samples.at(-1)[0]*1000+1),null);
assert.equal(e.vector({samples:[[0,1,2,3,0,0,0],[86400,1,2,3,0,0,0]]},43200000),null,'Do not interpolate across gaps in collected vectors');
assert.equal(e.point({...data,samples:[[0,100000,0,0,1,0,0],[86400,100000,0,0,1,0,0]]},0).speed_km_s,1,'Use published velocity at an isolated exact sample');
assert.equal(e.point({...data,samples:[[0,100000,0,0,1,0,0]]},0).speed_km_s,1,'Single sample at year boundary remains bounded and finite');
const p=e.point(data,at);assert.equal(p.id,43435);assert.ok(p.altitude_km>50000&&p.altitude_km<500000);assert.ok(Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);assert.ok(p.speed_km_s>0&&p.speed_km_s<4);assert.match(p.source,/NASA\/JPL/);
const r=e.augment({points:[{id:20580}],missing:2},data,at,43435);assert.equal(r.points.length,2);assert.equal(r.missing,1);assert.ok(r.track.length>1&&r.future_track.length>1);assert.deepEqual(r.track_3d.at(-1),r.future_track_3d[0]);
e.augment(r,data,at,43435);assert.equal(r.points.length,2);assert.equal(r.missing,1,'No duplicates or repeated missing decrement');
const unavailable={points:[],missing:1};assert.equal(e.augment(unavailable,data,0,43435),unavailable);assert.equal(unavailable.points.length,0,'Never extrapolate');
const start=data.samples[0][0]*1000;const edge=e.augment({points:[],missing:1},data,start,43435);assert.equal(edge.track.length,1);assert.ok(edge.future_track.length>1);
console.log('TESS : vecteurs officiels UTC, interpolation, altitude/vitesse, orbites et limites temporelles sans extrapolation OK.');

(async()=>{
 const requests=[];
 const fetchArchive=async url=>{const path=new URL(url).pathname;requests.push(path);try{return {ok:true,json:async()=>JSON.parse(fs.readFileSync('static'+path))};}catch{return {ok:false};}};
 const context={URL,document:{currentScript:{src:'https://atlas.test/ephemeris.js'}},window:{},fetch:fetchArchive};require('node:vm').runInNewContext(fs.readFileSync('static/ephemeris.js','utf8'),context);const browser=context.window.AtlasEphemeris;
 {
  const at='2020-06-01T12:00:00Z',url='https://atlas.test/api/positions?collection=tess&id=43435&at='+at;
  const result=await browser.apply(url,{points:[],missing:1});assert.equal(result.points[0].id,43435);assert.ok(result.track.length>1);assert.ok(result.points[0].altitude_km>50000);
  const count=requests.length;await browser.apply(url,{points:[],missing:1});assert.equal(requests.length,count,'Historical year fetched once per visit');
  const absent=await browser.apply('https://atlas.test/api/positions?collection=tess&at=2010-01-01T00:00:00Z',{points:[],missing:1});assert.equal(absent.points.length,0,'No position before launch');
  console.log('TESS historical archive: lazy year loading, caching and temporal bounds OK.');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

(async()=>{
 const vm=require('node:vm');const resolvers=[];let fetches=0,events=0;
 const context={URL,CustomEvent:class{constructor(type){this.type=type;}},document:{currentScript:{src:'https://atlas.test/ephemeris.js'}},window:{dispatchEvent(){events++;}},fetch:()=>{fetches++;return new Promise(resolve=>{resolvers.push(resolve);});}};
 vm.runInNewContext(fs.readFileSync('static/ephemeris.js','utf8'),context);const browser=context.window.AtlasEphemeris,url='https://atlas.test/api/positions?collection=all&at='+new Date(at).toISOString(),base={points:[{id:1}],missing:1};
 const result=await Promise.race([browser.apply(url,base),new Promise((_,reject)=>setTimeout(()=>reject(Error('Optional ephemerides block Atlas')),100))]);assert.equal(result,base);await browser.apply(url,base);assert.equal(fetches,20,'Coalesce TESS and the 19 supported distant-mission archives');
 resolvers[0]({ok:true,json:async()=>data});for(const resolve of resolvers.slice(1))resolve({ok:false});await new Promise(r=>setImmediate(r));assert.equal(events,1);const complete=await browser.apply(url,{points:[],missing:1});assert.equal(complete.points[0].id,43435);assert.equal(fetches,21,'Only one coalesced Eyes backup index request is added after primary failures');
 console.log('Atlas first positions are not blocked by optional TESS data; background request coalesced and augmentation restored.');
})().catch(error=>{console.error(error);process.exitCode=1;});
