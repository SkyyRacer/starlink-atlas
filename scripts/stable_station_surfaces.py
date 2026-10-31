"""Remove only opposing, coincident internal caps between assembled modules.
Keep all vertices, UVs, texture bytes and exterior triangles. Runtime index-only fix.
"""
import collections,math,struct
from build_science_models import identity,product,node_matrix,transform,cross,minus,dot

def remove_internal_caps(doc,binary):
 blob=bytearray(binary);world={}
 def visit(i,parent):
  n=doc['nodes'][i];world[i]=product(parent,node_matrix(n))
  for c in n.get('children',[]):visit(c,world[i])
 for i in doc['scenes'][doc.get('scene',0)]['nodes']:visit(i,identity())
 def array(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];d={'SCALAR':1,'VEC3':3}[a['type']];typ={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];fmt='<'+typ*d;stride=v.get('byteStride',struct.calcsize(fmt));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,blob,offset+j*stride) for j in range(a['count'])]
 seen={};removed=collections.defaultdict(set);primitives={}
 for ni,matrix in world.items():
  n=doc['nodes'][ni]
  if 'mesh' not in n:continue
  mi=n['mesh']
  for pi,p in enumerate(doc['meshes'][mi]['primitives']):
   if p.get('mode',4)!=4:continue
   positions=[transform(matrix,v) for v in array(p['attributes']['POSITION'])];indices=[x[0] for x in array(p['indices'])];primitives[(mi,pi)]=(p,indices)
   for j in range(0,len(indices),3):
    tri=[positions[i] for i in indices[j:j+3]];normal=cross(minus(tri[1],tri[0]),minus(tri[2],tri[0]));size=math.sqrt(dot(normal,normal))
    if size<1e-10:continue
    normal=[v/size for v in normal];key=tuple(sorted(tuple(round(v,5) for v in point) for point in tri));previous=seen.get(key)
    if previous and previous[:2]!=(mi,pi) and dot(previous[3],normal)<-.999999:
     removed[(mi,pi)].add(j//3);removed[previous[:2]].add(previous[2])
    else:seen[key]=(mi,pi,j//3,normal)
 report=[]
 for (mi,pi),faces in sorted(removed.items()):
  p,indices=primitives[(mi,pi)];values=[v for j in range(0,len(indices),3) if j//3 not in faces for v in indices[j:j+3]]
  assert values,'An entire external primitive must not disappear'
  blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);blob.extend(struct.pack('<'+str(len(values))+'I',*values));vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4,'target':34963});ai=len(doc['accessors']);doc['accessors'].append({'bufferView':vi,'componentType':5125,'count':len(values),'type':'SCALAR'});p['indices']=ai
  report.append({'mesh':mi,'primitive':pi,'triangle_indices':sorted(faces)})
 doc['buffers'][0]['byteLength']=len(blob)
 return bytes(blob),report
