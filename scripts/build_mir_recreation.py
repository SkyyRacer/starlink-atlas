"""Original Atlas reconstruction of the complete Mir exterior, late Shuttle-Mir.
Public TurboSquid 529931 preview is an appearance reference, not an asset source.
Dimensions/module directions: NASA SP-4225 and ESA bulletin 88 (see report).
Source +X runs from forward node through core to aft Kvant-1; +Y Kvant-2,
-Z Kristall, -Y Spektr, +Z Priroda. Secondary fittings/finishes interpreted.
"""
import hashlib,json,math,struct
from pathlib import Path
from build_historical_stations import Model,png
from build_tiangong_recreation import Frame,group
ROOT=Path(__file__).resolve().parents[1]
NASA='https://www.nasa.gov/history/SP-4225/mir/mir.htm'
ESA='https://www.esa.int/esapub/bulletin/bullet88/reite88.htm'
SOLAR='https://ntrs.nasa.gov/citations/19950021792'
REFERENCE='https://www.turbosquid.com/fr/3d-models/mir-space-station-3d-model/529931'
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(v):
 l=math.hypot(*v);return tuple(x/l for x in v)
def matrix(origin,z,normal):
 z=unit(z);x=unit(tuple(normal[k]-sum(normal[j]*z[j] for j in range(3))*z[k] for k in range(3)));y=cross(z,x);return [*x,0,*y,0,*z,0,*origin,1]
def inverse(a):
 r=[a[i*4+j] if i<3 and j<3 else 0 for j in range(4) for i in range(4)];r[15]=1
 for i in range(3):r[12+i]=-sum(r[k*4+i]*a[12+k] for k in range(3))
 return r
def sphere(m,name,c,r,material='ivory'):
 verts=[];normals=[];uv=[];faces=[];rows=18;cols=48
 for j in range(rows+1):
  phi=math.pi*j/rows
  for i in range(cols+1):
   t=math.pi*2*i/cols;n=(math.cos(phi),math.sin(phi)*math.cos(t),math.sin(phi)*math.sin(t));verts.append(tuple(c[k]+r*n[k] for k in range(3)));normals.append(n);uv.append((i/cols,j/rows))
 for j in range(rows):
  for i in range(cols):
   a=j*(cols+1)+i;b=a+cols+1
   if j:faces.append((a,b,a+1))
   if j<rows-1:faces.append((a+1,b,b+1))
 m.mesh(name,verts,normals,uv,faces,material)
def rig(m,first,name,pivot,axis,normal):
 roots=m.g['scenes'][0]['nodes'];children=[i for i in roots if i>=first];roots[:]=[i for i in roots if i not in children];base=matrix(pivot,axis,normal);cancel=len(m.g['nodes']);m.g['nodes'].append({'name':name+' bind geometry','matrix':inverse(base),'children':children});joint=len(m.g['nodes']);m.g['nodes'].append({'name':name,'matrix':base,'children':[cancel]});roots.append(joint)
 m.solar_rig.append({'name':name,'kind':'beta','body_from_joint':base,'base_matrix':base,'normal_body':list(normal),'minimum_angle':-math.pi/2,'maximum_angle':math.pi/2,'note':'One-axis nominal Sun pointing, bounded 180-degree travel; not historical motor telemetry.'})
def wing(f,name,x,theta,start,end,width,movable=True):
 m=f.m;first=len(m.g['nodes']);rad=(0,math.cos(theta),math.sin(theta));normal=(0,-math.sin(theta),math.cos(theta));side=(1,0,0)
 p=lambda r,n=0,dx=0:f.p((x+dx,r*rad[1]+n*normal[1],r*rad[2]+n*normal[2]))
 basis=[f.axis,f.n(rad),f.n(normal)]
 m.tube(name+' root drive',p(start-.3),p(start+.2),.12,mat='steel',segments=32)
 count=max(5,round((end-start)/.75));length=(end-start)/count
 for j in range(count):
  a=start+j*length+.025;b=start+(j+1)*length-.025;c=(a+b)/2
  m.box(name+' bronze rear',p(c),[width,b-a,.038],'mir-back',basis,repeat=(max(1,width),1));m.box(name+' photovoltaic cells',p(c,-.025),[width-.035,b-a-.025,.009],'mir-cells',basis,repeat=(width/.45,(b-a)/.35))
  for dx in [-width/2,width/2]:m.tube(name+' edge rail',p(a,-.02,dx),p(b,-.02,dx),.018,mat='silver',segments=8)
  m.tube(name+' fold rib',p(a,-.02,-width/2),p(a,-.02,width/2),.02,mat='silver',segments=8)
 m.tube(name+' central mast',p(start),p(end),.035,mat='steel',segments=12)
 if movable:rig(m,first,name,p(start),f.n(rad),f.n(tuple(-v for v in normal)))
 else:group(m,first,name+' fixed')
 m.wings.append({'name':name,'module':f.prefix,'movable':movable,'axis':list(f.n(rad)),'pivot':list(p(start)),'normal':list(f.n(tuple(-v for v in normal))),'width_m':width,'length_m':end-start})
