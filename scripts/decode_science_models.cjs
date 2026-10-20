/* Optional build preparation only: node scripts/decode_science_models.cjs /path/to/draco3dgltf */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../resources/science-originals');
(async()=>{const draco=await require(process.argv[2]||'draco3dgltf').createDecoderModule({});
for(const filename of fs.readdirSync(root).filter(name=>name.endsWith('.glb'))){
 const raw=fs.readFileSync(path.join(root,filename));let pos=12,document,bin;
 while(pos<raw.length){const size=raw.readUInt32LE(pos),type=raw.readUInt32LE(pos+4);pos+=8;const chunk=raw.subarray(pos,pos+size);pos+=size;if(type===0x4e4f534a)document=JSON.parse(chunk.toString());if(type===0x004e4942)bin=chunk;}
 const meshes=[];
 for(const source of document.meshes){const primitives=[];
 for(const p of source.primitives){const ext=p.extensions?.KHR_draco_mesh_compression;if(!ext)throw Error('Expected pinned Draco input');const view=document.bufferViews[ext.bufferView],bytes=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),mesh=new draco.Mesh();
  try{buffer.Init(new Int8Array(bytes),bytes.length);const status=decoder.DecodeBufferToMesh(buffer,mesh);if(!status.ok())throw Error(status.error_msg());
   const attr=decoder.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),values=new draco.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(mesh,attr,values);const positions=[];for(let i=0;i<mesh.num_points();i++)positions.push([0,1,2].map(k=>values.GetValue(3*i+k)));draco.destroy(values);
   const face=new draco.DracoInt32Array(),indices=[];for(let i=0;i<mesh.num_faces();i++){decoder.GetFaceFromMesh(mesh,i,face);for(let k=0;k<3;k++)indices.push(face.GetValue(k));}draco.destroy(face);primitives.push({positions,indices});
  }finally{draco.destroy(mesh);draco.destroy(buffer);draco.destroy(decoder);}
 }meshes.push({primitives});}
 const result={sha256:crypto.createHash('sha256').update(raw).digest('hex'),nodes:document.nodes,scenes:document.scenes,scene:document.scene||0,meshes};
 fs.writeFileSync(path.join(root,filename.replace('.glb','.mesh.json.gz')),zlib.gzipSync(JSON.stringify(result),{level:9}));console.log(filename,'decoded');
}
})().catch(error=>{console.error(error);process.exitCode=1;});
