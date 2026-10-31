"""Reduce the ESA engineering mesh for interactive use while retaining all parts.
Requires numpy and fast-simplification (offline conversion only, no browser dependency).
"""
from pathlib import Path
import hashlib,json,struct
import numpy as np
import fast_simplification
ROOT=Path(__file__).resolve().parents[1];path=ROOT/'resources/detailed-originals/juice-esa.glb';raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);old=raw[28+size:]
new=bytearray();views=[];accessors=[]
def view(raw,target=None):
 new.extend(b'\0'*(-len(new)%4));v={'buffer':0,'byteOffset':len(new),'byteLength':len(raw)};new.extend(raw)
 if target:v['target']=target
 views.append(v);return len(views)-1
def arr(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];count={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];return np.frombuffer(old,dtype='<f4' if a['componentType']==5126 else '<u4',count=a['count']*count,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,count)
def accessor(a,kind):
 a=np.asarray(a,dtype='<u4' if kind=='SCALAR' else '<f4');doc={'bufferView':view(a.tobytes(),34963 if kind=='SCALAR' else 34962),'componentType':5125 if kind=='SCALAR' else 5126,'count':a.shape[0],'type':kind}
 if kind=='VEC3':doc.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
 accessors.append(doc);return len(accessors)-1
for image in g['images']:
 v=g['bufferViews'][image['bufferView']];image['bufferView']=view(old[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
audit=[]
for mesh in g['meshes']:
 for p in mesh['primitives']:
  positions,remap=np.unique(arr(p['attributes']['POSITION']),axis=0,return_inverse=True);faces=remap[arr(p['indices']).reshape(-1,3)];before=len(faces);limit=20000 if mesh['name']=='bus' else 3500 if mesh['name'] in ['sapy','samy'] else 5000 if mesh['name'] in ['mag','rimemx','rimepx'] else 2500
  if len(faces)>limit:positions,faces=fast_simplification.simplify(positions.astype(np.float64),faces.astype(np.int32),target_count=limit,agg=5)
  edges1=positions[faces[:,1]]-positions[faces[:,0]];edges2=positions[faces[:,2]]-positions[faces[:,0]];face_normals=np.cross(edges1,edges2);normals=np.zeros_like(positions)
  for i in range(3):np.add.at(normals,faces[:,i],face_normals)
  normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-20)
  p['attributes']={'POSITION':accessor(positions,'VEC3'),'NORMAL':accessor(normals,'VEC3')}
  if p['material']==2:p['attributes']['TEXCOORD_0']=accessor(positions[:,:2]/2.5,'VEC2')
  p['indices']=accessor(faces.reshape(-1,1),'SCALAR');audit.append({'part':mesh['name'],'before':before,'after':len(faces)})
g['bufferViews']=views;g['accessors']=accessors;new.extend(b'\0'*(-len(new)%4));g['buffers']=[{'byteLength':len(new)}];g['asset']['generator']+=' · mesh reduction';text=json.dumps(g,separators=(',',':')).encode();text+=b' '*(-len(text)%4);blob=struct.pack('<III',0x46546c67,2,28+len(text)+len(new))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(new),0x004e4942)+new;path.write_bytes(blob)
sha=hashlib.sha256(blob).hexdigest();p=ROOT/'resources/detailed-model-sources.json';sources=json.loads(p.read_text());sources['juice']['sha256']=sha;sources['juice']['note']='Géométrie ESA/Airbus simplifiée pour le navigateur ; assemblage des 31 composants, matériaux illustratifs Atlas, sans télémétrie d’attitude.';p.write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
(ROOT/'resources/juice-cad/optimization.json').write_text(json.dumps({'original_bytes':len(raw),'runtime_source_bytes':len(blob),'sha256':sha,'parts':audit},indent=2));print(len(raw),'→',len(blob),'bytes;',sum(e['after'] for e in audit),'triangles')
