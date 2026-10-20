const assert=require('node:assert/strict'),EVA=require('../static/iss-evas.js');
assert.equal(EVA.seconds('P1DT5H49M'),29*3600+49*60);assert.equal(EVA.format(EVA.seconds('PT6H49M')),'6 h 49 min');assert.equal(EVA.seconds(null),null);assert.equal(EVA.seconds('bad'),null);
const base={id:1,start:'2026-01-01T12:00:00Z',end:'2026-01-01T18:49:00Z',duration:'PT6H49M',crew:[{id:7},{id:8}]};
const missing={...base,id:2,start:'2026-01-02T00:00:00Z',duration:null,end:'2026-01-02T01:00:00Z'};
const ongoing={...base,id:3,start:'2026-01-03T01:00:00Z',end:null,duration:null};
const future={...base,id:4,start:'2099-01-01T00:00:00Z',end:'2099-01-01T02:00:00Z'};
let s=EVA.stats({spacewalks:[base,base,missing,ongoing,future],complete:false},7,Date.parse('2026-01-04T00:00:00Z'));
assert.equal(s.completed,2);assert.equal(s.ongoing,1);assert.equal(s.total,7*3600+49*60);assert.equal(s.rows.length,3);assert.equal(s.complete,false);assert.equal(EVA.stats({spacewalks:[base]},99).total,null);
assert.equal(EVA.duration({...base,start:null,end:null,duration:null}),null);
console.log('Sorties EVA : dédoublonnage, cumul sans multiplication par équipage, durées manquantes, sortie en cours et futur OK');

const historical=EVA.stats({spacewalks:[base]},7,Date.parse('2026-01-01T15:00:00Z'));assert.equal(historical.completed,0);assert.equal(historical.ongoing,1);assert.equal(historical.total,null);
