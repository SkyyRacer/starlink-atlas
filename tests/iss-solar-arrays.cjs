const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('../static/vendor/cesium/index.cjs');
const read=path=>{const b=fs.readFileSync(path);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
const info=JSON.parse(fs.readFileSync('resources/detailed-model-manifest.json')).find(row=>row.key==='iss'),source=read(info.original_file),runtime=read('static/'+info.url.split('?')[0]);
function scene(doc){const result=new Map();function visit(index,parent){const node=doc.nodes[index],local=node.matrix?C.Matrix4.fromArray(node.matrix):C.Matrix4.fromTranslationQuaternionRotationScale(new C.Cartesian3(...(node.translation||[0,0,0])),new C.Quaternion(...(node.rotation||[0,0,0,1])),new C.Cartesian3(...(node.scale||[1,1,1])),new C.Matrix4()),matrix=C.Matrix4.multiply(parent,local,new C.Matrix4());result.set(node.name,{node,matrix,origin:C.Matrix4.getTranslation(matrix,new C.Cartesian3())});for(const child of node.children||[])visit(child,matrix);}for(const index of doc.scenes[doc.scene||0].nodes)visit(index,C.Matrix4.IDENTITY);return result;}
const original=scene(source),aligned=scene(runtime),placement=C.Matrix4.fromArray(runtime.nodes.find(node=>node.name==='Atlas presentation transform').matrix),joints=info.compatibility.solar_alignment;
assert.equal(joints.length,8);const changed=new Set(joints.map(row=>row.joint));
for(const joint of joints){
 const plane=aligned.get(joint.plane_node),normal=C.Cartesian3.normalize(C.Matrix4.getColumn(plane.matrix,joint.normal_axis,new C.Cartesian4()),new C.Cartesian3());
 assert.ok(C.Cartesian3.dot(normal,new C.Cartesian3(0,0,-1))>.99999,'Every deployed solar wing has the same zenith-facing plane');
 const expected=C.Matrix4.multiplyByPoint(placement,original.get(joint.joint).origin,new C.Cartesian3());
 assert.ok(C.Cartesian3.distance(expected,aligned.get(joint.joint).origin)<1e-5,'Solar wings rotate at their own joints, without moving their attachment');
 assert.ok(Math.abs(Math.abs(joint.angle_degrees)-90)<.001);
}
for(let i=0;i<source.nodes.length;i++){
 const expected=structuredClone(source.nodes[i]),actual=structuredClone(runtime.nodes[i]);
 if(changed.has(expected.name)){delete expected.rotation;delete actual.rotation;}
 assert.deepEqual(actual,expected,'Only the eight beta joint rotations change; Cupola, truss, radiators and iROSA mounts are retained');
}
console.log('ISS solar wings: eight aligned deployed planes, real articulation pivots preserved, Cupola and every other source node unchanged.');
