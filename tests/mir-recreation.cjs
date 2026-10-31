// Mir has returned to the first selected Celestia asset, without the later repaints.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function read(file){const raw=fs.readFileSync(file),n=raw.readUInt32LE(12);assert.equal(raw.readUInt32LE(8),raw.length);return {raw,g:JSON.parse(raw.subarray(20,20+n)),binary:raw.subarray(28+n)}}
const info=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')).find(r=>r.key==='mir'),source=JSON.parse(fs.readFileSync('resources/detailed-model-sources.json')).mir;
assert.equal(source.file,'resources/detailed-originals/mir-celestia.glb');
const original=read(source.file),runtime=read('static/'+info.url.split('?')[0]);
assert.equal(crypto.createHash('sha256').update(original.raw).digest('hex'),info.sha256);
assert.deepEqual(runtime.binary.subarray(0,original.binary.length),original.binary,'Original mesh buffers and texture images remain unchanged');
for(const key of ['materials','textures','images'])assert.deepEqual(runtime.g[key],original.g[key],key+' retained exactly');
assert.equal(info.triangles,446331);assert.equal(info.textures,9);assert.deepEqual(info.body_axes,[[0,0,-1],[1,0,0],[0,-1,0]]);assert.equal(info.solar_rig.length,10);
const matrix=runtime.g.nodes.at(-1).matrix,scale=Math.hypot(...matrix.slice(0,3));assert.ok(scale>0);for(const i of [4,8])assert.ok(Math.abs(Math.hypot(...matrix.slice(i,i+3))-scale)<1e-10,'Uniform scale retains original proportions');
const determinant=matrix[0]*(matrix[5]*matrix[10]-matrix[6]*matrix[9])-matrix[4]*(matrix[1]*matrix[10]-matrix[2]*matrix[9])+matrix[8]*(matrix[1]*matrix[6]-matrix[2]*matrix[5]);assert.ok(determinant>0,'Body-axis calibration is a proper rotation without mirroring');
console.log('Original Celestia Mir restored: original geometry, 9 source textures, materials and UVs intact; calibrated body axes without mirroring OK');
