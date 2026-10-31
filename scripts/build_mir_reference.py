"""Mir exterior v3, independently reconstructed from the user's 24 reference views.
Original meshes/textures. No geometry or textures extracted from a commercial asset.
Dimensions follow the existing NASA/ESA module audit; small fittings are interpreted.
"""
import collections,hashlib,io,json,math,struct
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from build_historical_stations import Model
from build_tiangong_recreation import Frame,transform_recent
from build_mir_recreation import sphere,dish
ROOT=Path(__file__).resolve().parents[1]
REF=Path('/Volumes/SSD_4T0/Desktop/Mir')
FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
class Mir(Model):
 def __init__(self):
  super().__init__('mir');self.batches={};self.component='Core';self.components=[];self.wings=[];self.feature_notes=[]
  for material in self.g['materials']:material.pop('normalTexture',None)
 def mesh(self,name,vertices,normals,uvs,faces,material):
  key=(self.component,material);b=self.batches.setdefault(key,[[],[],[],[]]);offset=len(b[0]);b[0].extend(vertices);b[1].extend(normals);b[2].extend(uvs);b[3].extend(tuple(i+offset for i in f) for f in faces)
 def flush(self):
  for (part,mat),(v,n,uv,f) in self.batches.items():Model.mesh(self,part+' / '+mat,v,n,uv,f,mat)
 def texture(self,name,im,clamp=False):
  out=io.BytesIO();im.save(out,format='PNG');self.g['images'].append({'name':name,'bufferView':self.view(out.getvalue()),'mimeType':'image/png'});self.g['textures'].append({'source':len(self.g['images'])-1,'sampler':1 if clamp else 0});return len(self.g['textures'])-1
 def material(self,name,color,metal,rough,image=None,alpha=False):
  p={'baseColorFactor':[*color,1],'metallicFactor':metal,'roughnessFactor':rough}
  if image is not None:p['baseColorTexture']={'index':self.texture(name,image,alpha)}
  g={'name':name,'pbrMetallicRoughness':p,'doubleSided':False}
  if alpha:g.update(alphaMode='MASK',alphaCutoff=.35)
  self.materials[name]=len(self.g['materials']);self.g['materials'].append(g)
