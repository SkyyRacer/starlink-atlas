"""Original Atlas Chinese Space Station exterior, built from public dimensions.
Reference appearance: Sketchfab 205e0d2 thumbnail; no original meshes, viewer
buffers, shaders or textures are extracted. All geometry/material artwork is
created here. Exterior only; fixed illustrative deployed/visiting configuration.
Body frame +X forward docking, +Z nadir. Source geometry is in metres.
"""
import hashlib,json,math,struct
from pathlib import Path
from build_historical_stations import Model,png
from tiangong_one_surfaces import finish,attach_shenzhou
ROOT=Path(__file__).resolve().parents[1]
REFERENCE='https://sketchfab.com/3d-models/tiangong-space-station-205e0d24d4994eb9a232abe728e10a0f'
SPEC='https://www.cnsa.gov.cn/n6758823/n6758838/c10087703/content.html'

def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(v):
 n=math.hypot(*v);return tuple(x/n for x in v)
class Frame:
 def __init__(self,m,origin=(0,0,0),axis=(1,0,0),prefix='Tianhe'):
  self.m=m;self.origin=origin;self.axis=axis;self.u=unit(cross((0,0,1) if abs(axis[2])<.9 else (1,0,0),axis));self.v=cross(axis,self.u);self.prefix=prefix
 def p(self,p):return tuple(self.origin[k]+p[0]*self.axis[k]+p[1]*self.u[k]+p[2]*self.v[k] for k in range(3))
 def n(self,v):return tuple(v[0]*self.axis[k]+v[1]*self.u[k]+v[2]*self.v[k] for k in range(3))
 def tube(self,name,a,b,r1,r2=None,mat='tg-white',segments=64,caps=True):self.m.tube(self.prefix+' / '+name,self.p(a),self.p(b),r1,r2,mat,segments,caps)
 def axial(self,name,a,b,r1,r2=None,mat='tg-white',segments=96,caps=True):self.tube(name,(a,0,0),(b,0,0),r1,r2,mat,segments,caps)
 def box(self,name,c,s,mat='tg-white',repeat=(1,1)):self.m.box(self.prefix+' / '+name,self.p(c),s,mat,[self.axis,self.u,self.v],repeat)
 def rings(self,positions,r):
  for x in positions:self.axial('Blanket seam',x-.012,x+.012,r,mat='tg-grey',segments=96)
 def flag(self,x,r):
  from tiangong_lab_detail import decal
  for theta,side in [(math.pi,'port'),(0,'starboard')]:
   first=len(self.m.g['accessors']);decal(self.m,self.prefix+' / Chinese flag '+side,x,r,theta,.75,.5,'tg-flag');transform_recent(self.m,first,self)
   first=len(self.m.g['accessors']);decal(self.m,self.prefix+' / Module name '+side,x+1.05,r+.004,theta,1.05,.3,self.prefix.lower()+'-name');transform_recent(self.m,first,self)
 def details(self,a,b,r,rows=7):
  for j in range(rows):
   x=a+(b-a)*j/max(1,rows-1)
   for theta in [.3,1.05,2.15,2.9,3.7,4.65,5.5]:
    y,z=math.cos(theta),math.sin(theta);self.tube('Blanket stud',(x,r*y,r*z),(x,(r+.045)*y,(r+.045)*z),.038,mat='tg-frame',segments=10)
   if j%2==0:
    for theta in [.65,2.6,4.3]:
     y,z=math.cos(theta),math.sin(theta);self.tube('External handrail',(x-.34,(r+.09)*y,(r+.09)*z),(x+.34,(r+.09)*y,(r+.09)*z),.021,mat='tg-white',segments=12)
     for dx in [-.34,.34]:self.tube('Handrail foot',(x+dx,r*y,r*z),(x+dx,(r+.09)*y,(r+.09)*z),.022,mat='tg-frame',segments=10)
  for theta in [.5,2.5,4.2]:
   y,z=math.cos(theta),math.sin(theta);self.tube('Gold cable conduit',(a,(r+.025)*y,(r+.025)*z),(b,(r+.025)*y,(r+.025)*z),.022,mat='gold',segments=10)
  for x in [a+.8,b-.8]:
   for theta in [math.pi/2,math.pi]:
    y,z=math.cos(theta),math.sin(theta);self.tube('Viewport rim',(x,r*y,r*z),(x,(r+.055)*y,(r+.055)*z),.14,mat='tg-frame',segments=32);self.tube('Viewport glass',(x,(r+.057)*y,(r+.057)*z),(x,(r+.061)*y,(r+.061)*z),.105,mat='glass',segments=32)

