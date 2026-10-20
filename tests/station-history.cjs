const assert=require('node:assert/strict'),{crewAt}=require('../static/station-history');
const time=s=>Date.parse(s+'T00:00:00Z'),person=id=>({id,name:'Astronaut '+id});
const flight=(name,arrival,departure,crew,landing=crew)=>({name,status_id:3,launch:'2024-01-01T00:00:00Z',arrival:arrival+'T00:00:00Z',departure:departure?departure+'T00:00:00Z':null,crew:crew.map(person),landing_crew:landing.map(person)});
const doc={history_complete:true,crew:[{...person(3),arrival:"2024-02-20T00:00:00Z"}],flights:[flight('A','2024-01-02','2024-02-01',[1],[2]),flight('B','2024-01-25','2024-03-01',[2],[1]),flight('C','2024-02-20',null,[3]),{...flight('Future','2025-01-01',null,[4]),status_id:2}]};
assert.deepEqual(crewAt(doc,time('2024-01-01')).crew,[]);
assert.deepEqual(crewAt(doc,time('2024-01-26')).crew.map(a=>a.id),[1,2]);
assert.deepEqual(crewAt(doc,time('2024-02-01')).crew.map(a=>a.id),[1],'Return crew can differ from launch crew');
assert.deepEqual(crewAt(doc,time('2024-02-25')).crew.map(a=>a.id),[1,3]);
assert.deepEqual(crewAt(doc,time('2024-03-01')).crew.map(a=>a.id),[3],'Departure boundary excludes the departing person');
assert.deepEqual(crewAt(doc,time('2024-01-01'),true).crew,doc.crew,'Now restores the collected current crew');
const uncertain={crew:[],flights:[flight('No return date','2020-01-02',null,[9])]};assert.equal(crewAt(uncertain,time('2024-01-01')).crew.length,0);assert.equal(crewAt(uncertain,time('2024-01-01')).incomplete,true,'Never keep a past visitor on board forever');
for(const key of ['iss','tiangong']){const data=require('../data/'+key+'-missions.json'),past=crewAt(data,time('2024-11-01'));assert.ok(past.crew.length>0,key+' historical crew');assert.ok(past.crew.every(a=>Date.parse(a.arrival)<=time('2024-11-01')));}
console.log('Équipages : dates historiques ISS/Tiangong, rotations, retours dans un autre véhicule, limites exactes, données manquantes et retour au présent OK.');

const iss=require('../data/iss-missions.json');
for(const name of ['Sunita Williams','Barry E. Wilmore'])assert.ok(crewAt(iss,time('2024-11-01')).crew.some(a=>a.name===name),'Starliner returned without its crew; '+name+' stayed aboard');
assert.ok(crewAt(iss,time('2023-08-01')).crew.some(a=>a.name==='Francisco Rubio'),'Soyuz MS-22 returned uncrewed; Rubio left on MS-23');
