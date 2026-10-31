"""Reviewed one-axis rigs for historical detailed models; source buffers retained.
Joint pivots are calibrated to the authored mesh, not historical motor telemetry.
Mir: TM-106940 (fixed dorsal array), Mir-24 reports (four Spektr arrays).
Salyut: NASA RP-1357, Part 2. Salyut 1 and Skylab have no tracking hinges.
"""
import copy,json,math,struct
from build_science_models import identity,product,node_matrix,transform,cross,unit

def columns(m):return [m[i][j] for j in range(4) for i in range(4)]
def rigid_inverse(m):
 out=identity()
 for i in range(3):
  for j in range(3):out[i][j]=m[j][i]
  out[i][3]=-sum(out[i][j]*m[j][3] for j in range(3))
 return out

def apply(doc,binary,key):
 if key not in {'mir','salyut-2','salyut-3','salyut-4','salyut-5','salyut-6','salyut-7'}:return binary,[],{}
 if any(n.get('name','').startswith('Atlas solar hinge ') for n in doc['nodes']):raise ValueError('Rig must start from an unanimated source')
 worlds={};parents={}
 def visit(i,parent):
  worlds[i]=product(parent,node_matrix(doc['nodes'][i]))
  for child in doc['nodes'][i].get('children',[]):parents[child]=i;visit(child,worlds[i])
 for i in doc['scenes'][doc.get('scene',0)]['nodes']:visit(i,identity())
 rig=[];audit={'policy':'One-axis nominal Sun tracking; fixed panels and visiting craft never articulated. No measured historical motor telemetry.','wings':[]}
 def joint(name,children,parent,pivot,axis,normal):
  z=unit(axis);x=unit([normal[k]-sum(normal[j]*z[j] for j in range(3))*z[k] for k in range(3)]);y=cross(z,x);m=identity()
  for k in range(3):m[k][0]=x[k];m[k][1]=y[k];m[k][2]=z[k];m[k][3]=pivot[k]
  inv=rigid_inverse(m);holder=len(doc['nodes']);doc['nodes'].append({'name':name+' rest geometry','matrix':columns(inv),'children':children})
  idx=len(doc['nodes']);doc['nodes'].append({'name':name,'matrix':columns(m),'children':[holder]})
  target=doc['nodes'][parent]['children'];target[:]=[i for i in target if i not in children]+[idx]
  body=product(worlds[parent],m);bodyNormal=[sum(worlds[parent][k][j]*normal[j] for j in range(3)) for k in range(3)]
  # The authored deployed pose is the centre of a nominal 180-degree sweep.
  # Exact historical stop settings and parking commands are unavailable.
  rig.append({'name':name,'kind':'beta','base_matrix':columns(m),'body_from_joint':columns(body),'normal_body':unit(bodyNormal),'minimum_angle':-math.pi/2,'maximum_angle':math.pi/2})
  audit['wings'].append({'name':name,'pivot_source':pivot,'axis_source':axis,'children':children,'source_parent':parent})
 if key.startswith('salyut'):
  almaz=key in {'salyut-2','salyut-3','salyut-5'};angles=[0,math.pi] if almaz else [0,math.pi,-math.pi/2];x=-3.15 if almaz else 1.45;start=2.35 if almaz else 2.05
  for n,theta in enumerate(angles,1):
   a=next(i for i,node in enumerate(doc['nodes']) if node.get('name')==f'Array {n} drive')
   b=next(i for i,node in enumerate(doc['nodes']) if i>a and node.get('name')==f'Solar array {n} cells')
   parent=parents[a];children=[i for i in doc['nodes'][parent]['children'] if a<=i<=b]
   radial=[0,math.cos(theta),math.sin(theta)];normal=[0,-math.sin(theta),math.cos(theta)];front=-1 if normal[2]>0 else 1;normal=[v*front for v in normal]
   joint(f'Atlas solar hinge {key} {n}',children,parent,[x,start*radial[1],start*radial[2]],radial,normal)
  return binary,rig,audit
 # The original Celestia export batches by material. Partition complete panel
 # geometry into named wing meshes, retaining the original shared vertex buffers
 # and each triangle's exact indices, UVs, normal and material.
 blob=bytearray(binary)
 def array(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];dim={'SCALAR':1,'VEC3':3}[a['type']];typ={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];fmt='<'+typ*dim;stride=v.get('byteStride',struct.calcsize(fmt));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,blob,offset+j*stride) for j in range(a['count'])]
 definitions=[]
 for side in [-1,1]:
  definitions.extend([
   {'name':f'core {side}','pivot':[side*1.8,2.3,.037],'axis':[side,0,0],'normal':[0,0,1],'bounds':[(2.0,14.1),(.3,4.3),(-.25,.25)]},
   {'name':f'Kvant-1 {side}','pivot':[side*3.3,-7.02,0],'axis':[side,0,0],'normal':[0,0,1],'bounds':[(3.3,19.2),(-8.05,-5.3),(-1,1.6)]},
   {'name':f'Kvant-2 {side}','pivot':[side*2.35,5.94,8.17],'axis':[side,0,0],'normal':[0,1,0],'bounds':[(2.35,12.5),(4.7,7.15),(7.1,9.35)]},
   {'name':f'Spektr main {side}','pivot':[side*2.35,5.94,-7.3],'axis':[side,0,0],'normal':[0,1,0],'bounds':[(2.35,12.5),(4.7,7.15),(-8.5,-6.15)]},
   {'name':f'Spektr tip {side}','pivot':[side*.7,5.94,-9.85],'axis':[side*.9,0,-.43589],'normal':[0,1,0],'bounds':[(2.35,14.1),(5.5,6.3),(-16.7,-9.7)]}
  ])
 # Retain the core's dorsal wing, collapsed equipment and visitor arrays fixed.
 original=next(i for i,n in enumerate(doc['nodes']) if 'mesh' in n);mesh=doc['meshes'][doc['nodes'][original]['mesh']];primitives=mesh['primitives'];partition=[[] for _ in definitions];static=[];records=[]
 cache={}
 for pi,p in enumerate(primitives):
  posindex=p['attributes']['POSITION']
  if posindex not in cache:cache[posindex]=array(posindex)
  pos=cache[posindex];indices=[i[0] for i in array(p['indices'])];groups=[[] for _ in range(len(definitions)+1)]
  for j in range(0,len(indices),3):
   tri=indices[j:j+3];center=[sum(pos[i][k] for i in tri)/3 for k in range(3)];chosen=len(definitions)
   for di,d in enumerate(definitions):
    if center[0]*d['axis'][0]<=0:continue
    q=[abs(center[0]),center[1],center[2]]
    if all(lo<=v<=hi for v,(lo,hi) in zip(q,d['bounds'])):chosen=di;break
   groups[chosen].extend(tri)
  for di,values in enumerate(groups):
   if not values:continue
   blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);blob.extend(struct.pack('<'+str(len(values))+'I',*values));view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(values)*4,'target':34963});ai=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5125,'count':len(values),'type':'SCALAR'})
   primitive=copy.deepcopy(p);primitive['indices']=ai;primitive.setdefault('extras',{})['atlasOriginalPrimitive']=pi
   (static if di==len(definitions) else partition[di]).append(primitive)
 mesh['primitives']=static
 doc['nodes'][original].setdefault('children',[])
 for d,parts in zip(definitions,partition):
  assert parts,'Missing Mir wing '+d['name']
  mi=len(doc['meshes']);doc['meshes'].append({'name':'Mir solar wing '+d['name'],'primitives':parts});idx=len(doc['nodes']);doc['nodes'].append({'name':'Mir solar wing '+d['name'],'mesh':mi});doc['nodes'][original]['children'].append(idx)
  joint('Atlas solar hinge Mir '+d['name'],[idx],original,d['pivot'],d['axis'],d['normal'])
 doc['buffers'][0]['byteLength']=len(blob)
 audit['solar_partition']={'original_mesh':0,'original_primitives':len(primitives),'original_binary_bytes':len(binary),'geometry':'Original triangles partitioned without added, dropped or modified faces; original vertex/texture buffers unchanged.'}
 return bytes(blob),rig,audit
