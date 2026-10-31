const assert=require('node:assert/strict'),fs=require('node:fs');
const manifest=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')),info=manifest.find(m=>m.key==='tiangong'),raw=fs.readFileSync(info.original_file),n=raw.readUInt32LE(12),g=JSON.parse(raw.subarray(20,20+n));
assert.deepEqual(info.ids,[48274]);assert.deepEqual(info.body_axes,[[1,0,0],[0,1,0],[0,0,1]]);assert.match(info.credit,/Atlas/);assert.equal(g.extras.atlasOriginalRecreation.solar_wings,6);
for(const name of ['Tianhe module','Wentian module','Mengtian module'])assert.ok(g.nodes.some(n=>n.name===name));
assert.ok(g.nodes.filter(n=>n.name.startsWith('Robotic arm joint')).length>=7);assert.ok(g.nodes.filter(n=>n.name.includes('Payload platform radiator')).length>=6);assert.ok(g.nodes.filter(n=>n.name.endsWith('/ Chinese flag port')).length>=3);
assert.equal(info.docked_visitors.length,3);assert.equal(info.docked_visitors.filter(v=>v.vehicle==='shenzhou').length,2);assert.equal(info.docked_visitors.filter(v=>v.vehicle==='tianzhou').length,1);
for(const v of info.docked_visitors)assert.ok(g.nodes.some(n=>n.name===v.node&&n.children.length));
for(const [node,coordinate,value] of [['Atlas CSS Shenzhou front / Active docking adapter',0,8.37],['Atlas CSS Shenzhou nadir / Active docking adapter',2,1.57]]){
 const part=g.nodes.find(n=>n.name===node),a=g.accessors[g.meshes[part.mesh].primitives[0].attributes.POSITION];assert.ok(Math.abs(a.min[coordinate]-value)<1e-4,'Visitor docking interface follows the chosen port frame');
}
const report=JSON.parse(fs.readFileSync('resources/tiangong-recreation.json'));assert.equal(report.solar_arrays.filter(v=>v.module!=='Tianzhou').length,6);assert.ok(report.solar_arrays.filter(v=>v.module==='Wentian'||v.module==='Mengtian').every(a=>a.blankets===2&&a.leaf_sections===28));
assert.ok(info.triangles>80000&&info.bytes<10000000);assert.ok(info.textures>=6);assert.ok(fs.existsSync('resources/atlas-reference-recreations/tiangong-1.glb'));const standalone=fs.readFileSync('resources/atlas-reference-recreations/tiangong-1.glb');const doc=JSON.parse(standalone.subarray(20,20+standalone.readUInt32LE(12)));assert.ok(!doc.nodes.some(n=>n.name.startsWith('Atlas docked Shenzhou')));
console.log('Original Tiangong recreation: T configuration, six deployed arrays, three correct visiting ports, rigid capsule frames, robotic arm, payload platforms, standalone Tiangong-1 export and calibrated body frame OK');