def detail(f,a,b,r):
 # Short blanket seams, circumferential straps, external wiring and handrails.
 m=f.m
 for j in range(8):
  x=a+(b-a)*j/7;f.axial('Thermal blanket strap',x-.018,x+.018,r+.018,mat='silver',segments=64)
  for t in [.4,1.5,2.6,3.7,4.8,5.9]:
   y,z=math.cos(t),math.sin(t);f.tube('Blanket fastener',(x,r*y,r*z),(x,(r+.045)*y,(r+.045)*z),.025,mat='steel',segments=8)
  if j%2==0:
   for t in [.8,3.8]:
    y,z=math.cos(t),math.sin(t)
    f.tube('EVA handrail',(x-.28,(r+.09)*y,(r+.09)*z),(x+.28,(r+.09)*y,(r+.09)*z),.02,mat='ivory',segments=10)
 for t in [.3,2.7,4.3]:
  y,z=math.cos(t),math.sin(t);f.tube('Exterior cable harness',(a,(r+.035)*y,(r+.035)*z),(b,(r+.035)*y,(r+.035)*z),.03,mat='steel',segments=10)
 for x in [a+.65,b-.6]:
  for t in [0,math.pi]:
   y,z=math.cos(t),math.sin(t);f.tube('Porthole silver rim',(x,r*y,r*z),(x,(r+.07)*y,(r+.07)*z),.16,mat='silver',segments=32);f.tube('Porthole glass',(x,(r+.075)*y,(r+.075)*z),(x,(r+.079)*y,(r+.079)*z),.125,mat='glass',segments=32)
 for x in [a+1,b-1]:f.box('Rectangular thermal radiator',(x,0,-r-.045),(1.25,1.65,.06),'ivory')
 for x in [a+1,b-1]:
  # Original exterior interpretation: louvres, bracketed instruments and plumbing.
  for side in [-1,1]:
   f.box('Instrument mounting frame',(x,side*(r+.08),.65),(.72,.14,.85),'steel');f.box('Insulated electronics unit',(x,side*(r+.19),.65),(.61,.2,.72),'ivory')
   for z in [.4,.55,.7,.85]:f.box('Equipment louvre',(x,side*(r+.3),z),(.5,.025,.025),'dark')
  for dx in [-.42,.42]:f.tube('Radiator retaining rail',(x+dx,-.65,-r-.12),(x+dx,.65,-r-.12),.025,mat='steel',segments=10)
  f.tube('Thermal fluid pipe',(x-.55,0,-r-.1),(x+.55,0,-r-.1),.03,mat='steel',segments=10)
 # Paired pressurisation bottles and their ring clamps; placement is illustrative.
 for side in [-1,1]:
  c=f.p((b-.3,side*(r+.16),.15));sphere(m,f.prefix+' exterior pressure bottle',c,.19,'ivory')
  f.tube('Pressure bottle neck',(b-.3,side*(r+.16),.3),(b-.3,side*(r+.16),.46),.055,mat='steel',segments=16)
  f.tube('Sensor whip',(a+.6,.4,-r),(a+.6,.4,-r-.95),.012,mat='steel',segments=8)

def dish(m,name,c,axis,r):
 axis=unit(axis);u=unit(cross(axis,(1,0,0) if abs(axis[0])<.8 else (0,1,0)));v=cross(axis,u);verts=[];normals=[];uv=[];faces=[]
 for j in range(9):
  radius=r*j/8
  for i in range(49):
   t=2*math.pi*i/48;rad=[u[k]*math.cos(t)+v[k]*math.sin(t) for k in range(3)];verts.append(tuple(c[k]+radius*rad[k]+.16*(radius/r)**2*axis[k] for k in range(3)));normals.append(unit(tuple(axis[k]-.32*radius/(r*r)*rad[k] for k in range(3))));uv.append((.5+radius/r*.5*math.cos(t),.5+radius/r*.5*math.sin(t)))
 for j in range(8):
  for i in range(48):
   a=j*49+i;b=a+49;faces.extend([(a,b,a+1),(a+1,b,b+1)])
 m.mesh(name,verts,normals,uv,faces,'ivory');tip=tuple(c[k]+axis[k]*.65 for k in range(3))
 for i in range(3):
  t=2*math.pi*i/3;m.tube(name+' feed strut',tuple(c[k]+r*(u[k]*math.cos(t)+v[k]*math.sin(t)) for k in range(3)),tip,.012,mat='steel',segments=8)
 m.tube(name+' receiver',tip,tuple(tip[k]+axis[k]*.08 for k in range(3)),.04,mat='gold',segments=12)
