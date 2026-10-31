const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json'));
function glb(file){const bytes=fs.readFileSync(file),n=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(8),bytes.length);return {bytes,doc:JSON.parse(bytes.subarray(20,20+n)),binary:bytes.subarray(28+n)};}
for(const info of manifest){
 const original=glb(info.original_file),detail=glb('static/images/detailed/'+info.key+'.glb');
 assert.equal(crypto.createHash('sha256').update(original.bytes).digest('hex'),info.sha256);assert.equal(detail.bytes.length,info.bytes);const meshes=structuredClone(detail.doc.meshes);
 for(const repair of info.uv_repairs||[]){const primitive=meshes[repair.mesh].primitives[repair.primitive],name='TEXCOORD_'+repair.texcoord,accessor=detail.doc.accessors[primitive.attributes[name]],view=detail.doc.bufferViews[accessor.bufferView];assert.equal(accessor.type,'VEC2');assert.equal(accessor.count,repair.count);assert.equal(accessor.count,detail.doc.accessors[primitive.attributes.POSITION].count);assert.ok(detail.binary.subarray(view.byteOffset,view.byteOffset+view.byteLength).every(value=>value===0));delete primitive.attributes[name];}
 const expectedMeshes=structuredClone(original.doc.meshes);
 if(info.compatibility?.primitive_materials)for(let i=0;i<expectedMeshes.length;i++)for(let j=0;j<expectedMeshes[i].primitives.length;j++)expectedMeshes[i].primitives[j].material=info.compatibility.primitive_materials[i][j];
 for(const entry of info.compatibility?.neutral_vertex_colours||[]){const primitive=expectedMeshes[entry.mesh].primitives[entry.primitive];for(const name of entry.removed_attributes){delete primitive.attributes[name];delete primitive.extensions.KHR_draco_mesh_compression.attributes[name];}}
 if(info.compatibility?.png_images)for(let i=0;i<meshes.length;i++)for(let j=0;j<meshes[i].primitives.length;j++){
  const a=original.doc.meshes[i].primitives[j].extensions.KHR_draco_mesh_compression.bufferView,b=meshes[i].primitives[j].extensions.KHR_draco_mesh_compression.bufferView;
  const av=original.doc.bufferViews[a],bv=detail.doc.bufferViews[b];assert.deepEqual(detail.binary.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength),original.binary.subarray(av.byteOffset||0,(av.byteOffset||0)+av.byteLength),'Every compressed source mesh is byte-identical');
  expectedMeshes[i].primitives[j].extensions.KHR_draco_mesh_compression.bufferView=b;
 }
 for(const repair of info.compatibility?.removed_internal_faces||[]){
  const expected=expectedMeshes[repair.mesh].primitives[repair.primitive],actual=meshes[repair.mesh].primitives[repair.primitive];
  function indices(g,b,p){const a=g.accessors[p.indices],v=g.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,i)=>a.componentType===5125?b.readUInt32LE(offset+i*4):b.readUInt16LE(offset+i*2));}
  const before=indices(original.doc,original.binary,expected),skip=new Set(repair.triangle_indices),kept=before.filter((_,i)=>!skip.has(Math.floor(i/3)));
  assert.deepEqual(indices(detail.doc,detail.binary,actual),kept,'Only reviewed internal-cap triangle indices removed; exterior ordering unchanged');expected.indices=actual.indices;
 }
 if(info.compatibility?.skylab_planar_caps){
  const r=info.compatibility.skylab_planar_caps;assert.equal(r.mesh,0);assert.equal(r.primitive,0);assert.equal(r.planes.length,4);assert.equal(r.preserved_side_triangles,152);expectedMeshes[0].primitives[0]=meshes[0].primitives[0];
 }
 if(info.compatibility?.solar_partition){
  const fragments=new Map();
  function triangles(g,binary,p){const a=g.accessors[p.indices],v=g.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0),size=a.componentType===5125?4:2,values=[];for(let i=0;i<a.count;i+=3)values.push([0,1,2].map(k=>size===4?binary.readUInt32LE(offset+(i+k)*4):binary.readUInt16LE(offset+(i+k)*2)).join(','));return values;}
  for(const mesh of meshes)for(const p of mesh.primitives){const pi=p.extras.atlasOriginalPrimitive,expected=expectedMeshes[0].primitives[pi];assert.deepEqual(p.attributes,expected.attributes);assert.equal(p.material,expected.material);if(!fragments.has(pi))fragments.set(pi,[]);fragments.get(pi).push(...triangles(detail.doc,detail.binary,p));}
  for(let pi=0;pi<expectedMeshes[0].primitives.length;pi++)assert.deepEqual(fragments.get(pi).sort(),triangles(original.doc,original.binary,expectedMeshes[0].primitives[pi]).sort(),'Rig keeps every original triangle, material and UV assignment exactly once');
 }else assert.deepEqual(meshes,expectedMeshes);const expectedMaterials=structuredClone(original.doc.materials||info.compatibility?.added_materials);for(const material of expectedMaterials){const finish=info.material_finishes?.[material.name];if(finish)Object.assign(material.pbrMetallicRoughness,finish);}for(const material of expectedMaterials){const mode=info.compatibility?.material_modes?.[material.name];if(mode){material.alphaMode=mode;if(mode==='MASK')material.alphaCutoff=.5;}}
 for(const material of expectedMaterials)if(info.compatibility?.normal_map_scales?.[material.name]!==undefined)material.normalTexture.scale=info.compatibility.normal_map_scales[material.name];
 for(const material of expectedMaterials){const override=info.compatibility?.material_specular?.[material.name];if(override)Object.assign(material.extensions.KHR_materials_specular,override);}
 assert.deepEqual(detail.doc.materials,expectedMaterials);
 if(!info.compatibility?.png_images){assert.deepEqual(detail.doc.images,original.doc.images);assert.deepEqual(detail.binary.subarray(0,original.binary.length),original.binary,'Mesh compression, textures and original vertex data remain intact');}
 else{const originals=original.doc.images.filter(image=>image.mimeType==='image/png');assert.equal(detail.doc.images.length,originals.length);for(let i=0;i<originals.length;i++){const av=original.doc.bufferViews[originals[i].bufferView],bv=detail.doc.bufferViews[detail.doc.images[i].bufferView];assert.deepEqual(detail.binary.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength),original.binary.subarray(av.byteOffset||0,(av.byteOffset||0)+av.byteLength),'Original lossless PNG texture retained byte for byte');}}
 assert.ok(detail.doc.meshes.some(m=>m.primitives.some(p=>p.attributes.COLOR_0!==undefined))||detail.doc.materials.some(m=>m.pbrMetallicRoughness?.baseColorFactor?.some((x,i)=>i<3&&x<.9)||m.pbrMetallicRoughness?.baseColorTexture));
}
const ctx={window:{},document:{currentScript:{src:'http://localhost/detailed-models.js'}},URL,Map,Math,AbortController,fetch(){throw Error('No download before explicit request');}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('static/detailed-models.js','utf8'),ctx);const api=ctx.window.AtlasDetailed;
(async()=>{
 for(const info of manifest)for(const id of info.ids)assert.equal(api.has(id),true,info.key+' is selectable without preloading');
 assert.equal(api.has(20580),true);assert.equal(api.has(25544),true);assert.equal(api.has(48274),true);assert.equal(api.has(49954),false,'Do not advertise a schematic as a detailed official model');assert.equal(api.has(37820),true,'Tiangong-1 has its own reconstructed model');assert.equal(api.has(41765),true,'Tiangong-2 has its own reconstructed model');
 let requests=[],values=[];const state=api.controller({load:(id,signal,progress)=>new Promise((resolve,reject)=>requests.push({id,signal,progress,resolve,reject})),progress:value=>values.push(value)});
 state.select(20580);assert.equal(requests.length,0);const first=state.toggle(true);assert.equal(requests.length,1);assert.equal(state.loading,true);assert.equal(state.enabled,true);
 requests[0].progress(-100);requests[0].progress(999);assert.ok(values.every(n=>n>=0&&n<=100));requests[0].resolve({id:20580});await first;assert.equal(state.model.id,20580);assert.equal(state.loading,false);assert.equal(values.at(-1),100);
 await state.toggle(false);assert.equal(state.model,null);assert.equal(state.loading,false);await state.toggle(true);assert.equal(requests.length,1,'Detailed model is reused when rechecked');
 state.select(43435);const cancelled=state.toggle(true);assert.equal(state.loading,true);await state.toggle(false);assert.equal(state.enabled,false,'Unchecking restores wireframe immediately');assert.equal(requests[1].signal.aborted,true);requests[1].reject(Object.assign(Error('aborted'),{name:'AbortError'}));await cancelled;assert.equal(state.error,'');
 const stale=state.toggle(true);state.select(25544);requests[2].resolve({id:43435});await stale;assert.equal(state.target,25544);assert.equal(state.enabled,false,'Late completion cannot replace another object');
 const failed=state.toggle(true);requests[3].reject(Error('HTTP 500'));await failed;assert.equal(state.loading,false);assert.equal(state.enabled,false);assert.ok(state.error);
 const freed=[];const bounded=api.controller({load:async id=>({id}),dispose:(id,model)=>freed.push(model.id)});bounded.select(20580);await bounded.toggle(true);await bounded.toggle(false);await bounded.toggle(true);assert.equal(freed.length,0,'Rechecking the current target reuses its model');bounded.select(43435);assert.deepEqual(freed,[20580],'Changing target releases the old HD model');await bounded.toggle(true);bounded.select(null);assert.deepEqual(freed,[20580,43435],'Returning to the overview releases HD memory');
 const html=fs.readFileSync('static/index.html','utf8'),globe=fs.readFileSync('static/globe.js','utf8');assert.ok(!html.includes('id="ground-link-toggle"'));assert.match(html,/data-orbit-toggle checked>Afficher l’orbite et le trait au sol/);assert.match(fs.readFileSync('static/app.js','utf8'),/orbits:showOrbit,groundLink:showOrbit/);assert.match(globe,/heightLine.positions=data.groundLink!==false\?/);assert.match(globe,/if\(heightLine.positions.length\)/);assert.match(globe,/scienceLayer.suppress\(p.id\)/);
 console.log('Détail : modèles NASA et Tiangong sous CC BY, surfaces et textures intactes, aucun préchargement, progression bornée, cache, annulation, erreur et réponse tardive OK ; trait au sol indépendant.');
})().catch(e=>{console.error(e);process.exitCode=1;});
const high=Object.fromEntries(manifest.map(m=>[m.key,m]));
assert.ok(high.iss.triangles>2700000&&high.iss.textures>=110);assert.ok(high.hubble.triangles>20000&&high.hubble.textures>=10);assert.ok(high.tess.textures>=6);
const environment=fs.readFileSync('static/images/detailed/environment.ktx2');assert.equal(environment.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');
assert.match(fs.readFileSync('static/detailed-models.js','utf8'),/specularEnvironmentMaps:new URL/);
console.log('Qualité : ISS IGOAL complet, textures PNG et maillages sources préservés, Hubble VTAD et TESS texturés, reflets IBL locaux.');

assert.ok(high.tiangong.triangles>80000&&high.tiangong.materials>=16);
assert.equal(high.tiangong.triangles,glb(high.tiangong.original_file).doc.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+glb(high.tiangong.original_file).doc.accessors[p.indices].count/3,0),0)-(high.tiangong.compatibility.removed_internal_faces||[]).reduce((sum,r)=>sum+r.triangle_indices.length,0),'Only duplicate internal faces reduce the original triangle count');assert.match(high.tiangong.credit,/Atlas/);assert.ok(high.tiangong.textures>=6);assert.deepEqual(high.tiangong.body_axes,[[1,0,0],[0,1,0],[0,0,1]]);

for(const [key,source] of Object.entries(JSON.parse(fs.readFileSync('resources/detailed-model-sources.json'))))if(source.enabled===false)assert.ok(!JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')).some(row=>row.key===key),'Rejected HD model cannot return: '+key);
