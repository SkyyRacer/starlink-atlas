"""Original Atlas surface models, reconstructed from cited agency diagrams.
Metres, +X forward, +Z nadir. Deployed standalone baseline configurations;
no permanent visiting craft, interiors, or claimed measured historical attitude.
Small fittings and surface finishes are illustrative, not engineering CAD.
Run this file to regenerate the nine source/runtime GLBs and their registries.
"""
from pathlib import Path
import hashlib,json,math,struct,zlib
ROOT=Path(__file__).resolve().parents[1]
NASA='https://www.nasa.gov/wp-content/uploads/static/history/SP-4225/documentation/mhh/mirhh-part2.pdf'
ESA='https://blogs.esa.int/rocketscience/2018/03/26/tiangong-1-frequently-asked-questions-2/'
CMSE='https://en.cmse.gov.cn/news/201907/t20190713_44588.html'
SPECS=[
 ('salyut-1',5160,15.8,10,4,1,'DOS-1',NASA),
 ('salyut-2',6398,14.55,14,2,1,'OPS-1',NASA),
 ('salyut-3',7342,14.55,14,2,1,'OPS-2',NASA),
 ('salyut-4',7591,15.8,17,3,1,'DOS-4',NASA),
 ('salyut-5',8911,14.55,14,2,1,'OPS-3',NASA),
 ('salyut-6',10382,15.8,17,3,2,'DOS-5',NASA),
 ('salyut-7',13138,16,17,3,2,'DOS-6',NASA),
 ('tiangong-1',37820,10.4,17,2,1,'TG-1',ESA),
 ('tiangong-2',41765,10.4,18.4,2,1,'TG-2',CMSE)]
def unit(v):
 n=math.hypot(*v);return tuple(x/n for x in v)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def png(width,height,fn):
 raw=bytearray()
 for y in range(height):
  raw.append(0)
  for x in range(width):raw.extend(fn(x,y))
 def chunk(k,b):return struct.pack('>I',len(b))+k+b+struct.pack('>I',zlib.crc32(k+b))
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
def solar(x,y):
 edge=x%32<2 or y%24<2;bus=x%32 in (15,16);noise=((x*19+y*37)%9)-4
 return (152,155,158) if edge else (136,122,86) if bus else (max(0,21+noise),max(0,35+noise),max(0,70+noise))
def foil(x,y):
 v=int(180+17*math.sin(x*.37+y*.13)*math.sin(y*.21-x*.17)+9*math.cos(x*.78+y*.51));return (v,v,min(255,v+3))
def quilt(x,y):
 seam=min((x+y)%64,64-(x+y)%64,(x-y)%64,64-(x-y)%64)<2
 v=175 if seam else 233+int(4*math.sin(x*.4+y*.11));return (v,v,max(0,v-5))
def normal(x,y):
 return (int(128+18*math.cos(x*.37+y*.13)),int(128+18*math.sin(y*.21-x*.17)),251)
