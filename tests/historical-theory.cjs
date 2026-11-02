const assert=require('node:assert/strict'),A=require('../static/historical-theory.js');
assert.equal(A.enabled,false,'Theoretical mode is always opt-in');
const base={points:[],missing:1,track:[],future_track:[],track_3d:[],future_track_3d:[]},time=Date.parse('1957-11-01T12:00Z'),url='http://localhost:3003/api/positions?collection=sputnik-1&id=2&at='+new Date(time).toISOString(),rows=[{id:2}];
assert.equal(A.apply(url,base,rows),base,'Disabled mode never alters orbital responses');A.setEnabled(true);
const result=A.apply(url,base,rows);assert.equal(result.points.length,1);assert.equal(result.missing,0);assert.equal(base.points.length,0,'The original response is not mutated');assert.equal(result.points[0].theoretical,true);assert.ok(result.track_3d.length>100);assert.ok(result.future_track_3d.length>100);assert.deepEqual(result.track_3d.at(-1),result.future_track_3d[0],'The past and future paths meet at the displayed position');
const real={id:2,lat:12,lon:10,source:'archive'},archived={...base,points:[real],track:[[1,2]]};assert.equal(A.apply(url,archived,rows),archived,'A genuine archive always takes precedence');assert.equal(A.apply(url,base,[{id:25544}]),base,'Only explicitly documented objects may be reconstructed');assert.equal(A.apply('http://localhost/api/catalog',base,rows),base);
for(const profile of A.profiles){
 assert.equal(A.point(profile.id,profile.start-1),null,'Never show a satellite before the orbital interval');assert.equal(A.point(profile.id,NaN),null);if(Number.isFinite(profile.end))assert.equal(A.point(profile.id,profile.end),null,'Never continue past reentry');
 const end=Number.isFinite(profile.end)?profile.end-1:Date.now();
 for(let i=0;i<=100;i++){const at=profile.start+(end-profile.start)*i/100,p=A.point(profile.id,at);assert.ok(p);for(const key of ['lat','lon','altitude_km','speed_km_s'])assert.ok(Number.isFinite(p[key]));assert.ok(Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);const [inc,period,perigee,apogee]=A.parameters(profile,at);assert.ok(Math.abs(p.lat)<=inc+.3);assert.ok(p.altitude_km>=perigee-1&&p.altitude_km<=apogee+23);assert.ok(p.speed_km_s>3&&p.speed_km_s<11);assert.equal(p.theory_source,profile.source);assert.match(p.source,/théorique/);}
 for(const [epoch] of profile.samples){if(epoch-1000<profile.start||epoch+1000>=profile.end)continue;const a=A.point(profile.id,epoch-1),b=A.point(profile.id,epoch+1);assert.ok(Math.abs(a.lat-b.lat)<.001,'No latitude jump at a parameter-table boundary');const delta=((a.lon-b.lon+540)%360)-180;assert.ok(Math.abs(delta)<.001,'No longitude jump at a parameter-table boundary');}
}
assert.equal(A.point(2,Date.now()),null);assert.equal(A.point(25544,time),null);assert.equal(A.point(5,Date.now()+60000),null);
A.setEnabled(false);assert.equal(A.apply(url,base,rows),base);
console.log('Theoretical history: 5 documented missions, bounded dates, finite physical positions, continuous epochs, orbit connection, archive priority and no mutation OK');
