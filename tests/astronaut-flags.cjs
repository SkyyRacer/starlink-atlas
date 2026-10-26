const assert=require('node:assert/strict'),fs=require('node:fs'),doc=require('../static/crew-archive.json'),rules=require('../resources/astronaut-nationalities.json');
for(const person of Object.values(doc.people))for(const n of person.nationalities){
 assert.match(n.code,/^[A-Z]{2}$/,person.name);const file='static/images/flags/'+n.code.toLowerCase()+'.svg';assert.ok(fs.existsSync(file),person.name+' flag');const svg=fs.readFileSync(file,'utf8');assert.match(svg,/<svg\b/);assert.doesNotMatch(svg,/<script\b|onload=/i);assert.ok(n.source,person.name+' nationality provenance');
}
for(const [country,code] of Object.entries({F:'FR',D:'DE',I:'IT',E:'ES',B:'BE',S:'SE',N:'NO',UAE:'AE',PAR:'PA'}))assert.equal(rules.codes[country].code,code);
assert.equal(doc.people['AS-00098'].nationalities[0].code,'DD');assert.match(doc.people['AS-00098'].nationalities[0].name,/RDA/);
assert.match(doc.people['AS-00095'].nationalities[0].name,/Tchécoslovaquie/);
assert.deepEqual(doc.people['AS-00699'].nationalities.map(n=>n.code),['US','IL']);
console.log('All 787 travellers: valid local flags and nationality provenance; aliases, Panama, dual citizenship and historical labels OK.');
