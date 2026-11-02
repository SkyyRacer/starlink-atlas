"""Build documented early spacecraft and matching white GLBs.
Original Atlas meshes for Sputnik/Vanguard; public NASA VTAD Explorer 1.
Small fittings and finishes are interpreted. No measured historical attitude.
Regeneration only replaces the declared entries, preserving every other model.
"""
import copy,hashlib,json,math,re,struct
from pathlib import Path
from build_historical_stations import Model,png,unit,cross
from build_science_models import identity,product,transform,node_matrix,length,minus
from build_tiangong_white import lines_from_model,write_glb
ROOT=Path(__file__).resolve().parents[1]
KEYS={'sputnik-1':2,'sputnik-2':3,'sputnik-3':8,'explorer-1':4,'vanguard-1':5}
NAMES={'sputnik-1':'Spoutnik 1','sputnik-2':'Spoutnik 2','sputnik-3':'Spoutnik 3','explorer-1':'Explorer 1','vanguard-1':'Vanguard 1'}
SOURCES={
 'sputnik-1':'https://airandspace.si.edu/stories/editorial/sputnik-and-space-age',
 'sputnik-2':'https://www.lib.cas.cz/space.40/1957/002A.HTM',
 'sputnik-3':'https://www.nasa.gov/history/60-years-ago-soviets-launch-sputnik-3/',
 'explorer-1':'https://science.nasa.gov/resource/explorer-1-3d-model/',
 'vanguard-1':'https://ntrs.nasa.gov/citations/19980228199'}
from early_explorer_vanguard import IDS as EXTRA_IDS,SOURCES as EXTRA_SOURCES,NOTES as EXTRA_NOTES,build as extra_model
KEYS.update(EXTRA_IDS);SOURCES.update(EXTRA_SOURCES)
NAMES.update({key:key.replace('explorer-','Explorer ').replace('vanguard-','Vanguard ') for key in EXTRA_IDS})
DOWNLOAD='https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Explorer_1.glb'
def read(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return raw,json.loads(raw[20:20+n]),raw[28+n:]
def write(path,g,binary):
 binary+=b'\0'*(-len(binary)%4);g['buffers']=[{'byteLength':len(binary)}];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*(-len(js)%4);raw=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw);return raw
