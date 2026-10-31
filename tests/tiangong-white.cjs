const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const report=JSON.parse(fs.readFileSync('resources/tiangong-white-models.json')),manifest=JSON.parse(fs.readFileSync('resources/science-model-manifest.json')),detailed=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json'));
function glb(file){const raw=fs.readFileSync(file);return {raw,g:JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)))}};
for(const key of ['tiangong','tiangong-1','tiangong-2']){
 const file=key==='tiangong'?'static/images/tiangong.glb':'static/images/science/'+key+'.glb',{raw,g}=glb(file),r=report.find(x=>x.key===key),source=detailed.find(x=>x.key===key);
 assert.equal(r.source_sha256,crypto.createHash('sha256').update(fs.readFileSync('static/'+source.url.split('?')[0])).digest('hex'),'White outline tracks its precise detailed source');
 assert.ok(g.meshes.every(m=>m.primitives.every(p=>p.mode===1)),'White mode uses feature lines');assert.ok(!g.images&&!g.textures,'No colour textures or detailed-model download in white mode');assert.ok(g.materials.every(m=>m.pbrMetallicRoughness.baseColorFactor.slice(0,3).every(c=>c===1)));
 assert.ok(raw.length<400000);assert.ok(r.line_segments>2000);assert.ok(r.parts.some(n=>n.includes('Orbital cabin'))&&r.parts.some(n=>n.includes('Propulsion module')),'Docked Shenzhou is part of the white silhouette');
 assert.ok(!g.nodes[0].rotation,'Retains the body axes rather than applying another glTF tilt');
 if(key==='tiangong'){for(const name of ['Tianhe / Large crew cabin','Wentian / Work cabin','Mengtian / Work cabin'])assert.ok(r.parts.includes(name));assert.ok(r.parts.some(n=>n.startsWith('Tianzhou /')));}else{const row=manifest.find(x=>x.key===key);assert.deepEqual(row.ids,[key==='tiangong-1'?37820:41765]);assert.equal(row.body_axes,true);assert.equal(row.kind,'original-reconstruction-outline');}
}
const context={window:{AtlasISS:{screenSize(){return 30;}}},document:{currentScript:{src:'http://localhost/science-visual.js'}},URL,Map};vm.runInNewContext(fs.readFileSync('static/science-visual.js','utf8'),context);assert.ok(context.window.AtlasScience.has(37820)&&context.window.AtlasScience.has(41765),'Both laboratories are registered in the white layer');
console.log('Three Tiangong white models: exact assembly sources, true feature edges, all modules/wings/visitors, untextured white materials, calibrated loader axes and active laboratory registry OK');
