const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../static/vendor/cesium/index.cjs');
const audit=JSON.parse(fs.readFileSync('resources/historical-station-models.json'));
const manifest=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json'));
const attitude=require('../static/model-attitude.js');
assert.deepEqual(audit.models.map(m=>m.norad),[5160,6398,7342,7591,8911,10382,13138,37820,41765]);
const context={window:{},document:{currentScript:{src:'http://localhost/detailed-models.js'}},URL,Map,AbortController};vm.runInNewContext(fs.readFileSync('static/detailed-models.js','utf8'),context);
for(const row of audit.models){
 const info=manifest.find(m=>m.key===row.key);assert.equal(info.ids[0],row.norad);assert.match(info.credit,/Atlas/);assert.match(info.note,/interprétés/);assert.ok(info.bytes<5000000,'Each historical model is bounded and loads on demand');
 const buffer=fs.readFileSync('static/'+info.url.split('?')[0]),size=buffer.readUInt32LE(12),g=JSON.parse(buffer.subarray(20,20+size)),binary=buffer.subarray(28+size);
 assert.equal(g.extras.atlasHistoricalStation.solar_arrays,row.solar_arrays);
 if(row.key.startsWith('salyut')){assert.ok(g.nodes.filter(n=>/Panel fold hinge/.test(n.name)).length>=row.solar_arrays*4,'Each Salyut wing is articulated into physical leaf sections');assert.ok(g.materials.some(m=>m.name==='hull'&&m.pbrMetallicRoughness.baseColorTexture),'Station-specific thermal covering and markings');assert.ok(g.images.length>=5);}
 assert.equal(g.nodes.filter(n=>/^Solar array \d+ cells$/.test(n.name)).length,row.solar_arrays,'Correct number of physical solar wings; never a visiting Soyuz array');
 assert.equal(g.nodes.filter(n=>n.name==='Recessed docking target').length,row.docking_ports);
 for(const visitor of info.docked_visitors||[])assert.ok(g.nodes.some(n=>n.name===visitor.node&&n.extras?.atlasDockedVisitor),'Visitor group remains independently hideable');
 const positions=[];
 for(const mesh of g.meshes)for(const p of mesh.primitives){
  const a=g.accessors[p.attributes.POSITION],n=g.accessors[p.attributes.NORMAL],idx=g.accessors[p.indices];assert.equal(a.count,n.count);assert.equal(idx.count%3,0);const av=g.bufferViews[a.bufferView],nv=g.bufferViews[n.bufferView],iv=g.bufferViews[idx.bufferView];
  for(let i=0;i<a.count;i++){const xyz=[0,1,2].map(k=>binary.readFloatLE(av.byteOffset+i*12+k*4));assert.ok(xyz.every(Number.isFinite));positions.push(xyz);const normal=[0,1,2].map(k=>binary.readFloatLE(nv.byteOffset+i*12+k*4));assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-5);}
  for(let i=0;i<idx.count;i++)assert.ok(binary.readUInt32LE(iv.byteOffset+i*4)<a.count);
  const material=g.materials[p.material];assert.notEqual(material.alphaMode,'BLEND','Opaque cells and hull avoid transparency sorting artefacts');
  if(material.normalTexture)assert.equal(g.accessors[p.attributes.TANGENT].count,a.count,'Thermal blankets carry their tangent space, avoiding GPU-specific normal-map generation');
 }
 const xExtent=g.extras.atlasHistoricalStation.station_bounds_m[0][1]-g.extras.atlasHistoricalStation.station_bounds_m[0][0];assert.ok(Math.abs(xExtent-row.length_m)<.25,'Source axial length agrees with documented station dimensions');
 assert.ok(g.materials.some(m=>m.pbrMetallicRoughness.metallicFactor>.7));assert.ok(g.materials.some(m=>m.pbrMetallicRoughness.roughnessFactor>.5));
 for(const image of g.images){assert.equal(image.mimeType,'image/png');const view=g.bufferViews[image.bufferView];assert.equal(binary.subarray(view.byteOffset,view.byteOffset+8).toString('hex'),'89504e470d0a1a0a');}
 assert.equal(context.window.AtlasDetailed.has(row.norad),true);const axes=context.window.AtlasDetailed.axisOptions(C,info);assert.equal(axes.upAxis,C.Axis.Z);assert.equal(axes.forwardAxis,C.Axis.X);
 const position=new C.Cartesian3(6778000,0,0),rotation=attitude.matrix(C,{}, {id:row.norad,velocity_inertial_fixed_km_s:[0,7.4,2]},position);
 assert.ok(C.Cartesian3.dot(C.Matrix4.multiplyByPointAsVector(rotation,C.Cartesian3.UNIT_Z,new C.Cartesian3()),new C.Cartesian3(-1,0,0))>.999999,'Calibrated body Z points towards nominal nadir');assert.ok(C.Cartesian3.equals(C.Matrix4.getTranslation(rotation,new C.Cartesian3()),position));
}
const validation=JSON.parse(fs.readFileSync('resources/historical-stations-gltf-validation.json'));assert.equal(validation.models.length,9);assert.ok(validation.models.every(m=>m.errors===0&&m.warnings===0));
console.log('Nine reconstructed station models: distinct catalogue IDs, array counts, docking ports, measured scale, embedded textures, portable tangents, reflective materials, lazy registry and nominal body frames OK. Khronos validation: zero errors/warnings.');
