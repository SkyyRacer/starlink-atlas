"""Convert pinned CC BY 4.0 Mir CMOD into an embedded glTF 2.0 source.
Independent reader for the documented Celestia binary format; no Celestia code copied.
Positions, normals and triangle indices are retained; OpenGL UV V is flipped for glTF.
Phong shininess is approximated by PBR roughness; original material values stay in extras.
"""
import collections,hashlib,json,math,pathlib,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'resources/model-research-2026-10-24/mir-source'
AUDIT=ROOT/'resources/model-research-2026-10-24/mir-source-audit.json'
OUTPUT=ROOT/'resources/detailed-originals/mir-celestia.glb'
CREDIT='Mir © 2025 DaveBowman2001 · CC BY 4.0 · conversion GLB Atlas'
class Reader:
 def __init__(self,raw):
  assert raw[:16]==b'#celmodel_binary';self.raw=raw;self.at=16
 def read(self,fmt):
  size=struct.calcsize('<'+fmt);v=struct.unpack_from('<'+fmt,self.raw,self.at);self.at+=size;return v[0] if len(v)==1 else v
 def take(self,count):
  assert self.at+count<=len(self.raw);raw=self.raw[self.at:self.at+count];self.at+=count;return raw
 def value(self):
  kind=self.read('h')
  if kind in [1,2,3,4,7]:return self.read('f'*(3 if kind==7 else kind))
  if kind==5:return self.take(self.read('H')).decode('utf-8')
  if kind==6:return self.read('I')
  raise ValueError('Unsupported CMOD value '+str(kind))
def parse(raw):
 r=Reader(raw);materials=[];meshes=[]
 while r.at<len(raw):
  token=r.read('h')
  if token==1001:
   mat={'diffuse':[0,0,0],'specular':[0,0,0],'emissive':[0,0,0],'shininess':1,'opacity':1,'blend':0,'maps':{}}
   while True:
    token=r.read('h')
    if token==1002:break
    if token==1015:mat['blend']=r.read('h')
    elif token==1007:
     semantic=r.read('h');mat['maps'][semantic]=r.value()
    else:mat[{1003:'diffuse',1004:'specular',1005:'shininess',1006:'opacity',1014:'emissive'}[token]]=r.value()
   materials.append(mat)
  elif token==1009:
   assert r.read('h')==1011;attrs=[];stride=0
   while True:
    sem=r.read('h')
    if sem==1012:break
    fmt=r.read('h');attrs.append((sem,fmt,stride));stride+=[4,8,12,16,4][fmt]
   assert r.read('h')==1013;count=r.read('I');data=r.take(count*stride);groups=[]
   while True:
    mode=r.read('h')
    if mode==1010:break
    assert mode==0,'Pinned Mir uses triangle lists only'
    mat,size=r.read('II');indices=r.take(size*4);assert size%3==0
    assert all(v[0]<count for v in struct.iter_unpack('<I',indices))
    groups.append({'material':mat,'count':size,'indices':indices})
   meshes.append({'attributes':attrs,'count':count,'stride':stride,'vertices':data,'groups':groups})
  else:raise ValueError('Unsupported CMOD block '+str(token))
 return materials,meshes

