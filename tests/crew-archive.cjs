const assert=require('node:assert/strict'),api=require('../static/crew-archive.js'),history=require('../static/station-history.js'),archive=require('../static/crew-archive.json');
const at=value=>Date.parse(value+'T12:00:00Z');
for(const [key,date,count] of [['mir','1999-01-01',2],['skylab','1973-08-01',3],['salyut-1','1971-06-15',3],['tiangong-1','2012-06-20',3],['tiangong-2','2016-11-01',2]]){
 const doc=api.station(archive,key);assert.ok(doc.flights.length);const crew=history.crewAt(doc,at(date));assert.equal(crew.crew.length,count,key);assert.ok(crew.crew.every(a=>a.role&&a.nationalities.length));for(const p of crew.crew)assert.ok(api.total(archive,p,at(date)).seconds>0);assert.equal(history.crewAt(doc,at('2026-10-26'),true).crew.length,0,'Historical station cannot be crewed today');
}
assert.equal(history.crewAt(api.station(archive,'salyut-1'),at('1971-04-24')).crew.length,0,'Soyuz 10 never entered Salyut 1');
const conrad=Object.values(archive.people).find(a=>a.family_name==='Conrad');
assert.ok(api.total(archive,conrad,at('1973-08-01')).seconds>28*86400,'Career includes Gemini and Apollo');assert.equal(api.total(archive,conrad,at('1960-01-01')).seconds,0);
for(const person of [{name:'Kayla Barron'},{name:'Kimiya Yui'},{name:'Zhu Yangzhu',family_name:'Zhu'},{name:'Sunita Williams'}])assert.ok(api.identify(archive,person),person.name);
assert.equal(api.identify(archive,{name:'Williams'}),null);
const test={observed_at:'2020-01-04T00:00:00Z',people:{A:{id:'A',flights:[{id:1,launch:'2020-01-01T00:00:00Z',end:'2020-01-03T00:00:00Z'},{id:2,launch:'2020-01-02T00:00:00Z',end:'2020-01-04T00:00:00Z'}]}}};
assert.equal(api.total(test,{id:'A'},Date.parse('2020-01-05')).seconds,3*86400,'Overlaps are counted once');assert.ok(archive.spacewalks.some(e=>e.location.includes('Mir')));
console.log('Crew: historical occupancy, failed docking, career rides, cutoffs, identities, overlap protection and EVA records OK.');