class Early(Model):
 def __init__(self,key):
  super().__init__(key);self.extra_lines=[];self.parts=[]
  # Replace station finishes entirely; no irrelevant station textures or normals.
  self.binary=bytearray();self.g['bufferViews']=[];self.g['materials']=[];self.g['images']=[];self.g['textures']=[];self.materials={}
  palette=[('silver',[.83,.85,.87,1],.83,.30),('chrome',[.93,.95,.97,1],.9,.25),('steel',[.38,.42,.46,1],.78,.36),('ivory',[.86,.86,.82,1],.12,.58),('dark',[.035,.045,.055,1],.1,.52),('glass',[.035,.085,.105,1],.25,.27),('gold',[.67,.45,.15,1],.72,.35),('blue',[.03,.09,.22,1],.15,.43),('cells',[1,1,1,1],.42,.36)]
  for name,color,metal,rough in palette:self.materials[name]=len(self.g['materials']);self.g['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':False})
  tex=png(128,256,lambda x,y:(86,94,109) if x%32<2 or y%24<2 else (13+(x%9),27+(y%7),52+(x%5)))
  self.g['images'].append({'bufferView':self.view(tex),'mimeType':'image/png'});self.g['textures'].append({'source':0,'sampler':0});self.g['materials'][self.materials['cells']]['pbrMetallicRoughness']['baseColorTexture']={'index':0}
  self.g['asset'].update(generator='Atlas early satellite reconstruction · original geometry',copyright='Original Atlas geometry and cell artwork, CC BY 4.0; cited historic photographs are references only.')
 def mesh(self,name,*args,**kwargs):self.parts.append(name);return super().mesh(name,*args,**kwargs)
 def path(self,name,points,r=.008,mat='steel',segments=12):
  for i,(a,b) in enumerate(zip(points,points[1:])):self.tube(name+f' segment {i}',a,b,r,mat=mat,segments=segments)
 def ring(self,name,x,r,thickness=.008,mat='steel',steps=64):
  pts=[(x,r*math.cos(i*2*math.pi/steps),r*math.sin(i*2*math.pi/steps)) for i in range(steps+1)];self.path(name,pts,thickness,mat,8)
 def sphere(self,name,c,r,mat='silver',rows=40,cols=80):
  v=[];n=[];uv=[];faces=[]
  for j in range(rows+1):
   p=math.pi*j/rows
   for i in range(cols+1):
    t=math.tau*i/cols;normal=(math.cos(p),math.sin(p)*math.cos(t),math.sin(p)*math.sin(t));v.append(tuple(c[k]+r*normal[k] for k in range(3)));n.append(normal);uv.append((i/cols,j/rows))
  for j in range(rows):
   for i in range(cols):
    a=j*(cols+1)+i;b=a+cols+1
    if j:faces.append((a,b,a+1))
    if j<rows-1:faces.append((a+1,b,b+1))
  self.mesh(name,v,n,uv,faces,mat)
  for axis in range(3):
   a=(axis+1)%3;b=(axis+2)%3
   for i in range(64):
    def p(t):
     v=list(c);v[a]+=r*math.cos(t);v[b]+=r*math.sin(t);return v
    self.extra_lines.append([p(i*math.tau/64),p((i+1)*math.tau/64)])
 def curved_cell(self,name,normal,r,width,height):
  normal=unit(normal);u=unit(cross((1,0,0) if abs(normal[0])<.9 else (0,1,0),normal));v=cross(normal,u);vertices=[];normals=[];uv=[];faces=[];steps=8
  for j in range(steps+1):
   for i in range(steps+1):
    a=(i/steps-.5)*width;b=(j/steps-.5)*height;d=unit(tuple(normal[k]*r+u[k]*a+v[k]*b for k in range(3)));vertices.append(tuple(d[k]*r for k in range(3)));normals.append(d);uv.append((i/steps,j/steps))
  for j in range(steps):
   for i in range(steps):a=j*(steps+1)+i;b=a+steps+1;faces.extend([(a,a+1,b),(a+1,b+1,b)])
  self.mesh(name,vertices,normals,uv,faces,'cells')
 def disk(self,name,center,normal,radius,mat='dark',depth=.01):
  self.tube(name,center,tuple(center[k]+normal[k]*depth for k in range(3)),radius,mat=mat,segments=40)
def sputnik1():
 m=Early('sputnik-1');r=.2915;m.sphere('Polished pressure sphere, 58.3 cm',(0,0,0),r,'chrome');m.ring('Two-hemisphere joint',0,r+.0005,.0015,'steel')
 for i in range(36):
  a=math.tau*i/36;m.sphere('Equatorial fastener '+str(i),(0,(r+.001)*math.cos(a),(r+.001)*math.sin(a)),.0028,'steel',6,10)
 for i,L in enumerate([2.4,2.4,2.9,2.9]):
  t=math.pi/4+i*math.pi/2;mount=(-.205,.205*math.cos(t),.205*math.sin(t));direction=(-.91,.415*math.cos(t),.415*math.sin(t));tip=tuple(mount[k]+L*direction[k] for k in range(3));m.tube('Antenna '+str(i+1)+' ceramic base',mount,tuple(mount[k]+.055*direction[k] for k in range(3)),.014,mat='ivory',segments=24);m.tube(f'Antenna {i+1}, {L} m',mount,tip,.0045,.0013,'chrome',16)
 return m
