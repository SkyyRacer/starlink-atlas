"""Build compact white line GLBs and matching 2D drawings. Standard library only.
NASA inputs are pinned public models. Other geometries are original illustrative
schematics based on the mission documents recorded in science-model-sources.json.
"""
import collections,gzip,hashlib,json,math,pathlib,struct
from mission_model_schematics import lines as mission_lines
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'static/images/science';OUT.mkdir(exist_ok=True)
def minus(a,b):return [a[i]-b[i] for i in range(3)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def length(a):return math.sqrt(dot(a,a))
def unit(a):
 n=length(a);return [x/n for x in a] if n>1e-15 else [0,0,0]
def identity():return [[int(i==j) for j in range(4)] for i in range(4)]
def product(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def transform(m,p):return [sum(m[i][j]*p[j] for j in range(3))+m[i][3] for i in range(3)]
def node_matrix(node):
 if 'matrix' in node:return [[node['matrix'][4*j+i] for j in range(4)] for i in range(4)]
 x,y,z,w=node.get('rotation',[0,0,0,1]);scale=node.get('scale',[1,1,1]);t=node.get('translation',[0,0,0]);m=identity()
 r=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 for i in range(3):
  for j in range(3):m[i][j]=r[i][j]*scale[j]
  m[i][3]=t[i]
 return m
def nasa_lines(path):
 raw=path.read_bytes();assert raw[:4]==b'glTF';pos=12;g=None;blob=None
 while pos<len(raw):
  size,kind=struct.unpack_from('<II',raw,pos);pos+=8;chunk=raw[pos:pos+size];pos+=size
  if kind==0x4e4f534a:g=json.loads(chunk)
  if kind==0x004e4942:blob=chunk
 cached=path.with_suffix('.mesh.json.gz')
 if cached.exists():
  g=json.loads(gzip.decompress(cached.read_bytes()));assert g['sha256']==hashlib.sha256(raw).hexdigest()
 def accessor(index):
  a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];assert v.get('buffer',0)==0
  typ={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];dim={'SCALAR':1,'VEC3':3}[a['type']];fmt='<'+typ*dim;size=struct.calcsize(fmt);stride=v.get('byteStride',size);start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,blob,start+i*stride) for i in range(a['count'])]
 triangles=[]
 def visit(index,parent):
  node=g['nodes'][index];matrix=product(parent,node_matrix(node))
  if 'mesh' in node:
   for part in g['meshes'][node['mesh']]['primitives']:
    if part.get('mode',4)!=4:continue
    pts=[transform(matrix,p) for p in (part['positions'] if 'positions' in part else accessor(part['attributes']['POSITION']))]
    indices=part['indices'] if 'positions' in part else [x[0] for x in accessor(part['indices'])] if 'indices' in part else list(range(len(pts)))
    triangles.extend([pts[indices[i]],pts[indices[i+1]],pts[indices[i+2]]] for i in range(0,len(indices)-2,3))
  for child in node.get('children',[]):visit(child,matrix)
 for index in g['scenes'][g.get('scene',0)]['nodes']:visit(index,identity())
 assert triangles,path
 bounds=[[min(p[i] for tri in triangles for p in tri),max(p[i] for tri in triangles for p in tri)] for i in range(3)];span=max(b-a for a,b in bounds);center=[(a+b)/2 for a,b in bounds]
 edges=collections.defaultdict(list)
 for tri in triangles:
  pts=[tuple(round((p[i]-center[i])/span*100,4) for i in range(3)) for p in tri];normal=unit(cross(minus(pts[1],pts[0]),minus(pts[2],pts[0])))
  for a,b in zip(pts,pts[1:]+pts[:1]):
   if a!=b:edges[tuple(sorted((a,b)))].append(normal)
 lines=[]
 for (a,b),normals in edges.items():
  size=length(minus(a,b));crease=len(normals)==1 or any(abs(dot(normals[0],n))<math.cos(math.radians(19)) for n in normals[1:])
  if (crease and size>.18) or size>9:lines.append([a,b])
 # Retain strong feature edges, rather than tessellation diagonals or tiny screws.
 lines.sort(key=lambda edge:length(minus(*edge)),reverse=True)
 return lines[:2200]
