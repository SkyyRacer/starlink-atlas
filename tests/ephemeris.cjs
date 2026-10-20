const assert=require('node:assert/strict'),fs=require('node:fs'),e=require('../static/ephemeris.js');
const data=JSON.parse(fs.readFileSync('static/ephemerides/tess.json')),row=data.samples[500],at=row[0]*1000;
assert.deepEqual(e.vector(data,at),row.slice(1,4));assert.equal(e.vector(data,data.samples[0][0]*1000-1),null);assert.equal(e.vector(data,data.samples.at(-1)[0]*1000+1),null);
const p=e.point(data,at);assert.equal(p.id,43435);assert.ok(p.altitude_km>50000&&p.altitude_km<500000);assert.ok(Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);assert.ok(p.speed_km_s>0&&p.speed_km_s<4);assert.match(p.source,/NASA\/JPL/);
const r=e.augment({points:[{id:20580}],missing:2},data,at,43435);assert.equal(r.points.length,2);assert.equal(r.missing,1);assert.ok(r.track.length>1&&r.future_track.length>1);assert.deepEqual(r.track_3d.at(-1),r.future_track_3d[0]);
e.augment(r,data,at,43435);assert.equal(r.points.length,2);assert.equal(r.missing,1,'No duplicates or repeated missing decrement');
const unavailable={points:[],missing:1};assert.equal(e.augment(unavailable,data,0,43435),unavailable);assert.equal(unavailable.points.length,0,'Never extrapolate');
const start=data.samples[0][0]*1000;const edge=e.augment({points:[],missing:1},data,start,43435);assert.equal(edge.track.length,1);assert.ok(edge.future_track.length>1);
console.log('TESS : vecteurs officiels UTC, interpolation, altitude/vitesse, orbites et limites temporelles sans extrapolation OK.');
