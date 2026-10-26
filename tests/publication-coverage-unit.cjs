const assert=require('node:assert/strict'),{coverage}=require('./publication-coverage.cjs');
const now=Date.parse('2026-10-23T12:00:00Z'),satellites=Array.from({length:10000},(_,i)=>({id:i+1,name:'STARLINK-'+i,launch:'2020-01-01',decay:null}));
satellites.push({id:20001,name:'STARLINK-OLD',decay:'2026-01-01'},{id:20002,name:'STARLINK-FUTURE',launch:'2027-01-01'});
assert.throws(()=>coverage({satellites},Array.from({length:5},(_,i)=>({id:i+1})),now),/Publication suspendue/);
const points=Array.from({length:9000},(_,i)=>({id:i+1}));assert.equal(coverage({satellites},points,now).expected,10000);assert.equal(coverage({satellites},points,now).starlink,9000);assert.equal(coverage({satellites},points,now).minimum,8000);
console.log('Publication guard: severe source loss rejected, historical/future objects excluded, healthy fallback accepted.');

const gps=Array.from({length:30},(_,i)=>({id:30000+i,name:'GPS '+i,family:'gps',launch:'2000-01-01'}));
assert.throws(()=>coverage({satellites:[...satellites,...gps]},points,now),/gps/,'Starlink alone cannot hide another major constellation disappearing');
assert.doesNotThrow(()=>coverage({satellites:[...satellites,...gps]},[...points,...gps.map(s=>({id:s.id}))],now));
const iss={id:25544,name:'ISS',launch:'1998-11-20'};
assert.throws(()=>coverage({satellites:[...satellites,iss]},points,now),/ISS/);
assert.doesNotThrow(()=>coverage({satellites:[...satellites,{...iss,decay:'2020-01-01'}]},points,now));
console.log('Publication guard: other major constellations and active stations protected independently.');

const withGps={satellites:[...satellites,...gps]},partialPoints=[...points,...gps.slice(0,18).map(s=>({id:s.id}))];
const partial=coverage(withGps,partialPoints,now);assert.equal(partial.groups.gps.status,'partial');assert.equal(partial.groups.gps.minimum,15);assert.equal(partial.groups.gps.target,21);assert.match(partial.warnings[0],/18 \/ 30/);
assert.throws(()=>coverage(withGps,[...points,...gps.slice(0,14).map(s=>({id:s.id}))],now),/gps/,'A severe loss remains blocking');
assert.equal(coverage(withGps,[...points,...gps.slice(0,21).map(s=>({id:s.id}))],now).warnings.length,0);
console.log('Publication distinguishes partial coverage (reported) from severe constellation loss (blocked), without extending orbit validity.');
