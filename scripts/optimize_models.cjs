/* Rebuild browser-only GLBs. Source assets and official originals stay intact.
 * NODE_PATH=<tool dependencies> node scripts/optimize_models.cjs
 * Requires @gltf-transform/{core,extensions,functions}, meshoptimizer, sharp.
 * Generate a browser LOD; original resolution remains a separate explicit choice.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {NodeIO,PropertyType}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions'),{dedup,weld,meshopt,flatten,join,prune,simplify,textureCompress,getBounds}=require('@gltf-transform/functions'),sharp=require('sharp');
(async()=>{
 const {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier}=await import(require.resolve('meshoptimizer'));await MeshoptEncoder.ready;await MeshoptDecoder.ready;await MeshoptSimplifier.ready;
 const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'resources/detailed-model-manifest.json'))),out=path.join(root,'static/images/detailed/optimized');fs.mkdirSync(out,{recursive:true});
 const draco=await require('draco3dgltf').createDecoderModule();
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':draco,'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});const results=[];
 for(const info of manifest){if(process.argv[2]&&info.key!==process.argv[2])continue;
  const source=info.key==='iss'?path.join(root,'resources/detailed-originals/iss.glb'):path.join(root,'static/images/detailed',info.key+'.glb'),doc=await io.read(source),originalBytes=info.bytes;
  if(info.key==='iss'){const scene=doc.getRoot().getDefaultScene()||doc.getRoot().listScenes()[0],bounds=getBounds(scene),span=Math.max(...bounds.max.map((n,i)=>n-bounds.min[i])),s=100/span,center=bounds.max.map((n,i)=>(n+bounds.min[i])/2),c=Math.cos(-Math.PI/4),t=Math.sin(-Math.PI/4),children=scene.listChildren().slice();const parent=doc.createNode('Atlas normalized ISS B').setMatrix([s,0,0,0,0,s*c,s*t,0,0,-s*t,s*c,0,-center[0]*s,(-center[1]*c+center[2]*t)*s,(-center[1]*t-center[2]*c)*s,1]);for(const node of children)parent.addChild(node);scene.addChild(parent);}
  const triangleCount=d=>d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((k,p)=>k+(p.getMode()===4?(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3:0),0),0),triangles=triangleCount(doc);
  // Cesium uses COLOR_0 only; higher colour sets in the source are never rendered.
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives())for(const semantic of primitive.listSemantics())if(/^COLOR_[1-9]/.test(semantic))primitive.setAttribute(semantic,null);
  doc.getRoot().listExtensionsUsed().find(e=>e.extensionName==='KHR_draco_mesh_compression')?.dispose();
  await doc.transform(prune(),dedup({propertyTypes:[PropertyType.ACCESSOR,PropertyType.TEXTURE,PropertyType.MATERIAL]}),flatten(),join(),weld());
  if(triangles>150000&&info.key!=='iss')await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:info.key==='iss'?.12:.6,error:info.key==='iss'?.01:.0005}));
  const textureLimit=info.key==='iss'?512:1024;
  await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:90,resize:[textureLimit,textureLimit]}),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16,quantizeColor:12,quantizeWeight:16}));
  const target=path.join(out,info.key+'.glb');await io.write(target,doc);const decoded=await io.read(target);const runtimeTriangles=triangleCount(decoded);
  const blob=fs.readFileSync(target),hash=crypto.createHash('sha256').update(blob).digest('hex').slice(0,12);
  const smaller=blob.length<originalBytes;if(!smaller)fs.unlinkSync(target);
  results.push({key:info.key,runtime_url:smaller?'images/detailed/optimized/'+info.key+'.glb?v='+hash:info.url,runtime_bytes:smaller?blob.length:originalBytes,original_bytes:originalBytes,triangles:smaller?runtimeTriangles:info.triangles,original_triangles:info.triangles,runtime_credit:info.key==='iss'?'NASA 3D Resources · ISS B':info.credit,texture_limit:textureLimit,textures:decoded.getRoot().listTextures().length,compression:smaller?'meshopt-16-bit / WebP-90 / browser-LOD':'original'});
  console.log(info.key,originalBytes,'->',blob.length,'bytes; triangles',triangles,'->',runtimeTriangles);
 }
 const file=path.join(root,'resources/model-runtime-manifest.json'),previous=process.argv[2]&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];fs.writeFileSync(file,JSON.stringify([...previous.filter(row=>!results.some(r=>r.key===row.key)),...results],null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
