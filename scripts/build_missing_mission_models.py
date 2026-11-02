"""Import four public ESA Scifleet OBJ assemblies; reconstruct three exteriors.
Source OBJ normals/UVs are retained; texture resizing and omitted camera helpers
are documented. The other three models are original Atlas reconstructions.
"""
import copy,hashlib,io,json,math,struct,zipfile
from pathlib import Path
from PIL import Image
from build_early_satellites import Early,read,write,png
from build_science_models import identity,product,node_matrix,transform
ROOT=Path(__file__).resolve().parents[1]
IDS={'bepicolombo':43653,'gaia':39479,'herschel':34937,'planck':34938,'spektr-rg':44432,'aditya-l1':57754,'ikaros':36577}
ESA={'bepicolombo':'bepi_mcs','gaia':'gaia','herschel':'herschel','planck':'planck'}
REFERENCES={'spektr-rg':'https://www.laspace.ru/en/activities/projects/spectrum-x/','aditya-l1':'https://www.isro.gov.in/media_isro/pdf/AdityaL1_Mission_Brochure.pdf','ikaros':'https://www.isas.jaxa.jp/en/missions/spacecraft/past/ikaros.html'}
SPANS={'bepicolombo':30,'gaia':10.5,'herschel':7.5,'planck':4.2,'spektr-rg':8,'aditya-l1':9.6,'ikaros':19.8}
def esa_model(key):
 name=ESA[key];folder=ROOT/'resources/esa-scifleet'/name;m=Early(key);m.g['materials']=[];m.g['images']=[];m.g['textures']=[];m.materials={};z=zipfile.ZipFile(folder/(name+'_textures.zip'));textures=[n for n in z.namelist() if n.lower().endswith('.png') and '__MACOSX' not in n]
 def material(group,mtl):
  label=mtl or group
  if label in m.materials:return label
  if name=='gaia':needle='T_Gaia_BotFace_BaseColor' if 'Bottom' in group else 'T_SM_Gaia_low_Final_BaseColor'
  elif name=='herschel':needle='herschelpanel1' if mtl=='02___Default' else 'HERSCHEL_bandage8_Albedo'
  elif name=='planck':needle='PLANK_Material30_Albedo'
  else:needle={'SM_MTM':'SM_MTM_BaseColor','SunShield':'T_SunShield_BaseColor','SM_MMO':'T_SM_MMO_02_BaseColor'}.get(group,'T_SM_Bepi_MPO_BaseColor')
  candidates=[n for n in textures if needle in n];assert candidates,(name,group,needle)
  texture=sorted(candidates,key=lambda n:('2K' not in n,len(n)))[0];im=Image.open(io.BytesIO(z.read(texture))).convert('RGB');im.thumbnail((2048,2048));out=io.BytesIO();im.save(out,format='PNG',optimize=True);data=out.getvalue();vi=m.view(data);ii=len(m.g['images']);m.g['images'].append({'bufferView':vi,'mimeType':'image/png'});ti=len(m.g['textures']);m.g['textures'].append({'source':ii,'sampler':0});m.materials[label]=len(m.g['materials']);m.g['materials'].append({'name':label,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':ti},'metallicFactor':.45,'roughnessFactor':.45},'doubleSided':True});return label
 positions=[];normals=[];uv=[];parts={};group='body';mtl=''
 for line in (folder/(name+'.obj')).read_text().splitlines():
  bits=line.split()
  if not bits:continue
  if bits[0]=='v':positions.append(tuple(map(float,bits[1:4])))
  elif bits[0]=='vn':normals.append(tuple(map(float,bits[1:4])))
  elif bits[0]=='vt':uv.append(tuple(map(float,bits[1:3])))
  elif bits[0]=='g':group=' '.join(bits[1:])
  elif bits[0]=='usemtl':mtl=' '.join(bits[1:])
  elif bits[0]=='f' and not group.startswith('Camera_'):
   part=parts.setdefault((group,mtl),{'verts':[],'normals':[],'uv':[],'faces':[],'lookup':{}});face=[]
   for ref in bits[1:]:
    ids=tuple(int(v) if v else 0 for v in ref.split('/'));ids=ids+(0,)*(3-len(ids))
    if ids not in part['lookup']:
     a,b,c=ids;part['untextured']=part.get('untextured',False) or not b;part['lookup'][ids]=len(part['verts']);part['verts'].append(positions[a-1 if a>0 else a]);n=normals[c-1 if c>0 else c] if c else (0,0,0);l=math.hypot(*n) or 1;part['normals'].append(tuple(v/l for v in n));t=uv[b-1 if b>0 else b] if b else (0,0);part['uv'].append((t[0],1-t[1]))
    face.append(part['lookup'][ids])
   part['faces'].extend((face[0],face[i],face[i+1]) for i in range(1,len(face)-1))
 for (group,mtl),part in parts.items():
  if not normals:
   sums=[[0.,0.,0.] for _ in part['verts']]
   for a,b,c in part['faces']:
    u=[part['verts'][b][i]-part['verts'][a][i] for i in range(3)];v=[part['verts'][c][i]-part['verts'][a][i] for i in range(3)];n=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
    for index in [a,b,c]:
     for k in range(3):sums[index][k]+=n[k]
   part['normals']=[tuple(v/(math.hypot(*n) or 1) for v in n) if math.hypot(*n)>1e-12 else (1,0,0) for n in sums]
  if part.get('untextured'):
   label='untextured-reflector'
   if label not in m.materials:m.materials[label]=len(m.g['materials']);m.g['materials'].append({'name':label,'pbrMetallicRoughness':{'baseColorFactor':[.85,.86,.88,1],'metallicFactor':.8,'roughnessFactor':.3}})
  else:label=material(group,mtl)
  m.mesh(group,part['verts'],part['normals'],part['uv'],part['faces'],label)
 m.g['asset'].update(generator='ESA Scifleet OBJ to GLB · Atlas conversion',copyright='ESA · https://www.esa.int/Services/Terms_and_conditions');return m

def wings(m,span,x,width):
 for sign in [-1,1]:
  m.tube('Array support',(x,0,0),(x,sign*(span/2-.2),0),.035,mat='steel',segments=12)
  for i in range(3):
   y=sign*(1.2+i*(span/2-1.2)/3+(span/2-1.2)/6);size=(span/2-1.2)/3
   m.box('Solar array frame',(x,y,0),(width,size-.025,.04),'steel');m.box('Solar cells',(x,y,.025),(width-.04,size-.06,.008),'cells')
def telescope(m,name,c,r,length,modules=7):
 x,y,z=c;m.tube(name+' thermal tube',(x,y,z),(x+length,y,z),r,mat='ivory',segments=48)
 m.tube(name+' aperture rim',(x+length,y,z),(x+length+.05,y,z),r*1.02,mat='steel',segments=48)
 m.disk(name+' aperture',(x+length+.052,y,z),(1,0,0),r*.93,'dark',.004)
 for i in range(modules):
  a=i*math.tau/6;dy,dz=(0,0) if i==6 else (r*.52*math.cos(a),r*.52*math.sin(a));m.disk(name+' mirror module '+str(i),(x+length+.059,y+dy,z+dz),(1,0,0),r*.20,'chrome',.007)
def original(key):
 m=Early(key)
 foil=png(512,512,lambda x,y:tuple(max(0,min(255,int(c+11*math.sin(x*.31+y*.07)*math.cos(y*.23-x*.13)+4*math.sin(x*1.3+y*.9)))) for c in [180,132,58]))
 ii=len(m.g['images']);m.g['images'].append({'bufferView':m.view(foil),'mimeType':'image/png'});ti=len(m.g['textures']);m.g['textures'].append({'source':ii,'sampler':0});m.g['materials'][m.materials['gold']]['pbrMetallicRoughness'].update(baseColorFactor=[1,1,1,1],baseColorTexture={'index':ti},metallicFactor=.65,roughnessFactor=.48)
 if key=='spektr-rg':
  m.box('Navigator service module',(-1,0,0),(1.6,1.9,1.5),'gold');m.box('Instrument platform',(0,0,0),(.25,2.6,1.8),'silver');wings(m,8,-1.1,1.4)
  telescope(m,'eROSITA',(.05,-.62,.12),.62,2.5);telescope(m,'ART-XC',(.05,.77,.12),.43,2.7)
  for y in [-1.05,1.05]:m.tube('Payload support',(-.8,y,0),(1.8,y,-.45),.04,mat='steel',segments=12)
 elif key=='aditya-l1':
  m.box('Spacecraft bus',(0,0,0),(1.8,2,1.9),'gold');wings(m,9.6,-.2,1.5)
  telescope(m,'VELC coronagraph',(.9,-.45,.15),.35,.85,0);telescope(m,'SUIT telescope',(.9,.5,.2),.25,.55,0);m.disk('VELC central occulting stop',(1.81,-.45,.15),(1,0,0),.075,'steel',.009)
  m.tube('Magnetometer deployed boom',(-.9,0,-.4),(-6.9,0,-.4),.022,mat='steel',segments=12)
  for x in [-3.9,-6.9]:m.box('Magnetometer sensor',(x,0,-.4),(.16,.16,.16),'ivory')
  for y in [-.8,.8]:m.box('Sunward instrument housing',(1,y,-.5),(.4,.28,.28),'ivory')
 else:
  m.axial('Central spacecraft body',-.4,.4,.8,mat='gold');m.axial('Communications deck',.4,.46,.55,mat='ivory');m.axial('Central antenna',.46,.75,.15,.015,'steel')
  # A spun membrane has no rigid perimeter frame. Keep both thin faces and
  # an original subtle folded foil texture; no invented mechanical solar hinge.
  m.g['materials'][m.materials['gold']]['doubleSided']=True
  for i,(a,b) in enumerate([((-7,-7),(7,-7)),((7,-7),(7,7)),((7,7),(-7,7)),((-7,7),(-7,-7))]):
   vertices=[(0,0,0),(.025,a[0],a[1]),(.025,b[0],b[1])];m.mesh('Reflective sail quadrant '+str(i),vertices,[(1,0,0)]*3,[(.5,.5),(0,0),(1,1)],[(0,1,2)],'gold')
   for y,z in [a]:m.sphere('Corner deployment mass',(.025,y,z),.07,'steel',8,16)
  for sign in [-1,1]:
   for j in range(5):
    m.box('Thin-film solar cell strip',(.035,sign*4,j*1.3-2.6),(.003,1.9,.28),'cells')
  for y,z in [(-7,-7),(-7,7),(7,-7),(7,7)]:m.tube('Sail diagonal seam',(0,0,0),(.03,y,z),.007,mat='steel',segments=8)
 if key!='ikaros':
  for y in [-.65,0,.65]:
   m.box('Radiator tile',(-.2,y,-.966),(.75,.45,.02),'ivory')
   for x in [-.5,-.2,.1]:m.box('Radiator fin',(x,y,-.981),(.015,.43,.01),'steel')
  for x in [-.8,.8]:
   for y in [-.85,.85]:m.sphere('Service panel fastener',(x,y,-.97),.018,'steel',6,12)
 return m

def build():
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());manifest=[r for r in manifest if r['key'] not in IDS];sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());probe=json.loads((ROOT/'static/solar/probe-models.json').read_text());probe['models']=[r for r in probe['models'] if r['key'] not in IDS]
 for key,id in IDS.items():
  model=esa_model(key) if key in ESA else original(key);path=ROOT/f'resources/detailed-originals/{key}-source.glb'
  raw=model.save(path);_,g,binary=read(path);roots=g['scenes'][0]['nodes'];points=[]
  def visit(i,parent):
   node=g['nodes'][i];matrix=product(parent,node_matrix(node))
   if 'mesh' in node:
    for p in g['meshes'][node['mesh']]['primitives']:
     a=g['accessors'][p['attributes']['POSITION']];points.extend(transform(matrix,(x,y,z)) for x in [a['min'][0],a['max'][0]] for y in [a['min'][1],a['max'][1]] for z in [a['min'][2],a['max'][2]])
   for child in node.get('children',[]):visit(child,matrix)
  for i in roots:visit(i,identity())
  lo=[min(p[k] for p in points) for k in range(3)];hi=[max(p[k] for p in points) for k in range(3)];scale=100/max(hi[k]-lo[k] for k in range(3));mat=identity()
  for k in range(3):mat[k][k]=scale;mat[k][3]=-(lo[k]+hi[k])/2*scale
  g['nodes'].append({'name':'Atlas presentation transform','children':roots,'matrix':[mat[i][j] for j in range(4) for i in range(4)]});g['scenes']=[{'nodes':[len(g['nodes'])-1]}];blob=write(ROOT/f'static/images/detailed/{key}.glb',g,binary)
  page='https://scifleet.esa.int/model-downloads' if key in ESA else REFERENCES[key];download=f'https://scifleet.esa.int/downloads/{ESA[key]}/{ESA[key]}.obj' if key in ESA else page;credit='ESA · Scifleet · conversion Atlas' if key in ESA else 'Atlas · reconstitution documentée';note='Géométrie et UV ESA ; assistants caméra exclus ; textures limitées à 2048 px, finitions PBR Atlas.' if key in ESA else 'Reconstitution extérieure Atlas ; détails secondaires et finitions interprétés. Attitude historique non mesurée.'
  source={'enabled':True,'file':str(path.relative_to(ROOT)),'ids':[id],'sha256':hashlib.sha256(raw).hexdigest(),'page':page,'download':download,'credit':credit,'version':'ESA Scifleet texturé' if key in ESA else 'Atlas historical reconstruction · PBR','body_axes':[[1,0,0],[0,1,0],[0,0,1]],'note':note};sources[key]=source
  row={'key':key,'ids':[id],'url':f'images/detailed/{key}.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'bytes':len(blob),'source':page,'download':download,'sha256':source['sha256'],'original_file':source['file'],'credit':credit,'version':source['version'],'note':note,'body_axes':source['body_axes'],'uv_repairs':[],'compatibility':{},'solar_rig':[],'material_finishes':{},'triangles':sum(g['accessors'][p['indices']]['count']//3 for mesh in g['meshes'] for p in mesh['primitives']),'textures':len(g['images']),'materials':len(g['materials'])};manifest.append(row);probe['models'].append({**row,'physical_span_m':SPANS[key],'dimension_source':page,'dimension_approximate':True});print(key,len(blob),row['triangles'],row['textures'],flush=True)
 for file,data in [('resources/detailed-model-manifest.json',manifest),('resources/detailed-model-sources.json',sources),('static/images/detailed/manifest.json',manifest),('static/solar/probe-models.json',probe)]: (ROOT/file).write_text(json.dumps(data,ensure_ascii=False,indent=2 if file.startswith('resources') else None)+'\n')
 p=ROOT/'static/detailed-models.js';s=p.read_text();a=s.index('definitions=')+len('definitions=');_,n=json.JSONDecoder().raw_decode(s[a:]);p.write_text(s[:a]+json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+s[a+n:])
 rt=ROOT/'resources/model-runtime-manifest.json';rows=[r for r in json.loads(rt.read_text()) if r['key'] not in IDS];rows.extend({'key':r['key'],'runtime_url':r['url'],'runtime_bytes':r['bytes'],'original_bytes':(ROOT/r['original_file']).stat().st_size,'triangles':r['triangles'],'original_triangles':r['triangles'],'compression':'original'} for r in manifest if r['key'] in IDS);rt.write_text(json.dumps(rows,indent=2)+'\n')
if __name__=='__main__':build()
