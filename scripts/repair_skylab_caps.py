"""Resolve self-overlapping NASA Skylab end caps, observed in supplied videos.
Exact planar triangle union by convex subtraction. No hull/convex approximation:
openings and concavities survive. Other 15 Draco primitives remain byte-identical.
"""
import gzip,hashlib,json,struct,math
from pathlib import Path

def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def signed_area(p):return sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(p,p[1:]+p[:1]))/2 if len(p)>2 else 0

def half_plane(poly,a,b,inside=True):
 if not poly:return []
 out=[];prev=poly[-1];dp=cross(a,b,prev)*(1 if inside else -1)
 for cur in poly:
  dc=cross(a,b,cur)*(1 if inside else -1)
  if (dc>=0)!=(dp>=0):
   t=dp/(dp-dc);out.append([prev[0]+t*(cur[0]-prev[0]),prev[1]+t*(cur[1]-prev[1])])
  if dc>=0:out.append(cur)
  prev=cur;dp=dc
 clean=[]
 for point in out:
  if not clean or math.dist(point,clean[-1])>1e-9:clean.append(point)
 if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-9:clean.pop()
 return clean if abs(signed_area(clean))>1e-10 else []

def subtract(poly,triangle):
 if signed_area(triangle)<0:triangle=list(reversed(triangle))
 if any(max(p[k] for p in poly)<=min(p[k] for p in triangle) or max(p[k] for p in triangle)<=min(p[k] for p in poly) for k in (0,1)):return [poly]
 remains=poly;outside=[]
 for a,b in zip(triangle,triangle[1:]+triangle[:1]):
  if not remains:break
  fragment=half_plane(remains,a,b,False)
  if fragment:outside.append(fragment)
  remains=half_plane(remains,a,b,True)
 return outside

def union_triangles(triangles):
 accepted=[];prior=[]
 for triangle in triangles:
  if abs(signed_area(triangle))<1e-9:continue
  if signed_area(triangle)<0:triangle=list(reversed(triangle))
  fragments=[triangle]
  for previous in prior:
   fragments=[part for fragment in fragments for part in subtract(fragment,previous)]
   if not fragments:break
  accepted.extend(fragments);prior.append(triangle)
 return accepted

def stitch_fragments(fragments):
 # Share numerically identical intersections and split T junctions. Adjacent
 # fragments must rasterize the same edge even at very close camera ranges.
 points={}
 for polygon in fragments:
  for point in polygon:points.setdefault(tuple(round(v,7) for v in point),point)
 vertices=list(points.values());result=[]
 for polygon in fragments:
  outline=[]
  for a,b in zip(polygon,polygon[1:]+polygon[:1]):
   a=points[tuple(round(v,7) for v in a)];b=points[tuple(round(v,7) for v in b)];dx=b[0]-a[0];dy=b[1]-a[1];squared=dx*dx+dy*dy
   if squared<1e-16:continue
   along=[(0,a)]
   for point in vertices:
    t=((point[0]-a[0])*dx+(point[1]-a[1])*dy)/squared
    if 1e-8<t<1-1e-8 and abs(cross(a,b,point))<1e-8*math.sqrt(squared):along.append((t,point))
   outline.extend(point for _,point in sorted(along,key=lambda v:v[0]))
  if abs(signed_area(outline))>1e-10:result.append(outline)
 return result

def repair(root,doc,binary,source):
 original=root/source['file'];decoded=json.loads(gzip.decompress((root/'resources/science-originals/skylab-surface.mesh.json.gz').read_bytes()));assert decoded['sha256']==hashlib.sha256(original.read_bytes()).hexdigest()==source['sha256']
 primitive=doc['meshes'][0]['primitives'][0];assert 'KHR_draco_mesh_compression' in primitive.get('extensions',{}),'Start with original, unpatched Skylab primitive'
 attributes=decoded['attributes'];positions=attributes['POSITION'];oldindices=decoded['indices'];planes=[(16.8546,-1),(17.196,1),(-19.1292,-1),(-18.8388,1)];groups=[[] for _ in planes];exact_planes={};retained=[]
 for j in range(0,len(oldindices),3):
  tri=[positions[i] for i in oldindices[j:j+3]];group=next((k for k,(x,_) in enumerate(planes) if max(p[0] for p in tri)-min(p[0] for p in tri)<1e-5 and all(abs(p[0]-x)<6e-5 for p in tri)),None)
  if group is None:retained.extend(oldindices[j:j+3])
  else:
   exact_planes[group]=tri[0][0]
   groups[group].append([[p[1],p[2]] for p in tri])
 assert [len(g) for g in groups]==[169,173,169,173],'Pinned source cap layout changed'
 # Keep untouched side/bevel vertex attributes and indices first.
 values={name:[list(v) for v in rows] for name,rows in attributes.items()};indices=retained[:];reports=[];polygons=[]
 for gi,((label,normal),triangles) in enumerate(zip(planes,groups)):
  x=exact_planes[gi] # Never round the plane away from its original bevel.
  fragments=stitch_fragments(union_triangles(triangles));start=len(indices);welded={}
  for fragment in fragments:
   if signed_area(fragment)<0:fragment.reverse()
   local=[]
   for y,z in fragment:
    coordinate=tuple(struct.unpack('<3f',struct.pack('<3f',x,y,z)))
    if coordinate not in welded:
     welded[coordinate]=len(values['POSITION']);values['POSITION'].append(list(coordinate));values['NORMAL'].append([normal,0,0]);values['TEXCOORD_0'].append([0,0])
    local.append(welded[coordinate])
   for k in range(1,len(fragment)-1):
    order=[local[0],local[k],local[k+1]] if normal>0 else [local[0],local[k+1],local[k]]
    p,q,r=[values['POSITION'][i] for i in order]
    if abs(cross(p[1:],q[1:],r[1:]))>1e-10:indices.extend(order)
  reports.append({'x':x,'normal_x':normal,'old_triangles':len(triangles),'old_summed_area':sum(abs(signed_area(t)) for t in triangles),'union_area':sum(abs(signed_area(p)) for p in fragments),'new_triangles':(len(indices)-start)//3});polygons.append({'x':x,'polygons':fragments})
 blob=bytearray(binary)
 def accessor(rows,kind,integer=False):
  dim=1 if kind=='SCALAR' else len(rows[0]);flat=rows if dim==1 else [v for row in rows for v in row];blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);blob.extend(struct.pack('<'+str(len(flat))+('I' if integer else 'f'),*flat));vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(flat)*4,'target':34963 if integer else 34962});a={'bufferView':vi,'componentType':5125 if integer else 5126,'count':len(rows),'type':kind}
  if kind=='VEC3':a.update(min=[min(v[k] for v in rows) for k in range(3)],max=[max(v[k] for v in rows) for k in range(3)])
  ai=len(doc['accessors']);doc['accessors'].append(a);return ai
 primitive['attributes']={name:accessor(rows,'VEC2' if name.startswith('TEXCOORD') else 'VEC3') for name,rows in values.items()};primitive['indices']=accessor(indices,'SCALAR',True);primitive['extensions'].pop('KHR_draco_mesh_compression')
 if not primitive['extensions']:primitive.pop('extensions')
 doc['buffers'][0]['byteLength']=len(blob)
 report={'mesh':0,'primitive':0,'preserved_side_triangles':len(retained)//3,'old_triangles':len(oldindices)//3,'new_triangles':len(indices)//3,'planes':reports,'source_sha256':source['sha256'],'coverage_polygons':polygons,'seams':{'exact_source_planes':True,'shared_float32_vertices':True,'conforming_fragment_edges':True}}
 return bytes(blob),report