class Shape:
 def __init__(self):self.lines=[]
 def line(self,a,b):self.lines.append([list(a),list(b)])
 def box(self,x,y,z,w,h,d):
  p=[(x+i*w,y+j*h,z+k*d) for k in (0,1) for j in (0,1) for i in (0,1)]
  for a,b in [(0,1),(0,2),(0,4),(1,3),(1,5),(2,3),(2,6),(3,7),(4,5),(4,6),(5,7),(6,7)]:self.line(p[a],p[b])
 def cylinder(self,x,y,z,r,h,n=16):
  for i in range(n):
   a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
   for level in [y,y+h]:self.line((x+r*math.cos(a),level,z+r*math.sin(a)),(x+r*math.cos(b),level,z+r*math.sin(b)))
   if i%2==0:self.line((x+r*math.cos(a),y,z+r*math.sin(a)),(x+r*math.cos(a),y+h,z+r*math.sin(a)))
 def panel(self,x,y,z,w,h):
  self.box(x,y,z,w,h,.25)
  for k in range(1,7):self.line((x+w*k/7,y,z+.25),(x+w*k/7,y+h,z+.25))
  for k in range(1,4):self.line((x,y+h*k/4,z+.25),(x+w,y+h*k/4,z+.25))
 def wings(self,span=36,y=-4):
  self.line((-span,y,0),(span,y,0));self.panel(-span,y-6,0,span-8,12);self.panel(8,y-6,0,span-8,12)
def schematic(key):
 s=Shape()
 if key=='lageos':
  # 60 cm sphere, 426 flush 3.81 cm retroreflector apertures (NASA design).
  # Fibonacci distribution is illustrative; no protruding corner-cube boxes.
  for i in range(426):
   y=1-2*(i+.5)/426;t=i*math.pi*(3-math.sqrt(5));n=[math.sqrt(1-y*y)*math.cos(t),y,math.sqrt(1-y*y)*math.sin(t)]
   u=unit(cross(n,[0,1,0]));v=cross(n,u);r=18*3.81/60;depth=math.sqrt(18**2-r*r)
   ring=[[depth*n[j]+r*(math.cos(k*2*math.pi/8)*u[j]+math.sin(k*2*math.pi/8)*v[j]) for j in range(3)] for k in range(8)]
   for a,b in zip(ring,ring[1:]+ring[:1]):s.line(a,b)
 elif key=='nustar':
  s.box(-5,-28,-4,10,8,8);s.panel(6,-28,0,23,9)
  for y in range(-20,22,4):
   s.box(-1.3,y,-1.3,2.6,4,2.6);s.line((-1.3,y,-1.3),(1.3,y+4,-1.3));s.line((1.3,y,-1.3),(1.3,y+4,1.3))
  s.box(-5,22,-3,10,2,6)
  for x in [-2.7,2.7]:s.cylinder(x,24,0,2.4,5)
 elif key=='ixpe':
  s.cylinder(0,-19,0,7,6,6);s.wings(28,-17)
  for x,z in [(-4,-2),(4,-2),(0,4)]:
   s.cylinder(x,14,z,2.6,8);s.line((x,-13,z),(x,14,z))
  for y in range(-12,12,4):s.line((-4,y,-2),(4,y+4,-2));s.line((4,y,-2),(0,y+4,4))
 elif key=='xmm-newton':
  s.cylinder(0,-20,0,7,10,8);s.cylinder(0,-10,0,5.8,35);s.wings(38,-13)
  for x,z in [(-3,-1.5),(3,-1.5),(0,3.2)]:s.cylinder(x,25,z,2.4,3)
 elif key=='cheops':
  s.box(-8,-12,-7,16,14,14);s.cylinder(0,2,0,5,22,12);s.cylinder(0,20,0,7,5,12)
  s.panel(-13,-13,-8,26,23);s.panel(-20,-13,-1,7,23);s.panel(13,-13,-1,7,23)
 elif key=='astrosat':
  s.box(-9,-14,-7,18,18,14);s.wings(38,-6)
  for x,z,r,h in [(-5,-3,3.6,21),(4,-3,3.6,21),(0,4,3.7,14),(-6,5,2,10)]:s.cylinder(x,4,z,r,h)
  s.box(4,4,3,4,11,5)
 elif key=='xrism':
  s.cylinder(0,-24,0,7,14,8);s.cylinder(0,-10,0,5.5,27,12);s.cylinder(0,17,0,7.5,7,12);s.wings(39,-18)
  s.cylinder(0,23,0,4,3);s.box(6,-16,-3,4,12,6)
 elif key=='xposat':
  s.box(-9,-10,-7,18,17,14);s.wings(32,-3);s.box(-7,7,-5,12,7,10)
  for x,z in [(-4,-2),(1,-2),(-4,3),(1,3)]:s.cylinder(x,14,z,2,4,8)
  s.box(6,8,-4,4,10,6)
 else:raise ValueError(key)
 return s.lines