def wing(f,index,x,side,start,end,width,split=True):
 first_node=len(f.m.g['nodes']);m=f.m;spine=(.14 if split else .10);count=28 if split else 14;length=end-start;names=[];blankets=2 if split else 1;gap=.25 if split else 0;blanket_width=(width-gap)/blankets
 f.tube('Solar array drive',(x,side*(start-.6),0),(x,side*(start+.25),0),.16,mat='tg-frame',segments=32)
 f.tube('Solar deployment mast',(x,side*start,0),(x,side*end,0),.045,mat='tg-frame',segments=12)
 for k in range(count):
  lo=start+length*k/count+.015;hi=start+length*(k+1)/count-.015
  for b in range(blankets):
   offset=(b-(blankets-1)/2)*(blanket_width+gap);center=(x+offset,side*(lo+hi)/2,0);f.box('Flexible solar blanket back',center,(blanket_width,hi-lo,.025),'cell-back',repeat=(2,1));f.box('Flexible solar cells',(center[0],center[1],-.017),(blanket_width-.025,hi-lo-.025,.006),'css-cells',repeat=(max(.5,blanket_width/.7),max(.5,(hi-lo)/.7)));names.append(len(m.g['nodes'])-1)
  f.tube('Solar transverse fold',(x-width/2,side*lo,0),(x+width/2,side*lo,0),.011,mat='gold',segments=6)
  # Open triangular mast bays, original mesh artwork rather than flat ribbons.
  if split:
   for edge in [-.12,.12]:f.tube('Mast diagonal',(x+edge,side*lo,-.09),(x-edge,side*hi,.09),.01,mat='tg-frame',segments=6)
 for edge in [-width/2,width/2]:f.tube('Solar array border',(x+edge,side*start,0),(x+edge,side*end,0),.019,mat='tg-frame',segments=10)
 # Actual pivot frames: carrier rotates around module axis, wing around span.
 # Only station wings are rigged; docked vehicles keep their own fixed arrays.
 if f.prefix!='Tianzhou':
  pivot=f.p((x,0,0));beta_pivot=f.p((x,side*start,0))
  def matrix(origin,z):
   z=unit(z);normal=f.n((0,0,-1));y=unit(cross(z,normal));xx=cross(y,z)
   return [*xx,0,*y,0,*z,0,*origin,1]
  alpha_name=f.prefix+' solar carrier '+str(index);beta_name=f.prefix+' solar wing '+str(index)
  # Mesh nodes retain world-baked coordinates in bind pose; cancellation nodes
  # make the articulated hierarchy identity until the runtime rotates joints.
  def inverse(a):
   r=[a[i*4+j] if i<3 and j<3 else 0 for j in range(4) for i in range(4)];r[15]=1
   for i in range(3):r[12+i]=-sum(r[k*4+i]*a[12+k] for k in range(3))
   return r
  def multiply(a,b):return [sum(a[k*4+i]*b[j*4+k] for k in range(4)) for j in range(4) for i in range(4)]
  alpha=matrix(pivot,f.axis);beta=matrix(beta_pivot,f.n((0,side,0)))
  children=list(range(first_node,len(m.g['nodes'])));roots=m.g['scenes'][0]['nodes'];roots[:]=[i for i in roots if i not in children]
  cancel=len(m.g['nodes']);m.g['nodes'].append({'name':beta_name+' bind geometry','matrix':inverse(beta),'children':children})
  if split:
   beta_base=multiply(inverse(alpha),beta);bi=len(m.g['nodes']);m.g['nodes'].append({'name':beta_name,'matrix':beta_base,'children':[cancel]})
   ai=len(m.g['nodes']);m.g['nodes'].append({'name':alpha_name,'matrix':alpha,'children':[bi]});roots.append(ai)
   m.solar_rig.append({'name':alpha_name,'kind':'alpha','body_from_joint':alpha,'base_matrix':alpha,'normal_body':list(f.n((0,0,-1)))})
   m.solar_rig.append({'name':beta_name,'kind':'beta','alpha':alpha_name,'body_from_joint':beta,'base_matrix':beta_base,'normal_body':list(f.n((0,0,-1)))})
  else:
   bi=len(m.g['nodes']);m.g['nodes'].append({'name':beta_name,'matrix':beta,'children':[cancel]});roots.append(bi)
   m.solar_rig.append({'name':beta_name,'kind':'beta','body_from_joint':beta,'base_matrix':beta,'normal_body':list(f.n((0,0,-1)))})
 m.parts.append({'part':'solar_array','module':f.prefix,'index':index,'blankets':blankets,'leaf_sections':count,'span_from_axis_m':end,'width_m':width})

