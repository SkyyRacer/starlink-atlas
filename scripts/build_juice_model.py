"""Assemble ESA/Airbus public JUICE CAD components as a self-contained PBR GLB.
Source vertices are km in JUICE_SPACECRAFT-aligned component frames. Component
origins are the published ESA structure-kernel offsets, in metres. Surface
finishes and solar-cell artwork are Atlas presentation, not engineering data.
"""
from pathlib import Path
import concurrent.futures,gzip,hashlib,json,math,struct,urllib.parse,urllib.request,zlib
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'resources/juice-cad';SRC.mkdir(exist_ok=True)
BASE='https://spiftp.esac.esa.int/data/SPICE/JUICE/misc/models/'
PARTS=[('bus',7,(0,0,0)),('sapy',2,(.019,1,1.652)),('samy',2,(.019,-1,1.652)),('mag',6,(1.380,-.857,.168)),('mga_apm',4,(-1.398,-.893,3.442)),('mga_dish',4,(-1.290,-1.739,3.327)),('rimemx',3,(.614,.800,3.544)),('rimepx',3,(-.647,.910,3.544)),('rwi',4,(6.775,-.857,-6.495)),('scm',3,(6.579,-.857,-6.252)),('gala',2,(.991,.058,3.444)),('janus',2,(1.073,.524,3.502)),('jmc1',2,(1.458,-.425,.955)),('jmc2',2,(-.021,1.058,3.624)),('majis',2,(1.399,.234,3.222)),('swi',3,(1.424,-.379,3.558)),('uvs',1,(1.430,1.141,3.191)),('pep_jdc',2,(1.373,.182,.217)),('pep_jei',2,(-.479,-.686,3.875)),('pep_jeni',2,(.300,-.784,3.640)),('pep_jna',2,(-.247,-.978,3.793)),('pep_nim',2,(-.116,-.644,3.911)),('str1',2,(1.503,-.548,2.411)),('str2',2,(1.495,-.585,2.820)),('str3',2,(1.495,-.299,2.641)),('lpb1',2,(1.384,1.134,2.281)),('lpb2',2,(1.455,-1.162,3.207)),('lpb3',2,(1.455,-1.162,.247)),('lpb4',2,(-1.379,1.143,2.336)),('navcam1',1,(.902,-.424,3.364)),('navcam2',1,(1.106,-.563,3.364))]
def get(part):
 name,version,offset=part;file=f'juice_sc_{name}_v{version:02}.obj';p=SRC/file;url=BASE+urllib.parse.quote(file)
 if not p.exists() and not p.with_suffix(p.suffix+'.gz').exists():p.write_bytes(urllib.request.urlopen(url,timeout=70).read())
 return {'file':file,'url':url,'sha256':hashlib.sha256(p.read_bytes() if p.exists() else gzip.decompress(p.with_suffix(p.suffix+'.gz').read_bytes())).hexdigest(),'offset_m':offset}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:manifest=list(pool.map(get,PARTS))
# Original solar-cell texture, repeating in model UV space; no third-party image.
w,h=128,256;pixels=bytearray()
for y in range(h):
 pixels.append(0)
 for x in range(w):
  grid=x%16 in (0,1) or y%16 in (0,1);bus=x%16==8;v=int(5*math.sin(x*.08+y*.03));pixels.extend((85,99,126) if grid else (110,97,64) if bus else (16+v,32+v,65+v))
def pngchunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
png=b'\x89PNG\r\n\x1a\n'+pngchunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+pngchunk(b'IDAT',zlib.compress(pixels,9))+pngchunk(b'IEND',b'')
g={'asset':{'version':'2.0','generator':'Atlas · ESA JUICE CAD assembly','copyright':'ESA / Airbus · public JUICE SPICE CAD; PBR finishes and solar cells: Atlas'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'accessors':[],'bufferViews':[],'buffers':[],'materials':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]};binary=bytearray()
def view(raw,target=None):
 binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(raw);v={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
 if target:v['target']=target
 g['bufferViews'].append(v);return len(g['bufferViews'])-1
def acc(values,kind,components,ctype=5126):
 fmt='f' if ctype==5126 else 'I';raw=struct.pack('<'+str(len(values)*components)+fmt,*[v for row in values for v in row])
 a={'bufferView':view(raw,34963 if kind=='SCALAR' else 34962),'componentType':ctype,'count':len(values),'type':kind}
 if kind=='VEC3':a.update(min=[min(v[i] for v in values) for i in range(3)],max=[max(v[i] for v in values) for i in range(3)])
 g['accessors'].append(a);return len(g['accessors'])-1
g['images'].append({'bufferView':view(png),'mimeType':'image/png'});g['textures'].append({'source':0,'sampler':0})
for name,color,metal,rough in [('Black MLI',[.055,.06,.065,1],.45,.36),('White antenna and radiators',[.88,.9,.91,1],.18,.32),('Solar cells',[1,1,1,1],.58,.23),('Instrument metal',[.46,.49,.52,1],.8,.23),('Gold instrument insulation',[.55,.36,.09,1],.8,.3)]:
 pbr={'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough}
 if name=='Solar cells':pbr['baseColorTexture']={'index':0}
 g['materials'].append({'name':name,'doubleSided':True,'pbrMetallicRoughness':pbr})
for part,meta in zip(PARTS,manifest):
 name,version,offset=part;vertices=[];normals=[];groups={}
 for line in ((SRC/meta['file']).read_text() if (SRC/meta['file']).exists() else gzip.decompress((SRC/(meta['file']+'.gz')).read_bytes()).decode()).splitlines():
  fields=line.split()
  if not fields:continue
  if fields[0]=='v':vertices.append(tuple(float(x)*1000 for x in fields[1:4]))
  elif fields[0]=='vn':normals.append(tuple(map(float,fields[1:4])))
  elif fields[0]=='f':
   face=[tuple(int(x) if x else 0 for x in f.split('/')) for f in fields[1:]]
   for k in range(1,len(face)-1):
    tri=[face[0],face[k],face[k+1]];points=[vertices[t[0]-1] for t in tri];centre=[sum(p[i] for p in points)/3 for i in range(3)]
    material=2 if name in ['sapy','samy'] else 1 if name=='bus' and centre[0]<-1.32 else 0 if name=='bus' else 1 if name in ['mga_dish'] else 4 if name in ['pep_nim','pep_jeni'] else 3
    a,b,c=points;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.hypot(*n)
    if length<1e-15:continue
    n=[x/length for x in n];group=groups.setdefault(material,{'positions':[],'normals':[],'uvs':[],'indices':[],'lookup':{}})
    for t,p in zip(tri,points):
     normal=normals[t[2]-1] if len(t)>2 and t[2]>0 else n;key=(t[0],*normal)
     if key not in group['lookup']:
      group['lookup'][key]=len(group['positions']);group['positions'].append(p);group['normals'].append(normal);group['uvs'].append((p[0]/2.5,p[1]/2.5))
     group['indices'].append((group['lookup'][key],))
 primitives=[]
 for material,group in groups.items():
  attrs={'POSITION':acc(group['positions'],'VEC3',3),'NORMAL':acc(group['normals'],'VEC3',3)}
  if material==2:attrs['TEXCOORD_0']=acc(group['uvs'],'VEC2',2)
  primitives.append({'attributes':attrs,'indices':acc(group['indices'],'SCALAR',1,5125),'material':material})
 mesh=len(g['meshes']);g['meshes'].append({'name':name,'primitives':primitives});node=len(g['nodes']);g['nodes'].append({'name':'JUICE '+name,'mesh':mesh,'translation':offset,**({'rotation':[0,0,1,0]} if name=='samy' else {})});g['scenes'][0]['nodes'].append(node)
binary.extend(b'\0'*(-len(binary)%4));g['buffers']=[{'byteLength':len(binary)}];text=json.dumps(g,separators=(',',':')).encode();text+=b' '*(-len(text)%4);blob=struct.pack('<III',0x46546c67,2,28+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
out=ROOT/'resources/detailed-originals/juice-esa.glb';out.write_bytes(blob)
(SRC/'manifest.json').write_text(json.dumps({'documentation':'https://juicesoc.esac.esa.int/help/82_spacecraft_model.html','files':manifest,'note':'Official geometry and published component translations; illustrative deployed solar-array orientation and PBR surface finishes; not live attitude telemetry.','sha256':hashlib.sha256(blob).hexdigest()},indent=2))
p=ROOT/'resources/detailed-model-sources.json';sources=json.loads(p.read_text());sources['juice']={'file':str(out.relative_to(ROOT)),'ids':[56176],'download':BASE,'page':'https://juicesoc.esac.esa.int/help/82_spacecraft_model.html','version':'ESA JUICE CAD · Atlas PBR finish','sha256':hashlib.sha256(blob).hexdigest(),'credit':'ESA / Airbus · adaptation Atlas','license':'ESA public SPICE spacecraft model · original Atlas surface finishes','body_axes':[[1,0,0],[0,1,0],[0,0,1]],'presentation_focus_node':'JUICE bus','note':'Géométrie technique ESA/Airbus ; matériaux illustratifs Atlas, sans télémétrie d’attitude.'};p.write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n');print('JUICE official CAD',len(PARTS),'parts',len(blob),'bytes',flush=True)