TEXTURES=[png(512,512,solar),png(256,256,foil),png(256,256,quilt),png(256,256,normal)]
class Model:
 def __init__(self,key):
  self.key=key;self.length=next((row[2] for row in SPECS if row[0]==key),16.6);self.binary=bytearray();self.parts=[]
  self.g={'asset':{'version':'2.0','generator':'Atlas historical station reconstruction v1','copyright':'Original Atlas geometry and textures, CC BY 4.0; historical references recorded in manifest.'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'accessors':[],'bufferViews':[],'materials':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]}
  for tex in TEXTURES:
   self.g['images'].append({'bufferView':self.view(tex),'mimeType':'image/png'});self.g['textures'].append({'source':len(self.g['images'])-1,'sampler':0})
  self.materials={}
  for name,color,metal,rough,texture in [('ivory',[.92,.92,.88,1],.08,.59,2),('green',[.29,.34,.24,1],.16,.56,None),('silver',[.85,.86,.88,1],.82,.29,1),('gold',[.82,.56,.17,1],.78,.32,1),('steel',[.46,.49,.53,1],.86,.24,None),('dark',[.035,.045,.055,1],.18,.5,None),('cells',[1,1,1,1],.58,.24,0),('cell-back',[.3,.19,.075,1],.52,.4,1),('glass',[.06,.18,.24,1],.42,.15,None),('red',[.62,.06,.035,1],.1,.55,None)]:
   pbr={'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough}
   if texture is not None:pbr['baseColorTexture']={'index':texture}
   m={'name':name,'pbrMetallicRoughness':pbr,'doubleSided':False}
   if name in ('silver','gold'):m['normalTexture']={'index':3,'scale':.28}
   self.materials[name]=len(self.g['materials']);self.g['materials'].append(m)
  if key.startswith('salyut'):
   hull=(ROOT/f'resources/historical-station-textures/{key}-hull.png').read_bytes();self.g['images'].append({'bufferView':self.view(hull),'mimeType':'image/png'});self.g['textures'].append({'source':len(self.g['images'])-1,'sampler':0});self.materials['hull']=len(self.g['materials']);self.g['materials'].append({'name':'hull','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':len(self.g['textures'])-1},'metallicFactor':.07,'roughnessFactor':.72},'doubleSided':False});self.g['asset']['generator']='Atlas Salyut reconstruction v2 · historical hull and segmented arrays'
   self.materials['rust']=len(self.g['materials']);self.g['materials'].append({'name':'rust','pbrMetallicRoughness':{'baseColorFactor':[.37,.15,.065,1],'metallicFactor':.12,'roughnessFactor':.63},'doubleSided':False})

  if key in ('tiangong-1','tiangong-2'):
   from tiangong_one_surfaces import finish
   finish(self,png)
 def view(self,data,target=None):
  self.binary.extend(b'\0'*(-len(self.binary)%4));v={'buffer':0,'byteOffset':len(self.binary),'byteLength':len(data)}
  if target:v['target']=target
  self.binary.extend(data);self.g['bufferViews'].append(v);return len(self.g['bufferViews'])-1
 def accessor(self,rows,kind,integer=False):
  n=len(rows[0]);raw=struct.pack('<'+str(len(rows)*n)+('I' if integer else 'f'),*(v for r in rows for v in r));a={'bufferView':self.view(raw,34963 if integer else 34962),'componentType':5125 if integer else 5126,'count':len(rows),'type':kind}
  if kind=='VEC3':a.update(min=[min(r[i] for r in rows) for i in range(3)],max=[max(r[i] for r in rows) for i in range(3)])
  self.g['accessors'].append(a);return len(self.g['accessors'])-1
 def mesh(self,name,verts,normals,uvs,faces,material):
  attributes={'POSITION':self.accessor(verts,'VEC3'),'NORMAL':self.accessor(normals,'VEC3')}
  finish=self.g['materials'][self.materials[material]]
  if 'baseColorTexture' in finish['pbrMetallicRoughness'] or 'metallicRoughnessTexture' in finish['pbrMetallicRoughness'] or 'normalTexture' in finish:attributes['TEXCOORD_0']=self.accessor(uvs,'VEC2')
  if 'normalTexture' in finish:
   ts=[[0.,0.,0.] for p in verts];bs=[[0.,0.,0.] for p in verts]
   for a,b,c in faces:
    e1=[verts[b][k]-verts[a][k] for k in range(3)];e2=[verts[c][k]-verts[a][k] for k in range(3)];u1,v1=uvs[b][0]-uvs[a][0],uvs[b][1]-uvs[a][1];u2,v2=uvs[c][0]-uvs[a][0],uvs[c][1]-uvs[a][1];det=u1*v2-v1*u2
    if abs(det)<1e-12:continue
    for i in [a,b,c]:
     for k in range(3):ts[i][k]+=(e1[k]*v2-e2[k]*v1)/det;bs[i][k]+=(e2[k]*u1-e1[k]*u2)/det
   tangents=[]
   for n,t,b in zip(normals,ts,bs):
    dot=sum(n[k]*t[k] for k in range(3));t=[t[k]-n[k]*dot for k in range(3)]
    if math.hypot(*t)<1e-12:t=cross(n,(1,0,0) if abs(n[0])<.9 else (0,1,0))
    t=unit(t);w=-1 if sum(v*b[k] for k,v in enumerate(cross(n,t)))<0 else 1;tangents.append((*t,w))
   attributes['TANGENT']=self.accessor(tangents,'VEC4')
  primitive={'attributes':attributes,'indices':self.accessor([(i,) for f in faces for i in f],'SCALAR',True),'material':self.materials[material]}
  idx=len(self.g['meshes']);self.g['meshes'].append({'name':name,'primitives':[primitive]});node=len(self.g['nodes']);self.g['nodes'].append({'name':name,'mesh':idx});self.g['scenes'][0]['nodes'].append(node)
 def tube(self,name,a,b,r1,r2=None,mat='ivory',segments=64,caps=True):
  if r2 is None:r2=r1
  axis=unit(tuple(b[i]-a[i] for i in range(3)));ref=(0,0,1) if abs(axis[2])<.9 else (0,1,0);u=unit(cross(ref,axis));v=cross(axis,u);length=math.dist(a,b);verts=[];norms=[];uv=[];faces=[]
  for j,(p,r) in enumerate([(a,r1),(b,r2)]):
   for i in range(segments+1):
    theta=2*math.pi*i/segments;rad=tuple(u[k]*math.cos(theta)+v[k]*math.sin(theta) for k in range(3));verts.append(tuple(p[k]+r*rad[k] for k in range(3)));norms.append(unit(tuple(rad[k]+axis[k]*(r1-r2)/length for k in range(3))));uv.append((i/segments,(p[0]+self.length/2)/self.length) if mat=='hull' else (i/segments*max(1,2*math.pi*max(r1,r2)/1.5),j*length/1.5))
  for i in range(segments):
   k=i+segments+1;faces.extend([(i,i+1,k),(i+1,k+1,k)])
  if caps:
   for j,(p,r) in enumerate([(a,r1),(b,r2)]):
    start=len(verts);verts.append(p);norms.append(tuple(axis[k]*(1 if j else -1) for k in range(3)));uv.append((.5,.5))
    for i in range(segments+1):
     t=2*math.pi*i/segments;verts.append(tuple(p[k]+r*(u[k]*math.cos(t)+v[k]*math.sin(t)) for k in range(3)));norms.append(norms[start]);uv.append((.5+.5*math.cos(t),.5+.5*math.sin(t)))
    for i in range(segments):faces.append((start,start+i+1,start+i+2) if j else (start,start+i+2,start+i+1))
  self.mesh(name,verts,norms,uv,faces,mat)
 def box(self,name,center,size,mat='ivory',basis=None,repeat=(1,1)):
  basis=basis or [(1,0,0),(0,1,0),(0,0,1)];verts=[];norms=[];uv=[];faces=[]
  for axis in range(3):
   d=(axis+1)%3;e=(axis+2)%3
   for sign in [-1,1]:
    start=len(verts)
    for s,t in [(-1,-1),(1,-1),(1,1),(-1,1)]:
     local=[0.,0.,0.];local[axis]=sign*size[axis]/2;local[d]=s*size[d]/2;local[e]=t*size[e]/2;verts.append(tuple(center[k]+sum(basis[j][k]*local[j] for j in range(3)) for k in range(3)));norms.append(tuple(sign*x for x in basis[axis]));uv.append(((s+1)*repeat[0]/2,(t+1)*repeat[1]/2))
    faces.extend([(start,start+1,start+2),(start,start+2,start+3)] if sign==1 else [(start,start+2,start+1),(start,start+3,start+2)])
  self.mesh(name,verts,norms,uv,faces,mat)
 def axial(self,name,x1,x2,r1,r2=None,mat='ivory'):self.tube(name,(x1,0,0),(x2,0,0),r1,r2,mat)
 def collar(self,x,r,name='Assembly seam'):self.axial(name,x-.025,x+.025,r,r,'steel')
 def docking(self,x,sign=1):
  self.axial('Docking support',x-sign*.38,x,.78,.68,'ivory');self.axial('Docking collar',x,x+sign*.16,.68,.68,'steel');self.axial('Recessed docking target',x+sign*.165,x+sign*.17,.48,.48,'dark')
  for i in range(12):
   t=i*math.pi/6;y,z=.6*math.cos(t),.6*math.sin(t);self.tube('Docking latch',(x,y,z),(x+sign*.2,y,z),.027,mat='steel',segments=10)
 def engine(self,a,b,r=.25):
  self.tube('Thruster outer bell',a,b,r*.45,r,'steel',32);axis=unit(tuple(b[i]-a[i] for i in range(3)));c=tuple(b[i]+axis[i]*.006 for i in range(3));self.tube('Thruster dark cavity',b,c,r*.86,mat='dark',segments=32)
 def hatch(self,x,r,theta):
  direction=(0,math.cos(theta),math.sin(theta));a=(x,r*direction[1],r*direction[2]);b=(x,(r+.08)*direction[1],(r+.08)*direction[2]);self.tube('EVA hatch rim',a,b,.42,mat='steel',segments=48);c=(x,(r+.1)*direction[1],(r+.1)*direction[2]);self.tube('EVA hatch lid',b,c,.365,mat='ivory',segments=48)
  for dy in [-.18,.18]:self.tube('Hatch grab bar',(x+dy,(r+.16)*direction[1]-.13*direction[2],(r+.16)*direction[2]+.13*direction[1]),(x+dy,(r+.16)*direction[1]+.13*direction[2],(r+.16)*direction[2]-.13*direction[1]),.018,mat='steel',segments=10)
 def window(self,x,r,theta):
  y,z=math.cos(theta),math.sin(theta);self.tube('Porthole bezel',(x,r*y,r*z),(x,(r+.07)*y,(r+.07)*z),.16,mat='steel',segments=32);self.tube('Porthole glass',(x,(r+.071)*y,(r+.071)*z),(x,(r+.078)*y,(r+.078)*z),.126,mat='glass',segments=32)
 def wing(self,index,x,theta,start,end,width):
  if self.key.startswith('salyut'):return self.segmented_wing(index,x,theta,start,end,width)
  # One independently named array, including front cells, opaque rear, frame,
  # drive spindle, ribs, busbars and a separately authored repeating cell map.
  radial=(0,math.cos(theta),math.sin(theta));normal=(0,-math.sin(theta),math.cos(theta));basis=[(1,0,0),radial,normal]
  p=lambda along,n=0:(x,along*radial[1]+n*normal[1],along*radial[2]+n*normal[2]);self.tube(f'Array {index} drive',p(start-.5),p(start+.2),.1,mat='steel',segments=24)
  length=end-start;self.box(f'Solar array {index} back',p((start+end)/2),[width,length,.06],'cell-back',basis,repeat=(4,8));self.box(f'Solar array {index} cells',p((start+end)/2,-.033 if normal[2]>0 else .033),[width-.06,length-.06,.008],'cells',basis,repeat=(max(1,width/1.2),max(1,length/1.5)))
  for side in [-1,1]:
   self.tube('Solar array perimeter',(x+side*width/2,*p(start)[1:]),(x+side*width/2,*p(end)[1:]),.025,mat='steel',segments=8)
  for j in range(7):
   d=start+j*length/6;self.tube('Solar array transverse rib',(x-width/2,*p(d)[1:]),(x+width/2,*p(d)[1:]),.022,mat='steel',segments=8)
  for j in range(2):
   d=start+j*length/2;self.tube('Array cable harness',p(d,-.055),p(min(end,d+length/2),-.055),.018,mat='dark',segments=8)
  self.parts.append({'part':'solar_array','index':index,'span_from_axis_m':end,'width_m':width})
 def segmented_wing(self,index,x,theta,start,end,width):
  radial=(0,math.cos(theta),math.sin(theta));normal=(0,-math.sin(theta),math.cos(theta));front=-1 if normal[2]>0 else 1;length=end-start;sections=4 if self.key=='salyut-1' else 6
  def point(px,d,n=0):return (px,d*radial[1]+n*normal[1],d*radial[2]+n*normal[2])
  self.tube(f'Array {index} drive',point(x,start-.55),point(x,start+.12),.11,mat='steel',segments=32)
  cell_nodes=[]
  for j in range(sections):
   lo=start+j*length/sections+.035;hi=start+(j+1)*length/sections-.035;wa=width*(.94 if j%2 else 1);cut=.11;offset=math.sin(j*math.pi/2)*.032
   outline=[(-wa/2+cut,lo), (wa/2-cut,lo),(wa/2,lo+cut),(wa/2,hi-cut),(wa/2-cut,hi),(-wa/2+cut,hi),(-wa/2,hi-cut),(-wa/2,lo+cut)]
   for name,mat,height in [('back','cell-back',offset),('cells','cells',offset+front*.014)]:
    vertices=[point(x+px,d,height) for px,d in outline];n=tuple(v*(front if name=='cells' else -front) for v in normal);faces=[(0,k,k+1) if (front if name=='cells' else -front)>0 else (0,k+1,k) for k in range(1,7)];uv=[((px/wa+.5)*max(1,wa/1.2),(d-lo)/1.5) for px,d in outline];self.mesh(f'Array {index} section {j+1} {name}',vertices,[n]*8,uv,faces,mat)
    if name=='cells':cell_nodes.append(len(self.g['nodes'])-1)
   for k in range(8):
    a,b=outline[k],outline[(k+1)%8];self.tube('Articulated panel frame',point(x+a[0],a[1],offset),point(x+b[0],b[1],offset),.026,mat='steel',segments=8)
   self.tube('Panel fold hinge',point(x-width*.47,lo-.025,offset),point(x+width*.47,lo-.025,offset),.035,mat='steel',segments=12)
   for side in [-1,1]:self.tube('Array support spar',point(x+side*wa*.27,lo,-.075),point(x+side*wa*.27,hi,-.075),.022,mat='steel',segments=8)
  # One physical wing, independent of the number of articulated leaf sections.
  self.g['nodes'].append({'name':f'Solar array {index} cells','children':cell_nodes});roots=self.g['scenes'][0]['nodes'];roots[:]=[i for i in roots if i not in cell_nodes];roots.append(len(self.g['nodes'])-1)
  self.parts.append({'part':'solar_array','index':index,'span_from_axis_m':end,'width_m':width,'leaf_sections':sections})
 def salyut_details(self,almaz=False):
  # Distributed equipment follows hull radii, including the tapered waist.
  def radius(x):return 2.075 if x<-.8 else 2.075-(x+.8)/1.2*.625 if x<.4 else 1.45 if x<4.2 else 1
  for x in [-4.55,-3.8,-2.8,-1.6,.7,2.2,3.7]:
   r=radius(x)
   for theta in [.4,2.1,3.5,5.5]:
    y,z=math.cos(theta),math.sin(theta);self.tube('Thermal blanket tie-down',(x,r*y,r*z),(x,(r+.035)*y,(r+.035)*z),.045,mat='ivory',segments=10)
  for x,r in [(-4.65,2.075),(-2.7,2.075),(1.2,1.45),(3.3,1.45)]:
   for theta in [1.0,2.4,4.2,5.5]:
    y,z=math.cos(theta),math.sin(theta);self.box('Surface equipment base',(x,(r+.07)*y,(r+.07)*z),(.23,.12,.14),'steel');self.tube('Surface sensor head',(x,(r+.1)*y,(r+.1)*z),(x,(r+.2)*y,(r+.2)*z),.065,mat='dark',segments=16)
  for theta in [0,math.pi]:
   y,z=math.cos(theta),math.sin(theta)
   points=[(-4.2,2.13*y,2.13*z),(-1,2.13*y,2.13*z),(.5,1.52*y,1.52*z),(3.4,1.52*y,1.52*z)]
   for a,b in zip(points,points[1:]):self.tube('External bent cable conduit',a,b,.035,mat='ivory',segments=12)
  # Long whip antennas and small rendezvous reflectors distinguish the silhouette.
  self.tube('Long rendezvous whip',(4.5,.8,-.6),(5.25,1.15,-3.1),.018,mat='steel',segments=10)
  for i in range(6):
   theta=i*math.pi/3;y,z=.88*math.cos(theta),.88*math.sin(theta);self.tube('Rendezvous illuminator', (self.length/2-.52,y,z),(self.length/2-.32,y,z),.105,mat='gold',segments=20)
  if self.key=='salyut-1':
   for x,r in [(-4.75,2.09),(-.8,2.09),(.4,1.47)]:self.axial('Broad polished transition collar',x-.15,x+.15,r,r,'silver')
   for x in [-4.25,-1.6]:
    self.tube('Red instrument cover',(x,-.3,-2.07),(x,-.3,-2.32),.085,mat='red',segments=20)
  if self.key in ('salyut-6','salyut-7'):
   for x in [-4.35,-2.1]:self.axial('Brown-red thermal belt',x-.16,x+.16,2.095,2.095,'rust')
 def soyuz(self,port,variant):
  sign=1 if port=='front' else -1;dock=(self.length/2 if sign==1 else -self.length/2+(.33 if self.key in ('salyut-6','salyut-7') else 0));start=len(self.g['nodes']);saved_key=self.key;self.key='soyuz'
  at=lambda x:(dock+sign*x,0,0)
  def axial(name,a,b,r1,r2=None,mat='green'):self.tube(name,at(a),at(b),r1,r2,mat)
  axial('Docking probe collar',.02,.25,.49,.65,'steel');axial('Orbital forward neck',.25,.44,.65,.54,'green')
  # Three recognisable modules: forward orbital compartment, bell-shaped
  # descent capsule and cylindrical service/propulsion section, total ~7 m.
  for j in range(12):
   t0=-1.05+j*2.1/12;t1=-1.05+(j+1)*2.1/12;a=1.45+1.18*math.sin(t0);b=1.45+1.18*math.sin(t1);r1=max(.04,1.08*math.cos(t0));r2=max(.04,1.08*math.cos(t1));self.tube('Orbital module blanket',at(a),at(b),r1,r2,'green',48,caps=False)
  axial('Orbital-descent tunnel',2.52,2.8,.51,mat='steel');axial('Descent capsule shoulder',2.8,3.08,.77,1.08,'green');axial('Descent capsule',3.08,4.35,1.08,.9,'green');axial('Descent heat shield rim',4.35,4.47,.98,1.1,'dark');axial('Service section',4.47,6.6,1.14,mat='ivory');axial('Service thermal blanket',4.65,6.1,1.15,mat='silver');axial('Aft equipment skirt',6.6,6.95,1.14,1.26,'green');self.engine(at(6.8),at(7.18),.34)
  for x in [4.65,6.1,6.6]:self.tube('Service module seam',at(x-.025),at(x+.025),1.17,mat='steel',segments=48)
  for x,r in [(1.4,1.08),(3.35,1.05)]:
   self.window(dock+sign*x,r,-math.pi/2)
  self.hatch(dock+sign*1.4,1.08,math.pi/2)
  for side in [-1,1]:
   self.engine((dock+sign*6.5,side*.85,.5),(dock+sign*6.85,side*1.25,.7),.09)
  if variant!='ferry':
   for i,t in enumerate([0,math.pi]):self.wing(i+1,dock+sign*5.15,t,1.35,5.2 if variant=='early' else 5.3,1.55)
  else:
   for side in [-1,1]:self.box('Battery fairing',(dock+sign*5.2,side*1.05,.65),(.8,.45,.45),'ivory')
  self.tube('Rendezvous antenna',(dock+sign*.8,0,-.8),(dock+sign*.6,0,-1.9),.025,mat='steel',segments=12)
  child=list(range(start,len(self.g['nodes'])));name=f'Atlas docked Soyuz {port} {variant}'
  for index in child:self.g['nodes'][index]['name']=name+' / '+self.g['nodes'][index]['name']
  roots=self.g['scenes'][0]['nodes'];roots[:]=[i for i in roots if i not in child];roots.append(len(self.g['nodes']));self.g['nodes'].append({'name':name,'children':child,'extras':{'atlasDockedVisitor':True}});self.key=saved_key
  return name
 def fittings(self,length,r=2.075,chinese=False):
  for x in [-length*.19,-length*.06,length*.08]:
   r=(2.075 if x<-.8 else 2.075-(x+.8)/1.2*.625 if x<.4 else 1.45) if self.key.startswith('salyut') else r
   for theta in [math.pi*.2,math.pi*.7,math.pi*1.2,math.pi*1.7]:
    y,z=math.cos(theta),math.sin(theta);self.tube('Handrail',(x-.3,(r+.09)*y,(r+.09)*z),(x+.3,(r+.09)*y,(r+.09)*z),.018,mat='steel',segments=8)
    for dx in [-.3,.3]:self.tube('Handrail mount',(x+dx,r*y,r*z),(x+dx,(r+.09)*y,(r+.09)*z),.022,mat='steel',segments=8)
  for x in [-length*.1,length*.09]:
   r=(2.075 if x<-.8 else 1.45) if self.key.startswith('salyut') else r
   self.window(x,r,math.pi/2);self.window(x,r,-math.pi/2)
  for theta in [0,math.pi]:
   y,z=math.cos(theta),math.sin(theta);a=(-length*.38,r*.7*y,r*.7*z);b=(-length*.45,(r+.45)*y,(r+.45)*z);self.engine(a,b,.12)
  for sign in [-1,1]:
   self.tube('Radio antenna mast',(length*.28,.65*sign,-.7),(length*.28,sign*1.55,-2.2),.022,mat='steel',segments=10)
   self.tube('Antenna dipole',(length*.28-.45,sign*1.55,-2.2),(length*.28+.45,sign*1.55,-2.2),.013,mat='steel',segments=8)
 def save(self,file):
  self.binary.extend(b'\0'*(-len(self.binary)%4));self.g['buffers']=[{'byteLength':len(self.binary)}];text=json.dumps(self.g,separators=(',',':')).encode();text+=b' '*(-len(text)%4);blob=struct.pack('<III',0x46546c67,2,28+len(text)+len(self.binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(self.binary),0x004e4942)+self.binary;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(blob);return blob

def build(spec):
 key,ident,length,span,arrays,ports,family,source=spec;m=Model(key);chinese=key.startswith('tiangong');almaz=family.startswith('OPS');h=length/2
 if key in ('tiangong-1','tiangong-2'):
  from tiangong_one_surfaces import build as build_tiangong_one
  build_tiangong_one(m)
 else:
  if almaz:
   m.axial('Main work compartment',-3.9,1.4,2.075,mat='hull');m.axial('Work living transition',1.4,2.4,2.075,1.45,'silver');m.axial('Small living compartment',2.4,h-.5,1.45,mat='hull');m.axial('Front equipment cap',h-.5,h,1.45,.65,'silver');m.axial('Aft spherical airlock approximation',-6.45,-3.9,.85,1.35,'ivory');m.docking(-h+.17,-1)
   for sign in [-1,1]:m.engine((-4.05,sign*1.5,0),(-h+.3,sign*1.5,0),.34)
   m.wing(1,-3.15,0,2.35,span/2,3.2);m.wing(2,-3.15,math.pi,2.35,span/2,3.2)
   m.tube('Agat optical aperture',(-.8,0,1.95),(-.8,0,2.22),.42,mat='dark',segments=48);m.hatch(-4.7,1.15,-math.pi/2)
   if key in ('salyut-3','salyut-5'):m.box('Return capsule equipment',(-3.3,0,2.08),(1.0,.8,.3),'silver')
  else:
   m.axial('Large work compartment',-4.9,-.8,2.075,mat='hull');m.axial('Work transition cone',-.8,.4,2.075,1.45,'silver');m.axial('Small work compartment',.4,4.2,1.45,mat='hull');m.axial('Transfer transition',4.2,4.6,1.45,1,'green');m.axial('Transfer compartment',4.6,h-.55,1,mat='hull');m.docking(h-.17)
   if ports==1:
    m.axial('Soyuz-derived service module',-h+.3,-4.9,1.1,mat='silver');m.engine((-h+.5,0,0),(-h,0,0),.28)
   else:
    m.axial('Integrated propulsion shroud',-h+.5,-4.9,1.35,2.075,'silver');m.docking(-h+.5,-1)
    for sign in [-1,1]:m.engine((-h+1.1,sign*1.5,0),(-h+.15,sign*1.5,0),.25)
   if arrays==4:
    for i,(x,t) in enumerate([(5.3,0),(5.3,math.pi),(-6.2,0),(-6.2,math.pi)]):m.wing(i+1,x,t,1.4,span/2,1.9)
   else:
    for i,t in enumerate([0,math.pi,-math.pi/2]):m.wing(i+1,1.45,t,2.05,span/2,3.1 if key=='salyut-4' else 2.65)
    m.tube('Scientific instrument collar',(-.1,0,1.8),(-.1,0,2.5),.5,.35,'silver',48);m.tube('Telescope optical opening',(-.1,0,2.5),(-.1,0,2.52),.29,mat='dark',segments=48)
   m.hatch(5.5,1,-math.pi/2)
   if key=='salyut-7':
    m.window(6,1,.4);m.box('External X-ray payload',(-1.6,0,2.09),(.95,1,.35),'silver')
  # Thermal blanket seams, pressure-hull collars, radiator channels and plumbing.
  for x in [-4.8,-.85]:m.collar(x,2.09)
  for x in [1,2.5,4]:m.collar(x,1.465)
  for theta in [math.pi*.22,math.pi*.78,math.pi*1.22,math.pi*1.78]:
   y,z=math.cos(theta),math.sin(theta)
   for k in range(6):
    a=theta+(k-2.5)*.043;y,z=math.cos(a),math.sin(a);m.tube('Radiator coolant channel',(-4.3,2.084*y,2.084*z),(-1.4,2.084*y,2.084*z),.019,mat='steel',segments=8)
  m.fittings(length);m.salyut_details(almaz)
 station_positions=[a for a in m.g['accessors'] if a['type']=='VEC3'][::2];m.station_bounds=[[min(a['min'][i] for a in station_positions),max(a['max'][i] for a in station_positions)] for i in range(3)];m.docked_visitors=[]
 if key.startswith('salyut'):
  # Explicit presentation choice: one Soyuz on every Salyut, at every date.
  # This illustrative assembly is separate from the sourced docking timeline.
  port='aft' if almaz else 'front';variant='early' if key=='salyut-1' else 't' if key in ('salyut-6','salyut-7') else 'ferry'
  node=m.soyuz(port,variant);m.docked_visitors.append({'node':node,'port':port,'variant':variant,'visibility':'always','illustrative':True,'intervals':[]})
 if key in ('tiangong-1','tiangong-2'):
  from tiangong_one_surfaces import attach_shenzhou
  visitor=attach_shenzhou(m)
  if key=='tiangong-2':visitor.update(name='Shenzhou-11 · composition visuelle',variant='shenzhou-11')
  m.docked_visitors.append(visitor)
 m.g['extras']={'atlasHistoricalStation':{'key':key,'norad':ident,'length_m':length,'solar_arrays':arrays,'docking_ports':ports,'family':family,'reference':source,'reconstruction':True,'configuration':'illustrative station assembly with one permanently visible Soyuz' if key.startswith('salyut') else 'illustrative '+key+' assembly with permanently docked Shenzhou' if key in ('tiangong-1','tiangong-2') else 'standalone deployed baseline; visiting vehicles excluded','station_bounds_m':m.station_bounds,'uncertainty':'Detailed fittings and finishes are illustrative; no measured historical attitude or date-dependent hardware changes.'}}
 return m

def main():
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());old=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());keys={s[0] for s in SPECS};manifest=[m for m in old if m['key'] not in keys];audit=[]
 for spec in SPECS:
  key,ident,length,span,arrays,ports,family,source=spec;m=build(spec);original=ROOT/f'resources/detailed-originals/{key}-atlas.glb';blob=m.save(original);sha=hashlib.sha256(blob).hexdigest()
  # Uniform normalisation follows the established renderer, preserving aspect ratios.
  allpositions=[a for a in m.g['accessors'] if a['type']=='VEC3'][::2];mins=[v[0] for v in m.station_bounds];maxs=[v[1] for v in m.station_bounds];scale=100/max(b-a for a,b in zip(mins,maxs));center=[(a+b)/2 for a,b in zip(mins,maxs)];parent=len(m.g['nodes']);m.g['nodes'].append({'name':'Atlas presentation transform','children':m.g['scenes'][0]['nodes'],'matrix':[scale,0,0,0,0,scale,0,0,0,0,scale,0,*[-x*scale for x in center],1]});m.g['scenes'][0]['nodes']=[parent];runtime=m.save(ROOT/f'static/images/detailed/{key}.glb')
  if key.startswith('salyut'):
   from historical_solar_rig import apply
   data,rig,solar_audit=apply(m.g,bytes(m.binary),key);m.binary=bytearray(data);m.solar_rig=rig
   runtime=m.save(ROOT/f'static/images/detailed/{key}.glb')
  note='Reconstitution originale Atlas basée sur les plans publics ; détails secondaires et finitions interprétés. Composition illustrative avec un Soyouz toujours visible, indépendamment de la date ; attitude historique non mesurée.'
  if not key.startswith('salyut'):note='Reconstitution originale Atlas basée sur les plans publics ; détails secondaires et finitions interprétés. Configuration déployée sans vaisseau amarré ; attitude historique non mesurée.'
  if key in ('tiangong-1','tiangong-2'):note='Reconstitution originale Atlas basée sur les plans publics ; détails secondaires et finitions interprétés. Composition illustrative avec Shenzhou amarré en permanence ; attitude historique non mesurée.'
  src={'file':str(original.relative_to(ROOT)),'ids':[ident],'download':source,'page':source,'sha256':sha,'credit':'Atlas · reconstitution documentée','license':'CC BY 4.0 · original Atlas geometry/textures','body_axes':[[1,0,0],[0,1,0],[0,0,1]],'version':'Atlas historical reconstruction · PBR','note':note,'solar_rig':getattr(m,'solar_rig',[]),'docked_visitors':m.docked_visitors,'historical_solar_tracking':key.startswith('salyut')};sources[key]=src
  entry={'docked_visitors':m.docked_visitors,'key':key,'ids':[ident],'url':f'images/detailed/{key}.glb?v='+hashlib.sha256(runtime).hexdigest()[:12],'bytes':len(runtime),'source':source,'download':source,'sha256':sha,'uv_repairs':[],'compatibility':{},'solar_rig':getattr(m,'solar_rig',[]),'material_finishes':{},'presentation_focus_node':None,'body_axes':src['body_axes'],'note':note,'credit':src['credit'],'original_file':src['file'],'version':src['version'],'triangles':sum(m.g['accessors'][p['indices']]['count']//3 for mesh in m.g['meshes'] for p in mesh['primitives']),'textures':len(m.g['images']),'materials':len(m.g['materials'])};manifest.append(entry)
  audit.append({'key':key,'norad':ident,'family':family,'length_m':length,'reference_span_m':span,'span_approximate':key in ('salyut-2','salyut-3','salyut-5','tiangong-1'),'solar_arrays':arrays,'docking_ports':ports,'parts':m.parts,'source':source,'triangles':entry['triangles'],'bytes':entry['bytes'],'note':note});print(key,entry['triangles'],'triangles',len(runtime),'bytes')
 (ROOT/'resources/detailed-model-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n');(ROOT/'resources/detailed-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')));(ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))));(ROOT/'resources/historical-station-models.json').write_text(json.dumps({'models':audit,'sources':[NASA,ESA,CMSE],'license':'CC BY 4.0','configuration_note':'One permanently visible Soyuz per Salyut, as an explicitly requested illustrative assembly; not a historical docking state. Progress/TKS not modelled.'},ensure_ascii=False,indent=2)+'\n')
 # Keep the existing runtime inventory in step without touching any other asset.
 runtime=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());runtime=[r for r in runtime if r['key'] not in keys]
 for m in manifest:
  if m['key'] in keys:runtime.append({'key':m['key'],'runtime_url':m['url'],'runtime_bytes':m['bytes'],'original_bytes':(ROOT/m['original_file']).stat().st_size,'triangles':m['triangles'],'original_triangles':m['triangles'],'compression':'original'})
 (ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
