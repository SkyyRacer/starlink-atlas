const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const rows=JSON.parse(fs.readFileSync('resources/model-runtime-manifest.json')),original=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json'));
for(const row of rows){const file='static/'+row.runtime_url.split('?')[0],bytes=fs.readFileSync(file);assert.equal(bytes.length,row.runtime_bytes);assert.ok(row.runtime_bytes<=row.original_bytes);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.ok(row.runtime_url.includes(crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)));const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n));assert.ok(doc.meshes.length);assert.ok(doc.materials.length);for(const image of doc.images||[])assert.ok(image.bufferView!==undefined,'Runtime model stays self contained');}
for(const row of rows){const source=original.find(r=>r.key===row.key);assert.equal(row.runtime_url,source.url,'Only original detailed models are offered');assert.equal(row.runtime_bytes,source.bytes);}
assert.ok(!fs.existsSync('static/images/detailed/optimized'));
console.log('Original detailed models only: sizes, hashes and GLB/material integrity OK.');

// Both Voyager cameras rotate around the spacecraft bus, beneath the dish.
{
 const info=original.find(row=>row.key==='voyager');assert.deepEqual(info.ids,[10321,10271]);assert.equal(info.presentation_focus_node,'tex_02_AO_dark');
 const read=file=>{const bytes=fs.readFileSync(file);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));};
 const source=read(info.original_file),runtime=read('static/'+info.url.split('?')[0]),node=source.nodes.find(node=>node.name===info.presentation_focus_node);
 const bounds=source.accessors[source.meshes[node.mesh].primitives[0].attributes.POSITION];
 const centre=bounds.min.map((value,i)=>(node.translation?.[i]||0)+(value+bounds.max[i])/2*(node.scale?.[i]||1));
 const matrix=runtime.nodes.find(node=>node.name==='Atlas presentation transform').matrix;
 const focused=[0,1,2].map(i=>matrix[i]*centre[0]+matrix[4+i]*centre[1]+matrix[8+i]*centre[2]+matrix[12+i]);
 assert.ok(Math.hypot(...focused)<1e-6,'The actual bus geometry is at the camera tracking origin');
 assert.deepEqual(runtime.meshes,source.meshes,'Moving the pivot leaves every antenna, boom and body vertex intact');
 console.log('Voyager 1/2: camera pivot at spacecraft bus; full original geometry preserved.');
}
