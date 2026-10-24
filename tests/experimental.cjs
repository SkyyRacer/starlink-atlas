const assert=require('node:assert/strict'),fs=require('node:fs'),registry=require('../static/constellations'),pages=require('../static/pages');
const expected={'proba-3':[62256,62258],'proba-2':[36037],'mev-1':[44625],'mev-2':[46113],'lares-2':[53105]};
for(const [key,ids] of Object.entries(expected)){
 const def=registry.byId.get(key);assert.equal(def.category,'experimental');assert.deepEqual(def.ids,ids);assert.equal(pages.mode('/'+key),key);assert.equal(pages.search(def.label)[0].mode,key);
 const catalog=JSON.parse(fs.readFileSync('data/'+key+'-catalog.json'));assert.equal(catalog.length,ids.length);
 for(const r of catalog){assert.ok(registry.belongs(r,key));assert.equal(registry.family(r),key);}
 assert.equal(registry.family({id:99999,name:def.prefixes[0]+' DEB',object_type:'DEB'}),'debris');
}
assert.equal(pages.search('proba').length,3);assert.equal(pages.search('mev').length,2);assert.ok(pages.search('relativité').some(row=>row.mode==='lares-2'));assert.ok(pages.search('relativité').some(row=>row.mode==='gravity-probe-b'));
console.log('Expérimental : cinq pages, six objets SATCAT, recherche, séparation des débris et fiches correctement associés.');