def sputnik2():
 m=Early('sputnik-2');m.axial('Lower attachment skirt',-1.06,-.85,.56,.50,'silver');m.ring('Skirt lower flange',-1.06,.565,.018,'ivory');m.sphere('Sealed biological cabin',(-.65,0,0),.35,'silver');m.ring('Cabin circumferential joint',-.65,.351,.009,'steel');m.sphere('Radio transmitter pressure sphere',(.02,0,0),.285,'chrome');m.axial('Upper scientific equipment',.36,.57,.20,.18,'silver');m.axial('UV and X-ray sensor cone',.58,1.08,.18,.015,'silver');
 for i in range(3):
  t=math.tau*i/3;a=(-1.04,.52*math.cos(t),.52*math.sin(t));b=(.98,.045*math.cos(t),.045*math.sin(t));m.tube('Conical structural rail '+str(i+1),a,b,.016,mat='ivory',segments=16)
 for x,r in [(-.86,.49),(-.30,.36),(.29,.22)]:m.ring('Frame cross brace',x,r,.009,'steel',48)
 m.disk('Biological cabin instrument hatch',(-.65,0,.349),(0,0,1),.095,'steel');m.disk('Cabin sealed viewport',(-.65,0,.361),(0,0,1),.072,'glass',.005)
 for i in range(4):
  t=i*math.pi/2;m.tube('Telemetry equipment fitting',(.39,.185*math.cos(t),.185*math.sin(t)),(.52,.185*math.cos(t),.185*math.sin(t)),.028,mat='gold',segments=16)
 for i in range(3):
  t=i*math.tau/3;m.path('Instrument cable',[(-.95,.48*math.cos(t),.48*math.sin(t)),(-.4,.38*math.cos(t),.38*math.sin(t)),(.28,.21*math.cos(t),.21*math.sin(t))],.004,'blue',8)
 m.g.setdefault('extras',{})['configuration_note']='Instrument package with exposed framework as documented by museum replicas; attached R-7 rocket body omitted, not an exact full orbital assembly.'
 return m
def sputnik3():
 m=Early('sputnik-3');m.axial('Lower scientific compartment',-1.4,-.48,.865,.80,'silver');m.axial('Conical scientific hull',-.48,1.5,.80,.235,'silver');m.axial('Upper instrumentation neck',1.5,1.67,.235,.16,'chrome');m.axial('Top instrument housing',1.67,1.86,.16,.115,'steel');
 for x,r in [(-1.4,.869),(-.48,.804),(.25,.595),(.95,.396),(1.50,.24)]:m.ring('Hull assembly band',x,r,.013,'steel',64)
 for i in range(4):
  t=math.pi/4+i*math.pi/2;normal=(0,math.cos(t),math.sin(t));side=(0,-math.sin(t),math.cos(t));basis=[(1,0,0),side,normal];center=(-.94,.845*math.cos(t),.845*math.sin(t));m.box('Recessed radiator frame '+str(i),center,(.80,.57,.025),'steel',basis)
  for row in range(3):
   for col in range(2):
    p=tuple(center[k]+(row-1)*.245*basis[0][k]+(col-.5)*.26*side[k]+.018*normal[k] for k in range(3));m.box('Radiator embossed plate',p,(.205,.22,.014),'ivory',basis)
  # The characteristic two-arm curved loop antennas, in four replicated sectors.
  pts=[(.70,.50*math.cos(t),.50*math.sin(t)),(.63,.78*math.cos(t),.78*math.sin(t)),(.30,.86*math.cos(t),.86*math.sin(t)),(.14,.81*math.cos(t),.81*math.sin(t)),(.14,.61*math.cos(t),.61*math.sin(t))];m.path('Curved instrument boom '+str(i),pts,.018,'chrome',16)
  m.disk('Flush instrument aperture',(.98,.39*math.cos(t),.39*math.sin(t)),normal,.060,'dark',.012)
  start=(-1.39,.46*math.cos(t),.46*math.sin(t));end=(-1.96,.55*math.cos(t),.55*math.sin(t));m.path('Lower antenna loop '+str(i),[start,end,(-2.03,.42*math.cos(t),.42*math.sin(t)),(-1.4,.34*math.cos(t),.34*math.sin(t))],.010,'chrome')
 for i in range(8):
  t=i*math.pi/4;normal=(0,math.cos(t),math.sin(t));m.disk('Upper sensor',(.42,.56*math.cos(t),.56*math.sin(t)),normal,.045,'dark',.018)
 for i in range(24):
  t=i*math.tau/24;m.sphere('Base fastener '+str(i),(-1.413,.82*math.cos(t),.82*math.sin(t)),.011,'steel',6,10)
 m.disk('Solar experiment',(.85,0,.43),(0,0,1),.075,'dark');m.tube('Magnetometer stem',(1.15,-.20,-.15),(1.35,-.60,-.35),.011,mat='steel',segments=12);m.sphere('Magnetometer head',(1.35,-.60,-.35),.065,'dark',14,24)
 return m