def glb(lines,solid_sphere=False):
 vertices=[list(map(float,p)) for edge in lines for p in edge];raw=b''.join(struct.pack('<3f',*p) for p in vertices);lo=[min(p[i] for p in vertices) for i in range(3)];hi=[max(p[i] for p in vertices) for i in range(3)]
 doc={'asset':{'version':'2.0','generator':'Atlas science white-line adaptation'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'rotation':[math.sin(-math.pi/8),0,0,math.cos(-math.pi/8)]}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'mode':1,'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1},'emissiveFactor':[1,1,1],'extensions':{'KHR_materials_unlit':{}}}],'extensionsUsed':['KHR_materials_unlit'],'buffers':[{'byteLength':len(raw)}],'bufferViews':[{'buffer':0,'byteLength':len(raw),'target':34962}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(vertices),'type':'VEC3','min':lo,'max':hi}]}
 if solid_sphere:
  # An opaque dark interior hides far-side reflectors, while white lines remain tintable.
  shell=[]
  def vertex(j,k):
   a=math.pi*j/24;t=2*math.pi*k/48
   return [17.94*math.sin(a)*math.cos(t),17.94*math.cos(a),17.94*math.sin(a)*math.sin(t)]
  for j in range(24):
   for k in range(48):
    a,b,c,d=vertex(j,k),vertex(j+1,k),vertex(j,k+1),vertex(j+1,k+1)
    for tri in [[a,c,b],[b,c,d]]:shell.extend(tri)
  offset=len(raw);raw+=b''.join(struct.pack('<3f',*p) for p in shell)
  doc['buffers'][0]['byteLength']=len(raw)
  doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)-offset,'target':34962})
  doc['accessors'].append({'bufferView':1,'componentType':5126,'count':len(shell),'type':'VEC3','min':[-17.94]*3,'max':[17.94]*3})
  doc['materials'].append({'pbrMetallicRoughness':{'baseColorFactor':[0,0,0,1],'metallicFactor':0,'roughnessFactor':1},'extensions':{'KHR_materials_unlit':{}}})
  doc['meshes'][0]['primitives'].append({'attributes':{'POSITION':1},'mode':4,'material':1})
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);raw+=b'\0'*((-len(raw))%4)
 return struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(raw))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(raw),0x004e4942)+raw

def build():
 definitions=json.loads((ROOT/'resources/constellations.json').read_text());sources=json.loads((ROOT/'resources/science-model-sources.json').read_text());manifest=[]
 for key,source in sources.items():
  if source.get('enabled') is False:
   for suffix in ['.glb','.json']:(OUT/(key+suffix)).unlink(missing_ok=True)
   continue
  row=next(r for r in definitions if r['id']==source.get('page_id',key));ids=source.get('ids',row['ids']);original=ROOT/'resources/science-originals'/f'{key}.glb'
  lines=nasa_lines(original) if original.exists() else mission_lines(Shape,source['profile']) if source.get('profile') else schematic(key)
  blob=glb(lines,key=='lageos');(OUT/f'{key}.glb').write_bytes(blob)
  # Orthographic drawing is derived from the same vertices as the orbiting model.
  project=lambda p:[.866*p[0]+.5*p[2],-.22*p[0]+.84*p[1]+.38*p[2]]
  drawing_lines=lines
  if key=='lageos':
   # Same orthographic viewing direction as the model drawing; hide the back hemisphere.
   view=unit(cross([.866,0,.5],[-.22,.84,.38]))
   drawing_lines=[edge for edge in lines if dot([(edge[0][i]+edge[1][i])/2 for i in range(3)],view)>0]
  segments=[[project(a),project(b)] for a,b in drawing_lines];xs=[p[0] for edge in segments for p in edge];ys=[p[1] for edge in segments for p in edge];center=[(min(xs)+max(xs))/2,(min(ys)+max(ys))/2];span=max(max(xs)-min(xs),max(ys)-min(ys));segments=[[[round((p[i]-center[i])/span*100,3) for i in range(2)] for p in edge] for edge in segments]
  drawing={'segments':segments};drawing_blob=json.dumps(drawing,separators=(',',':')).encode();(OUT/f'{key}.json').write_bytes(drawing_blob)
  manifest.append({'key':key,'page_id':row['id'],'ids':ids,'name':source.get('name',row['label']),'kind':source['kind'],'credit':source['credit'],'source':source['page'],'glb':f'images/science/{key}.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'drawing':f'images/science/{key}.json?v='+hashlib.sha256(drawing_blob).hexdigest()[:12],'radius':round(max(length(p) for edge in lines for p in edge),3),'segments':len(drawing_lines),'line_segments':len(lines),'bytes':len(blob)+len(drawing_blob)})
 (ROOT/'resources/science-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
 template=(ROOT/'resources/science-visual.template.js').read_text()
 (ROOT/'static/science-visual.js').write_text(template.replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 print('\n'.join(f"{m['name']}: {m['segments']} segments, {m['bytes']} octets, {m['kind']}" for m in manifest))
if __name__=='__main__':build()
