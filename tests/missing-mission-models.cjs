const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const wanted={'bepicolombo':43653,gaia:39479,herschel:34937,planck:34938,'spektr-rg':44432,'aditya-l1':57754,ikaros:36577},manifest=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')),probes=JSON.parse(fs.readFileSync('static/solar/probe-models.json')).models;
for(const [key,id] of Object.entries(wanted)){
 const row=manifest.find(m=>m.key===key);assert.deepEqual(row.ids,[id]);const raw=fs.readFileSync('static/'+row.url.split('?')[0]),n=raw.readUInt32LE(12),g=JSON.parse(raw.subarray(20,20+n));assert.equal(raw.readUInt32LE(8),raw.length);assert.equal(row.bytes,raw.length);assert.ok(row.triangles>1500);assert.ok(g.images.length>0);assert.ok(probes.some(m=>m.key===key&&m.ids.includes(id)&&m.physical_span_m>0));
 for(const mesh of g.meshes)for(const p of mesh.primitives){const mat=g.materials[p.material].pbrMetallicRoughness;assert.ok(mat.roughnessFactor>=.25);if(mat.baseColorTexture)assert.ok(p.attributes.TEXCOORD_0!==undefined);assert.ok(p.attributes.NORMAL!==undefined);}
 if(['bepicolombo','gaia','herschel','planck'].includes(key))assert.match(row.credit,/ESA/);else assert.match(row.note,/interprétés/);
 console.log(key,row.triangles,'triangles; textured GLB registered in isolated and solar views');
}
const context={window:{},document:{currentScript:{src:'http://atlas.local/detailed-models.js'}},URL};vm.runInNewContext(fs.readFileSync('static/detailed-models.js','utf8'),context);for(const id of Object.values(wanted))assert.ok(context.window.AtlasDetailed.has(id));