def materials(m):
 def add(name,color,metal,rough,texture=None):
  pbr={'baseColorFactor':[*color,1],'metallicFactor':metal,'roughnessFactor':rough}
  if texture is not None:pbr['baseColorTexture']={'index':texture}
  m.materials[name]=len(m.g['materials']);m.g['materials'].append({'name':name,'pbrMetallicRoughness':pbr})
 def tex(fn):
  m.g['images'].append({'bufferView':m.view(png(512,512,fn)),'mimeType':'image/png'});m.g['textures'].append({'source':len(m.g['images'])-1,'sampler':0});return len(m.g['textures'])-1
 hull=tex(lambda x,y:(224+int(6*math.sin(x*.03)*math.cos(y*.04))-((x*31+y*17)%5),220+int(6*math.sin(x*.03)*math.cos(y*.04)),207+int(5*math.cos(y*.05))) if min(x%128,y%128)>1 else (184,180,168))
 cell=tex(lambda x,y:(153,160,161) if x%32<2 or y%32<2 else (107,108,94) if x%32==16 else (33+(x*7+y*13)%5,43+(x+y)%5,52+(x*3+y)%5))
 back=tex(lambda x,y:(101,72,41) if x%32>1 and y%32>1 else (144,140,126))
 add('mir-hull',[1,1,1],.1,.58,hull);add('mir-cells',[1,1,1],.42,.3,cell);add('mir-back',[1,1,1],.5,.37,back);add('mir-orange',[.88,.48,.08],.48,.33,1);add('mir-blanket',[.42,.39,.30],.32,.48,1)
 m.g['materials'][m.materials['mir-hull']]['normalTexture']={'index':3,'scale':.075}
 for alias,target in [('tg-white','mir-hull'),('tg-grey','mir-blanket'),('tg-frame','steel')]:m.materials[alias]=m.materials[target]
def base_module(m):
 f=Frame(m,prefix='Mir core');first=len(m.g['nodes']);sphere(m,'Mir forward transfer sphere',(.8,0,0),1.1,'mir-hull');f.axial('Node aft connector',1.35,2.1,.85,1.45,'mir-hull');f.axial('Small working compartment',2.1,5.8,1.45,mat='mir-hull');f.axial('Working cone',5.8,6.75,1.45,2.075,'mir-hull');f.axial('Main working compartment',6.75,11.6,2.075,mat='mir-hull');f.axial('Resource section',11.6,12.6,2.075,1.5,'mir-blanket');f.axial('Aft docking tunnel',12.6,13.1,.7,mat='steel');detail(f,2.3,5.5,1.45);detail(f,7.0,11.3,2.075)
 for theta in [0,math.pi/2,math.pi,math.pi*1.5]:
  y,z=math.cos(theta),math.sin(theta);f.tube('Radial module docking collar',(.8,.95*y,.95*z),(.8,1.3*y,1.3*z),.72,mat='steel',segments=64)
 for t in [0,math.pi/2,math.pi,math.pi*1.5]:
  y,z=math.cos(t),math.sin(t);f.tube('Attitude thruster manifold',(11.9,1.5*y,1.5*z),(12.35,1.8*y,1.8*z),.08,mat='steel',segments=20)
 wing(f,'Mir core port solar',10.5,0,2.15,14.1,3.45);wing(f,'Mir core starboard solar',10.5,math.pi,2.15,14.1,3.45)
 wing(f,'Mir core dorsal fixed solar',9.2,-math.pi/2,2.15,9.9,2.75,False)
 dish(m,'Luch high gain antenna',(12.0,0,-2.5),(1,0,-.2),.62);group(m,first,'Mir core module')
 m.modules.append({'name':'Mir core','length_m':13.1,'max_diameter_m':4.15,'axis':[1,0,0],'origin':[0,0,0]})
