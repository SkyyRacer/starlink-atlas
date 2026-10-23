const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../static/vendor/cesium/index.cjs'),context={window:{},document:{currentScript:{src:'http://localhost/moon.js'}},URL};
vm.runInNewContext(fs.readFileSync('static/moon.js','utf8'),context);
const map=JSON.parse(fs.readFileSync('static/images/moon/map-names.json')),radius=C.Ellipsoid.MOON.maximumRadius+150;
const geometry=context.window.AtlasMoon.mapGeometry(C,map,radius),p=geometry.attributes.position.values,st=geometry.attributes.st.values,indices=geometry.indices;
let base=0;
for(const f of map.features){
 const nx=Math.max(2,Math.ceil(f.width/.015)),ny=Math.max(2,Math.ceil(f.height/.015));
 const center=C.Cartesian3.normalize(C.Cartesian3.fromDegrees(f.lon,f.lat,0,C.Ellipsoid.MOON),new C.Cartesian3());
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
  const id=base+j*(nx+1)+i,point=C.Cartesian3.fromArray(p,id*3);
  assert.ok(Math.abs(C.Cartesian3.magnitude(point)-radius)<1e-6,'Every label vertex follows the spherical surface');
  assert.ok(C.Cartesian3.dot(center,point)>radius*.9,'No vertex crosses to another hemisphere at a pole or longitude seam');
  assert.ok(Math.abs(st[id*2]-(f.rect[0]+i/nx*f.rect[2])/map.width)<6e-8);
  assert.ok(Math.abs(st[id*2+1]-(1-(f.rect[1]+j/ny*f.rect[3])/map.height))<6e-8,'Text UVs remain regular at the poles');
 }
 base+=(nx+1)*(ny+1);
}
for(let t=0;t<indices.length;t+=3){
 const a=C.Cartesian3.fromArray(p,indices[t]*3),b=C.Cartesian3.fromArray(p,indices[t+1]*3),c=C.Cartesian3.fromArray(p,indices[t+2]*3);
 const normal=C.Cartesian3.cross(C.Cartesian3.subtract(b,a,new C.Cartesian3()),C.Cartesian3.subtract(c,a,new C.Cartesian3()),new C.Cartesian3());
 assert.ok(C.Cartesian3.dot(normal,a)>0,'Every triangle faces outward; no folds at the poles');
}
for(const feature of [{name:'north pole',lon:0,lat:90},{name:'south pole',lon:359.99,lat:-90},{name:'seam',lon:0,lat:0}]){
 const g=context.window.AtlasMoon.mapGeometry(C,{width:2048,height:2048,features:[{...feature,width:.12,height:.04,rect:[8,8,300,100]}]},radius);
 assert.ok([...g.attributes.position.values].every(Number.isFinite));
 const u=g.attributes.st.values;assert.ok(Math.max(...u)-Math.min(...u)<1,'No longitude wrap in text coordinates');
}
const lunarSource=fs.readFileSync('static/moon.js','utf8'),shader=[...lunarSource.matchAll(/source:`([\s\S]*?)`/g)][1][1];
assert.doesNotMatch(shader,/atan|asin|inverseNormal/,'Text no longer samples a singular global projection');
const material=new C.Material({fabric:{type:'LunarPatchProjectionTest',uniforms:{image:C.Material.DefaultImageId,namesEnabled:1,cartographicDetail:2,shadowEnabled:0},source:shader},translucent:true});
const combined=new C.ShaderSource({sources:[material.shaderSource,C.MaterialAppearance.MaterialSupport.TEXTURED.fragmentShaderSource]});assert.ok(combined.createCombinedFragmentShader({webgl2:true}).includes('void main()'));
if(process.env.ATLAS_EXPORT_LUNAR_MESH)fs.writeFileSync('/private/tmp/lunar-label-mesh.json',JSON.stringify({positions:Array.from(p),st:Array.from(st),indices:Array.from(indices)}));
console.log(`Lunar map: ${map.features.length} names, ${p.length/3} vertices, ${indices.length/3} outward triangles; poles, longitude seam, UVs and Cesium shader assembly OK.`);