def coatings(m):
 m.g['samplers'].append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071})
 rng=np.random.default_rng(30032001)
 def paint(base,foil=False):
  small=Image.fromarray(np.uint8(np.clip(128+rng.normal(0,12,(48,48)),0,255))).resize((768,768),Image.Resampling.BICUBIC);a=(np.asarray(small,dtype=float)-128)*(.20 if not foil else .5);y,x=np.mgrid[:768,:768]
  if foil:a+=3*np.sin(x*.038+2*np.sin(y*.023))*np.cos(y*.041)
  return Image.fromarray(np.uint8(np.clip(np.array(base)+a[:,:,None],0,255)),'RGB')
 for name,color,metal,rough in [('shell',(229,230,222),.12,.56),('blanket',(190,190,174),.22,.65),('silverplate',(209,216,218),.8,.29),('orangefoil',(199,130,38),.58,.42),('blackwrap',(62,66,65),.10,.78),('redband',(135,34,30),.05,.63)]:m.material(name,[1,1,1],metal,rough,paint(color,name in ['blanket','orangefoil','blackwrap']))
 solar=Image.new('RGB',(768,768),'#263b49');d=ImageDraw.Draw(solar)
 for x in range(0,768,48):
  for y in range(0,768,96):d.rectangle((x+2,y+2,x+45,y+93),fill=(34+(y//96)%3,49+(x//48)%3,59));d.line((x+24,y+3,x+24,y+92),fill='#697b80',width=1)
 for y in range(0,768,24):d.line((0,y,768,y),fill='#55666c',width=1)
 m.material('photo-cells',[1,1,1],.42,.34,solar)
 back=Image.new('RGB',(768,768),'#626b6d');d=ImageDraw.Draw(back)
 for y in range(0,768,96):d.line((0,y,768,y),fill='#b6bab2',width=4)
 for x in range(0,768,192):d.line((x,0,x,768),fill='#c5c7bc',width=3)
 m.material('photo-back',[1,1,1],.47,.46,back)
 for name,text in [('core-name','МИР'),('cccp','СССР'),('soyuz-name','СОЮЗ'),('progress-name','ПРОГРЕСС'),('kvant-name','КВАНТ'),('spektr-name','СПЕКТР')]:
  im=Image.new('RGBA',(1024,256));d=ImageDraw.Draw(im);font=ImageFont.truetype(FONT,180 if len(text)<7 else 135);box=d.textbbox((0,0),text,font=font);d.text(((1024-(box[2]-box[0]))/2,15-box[1]),text,font=font,fill='#862d27');m.material(name,[1,1,1],0,.7,im,True)
 im=Image.new('RGBA',(768,512));d=ImageDraw.Draw(im);d.rectangle((12,12,756,500),fill='#a82923');d.polygon([(128,60),(141,99),(184,99),(149,125),(162,166),(128,141),(94,166),(107,125),(72,99),(115,99)],fill='#d9c36e');d.arc((93,174,224,335),270,120,fill='#d9c36e',width=17);d.line((85,306,202,190),fill='#d9c36e',width=16);d.line((155,170,217,232),fill='#d9c36e',width=20);m.material('soviet-mark',[1,1,1],0,.7,im,True)
 im=Image.new('RGBA',(768,512));d=ImageDraw.Draw(im)
 for j,c in enumerate(['#efefec','#294b96','#aa302a']):d.rectangle((12,12+j*162,756,12+(j+1)*162),fill=c)
 m.material('russian-mark',[1,1,1],0,.68,im,True)
def curved(f,name,a,b,r,theta,arc,mat):
 verts=[];norm=[];uv=[];faces=[];n=24
 for i in range(n+1):
  t=theta+(i/n-.5)*arc
  for u in [0,1]:verts.append(f.p((a+(b-a)*u,r*math.cos(t),r*math.sin(t))));norm.append(f.n((0,math.cos(t),math.sin(t))));uv.append((1-u,1-i/n))
 for i in range(n):k=i*2;faces.extend([(k,k+2,k+1),(k+1,k+2,k+3)])
 f.m.mesh(f.prefix+' '+name,verts,norm,uv,faces,mat)
def stamp(f,x,r,theta,w,h,mat):
 # Dedicated non-repeating UVs on conformal geometry, offset 8 mm from hull.
 # Written along the module axis; every glyph is entirely inside this patch.
 curved(f,'Marking '+mat,x-w/2,x+w/2,r+.008,theta,h/r,mat)
def trim(f,a,b,r,rows=5):
 for i in range(rows):
  x=a+(b-a)*i/(rows-1);f.axial('Seam strap',x-.013,x+.013,r+.013,mat='silverplate',segments=72)
  for t in [.55,1.6,2.7,3.8,4.9,6.0]:
   y,z=math.cos(t),math.sin(t);f.tube('Blanket stud',(x,r*y,r*z),(x,(r+.025)*y,(r+.025)*z),.025,mat='steel',segments=8)
 for t in [.8,3.5,5.2]:
  y,z=math.cos(t),math.sin(t)
  for i in range(3):
   x=a+.45+(b-a-1.2)*i/2
   for xx in [x-.23,x+.23]:f.tube('Handrail foot',(xx,r*y,r*z),(xx,(r+.10)*y,(r+.10)*z),.02,mat='steel',segments=8)
   f.tube('EVA grip',(x-.23,(r+.11)*y,(r+.11)*z),(x+.23,(r+.11)*y,(r+.11)*z),.022,mat='silverplate',segments=10)
def radiator(f,a,b,r,theta,width=1.4):
 arc=width/r;curved(f,'Curved white radiator',a,b,r+.07,theta,arc,'shell')
 # Connected serpentine circuit with rounded returns, as seen in the turntable.
 lanes=8;raw=[];left=a+.18;right=b-.18;rr=r+.09
 for i in range(lanes):
  transverse=-width*.39+i*width*.78/(lanes-1)
  raw.extend([(left,transverse),(right,transverse)] if i%2==0 else [(right,transverse),(left,transverse)])
 smooth=[raw[0]]
 for i in range(1,len(raw)-1):
  before=np.array(raw[i-1]);corner=np.array(raw[i]);after=np.array(raw[i+1]);u=before-corner;v=after-corner;cut=min(.065,np.linalg.norm(u)*.3,np.linalg.norm(v)*.3);u=corner+u/np.linalg.norm(u)*cut;v=corner+v/np.linalg.norm(v)*cut;smooth.append(tuple(u))
  for j in range(1,7):
   t=j/6;smooth.append(tuple((1-t)**2*u+2*(1-t)*t*corner+t*t*v))
 smooth.append(raw[-1]);points=[(float(x),rr*math.cos(theta+float(y)/r),rr*math.sin(theta+float(y)/r)) for x,y in smooth]
 for p,q in zip(points,points[1:]):f.tube('Radiator serpentine return',p,q,.012,mat='blackwrap',segments=8)
 for x in [a+.03,b-.03]:
  points=[(x,(r+.095)*math.cos(theta+(i/12-.5)*arc),(r+.095)*math.sin(theta+(i/12-.5)*arc)) for i in range(13)]
  for p,q in zip(points,points[1:]):f.tube('Radiator raised perimeter',p,q,.023,mat='silverplate',segments=8)
 for side in [-1,1]:
  t=theta+side*arc/2;f.tube('Radiator longitudinal frame',(a,(r+.095)*math.cos(t),(r+.095)*math.sin(t)),(b,(r+.095)*math.cos(t),(r+.095)*math.sin(t)),.023,mat='silverplate',segments=8)

def service_bay(f,a,b,r,theta):
 # Two separate curved covers flank an exposed equipment corridor.
 curved(f,'Dark recessed equipment corridor',a,b,r+.018,theta,.30,'blackwrap')
 for x,radius in [(a+.45,.19),(a+1.1,.13),(a+1.75,.22),(b-.45,.15)]:
  c=(x,(r+.12)*math.cos(theta),(r+.12)*math.sin(theta));sphere(f.m,f.prefix+' exposed reservoir',f.p(c),radius,'shell')
 for t in [theta-.11,theta+.11]:
  f.tube('Exposed pressure line',(a+.2,(r+.12)*math.cos(t),(r+.12)*math.sin(t)),(b-.2,(r+.12)*math.cos(t),(r+.12)*math.sin(t)),.035,mat='silverplate',segments=12)
 for t in [theta-.67,theta+.67]:radiator(f,a,b,r+.04,t,1.65)

def travers_radar(f):
 # The turntable shows a broad rectangular curved open-wire reflector, not a dish.
 # Long direction follows Priroda; aperture faces the forward half of the station.
 previous_component=f.m.component;f.m.component='Priroda Travers'
 def point(u,v):return (7.3+u,-3.6+v,-1.65+.105*u*u)
 for v in [-1.13,1.13]:
  ps=[point(-2.1+4.2*j/30,v) for j in range(31)]
  for a,b in zip(ps,ps[1:]):f.tube('Travers reflector perimeter',a,b,.025,mat='silverplate',segments=8)
 for u in [-2.1,2.1]:f.tube('Travers reflector side',point(u,-1.13),point(u,1.13),.025,mat='silverplate',segments=8)
 for i in range(25):
  u=-2.1+i*4.2/24;f.tube('Travers wire grid vertical',point(u,-1.13),point(u,1.13),.006,mat='steel',segments=6)
 for i in range(17):
  v=-1.13+i*2.26/16;ps=[point(-2.1+4.2*j/16,v) for j in range(17)]
  for a,b in zip(ps,ps[1:]):f.tube('Travers wire grid curved',a,b,.006,mat='steel',segments=6)
 for x in [5.7,8.9]:
  f.tube('Travers mounting strut',(x,-1.65,-1.20),(x,-2.55,-1.4),.035,mat='steel',segments=12)
  f.tube('Travers mounting brace',(x,-1.35,-.7),(x,-3.5,-1.1),.024,mat='steel',segments=10)
 f.box('Travers receiver',(7.3,-3.6,-2.15),(.42,.35,.22),'shell')
 f.m.feature_notes.append('Priroda Travers: 4.2 x 2.26 m interpreted curved rectangular wire reflector from the supplied turntable');f.m.component=previous_component

def end_equipment(f,x,r):
 port(f,x,r)
 for j in range(4):
  t=j*math.pi/2+.4;y,z=math.cos(t),math.sin(t)
  f.tube('Equipment cap detector barrel',(x-.1,r*.68*y,r*.68*z),(x+.45,r*.68*y,r*.68*z),.18,mat='shell',segments=24)
  f.tube('Equipment detector aperture',(x+.455,r*.68*y,r*.68*z),(x+.46,r*.68*y,r*.68*z),.125,mat='blackwrap',segments=24)
 for side in [-1,1]:
  f.box('Rear sensor bracket',(x+.12,side*.55,-.5),(.42,.6,.5),'shell')
  f.tube('Antenna mast',(x-.15,side*r*.8,.25),(x+.75,side*(r+.25),.45),.018,mat='steel',segments=8)
def port(f,x,r):
 f.axial('Docking outer collar',x,x+.04,r,mat='silverplate');f.axial('Docking dark recess',x+.045,x+.052,r*.78,mat='blackwrap');f.axial('Docking inner ring',x+.055,x+.068,r*.54,mat='steel');f.axial('Docking hatch inset',x+.071,x+.075,r*.45,mat='blackwrap')
 for j in range(12):
  t=j*math.pi/6;y,z=math.cos(t),math.sin(t);f.tube('Docking perimeter bolt',(x+.04,r*.91*y,r*.91*z),(x+.12,r*.91*y,r*.91*z),.035,mat='steel',segments=10)
 for j in range(3):
  t=j*math.pi*2/3;y,z=math.cos(t),math.sin(t);f.tube('Docking alignment petal',(x+.04,r*.73*y,r*.73*z),(x+.25,r*.64*y,r*.64*z),.065,mat='silverplate',segments=12)

def equipment(f,a,b,r):
 trim(f,a,b,r)
 # Narrow instrument trays and their visible supports stand clear of the blankets.
 for x in [a+.65,b-.65]:
  for side in [-1,1]:
   f.box('Avionics tray support',(x,side*(r+.11),.35),(.62,.12,.72),'steel');f.box('Avionics thermal cover',(x,side*(r+.21),.35),(.56,.10,.65),'shell')
   for j in range(5):f.box('Vent louvre',(x-.20+j*.1,side*(r+.27),.35),(.035,.02,.48),'blackwrap')
 for theta in [.1,2.7,4.2]:
  for j in range(4):
   x=a+.6+(b-a-1.2)*j/3;y,z=math.cos(theta),math.sin(theta);f.tube('Harness clamp',(x-.035,(r+.07)*y,(r+.07)*z),(x+.035,(r+.07)*y,(r+.07)*z),.04,mat='silverplate',segments=8)

 for t in [.12,2.3,4.4]:
  y,z=math.cos(t),math.sin(t);f.tube('External bundled wiring',(a,(r+.04)*y,(r+.04)*z),(b,(r+.04)*y,(r+.04)*z),.025,mat='blackwrap',segments=10)
 for x in [a+.3,b-.3]:
  for t in [0,math.pi]:
   y,z=math.cos(t),math.sin(t);f.tube('Porthole rim',(x,r*y,r*z),(x,(r+.07)*y,(r+.07)*z),.15,mat='steel',segments=32);f.tube('Porthole glass',(x,(r+.074)*y,(r+.074)*z),(x,(r+.079)*y,(r+.079)*z),.118,mat='glass',segments=32)
def wing(f,label,x,theta,start,end,width,accordion=False,normal_offset=0):
 m=f.m;part=m.component;m.component=label;rad=(0,math.cos(theta),math.sin(theta));normal=(0,-math.sin(theta),math.cos(theta));basis=[f.axis,f.n(rad),f.n(normal)];p=lambda d,n=0,dx=0:f.p((x+dx,d*rad[1]+(n+normal_offset)*normal[1],d*rad[2]+(n+normal_offset)*normal[2]));count=18 if accordion else 9
 world_normal=f.n(normal);dominant=max(range(3),key=lambda k:abs(world_normal[k]));front_sign=-1 if world_normal[dominant]>0 else 1
 m.tube(label+' root',p(start-.35),p(start+.2),.1,mat='steel',segments=24)
 for i in range(count):
  lo=start+i*(end-start)/count+.018;hi=start+(i+1)*(end-start)/count-.018
  h0=(.24 if i%2==0 else -.24) if accordion else 0;h1=-h0;slope=(h1-h0)/(hi-lo)
  leaf=lambda d,n=0,dx=0:p(d,n+h0+slope*(d-lo),dx)
  face_normal=np.array(normal)-slope*np.array(rad);face_normal=face_normal/np.linalg.norm(face_normal)
  for side,mat in [(front_sign,'photo-cells'),(-front_sign,'photo-back')]:
   verts=[leaf(d,side*.016,dx) for dx,d in [(-width/2,lo),(width/2,lo),(width/2,hi),(-width/2,hi)]];n=f.n(tuple(side*float(v) for v in face_normal));faces=[(0,1,2),(0,2,3)] if side>0 else [(0,2,1),(0,3,2)];m.mesh(label+' folded skin',verts,[n]*4,[(0,0),(1,0),(1,1),(0,1)],faces,mat)
  for dx in [-width/2,0,width/2]:m.tube(label+' leaf rail',leaf(lo,0,dx),leaf(hi,0,dx),.016,mat='silverplate',segments=8)
  for d in [lo,hi]:m.tube(label+' fold hinge',leaf(d,0,-width/2),leaf(d,0,width/2),.018,mat='silverplate',segments=8)
  m.tube(label+' rear diagonal',leaf(lo,.04,-width/2),leaf(hi,.04,width/2),.011,mat='steel',segments=6)
 m.wings.append({'name':label,'module':part,'span':[start,end],'width':width,'accordion':accordion,'fold_depth_m':.48 if accordion else 0,'root_angle_rad':theta,'normal_offset_m':normal_offset,'cell_normal_body':[front_sign*float(v) for v in world_normal],'reference_pose':True});m.component=part

def module(m,name,origin,axis,profile):
 m.component=name;f=Frame(m,origin,axis,name)
 for a,b,r1,r2,mat in profile:f.axial('Pressure shell',a,b,r1,r2,mat,segments=96)
 m.components.append({'name':name,'origin':list(origin),'axis':list(axis),'profile':profile});return f
def truss(m,name,a,b,r=.22,bays=18):
 d=np.array(b)-a;d=d/np.linalg.norm(d);u=np.cross(d,[0,0,1] if abs(d[2])<.9 else [0,1,0]);u=u/np.linalg.norm(u);v=np.cross(d,u);point=lambda t,j:tuple(np.array(a)+(np.array(b)-a)*t+r*(math.cos(j*math.pi/2)*u+math.sin(j*math.pi/2)*v))
 for j in range(4):
  for i in range(bays):m.tube(name+' longeron',point(i/bays,j),point((i+1)/bays,j),.018,mat='silverplate',segments=8);m.tube(name+' diagonal',point(i/bays,j),point((i+1)/bays,j+1),.012,mat='steel',segments=6)
def visitor(m,name,origin,axis,progress=False):
 f=module(m,name,origin,axis,[(0,.35,.65,.70,'steel'),(.35,.75,.70,1.06,'shell'),(.75,2.45,1.06,1.06,'blackwrap'),(2.45,2.9,1.06,.74,'blackwrap'),(2.9,3.3,.74,1.1,'shell'),(3.3,4.45,1.1,1.17,'shell'),(4.45,4.8,1.17,1.30,'silverplate'),(4.8,6.8,1.30,1.30,'shell'),(6.8,7.2,1.30,.95,'steel')])
 if not progress:sphere(m,'Soyuz orbital sphere',f.p((1.55,0,0)),1.13,'blackwrap')
 trim(f,.8,2.35,1.075,4);trim(f,4.95,6.65,1.315,4)
 for side in [-1,1]:wing(f,name+' solar '+str(side),5.7,math.pi/2 if side>0 else -math.pi/2,1.35,5.2,1.05)
 for t in [0,math.pi]:stamp(f,1.6,1.08,t,.8,.22,'progress-name' if progress else 'soyuz-name');stamp(f,2.15,1.085,t,.28,.18,'russian-mark')
 for y in [-.6,.6]:f.tube('Engine nozzle',(6.95,y,0),(7.35,y,0),.16,.25,'steel',segments=32)
 f.axial('Engine face',7.2,7.23,.95,mat='blackwrap');port(f,7.23,.93);dish(m,name+' rendezvous dish',f.p((.4,0,1.35)),f.n((0,0,1)),.32)

def build():
 m=Mir();coatings(m);m.component='Node';sphere(m,'Central transfer node',(0,0,0),1.22,'blanket')
 for axis in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]:m.tube('Node docking flange',tuple(.95*x for x in axis),tuple(1.5*x for x in axis),.75,mat='steel',segments=64)
 f=module(m,'Core',(1.3,0,0),(1,0,0),[(0,.6,.75,1.45,'blanket'),(.6,4.1,1.45,1.45,'shell'),(4.1,5.1,1.45,2.075,'blanket'),(5.1,9.7,2.075,2.075,'blanket'),(9.7,10.1,2.075,2.075,'redband'),(10.1,11.2,2.075,1.48,'blanket'),(11.2,11.8,1.48,.75,'steel')]);equipment(f,.8,3.85,1.45);equipment(f,5.3,9.5,2.075)
 for t in [.1,math.pi,math.pi/2]:radiator(f,5.55,8.9,2.09,t,1.3)
 for t in [-.8,2.3]:stamp(f,8.9,2.09,t,1.35,.43,'core-name');stamp(f,8.9,2.095,t-.24,.8,.21,'cccp');stamp(f,7.75,2.095,t,.6,.4,'soviet-mark')
 for side in [-1,1]:wing(f,'Core wing '+str(side),8.6,math.pi/2 if side>0 else -math.pi/2,2.2,13.5,3.2)
 wing(f,'Core narrow dorsal wing',7.4,0,2.2,9.4,1.85,True)
 dish(m,'Luch antenna',f.p((10.6,0,-2.7)),f.n((1,0,-.25)),.68)
 f=module(m,'Kvant-1',(13.1,0,0),(1,0,0),[(0,.4,.75,.75,'steel'),(.4,1.0,.75,2.05,'blanket'),(1,4.8,2.05,2.05,'blanket'),(4.8,5.6,2.05,1.25,'blanket'),(5.6,6.3,1.25,.68,'steel')]);equipment(f,1.2,4.6,2.05)
 for t in [math.pi/2,math.pi*1.5]:radiator(f,1.45,4.3,2.07,t,1.5)
 for side in [-1,1]:wing(f,'Kvant-1 accordion '+str(side),2.8,math.pi/2 if side>0 else -math.pi/2,2.2,13.9,2.7,True,-2.65*side)
 for side in [-1,1]:f.tube('Raised array support boom',(2.8,1.7,side*1.0),(2.8,2.65,side*2.2),.09,mat='silverplate',segments=20)
 truss(m,'Sofora',(16,1.2,-1.4),(16,1.2,-15.5),.24,23);m.box('Sofora propulsion package',(16,1.2,-15.5),(.8,.8,.7),'shell')
 visitor(m,'Progress',(19.4,0,0),(1,0,0),True)
 # Distinct radial module shoulders and equipment profiles visible in the 24 views.
 f=module(m,'Kvant-2',(0,1.45,0),(0,1,0),[(0,.6,.72,.72,'steel'),(.6,1.45,.72,1.45,'blanket'),(1.45,2.55,1.45,1.45,'shell'),(2.55,3.8,1.45,2.10,'blanket'),(3.8,9.5,2.10,2.10,'blanket'),(9.5,10.2,2.10,1.65,'blanket'),(10.2,12.0,1.65,1.65,'shell'),(12,12.3,1.65,.9,'steel')]);equipment(f,4,9.3,2.1)
 service_bay(f,4.05,9.3,2.12,0)
 for side in [-1,1]:wing(f,'Kvant-2 wing '+str(side),7.3,math.pi/2-.10 if side>0 else -math.pi/2+.10,2.25,12.8,3.15)
 port(f,12.3,.9)
 dish(m,'Kvant-2 docking radar',f.p((11.5,0,-1.9)),f.n((1,0,-.3)),.35)
 f=module(m,'Spektr',(0,-1.45,0),(0,-1,0),[(0,.5,.72,.72,'steel'),(.5,1.5,.72,1.45,'blanket'),(1.5,2.8,1.45,1.45,'shell'),(2.8,3.6,1.45,2.10,'blanket'),(3.6,8.7,2.10,2.10,'blanket'),(8.7,10.2,2.10,1.25,'blanket'),(10.2,12.4,1.25,.9,'shell')]);equipment(f,3.85,8.45,2.1)
 service_bay(f,3.9,8.45,2.12,math.pi)
 for side in [-1,1]:wing(f,'Spektr main '+str(side),6.9,math.pi/2+.10 if side>0 else -math.pi/2-.10,2.25,11.8,3.1)
 for t in [math.pi/3,-math.pi/3]:wing(f,'Spektr oblique '+str(round(t,2)),11.2,t,1.3,8.7,2.9)
 f=module(m,'Priroda',(0,0,1.45),(0,0,1),[(0,.6,.72,.72,'steel'),(.6,1.8,.72,1.45,'blanket'),(1.8,2.9,1.45,1.45,'shell'),(2.9,3.8,1.45,2.10,'blanket'),(3.8,9.5,2.10,2.10,'blanket'),(9.5,10.3,2.1,1.7,'blanket'),(10.3,11.6,1.7,1.2,'shell')]);equipment(f,4,9.2,2.1)
 for t in [-math.pi/2,math.pi/2]:radiator(f,4.1,9.25,2.12,t,2.35)
 end_equipment(f,11.6,1.2)
 for j in range(11):f.box('External radiator fin',(8.2,0,-2.2-j*.075),(2.6,1.8,.025),'silverplate')
 for x in [4.7,5.55,6.4,7.25]:
  for side in [-1,1]:sphere(m,'Priroda external gas bottle',f.p((x,side*1.4,-1.7)),.22,'shell')
 travers_radar(f)
 f=module(m,'Kristall',(0,0,-1.45),(0,0,-1),[(0,.6,.72,.72,'steel'),(.6,1.8,.72,1.45,'blanket'),(1.8,3.3,1.45,1.45,'shell'),(3.3,4.2,1.45,2.10,'blanket'),(4.2,8.2,2.10,2.10,'blanket'),(8.2,8.9,2.10,1.1,'blanket'),(8.9,9.45,1.1,1.1,'shell'),(9.45,11.4,.70,.70,'steel')]);equipment(f,4.4,8,2.1)
 for t in [-math.pi/2,math.pi/2]:radiator(f,4.45,8.0,2.12,t,2.35)
 sphere(m,'Kristall APAS spherical terminal',f.p((10.5,0,0)),1.36,'shell')
 for t in [0,math.pi/2,math.pi,math.pi*1.5]:
  y,z=math.cos(t),math.sin(t);f.tube('APAS terminal window rim',(10.5,1.31*y,1.31*z),(10.5,1.39*y,1.39*z),.34,mat='steel',segments=36);f.tube('APAS terminal window',(10.5,1.395*y,1.395*z),(10.5,1.40*y,1.40*z),.28,mat='glass',segments=36)
 for x in [4.8,5.8,6.8,7.8]:
  for t in [.65,2.5]:sphere(m,'Kristall external spherical tank',f.p((x,2.2*math.cos(t),2.2*math.sin(t))),.25,'shell')
 f=module(m,'Docking adapter',(0,0,-12.85),(0,0,-1),[(0,.3,.95,1.13,'steel'),(.3,.55,1.13,1.13,'shell'),(.55,3.9,1.13,1.13,'orangefoil'),(3.9,4.3,1.13,1.13,'shell'),(4.3,4.7,1.13,1.0,'steel')]);trim(f,.7,3.8,1.145,4)
 port(f,4.7,1.0)
 for side in [-1,1]:f.box('Stowed equipment bracket',(2.1,side*1.18,0),(2.2,.35,.55),'orangefoil')
 visitor(m,'Soyuz',(-1.45,0,0),(-1,0,0))
 m.component='Strela';truss(m,'Strela crane',(2.7,1.4,-1.5),(-1.3,4.5,-10),.15,18);m.box('Strela terminal',(-1.3,4.5,-10),(.6,.65,.55),'shell')
 m.flush();m.g['asset']['generator']='Atlas Mir v4 · reconstruction from 24 supplied perspective and wireframe references';m.g['extras']={'atlasReferenceRebuild':{'key':'mir','reference_count':24,'turntable_reference':{'file':'Enregistrement de l’écran 2026-10-30 à 11.39.13.mov','duration_seconds':10.85,'reviewed_seconds':[0,.65,1.45,3,6,9]},'components':m.components,'wings':m.wings,'feature_notes':m.feature_notes,'note':'Independent exterior reconstruction from supplied reference renders. Secondary details, paint placement and fixed deployed pose interpreted; not engineering CAD or date-exact visiting craft/attitude.'}}
 return m

def main():
 m=build();sourcefile=ROOT/'resources/detailed-originals/mir-reference.glb';raw=m.save(sourcefile);sha=hashlib.sha256(raw).hexdigest();a=[m.g['accessors'][p['attributes']['POSITION']] for mesh in m.g['meshes'] for p in mesh['primitives']];lo=[min(q['min'][k] for q in a) for k in range(3)];hi=[max(q['max'][k] for q in a) for k in range(3)];scale=100/max(hi[k]-lo[k] for k in range(3));center=[(hi[k]+lo[k])/2 for k in range(3)];m.g['nodes'].append({'name':'Atlas presentation transform','children':m.g['scenes'][0]['nodes'],'matrix':[scale,0,0,0,0,scale,0,0,0,0,scale,0,*[-v*scale for v in center],1]});m.g['scenes'][0]['nodes']=[len(m.g['nodes'])-1];blob=m.save(ROOT/'static/images/detailed/mir.glb');triangles=sum(m.g['accessors'][p['indices']]['count']//3 for mesh in m.g['meshes'] for p in mesh['primitives']);note=m.g['extras']['atlasReferenceRebuild']['note'];axes=[[1,0,0],[0,1,0],[0,0,1]]
 source={'enabled':True,'file':str(sourcefile.relative_to(ROOT)),'ids':[16609],'page':'https://www.nasa.gov/history/SP-4225/mir/mir.htm','download':'https://www.nasa.gov/history/SP-4225/mir/mir.htm','sha256':sha,'version':'Atlas reference reconstruction v4 · Mir (360-degree review)','credit':'Atlas · reconstitution d’après les 24 références fournies','license':'CC BY 4.0 · original Atlas geometry and textures','body_axes':axes,'solar_rig':[],'note':note,'reference_images':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(REF.glob('*.webp'))]}
 path=ROOT/'resources/detailed-model-sources.json';g=json.loads(path.read_text());g['mir']=source;path.write_text(json.dumps(g,ensure_ascii=False,indent=2)+'\n');info={'key':'mir','ids':[16609],'url':'images/detailed/mir.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'bytes':len(blob),'source':source['page'],'download':source['download'],'sha256':sha,'uv_repairs':[],'compatibility':{},'solar_rig':[],'material_finishes':{},'presentation_focus_node':None,'body_axes':axes,'note':note,'credit':source['credit'],'original_file':source['file'],'version':source['version'],'triangles':triangles,'textures':len(m.g['images']),'materials':len(m.g['materials'])};path=ROOT/'resources/detailed-model-manifest.json';g=json.loads(path.read_text());g=[info if r['key']=='mir' else r for r in g];path.write_text(json.dumps(g,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(g,separators=(',',':')));(ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(g,ensure_ascii=False,separators=(',',':'))));path=ROOT/'resources/model-runtime-manifest.json';g=json.loads(path.read_text());g=[{'key':'mir','runtime_url':info['url'],'runtime_bytes':len(blob),'original_bytes':len(raw),'triangles':triangles,'original_triangles':triangles,'compression':'original'} if r['key']=='mir' else r for r in g];path.write_text(json.dumps(g,ensure_ascii=False,indent=2)+'\n');(ROOT/'resources/mir-reference-rebuild.json').write_text(json.dumps({'info':info,'reference_images':source['reference_images'],'components':m.components,'wings':m.wings,'feature_notes':m.feature_notes,'turntable_reference':m.g['extras']['atlasReferenceRebuild']['turntable_reference'],'bounds':[lo,hi],'mesh_batches':len(m.g['meshes'])},ensure_ascii=False,indent=2)+'\n');print('Mir reference rebuild:',triangles,'triangles;',len(blob),'bytes;',len(m.g['meshes']),'material/component batches')
if __name__=='__main__':main()