def lab(m,side,name):
 f=Frame(m,(6.55,side*1.5,0),(0,side,0),name);first=len(m.g['nodes'])
 f.axial('Transfer neck',0,.55,.82,mat='tg-frame');f.axial('Transfer cone',.55,1.55,.82,2.1);f.axial('Work cabin',1.55,10.3,2.1);f.axial('Service shoulder',10.3,11.2,2.1,1.42);f.axial('Equipment section',11.2,15.9,1.42);f.axial('Resource tail',15.9,17.9,1.42,1.25)
 f.rings([1.65,3.25,5.3,7.7,9.0,10.2],2.12);f.rings([11.4,12.2,13.1,15.75,16.1],1.44);f.details(1.95,9.8,2.1,9);f.details(11.6,15.6,1.42,4);f.flag(4.3,2.12)
 # Exposed payload / cargo-airlock platforms and thermal control hardware.
 if name=='Mengtian':
  for x in [11.6,12.65,13.7]:
   for y in [-.82,.82]:
    f.box('Payload platform dark frame',(x,y,-1.65),(.98,1.48,.13),'dark');f.box('Payload platform radiator',(x,y,-1.73),(.78,1.27,.035),'tg-white')
    for k in [-.26,0,.26]:f.box('Radiator recessed strip',(x+k,y,-1.755),(.12,1.1,.012),'tg-grey')
  f.box('Cargo airlock insulation',(10.9,0,1.65),(1.1,2.1,.3),'gold')
 else:
  f.box('Experiment support platform',(10.9,0,1.8),(2.1,3.5,.16),'tg-frame');f.box('Experiment platform insulation',(10.9,0,1.93),(1.8,3.2,.1),'gold')
  for x in [10.4,11.2]:f.box('External experiment unit',(x,-.8,2.22),(.6,.7,.5),'tg-white')
  f.tube('Airlock outer hatch',(12.1,0,-1.35),(12.1,0,-1.51),.6,mat='tg-frame',segments=64);f.tube('Airlock hatch cover',(12.1,0,-1.515),(12.1,0,-1.54),.53,mat='tg-white',segments=64)
 for x in [11.7,14.2]:
  for y in [-1.15,1.15]:f.box('Equipment thermal tile',(x,y,-.7),(.8,.07,.7),'dark');f.box('Equipment white patch',(x,y*1.02,-.7),(.57,.025,.46),'tg-white')
 for sign in [-1,1]:wing(f,1 if sign==1 else 2,16.5,sign,1.75,27.65,4.2)
 for x in [16.2,17.2]:
  for y in [-.7,.7]:f.tube('Attitude thruster',(x,y,-.7),(x+.2,y,-.95),.1,mat='gold',segments=24)
 group(m,first,name+' module')

def group(m,first,name):
 roots=m.g['scenes'][0]['nodes'];children=[i for i in roots if i>=first];roots[:]=[i for i in roots if i not in children];roots.append(len(m.g['nodes']));m.g['nodes'].append({'name':name,'children':children});return name

def transform_recent(m,first,frame,source_origin=(0,0,0)):
 semantic_map={index:key for mesh in m.g['meshes'] for primitive in mesh['primitives'] for key,index in primitive['attributes'].items()}
 for index,accessor in enumerate(m.g['accessors'][first:],first):
  semantic=semantic_map.get(index)
  if accessor['type'] not in ('VEC3','VEC4'):continue
  view=m.g['bufferViews'][accessor['bufferView']];count=accessor['count'];n=3 if accessor['type']=='VEC3' else 4;values=[]
  for i in range(count):
   off=view['byteOffset']+i*n*4;row=list(struct.unpack_from('<'+'f'*n,m.binary,off));p=row[:3]
   # POSITION has min/max; NORMAL has neither in this generator? Both VEC3
   # carry bounds, so semantic is resolved from the primitive attribute map.
   v=frame.p(tuple(p[k]-source_origin[k] for k in range(3))) if semantic=='POSITION' else frame.n(p);row[:3]=v;struct.pack_into('<'+'f'*n,m.binary,off,*row);values.append(row)
  if accessor['type']=='VEC3':accessor['min']=[min(v[i] for v in values) for i in range(3)];accessor['max']=[max(v[i] for v in values) for i in range(3)]