def build():
 audit=json.loads(AUDIT.read_text())
 for entry in audit['files']:
  path=SOURCE/entry['path'].split('extras-standard/mir/')[1];assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
  if path.suffix=='.license':assert 'CC-BY-4.0' in path.read_text()
 source=(SOURCE/'models/mir.cmod').read_bytes();materials,meshes=parse(source)
 doc={'asset':{'version':'2.0','generator':'Atlas CMOD conversion','copyright':CREDIT},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Mir · configuration complète après Priroda (1996)','mesh':0}],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'extensionsUsed':['KHR_materials_specular'],'extras':{'source_sha256':hashlib.sha256(source).hexdigest(),'license':'https://creativecommons.org/licenses/by/4.0/','source_revision':audit['revision'],'adaptation':'UV V inverted for glTF; Phong to PBR material approximation; original geometry and texture bytes retained'}}
 binary=bytearray()
 def view(raw,target=None):
  binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(raw);v={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
  if target:v['target']=target
  doc['bufferViews'].append(v);return len(doc['bufferViews'])-1
 def accessor(raw,kind,count,ctype=5126,low=None,high=None):
  a={'bufferView':view(raw,34963 if kind=='SCALAR' else 34962),'componentType':ctype,'count':count,'type':kind}
  if low is not None:a.update(min=low,max=high)
  doc['accessors'].append(a);return len(doc['accessors'])-1
 textures={}
 for mat in materials:
  for semantic,name in mat['maps'].items():
   assert semantic==0,'Unexpected non-diffuse map in pinned source'
   if name in textures:continue
   image=(SOURCE/'textures/medres'/name).read_bytes();index=len(doc['images']);doc['images'].append({'name':name,'mimeType':'image/png','bufferView':view(image)});doc['textures'].append({'source':index,'sampler':0});textures[name]=index
 for index,mat in enumerate(materials):
  assert mat['blend']==0,'Additive source requires explicit conversion'
  opacity=max(0,min(1,mat['opacity']));pbr={'baseColorFactor':[*mat['diffuse'],opacity],'metallicFactor':0,'roughnessFactor':max(.04,min(1,math.sqrt(2/(max(0,mat['shininess'])+2))))}
  if 0 in mat['maps']:pbr['baseColorTexture']={'index':textures[mat['maps'][0]]}
  # Presentation finish for the existing environment reflections; source colors/maps stay intact.
  name=mat['maps'].get(0,'')
  if name=='chrome.png':pbr.update(metallicFactor=.85,roughnessFactor=.22)
  elif name=='paneliss3.png':pbr.update(metallicFactor=.25,roughnessFactor=.27)
  elif name=='metallwhite.png':pbr.update(metallicFactor=.35,roughnessFactor=.38)
  elif max(mat['diffuse'])>.3 and mat['shininess']>=50:pbr.update(metallicFactor=.3,roughnessFactor=max(.3,pbr['roughnessFactor']))
  else:pbr['roughnessFactor']=max(.3,pbr['roughnessFactor'])
  result={'name':'Mir material '+str(index),'pbrMetallicRoughness':pbr,'emissiveFactor':list(mat['emissive']),'extensions':{'KHR_materials_specular':{'specularFactor':1,'specularColorFactor':list(mat['specular'])}},'extras':{'celestia':mat}}
  if opacity<1:result['alphaMode']='BLEND'
  doc['materials'].append(result)
 positions=bytearray();normals=bytearray();uvs=bytearray();groups=collections.defaultdict(bytearray);offset=0;low=[math.inf]*3;high=[-math.inf]*3;source_groups=0
 for mesh in meshes:
  attrs={sem:(fmt,pos) for sem,fmt,pos in mesh['attributes']};assert set(attrs)=={0,3,5};assert attrs[0][0]==attrs[3][0]==2 and attrs[5][0]==1
  for i in range(mesh['count']):
   start=i*mesh['stride'];p=struct.unpack_from('<3f',mesh['vertices'],start+attrs[0][1]);n=struct.unpack_from('<3f',mesh['vertices'],start+attrs[3][1]);u,v=struct.unpack_from('<2f',mesh['vertices'],start+attrs[5][1]);assert all(math.isfinite(x) for x in (*p,*n,u,v))
   positions.extend(struct.pack('<3f',*p));normals.extend(struct.pack('<3f',*n));uvs.extend(struct.pack('<2f',u,1-v))
   low=[min(a,b) for a,b in zip(low,p)];high=[max(a,b) for a,b in zip(high,p)]
  for group in mesh['groups']:
   assert group['material']<len(materials)
   groups[group['material']].extend(b''.join(struct.pack('<I',x[0]+offset) for x in struct.iter_unpack('<I',group['indices'])));source_groups+=1
  offset+=mesh['count']
 attributes={'POSITION':accessor(positions,'VEC3',offset,low=low,high=high),'NORMAL':accessor(normals,'VEC3',offset),'TEXCOORD_0':accessor(uvs,'VEC2',offset)}
 primitives=[]
 for material,indices in sorted(groups.items()):primitives.append({'attributes':attributes.copy(),'indices':accessor(indices,'SCALAR',len(indices)//4,5125),'material':material,'mode':4})
 doc['meshes'].append({'name':'Mir surfaces originales','primitives':primitives});binary.extend(b'\0'*(-len(binary)%4));doc['buffers']=[{'byteLength':len(binary)}]
 encoded=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary;OUTPUT.write_bytes(blob)
 summary={'source_sha256':hashlib.sha256(source).hexdigest(),'glb_sha256':hashlib.sha256(blob).hexdigest(),'vertices':offset,'triangles':sum(len(x)//12 for x in groups.values()),'source_meshes':len(meshes),'source_primitive_groups':source_groups,'runtime_primitives':len(primitives),'materials':len(materials),'textures':len(textures),'bytes':len(blob),'bounds':[low,high],'uv_conversion':'(u, 1-v)','geometry':'positions, normals, triangle order and material assignments preserved; groups combined by material','material_conversion':'Phong to PBR with Atlas presentation finish: chrome .85/.22, solar panels .25/.27, white metal .35/.38 metallic/roughness; source color, emissive, specular and texture pixels retained; opacity clamped to [0,1]'}
 (ROOT/'resources/mir-conversion-audit.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':build()
