const assert=require('node:assert/strict'),fs=require('node:fs');
const registry=require('../static/constellations'),baseline=JSON.parse(fs.readFileSync('resources/collection-baseline.json')).existing_group_ids,audit=JSON.parse(fs.readFileSync('resources/mission-catalog-audit.json'));
for(const key of baseline)assert.ok(registry.byId.has(key),'Keep existing URL '+key);
const html=fs.readFileSync('static/index.html','utf8');for(const id of ['starlink-controls','search','date','year','launch','debris-filters','status','iss-controls','atlas-controls'])assert.ok(html.includes('id="'+id+'"'),'Registry generation preserves '+id);
let payloads=new Set();
for(const def of registry.definitions.filter(d=>d.extension)){
 assert.ok(def.ids.length,def.id);const rows=JSON.parse(fs.readFileSync('data-seed/'+def.id+'-catalog.json'));assert.equal(new Set(rows.map(r=>r.NORAD_CAT_ID)).size,rows.length);
 for(const row of rows){assert.equal(row.OBJECT_TYPE,'PAY',def.id);assert.ok(registry.belongs(row,def.id),`${row.NORAD_CAT_ID} belongs to ${def.id}`);assert.ok(registry.family(row),'Every physical object has a primary family');payloads.add(row.NORAD_CAT_ID);}
}
assert.ok(payloads.size>4000);
for(const id of registry.byId.get('gambit-1').ids)assert.ok(!registry.byId.get('gambit-3').ids.includes(id),'KH-7 and KH-8 are distinct');
assert.deepEqual(registry.byId.get('mol').ids,[2524]);assert.ok(!registry.byId.get('kosmos-science').ids.includes(37876),'A modern DS-2000 bus is not a Soviet DS spacecraft');
assert.equal(registry.family({id:34380,name:'KEPLER'}),'kepler');assert.ok(!registry.belongs({id:34380,name:'KEPLER'},'kepler-comms'));
assert.ok(registry.byId.get('guowang').ids.some(id=>id>99999),'Preserve six-digit identifiers');
for(const key of ['spitzer','kepler','dscovr','aditya-l1','spektr-rg','ikaros'])assert.equal(registry.byId.get(key).trajectory,'horizons');
for(const key of ['clearspace','musis','gravity-probe-a'])assert.ok(!registry.byId.has(key),'No invented orbital payload '+key);
console.log('Historic expansion: original URLs retained; >4000 verified payloads, overlapping groups, aliases and deep-space exclusions OK.');