def shenzhou(m,origin,axis,label):
 first=len(m.g['accessors']);node_first=len(m.g['nodes']);visitor=attach_shenzhou(m);frame=Frame(m,origin,axis);transform_recent(m,first,frame,(5.19,0,0));old=visitor['node'];new='Atlas CSS Shenzhou '+label
 for node in m.g['nodes'][node_first:]:
  if node.get('name','').startswith(old):node['name']=node['name'].replace(old,new,1)
 return {**visitor,'node':new,'name':'Shenzhou · '+label,'port':label}

def tianzhou(m):
 first=len(m.g['nodes']);f=Frame(m,(-8.3,0,0),(-1,0,0),'Tianzhou');f.axial('Docking neck',.02,.55,.72,mat='tg-frame');f.axial('Cargo forward cone',.55,1.45,.72,1.675);f.axial('Pressurised cargo',1.45,6.4,1.675);f.axial('Aft shoulder',6.4,7.3,1.675,1.4);f.axial('Propulsion section',7.3,10.3,1.4);f.axial('Engine deck',10.3,10.45,1.4,mat='dark');f.rings([1.6,3.4,5.5,6.2],1.69);f.rings([7.45,9.9],1.42);f.details(1.8,6.0,1.675,5);f.flag(3.5,1.7)
 for side in [-1,1]:wing(f,1 if side==1 else 2,8.7,side,1.6,8.9,2.2,False)
 for y in [-.7,.7]:f.tube('Engine bell',(10.2,y,0),(10.6,y,0),.15,.26,'tg-frame')
 name=group(m,first,'Atlas CSS Tianzhou aft');return {'node':name,'name':'Tianzhou · composition visuelle','vehicle':'tianzhou','visibility':'always','port':'aft','illustrative':True,'intervals':[]}

def build():
 m=Model('tiangong');finish(m,png);m.solar_rig=[]
 from tiangong_lab_detail import materials
 materials(m)
 def cells(x,y):
  line=x%32<2 or y%32<2;bus=x%32==16;v=(x*11+y*13)%5
  return (105,107,102) if line else (123,111,65) if bus else (18+v,32+v,61+v)
 m.g['images'].append({'bufferView':m.view(png(512,512,cells)),'mimeType':'image/png'});m.g['textures'].append({'source':len(m.g['images'])-1,'sampler':0});m.materials['css-cells']=len(m.g['materials']);m.g['materials'].append({'name':'css-cells','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':len(m.g['textures'])-1},'metallicFactor':.55,'roughnessFactor':.29}})
 m.materials['tg-cells']=m.materials['css-cells'];m.g['asset']['generator']='Atlas original CSS exterior recreation v1';f=Frame(m);first=len(m.g['nodes'])
 f.axial('Resource section',-8.3,-5.7,1.45);f.axial('Aft transition',-5.7,-4.8,1.45,2.1);f.axial('Large crew cabin',-4.8,.6,2.1);f.axial('Crew shoulder',.6,1.4,2.1,1.6);f.axial('Small crew cabin',1.4,4.8,1.6);f.axial('Node shoulder',4.8,5.3,1.6,1.4);f.axial('Docking node',5.3,8.3,1.4)
 f.rings([-4.7,-3.3,-1.2,.5],2.12);f.rings([1.5,3.0,4.7],1.62);f.rings([-8.1,-6.0],1.47);f.details(-4.5,.25,2.1,7);f.details(1.75,4.4,1.6,4);f.flag(-2.0,2.13)
 for x,r in [(5.65,1.42),(7.7,1.42)]:f.rings([x],r)
 for side in [-1,1]:wing(f,1 if side==1 else 2,-6.7,side,1.6,11.9,3.6,False)
 # Docking side ports and nadir hatch; no duplicate port at the resource deck.
 for side in [-1,1]:m.tube('Lateral lab collar',(6.55,side*1.3,0),(6.55,side*1.6,0),.86,mat='tg-frame',segments=64)
 m.tube('Nadir docking collar',(6.55,0,1.3),(6.55,0,1.55),.78,mat='steel',segments=64);f.axial('Forward docking collar',8.15,8.35,.78,mat='steel')
 # White articulated arm, seven visible joint housings, static reference pose.
 joints=[(4.6,-.65,-1.7),(4.6,-.65,-2.5),(4.1,-.65,-3.1),(1.8,-.65,-6.2),(-.7,-.65,-5.9),(-2.3,-.65,-4.3),(-2.3,-.65,-3.7)]
 for i,(a,b) in enumerate(zip(joints,joints[1:])):m.tube('Robotic arm link '+str(i),a,b,.095,mat='tg-white',segments=32)
 for i,p in enumerate(joints):m.tube('Robotic arm joint '+str(i),(p[0],p[1]-.18,p[2]),(p[0],p[1]+.18,p[2]),.21,mat='tg-white',segments=32)
 for x in [-.2,.5]:f.box('External rack',(x,0,2.12),(.5,2.9,.2),'gold')
 group(m,first,'Tianhe module');lab(m,1,'Wentian');lab(m,-1,'Mengtian')
 positions=[m.g['accessors'][p['attributes']['POSITION']] for mesh in m.g['meshes'] for p in mesh['primitives']];m.station_bounds=[[min(a['min'][i] for a in positions),max(a['max'][i] for a in positions)] for i in range(3)]
 m.g['extras']={'atlasOriginalRecreation':{'key':'tiangong','reference':REFERENCE,'specification_source':SPEC,'modules':['Tianhe','Wentian','Mengtian'],'main_body_length_m':16.6,'lab_length_m':17.9,'max_cabin_diameter_m':4.2,'solar_wings':6,'interpretation':'Exterior and fixed visiting configuration; secondary details, materials, deployment angles and arm pose are illustrative; no extracted Sketchfab data.'}}
 visitors=[shenzhou(m,(8.35,0,0),(1,0,0),'front'),shenzhou(m,(6.55,0,1.55),(0,0,1),'nadir'),tianzhou(m)];m.docked_visitors=visitors
 return m

