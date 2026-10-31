const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},document:{currentScript:{src:'http://localhost/detailed-models.js'}},URL,Map,AbortController};vm.runInNewContext(fs.readFileSync('static/detailed-models.js','utf8'),context);const api=context.window.AtlasDetailed;
for(let n=1;n<=7;n++){
 const info=api.definitions.find(m=>m.key==='salyut-'+n);assert.equal(info.docked_visitors.length,1,'Exactly one illustrative Soyuz on each Salyut');const v=info.docked_visitors[0];assert.equal(v.visibility,'always');assert.equal(v.illustrative,true);assert.equal(v.port,[2,3,5].includes(n)?'aft':'front');assert.equal(v.variant,n===1?'early':n>=6?'t':'ferry');
 const node={show:false},model={ready:true,getNode:name=>{assert.equal(name,v.node);return node;}};
 for(const date of ['1970-01-01','1971-06-17','1982-06-27','2026-10-29']){const at=Date.parse(date);assert.equal(api.dockedAt(info,at).length,1,'The requested assembly remains visible at every date, including Salyut 2');api.syncDocked(model,info,at);assert.equal(node.show,true);node.show=false;}
}
for(const key of ['iss','mir','skylab','tiangong','tiangong-2']){const info=api.definitions.find(m=>m.key===key);assert.ok(!info.docked_visitors?.some(v=>v.visibility==='always'&&(v.vehicle||'soyuz')==='soyuz'),'Permanent Soyuz choice is limited to Salyut');}
assert.ok(JSON.parse(fs.readFileSync('resources/salyut-soyuz-dockings.json')).stations['salyut-2'].length===0,'Historical sources are retained and not rewritten to justify the illustration');
console.log('All seven Salyut: exactly one permanent illustrative Soyuz, correct end/variant, timeline independence including rewind; other stations and historical docking records preserved');