def lab(m,name,origin,axis,length,diam=4.4):
 f=Frame(m,origin,axis,name);first=len(m.g['nodes']);r=diam/2
 f.axial('Docking neck',0,.65,.72,mat='steel');f.axial('Transfer cone',.65,2.0,.72,1.45,'mir-hull');f.axial('Forward instrumentation',2.,3.7,1.45,mat='mir-hull');f.axial('Cabin transition',3.7,4.6,1.45,r,'mir-hull');f.axial('Laboratory cabin',4.6,length-2.7,r,mat='mir-hull');f.axial('Aft equipment cone',length-2.7,length-1.6,r,1.35,'mir-blanket');f.axial('Aft equipment section',length-1.6,length-.4,1.35,mat='mir-hull');f.axial('End hatch',length-.4,length,1.35,.7,'steel');detail(f,4.85,length-2.95,r)
 for x in [2.2,length-2.2]:
  for side in [-1,1]:f.box('Gold equipment foil',(x,side*1.3,-.6),(.85,.25,.65),'gold')
 if name=='Kvant-2':
  f.axial('EVA airlock thermal cover',length-2.2,length-.5,1.4,mat='mir-blanket')
  for t in [0,math.pi]:wing(f,'Kvant-2 solar '+str(round(t/math.pi)),8.2,t,2.3,13.7,3.8)
 elif name=='Spektr':
  for t in [0,math.pi]:wing(f,'Spektr steerable solar '+str(round(t/math.pi)),8.4,t,2.3,12.3,3.3)
  for t in [math.pi/3,-math.pi/3]:wing(f,'Spektr oblique fixed solar '+str(round(t,2)),length-1.3,t,1.5,8.8,3.1,False)
 elif name=='Priroda':
  # Priroda had no solar wings; external remote-sensing instrumentation instead.
  for x in [5.,7.,8.7]:
   f.box('Microwave instrument radiator',(x,-2.22,0),(1.45,.22,2.1),'ivory');f.box('Radar electronics foil',(x,2.25,0),(1.05,.35,.7),'gold')
  dish(m,'Priroda travers radar antenna',f.p((length-.7,0,1.6)),f.n((0,0,1)),.8)
 elif name=='Kristall':
  f.axial('APAS docking adapter',length-.2,length+.25,.74,mat='steel')
  dm=Frame(m,f.p((length,0,0)),axis,'Shuttle docking module');dm.axial('APAS forward ring',0,.25,1.1,mat='steel');dm.axial('Orange insulated pressure shell',.25,4.35,1.1,mat='mir-orange');dm.axial('APAS aft ring',4.35,4.7,1.1,mat='steel')
  for x in [.55,3.9]:dm.axial('Docking module seam',x-.025,x+.025,1.13,mat='silver')
  for side in [-1,1]:dm.box('Stowed cargo fixture',(2.1,side*1.1,0),(2.4,.35,.6),'mir-orange')
  m.modules.append({'name':'Docking module','length_m':4.7,'max_diameter_m':2.2,'axis':list(axis),'origin':list(f.p((length,0,0)))})
 group(m,first,name+' module');m.modules.append({'name':name,'length_m':length,'max_diameter_m':diam,'axis':list(axis),'origin':list(origin)})
def kvant(m):
 f=Frame(m,(13.1,0,0),(1,0,0),'Kvant-1');first=len(m.g['nodes']);f.axial('Docking collar',0,.4,.73,mat='steel');f.axial('Forward body',.4,1.,.73,2.2,'mir-hull');f.axial('Astrophysics compartment',1,4.9,2.2,mat='mir-hull');f.axial('Rear conical compartment',4.9,5.7,2.2,1.3,'mir-blanket');f.axial('Aft visiting port',5.7,6.3,.7,mat='steel');detail(f,1.2,4.5,2.2)
 for side in [-1,1]:
  f.tube('Solar support boom',(3,side*2.0,0),(3,side*3.15,0),.13,mat='silver',segments=24);wing(f,'Kvant-1 relocated solar '+str(side),3,0 if side>0 else math.pi,3.0,14.4,3.4)
 for x in [1.7,3.5]:
  for y in [-.9,.9]:f.tube('X-ray telescope baffle',(x,y,-2.0),(x,y,-2.65),.22,mat='steel',segments=32)
 group(m,first,'Kvant-1 module');m.modules.append({'name':'Kvant-1','length_m':6.3,'max_diameter_m':4.4,'axis':[1,0,0],'origin':[13.1,0,0]})