def vanguard():
 m=Early('vanguard-1');r=.0818;m.sphere('Aluminium sphere, 6.44 inches',(0,0,0),r,'chrome');m.ring('Hemisphere seam',0,r+.0002,.0007,'steel')
 for i in range(6):
  normal=[0,0,0];normal[i//2]=(-1 if i%2 else 1);m.curved_cell('Solar cell cluster '+str(i+1),normal,r+.0006,.034,.043)
 # Antennas form three mutually orthogonal pairs; rotate away from cell patches.
 c=math.cos(math.pi/4);s=math.sin(math.pi/4);axis=(1/math.sqrt(3),)*3
 for i in range(6):
  v=[0,0,0];v[i//2]=(-1 if i%2 else 1);ax=cross(axis,v);dot=sum(a*b for a,b in zip(axis,v));normal=tuple(v[k]*c+ax[k]*s+axis[k]*dot*(1-c) for k in range(3));a=tuple((r-.003)*x for x in normal);b=tuple((r+.305)*x for x in normal);m.tube('Antenna '+str(i+1)+' base',a,tuple((r+.009)*x for x in normal),.005,.003,'steel',16);m.tube('Antenna '+str(i+1)+' 30.5 cm',a,b,.0028,.0015,'chrome',12)
 return m

def generate():
 detailed=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());detailed=[r for r in detailed if r['key'] not in KEYS];science=json.loads((ROOT/'resources/science-model-manifest.json').read_text());science=[r for r in science if r['key'] not in KEYS];ds=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());ss=json.loads((ROOT/'resources/science-model-sources.json').read_text());audit=[]
 for key,ident in KEYS.items():
  if key=='explorer-1':original=ROOT/'resources/detailed-originals/explorer-1-nasa.glb';raw,g,binary=read(original);extra=[];parts=[n.get('name','') for n in g['nodes'] if 'mesh' in n];nasa=True
  else:
   model=extra_model(key,Early) if key in EXTRA_IDS else {'sputnik-1':sputnik1,'sputnik-2':sputnik2,'sputnik-3':sputnik3,'vanguard-1':vanguard}[key]();original=ROOT/f'resources/detailed-originals/{key}-atlas.glb';raw=model.save(original);g=copy.deepcopy(model.g);binary=bytes(model.binary);extra=model.extra_lines;parts=model.parts;nasa=False
  points=[]
  def walk(i,parent):
   node=g['nodes'][i];matrix=product(parent,node_matrix(node))
   if 'mesh' in node:
    for part in g['meshes'][node['mesh']]['primitives']:
     a=g['accessors'][part['attributes']['POSITION']]
     points.extend(transform(matrix,(x,y,z)) for x in [a['min'][0],a['max'][0]] for y in [a['min'][1],a['max'][1]] for z in [a['min'][2],a['max'][2]])
   for child in node.get('children',[]):walk(child,matrix)
  roots=list(g['scenes'][g.get('scene',0)]['nodes'])
  for i in roots:walk(i,identity())
  lo=[min(p[k] for p in points) for k in range(3)];hi=[max(p[k] for p in points) for k in range(3)];scale=100/max(hi[k]-lo[k] for k in range(3));center=[(lo[k]+hi[k])/2 for k in range(3)];normal=identity()
  for k in range(3):normal[k][k]=scale;normal[k][3]=-center[k]*scale
  rotation=identity()
  if nasa:
   # Original NASA scene is Y-up. Calibrate that long axis to our common +X.
   rotation=[[0,1,0,0],[0,0,1,0],[1,0,0,0],[0,0,0,1]]
  placement=product(rotation,normal);parent=len(g['nodes']);g['nodes'].append({'name':'Atlas presentation transform','children':roots,'matrix':[placement[i][j] for j in range(4) for i in range(4)]});g['scenes']=[{'nodes':[parent]}];g['scene']=0
  g.setdefault('extras',{})['atlasEarlySatellite']={'key':key,'norad':ident,'source':SOURCES[key],'historical_attitude_measured':False,'construction':'NASA VTAD' if nasa else 'Atlas reconstruction','articulated_solar_tracking':False,'attitude_note':'Fixed exterior equipment; orbital elements do not supply historical attitude or spin phase.'}
  repairs=[];finishes={}
  if nasa:
   # The original transparent helper cube has a uniform clear texture but no UVs.
   # Constant UVs preserve its full transparency and avoid a Cesium shader failure.
   primitive=g['meshes'][2]['primitives'][0];count=g['accessors'][primitive['attributes']['POSITION']]['count'];offset=len(binary);binary+=b'\0'*(count*8);view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':count*8,'target':34962});accessor=len(g['accessors']);g['accessors'].append({'bufferView':view,'componentType':5126,'count':count,'type':'VEC2'});primitive['attributes']['TEXCOORD_0']=accessor
   repairs=[{'mesh':2,'primitive':0,'texcoord':0,'reason':'clear.png.001 is uniformly transparent RGBA (255,255,255,0); constant UVs preserve full transparency.','count':count}]
   finishes={'tex_01':{'roughnessFactor':.30}}
   for mat in g['materials']:
    if mat.get('name') in finishes:mat['pbrMetallicRoughness'].update(finishes[mat['name']])
  runtime=ROOT/f'static/images/detailed/{key}.glb';blob=write(runtime,g,binary);sha=hashlib.sha256(raw).hexdigest();credit='NASA VTAD' if nasa else 'Atlas · reconstitution documentée';note='Modèle officiel NASA VTAD, géométrie et textures conservées.' if nasa else 'Reconstitution extérieure documentée ; détails secondaires et finitions interprétés. Attitude historique non mesurée.'
  if key in EXTRA_NOTES:note+=' '+EXTRA_NOTES[key]
  if key=='sputnik-2':note+=' Charge instrumentale représentée, sans le corps de fusée R-7 resté attaché.'
  body_axes=[row[:3] for row in rotation[:3]]
  source={'enabled':True,'file':str(original.relative_to(ROOT)),'ids':[ident],'download':DOWNLOAD if nasa else SOURCES[key],'page':SOURCES[key],'sha256':sha,'credit':credit,'license':'NASA media usage guidelines' if nasa else 'CC BY 4.0 · original Atlas geometry/textures','body_axes':body_axes,'version':'NASA VTAD texturé' if nasa else 'Atlas historical reconstruction · PBR','note':note};source['missing_uv_repairs']=[{k:v for k,v in r.items() if k!='count'} for r in repairs];source['material_finishes']=finishes;ds[key]=source
  entry={'docked_visitors':[],'key':key,'ids':[ident],'url':f'images/detailed/{key}.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'bytes':len(blob),'source':SOURCES[key],'download':source['download'],'sha256':sha,'uv_repairs':repairs,'compatibility':{},'solar_rig':[],'material_finishes':finishes,'render_lighting':{'light_color':[1.1,1.1,1.1],'ibl_factor':[.55,.8]},'presentation_focus_node':None,'body_axes':body_axes,'note':note,'credit':credit,'original_file':source['file'],'version':source['version'],'triangles':sum(g['accessors'][p['indices']]['count']//3 for mesh in g['meshes'] for p in mesh['primitives'] if 'indices' in p),'textures':len(g.get('images',[])),'materials':len(g.get('materials',[]))};detailed.append(entry)
  lines,feature_parts=lines_from_model(runtime,max_edges_per_primitive=1000);lines.extend([[transform(placement,p) for p in edge] for edge in extra]);assert len(lines)>100
  dest=ROOT/f'static/images/science/{key}.glb';white=write_glb(lines,dest,generator='Atlas white feature lines from '+key+' detailed assembly',copyright=credit)
  if key.startswith('sputnik-') or key in EXTRA_IDS:

   # Keep the real silhouette, but fill the white hull instead of drawing a cage.
   solid=copy.deepcopy(g)
   for field in ('images','textures','samplers'):solid.pop(field,None)
   solid['materials']=[{'name':'Matte solid white','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.8}}]
   for mesh in solid['meshes']:
    for primitive in mesh['primitives']:
     primitive['material']=0
     for attr in list(primitive['attributes']):
      if attr.startswith(('TEXCOORD_','COLOR_')):del primitive['attributes'][attr]
   solid['asset']['generator']='Atlas solid white Sputnik assembly'
   white=write(dest,solid,binary)

  icon=sorted(lines,key=lambda e:length(minus(*e)),reverse=True)[:1800];project=lambda p:[.866*p[0]+.5*p[2],-.22*p[0]+.84*p[1]+.38*p[2]];drawing=[list(map(project,e)) for e in icon];a=[min(p[k] for e in drawing for p in e) for k in range(2)];b=[max(p[k] for e in drawing for p in e) for k in range(2)];span=max(b[k]-a[k] for k in range(2));drawing=[[[round((p[k]-(a[k]+b[k])/2)/span*100,3) for k in range(2)] for p in e] for e in drawing];draw=json.dumps({'segments':drawing},separators=(',',':')).encode();(ROOT/f'static/images/science/{key}.json').write_bytes(draw)
  white_entry={'key':key,'page_id':key if key.startswith('sputnik') else 'explorer-early' if key.startswith('explorer-') else 'vanguard','ids':[ident],'name':NAMES[key],'kind':'documented-solid-white' if key.startswith('sputnik-') or key in EXTRA_IDS else 'documented-detailed-outline','credit':credit+' · modèle blanc Atlas','source':SOURCES[key],'glb':f'images/science/{key}.glb?v='+hashlib.sha256(white).hexdigest()[:12],'drawing':f'images/science/{key}.json?v='+hashlib.sha256(draw).hexdigest()[:12],'radius':round(max(length(p) for e in lines for p in e),3),'segments':len(icon),'line_segments':len(lines),'bytes':len(white)+len(draw),'body_axes':True};science.append(white_entry);ss[key]={'enabled':True,'kind':white_entry['kind'],'credit':white_entry['credit'],'page':SOURCES[key],'detailed_outline':key}
  audit.append({'key':key,'norad':ident,'source':SOURCES[key],'body_bounds_metres':[lo,hi],'white_edges':len(lines),'triangles':entry['triangles'],'runtime_bytes':len(blob),'white_bytes':len(white),'parts':parts,'note':note});print(key,len(blob),'bytes;',len(lines),'white edges;',entry['triangles'],'triangles')
 for path,data in [('resources/detailed-model-manifest.json',detailed),('resources/science-model-manifest.json',science),('resources/detailed-model-sources.json',ds),('resources/science-model-sources.json',ss),('static/images/detailed/manifest.json',detailed),('static/images/science/manifest.json',science),('resources/early-satellite-models.json',audit)]:
  (ROOT/path).write_text(json.dumps(data,ensure_ascii=False,indent=2 if path.startswith('resources/') else None,separators=None if path.startswith('resources/') else (',',':'))+'\n')
 # Replace only the manifest literal; retain existing runtime fixes and controls.
 for file,manifest in [('static/detailed-models.js',detailed),('static/science-visual.js',science)]:
  text=(ROOT/file).read_text();start=text.index('definitions=')+len('definitions=');_,size=json.JSONDecoder().raw_decode(text[start:]);text=text[:start]+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+text[start+size:];(ROOT/file).write_text(text)
 rtpath=ROOT/'resources/model-runtime-manifest.json';rt=[r for r in json.loads(rtpath.read_text()) if r['key'] not in KEYS]
 for m in detailed:
  if m['key'] in KEYS:rt.append({'key':m['key'],'runtime_url':m['url'],'runtime_bytes':m['bytes'],'original_bytes':(ROOT/m['original_file']).stat().st_size,'triangles':m['triangles'],'original_triangles':m['triangles'],'compression':'original'})
 rtpath.write_text(json.dumps(rt,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':generate()
