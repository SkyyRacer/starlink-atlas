const fs=require('node:fs'),assert=require('node:assert/strict');
const entries=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json'));
for(const key of ['tiangong-1','tiangong-2','tiangong']){
 const info=entries.find(x=>x.key===key),b=fs.readFileSync(info.original_file),size=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+size)),binary=b.subarray(size+28);
 const values=i=>{const a=g.accessors[i],v=g.bufferViews[a.bufferView],n={VEC3:3,VEC2:2,SCALAR:1}[a.type],bytes=a.componentType===5126?4:4;return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>a.componentType===5126?binary.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+(j*n+k)*bytes):binary.readUInt32LE((v.byteOffset||0)+(j*n+k)*bytes)));};
 for(const name of ['tg-white','tg-grey','tg-frame']){const m=g.materials.find(m=>m.name===name);assert.ok(m.normalTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture,'Coating and metal roughness maps');}
 const decals=g.nodes.filter(n=>/Chinese flag (port|starboard)$|Station name (port|starboard)$|Module name (port|starboard)$/.test(n.name));assert.ok(decals.length>=4);
 for(const node of decals){const prim=g.meshes[node.mesh].primitives[0],p=values(prim.attributes.POSITION),normal=values(prim.attributes.NORMAL),uv=values(prim.attributes.TEXCOORD_0),indices=values(prim.indices).flat(),a=indices.slice(0,3).map(i=>p[i]),v=a[1].map((x,i)=>x-a[0][i]),w=a[2].map((x,i)=>x-a[0][i]),face=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];assert.ok(face.reduce((n,x,i)=>n+x*normal[indices[0]][i],0)>0,'Outward decal winding');assert.ok(uv.every(v=>v.every(x=>x>=0&&x<=1)),'Conformal UV does not repeat or mirror');}
 if(key!=='tiangong'){
  for(const flag of g.nodes.filter(n=>/^Chinese flag (port|starboard)$/.test(n.name))){
   const bounds=g.accessors[g.meshes[flag.mesh].primitives[0].attributes.POSITION];
   for(const obstacle of g.nodes.filter(n=>/^Porthole (glass|bezel)$/.test(n.name))){
    const other=g.accessors[g.meshes[obstacle.mesh].primitives[0].attributes.POSITION];
    const overlap=[0,1,2].every(k=>bounds.max[k]>=other.min[k]-.002&&other.max[k]>=bounds.min[k]-.002);
    assert.ok(!overlap,key+': flag cannot be pierced by a porthole');
   }
  }
 }
 if(key==='tiangong-2')assert.ok(g.nodes.some(n=>n.name==='POLAR experiment housing'));
}
console.log('Three Tiangong models: conformal flags/names, outward faces, PBR coating maps and distinct TG-2 POLAR OK');
// Review runtime-only flicker fixes: keep original colours/textures while
// removing opposing internal caps and broadening excessively sharp highlights.
for(const key of ['tiangong','tiangong-1','tiangong-2']){
 const info=entries.find(x=>x.key===key),b=fs.readFileSync('static/'+info.url.split('?')[0]),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.ok(info.compatibility.removed_internal_faces.reduce((n,r)=>n+r.triangle_indices.length,0)>1000,'Coincident internal caps are removed at joined modules');
 for(const name of ['tg-grey','tg-frame','silver','steel']){
  const m=g.materials.find(m=>m.name===name);assert.ok(m.pbrMetallicRoughness.roughnessFactor>=.38,'Grey metal has a finite, stable specular lobe');assert.ok(m.pbrMetallicRoughness.metallicFactor>=.38,'Keep metallic reflections');if(m.normalTexture)assert.ok(m.normalTexture.scale<=.08,'Fine normal map cannot create sharp sparkling highlights');
 }
 for(const sampler of g.samplers)assert.equal(sampler.minFilter,9987,'Trilinear mip filtering preserved');
}
console.log('Tiangong runtime: removed opposing internal caps, bounded grey-metal roughness and normal strength, colour maps and mip filtering preserved OK');