def strela(m):
 a=(3.3,1.65,-1.2);b=(.8,3.6,-11.5);d=unit(tuple(b[k]-a[k] for k in range(3)));u=unit(cross(d,(0,1,0)));v=cross(d,u)
 for j in range(17):
  for k in range(3):
   theta=2*math.pi*k/3;point=lambda t,e:tuple(a[q]+t*(b[q]-a[q])+.16*(math.cos(e)*u[q]+math.sin(e)*v[q]) for q in range(3));m.tube('Strela triangular longeron',point(j/17,theta),point((j+1)/17,theta),.017,mat='silver',segments=8);m.tube('Strela truss diagonal',point(j/17,theta),point((j+1)/17,theta+2*math.pi/3),.011,mat='steel',segments=6)
 m.box('Strela crane end platform',b,(.65,.7,.7),'ivory')
def build():
 m=Model('mir');m.solar_rig=[];m.wings=[];m.modules=[];materials(m);m.g['asset']['generator']='Atlas original Mir complete exterior reconstruction';base_module(m);kvant(m)
 for args in [('Kvant-2',(.8,1.3,0),(0,1,0),13.7),('Spektr',(.8,-1.3,0),(0,-1,0),14.4),('Kristall',(.8,0,-1.3),(0,0,-1),13.),('Priroda',(.8,0,1.3),(0,0,1),12.)]:lab(m,*args)
 strela(m);m.g['extras']={'atlasOriginalRecreation':{'key':'mir','reference':REFERENCE,'specification_sources':[NASA,ESA,SOLAR],'configuration':'Complete station after Priroda, representative late Shuttle-Mir exterior; no claim of date-exact hardware, visiting craft or measured attitude.','modules':m.modules,'wings':m.wings}}
 return m
def main():
 m=build();sourcefile=ROOT/'resources/detailed-originals/mir-atlas.glb';raw=m.save(sourcefile);sha=hashlib.sha256(raw).hexdigest();positions=[m.g['accessors'][p['attributes']['POSITION']] for mesh in m.g['meshes'] for p in mesh['primitives']];bounds=[[min(a['min'][k] for a in positions),max(a['max'][k] for a in positions)] for k in range(3)];scale=100/max(b-a for a,b in bounds);center=[(a+b)/2 for a,b in bounds];m.g['nodes'].append({'name':'Atlas presentation transform','children':m.g['scenes'][0]['nodes'],'matrix':[scale,0,0,0,0,scale,0,0,0,0,scale,0,*[-x*scale for x in center],1]});m.g['scenes'][0]['nodes']=[len(m.g['nodes'])-1];runtime=m.save(ROOT/'static/images/detailed/mir.glb')
 note='Reconstitution originale Atlas, configuration complète représentative après Priroda. Détails secondaires interprétés ; orientation et panneaux calculés, sans télémétrie historique.'
 source={'file':str(sourcefile.relative_to(ROOT)),'ids':[16609],'page':NASA,'download':NASA,'reference':REFERENCE,'sha256':sha,'version':'Atlas historical reconstruction · Mir PBR','credit':'Atlas · reconstitution documentée NASA/ESA','license':'CC BY 4.0 · original Atlas geometry/textures','body_axes':[[1,0,0],[0,1,0],[0,0,1]],'solar_rig':m.solar_rig,'note':note}
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());sources['mir']=source;(ROOT/'resources/detailed-model-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 info={'key':'mir','ids':[16609],'url':'images/detailed/mir.glb?v='+hashlib.sha256(runtime).hexdigest()[:12],'bytes':len(runtime),'source':NASA,'download':NASA,'sha256':sha,'uv_repairs':[],'compatibility':{},'solar_rig':m.solar_rig,'material_finishes':{},'presentation_focus_node':None,'body_axes':source['body_axes'],'note':note,'credit':source['credit'],'original_file':source['file'],'version':source['version'],'docked_visitors':[],'triangles':sum(m.g['accessors'][p['indices']]['count']//3 for mesh in m.g['meshes'] for p in mesh['primitives']),'textures':len(m.g['images']),'materials':len(m.g['materials'])}
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());manifest=[info if row['key']=='mir' else row for row in manifest];(ROOT/'resources/detailed-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')));(ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());inventory=[{'key':'mir','runtime_url':info['url'],'runtime_bytes':len(runtime),'original_bytes':len(raw),'triangles':info['triangles'],'original_triangles':info['triangles'],'compression':'original'} if row['key']=='mir' else row for row in inventory];(ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n');report={'source':NASA,'layout_source':ESA,'solar_source':SOLAR,'reference':REFERENCE,'modules':m.modules,'wings':m.wings,'solar_rig':m.solar_rig,'triangles':info['triangles'],'bytes':len(runtime),'note':note};(ROOT/'resources/mir-recreation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('Mir:',info['triangles'],'triangles,',len(runtime),'bytes')
if __name__=='__main__':main()