def main():
 m=build();original=ROOT/'resources/detailed-originals/tiangong-atlas.glb';raw=m.save(original);sha=hashlib.sha256(raw).hexdigest();bounds=m.station_bounds;scale=100/max(b-a for a,b in bounds);center=[(a+b)/2 for a,b in bounds];parent=len(m.g['nodes']);m.g['nodes'].append({'name':'Atlas presentation transform','children':m.g['scenes'][0]['nodes'],'matrix':[scale,0,0,0,0,scale,0,0,0,0,scale,0,*[-x*scale for x in center],1]});m.g['scenes'][0]['nodes']=[parent];runtime=m.save(ROOT/'static/images/detailed/tiangong.glb')
 source={'file':str(original.relative_to(ROOT)),'ids':[48274],'page':SPEC,'download':SPEC,'reference':REFERENCE,'sha256':sha,'version':'Atlas historical reconstruction · CSS PBR','credit':'Atlas · reconstitution originale documentée','license':'CC BY 4.0 · original Atlas geometry/textures','solar_rig':m.solar_rig,'body_axes':[[1,0,0],[0,1,0],[0,0,1]],'docked_visitors':m.docked_visitors,'note':'Reconstitution extérieure originale basée sur les dimensions publiques et un aperçu visuel. Aucun maillage ou texture Sketchfab extrait. Pose du bras et vaisseaux amarrés illustratifs.'}
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());sources['tiangong']=source;(ROOT/'resources/detailed-model-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 info={'key':'tiangong','ids':[48274],'url':'images/detailed/tiangong.glb?v='+hashlib.sha256(runtime).hexdigest()[:12],'bytes':len(runtime),'source':source['page'],'download':source['download'],'sha256':sha,'uv_repairs':[],'compatibility':{},'solar_rig':m.solar_rig,'material_finishes':{},'presentation_focus_node':None,'body_axes':source['body_axes'],'note':source['note'],'credit':source['credit'],'original_file':source['file'],'version':source['version'],'docked_visitors':m.docked_visitors,'triangles':sum(m.g['accessors'][p['indices']]['count']//3 for mesh in m.g['meshes'] for p in mesh['primitives']),'textures':len(m.g['images']),'materials':len(m.g['materials'])}
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());manifest=[info if row['key']=='tiangong' else row for row in manifest];(ROOT/'resources/detailed-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')));(ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 report={'reference':REFERENCE,'specification_source':SPEC,'triangles':info['triangles'],'bytes':info['bytes'],'solar_arrays':m.parts,'body_axes':source['body_axes'],'visiting_configuration':m.docked_visitors,'note':source['note']};(ROOT/'resources/tiangong-recreation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());inventory=[{'key':'tiangong','runtime_url':info['url'],'runtime_bytes':info['bytes'],'original_bytes':len(raw),'triangles':info['triangles'],'original_triangles':info['triangles'],'compression':'original'} if row['key']=='tiangong' else row for row in inventory];(ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n');print('Tiangong original recreation',info['triangles'],'triangles',info['bytes'],'bytes')
if __name__=='__main__':main()
