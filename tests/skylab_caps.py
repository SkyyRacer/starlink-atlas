"""Verify cap coverage with independent point/convex-intersection checks."""
import gzip,json,math,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(file):
 b=(ROOT/file).read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
g,binary=read('static/images/detailed/skylab.glb');original,ob=read('resources/science-originals/skylab.glb');decoded=json.loads(gzip.decompress((ROOT/'resources/science-originals/skylab-surface.mesh.json.gz').read_bytes()));report=json.loads((ROOT/'resources/skylab-planar-cap-repair.json').read_text());p=g['meshes'][0]['primitives'][0]
assert binary[:len(ob)]==ob
assert g['meshes'][0]['primitives'][1:]==original['meshes'][0]['primitives'][1:]
assert g['materials'][0]['pbrMetallicRoughness']['baseColorFactor']==original['materials'][0]['pbrMetallicRoughness']['baseColorFactor']
def values(index,dim,fmt):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];stride=v.get('byteStride',4*dim);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*dim,binary,offset+i*stride) for i in range(a['count'])]
points=values(p['attributes']['POSITION'],3,'f');indices=[v[0] for v in values(p['indices'],1,'I')];old=decoded['attributes']['POSITION'];oi=decoded['indices']
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def area(poly):return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))/2 if len(poly)>2 else 0

def inside(p,t):
 d=[cross(a,b,p) for a,b in zip(t,t[1:]+t[:1])];return all(x>=-1e-8 for x in d) or all(x<=1e-8 for x in d)
def overlap(a,b):
 if cross(*b)<0:b=list(reversed(b))
 out=a[:]
 for q,r in zip(b,b[1:]+b[:1]):
  subject=out;out=[]
  if not subject:break
  prev=subject[-1];dp=cross(q,r,prev)
  for cur in subject:
   dc=cross(q,r,cur)
   if (dc>=0)!=(dp>=0):
    f=dp/(dp-dc);out.append([prev[0]+f*(cur[0]-prev[0]),prev[1]+f*(cur[1]-prev[1])])
   if dc>=0:out.append(cur)
   prev=cur;dp=dc
 return area(out)
for plane in report['planes']:
 x=plane['x']
 assert x in {point[0] for point in old}, 'Cap must use exact source plane, never a rounded offset'
 assert all(points[i][0]==x for i in indices[report['preserved_side_triangles']*3:] if abs(points[i][0]-x)<6e-5), 'Rebuilt cap vertices match the original bevel plane exactly'
 def planar(rows,ids):
  result=[]
  for j in range(0,len(ids),3):
   t=[rows[i] for i in ids[j:j+3]]
   if max(p[0] for p in t)-min(p[0] for p in t)<1e-5 and all(abs(p[0]-x)<6e-5 for p in t):
    tri=[list(p[1:]) for p in t]
    if area(tri)>1e-9:result.append(tri)
  return result
 before=planar(old,oi);after=planar(points,indices)
 conflicts=0.;largest=0
 for i,a in enumerate(after):
  for b in after[i+1:]:
   if any(max(p[k] for p in a)<=min(p[k] for p in b) or max(p[k] for p in b)<=min(p[k] for p in a) for k in [0,1]):continue
   amount=overlap(a,b);conflicts+=amount;largest=max(largest,amount)
 assert largest<2e-6,(x,'overlapping replacement faces',largest)
 assert conflicts<2e-5,(x,'overlapping coverage',conflicts)
 assert abs(sum(area(t) for t in after)-plane['union_area'])<2e-5
 # Independently sample occupied AND empty points across the entire plate.
 lo=[min(p[k] for t in before for p in t) for k in [0,1]];hi=[max(p[k] for t in before for p in t) for k in [0,1]]
 for i in range(63):
  for j in range(63):
   point=[lo[0]+(hi[0]-lo[0])*(i+.371)/63,lo[1]+(hi[1]-lo[1])*(j+.619)/63]
   assert any(inside(point,t) for t in before)==any(inside(point,t) for t in after),(x,'coverage or opening changed',point)
 print('Cap',x,': coverage/openings retained; overlapping area',round(conflicts,9),'m²')
print('Skylab: planar union has no visible-area double surfaces; untouched Draco parts, source buffers, colours and plate openings retained')
