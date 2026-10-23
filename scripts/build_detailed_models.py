"""Preserve source surfaces, materials and embedded textures; normalize placement only."""
import gzip,hashlib,json,math,pathlib,struct
from build_science_models import identity,product,transform,node_matrix
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'static/images/detailed';OUT.mkdir(parents=True,exist_ok=True)
sources=json.loads((ROOT/'resources/science-model-sources.json').read_text());upgrades=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());manifest=[]
for key,ids in [('hubble',[20580]),('chandra',[25867]),('fermi',[33053]),('tess',[43435]),('iss',[25544])]+[(key,source['ids']) for key,source in upgrades.items() if 'ids' in source]:
 path=ROOT/upgrades[key]['file'] if key in upgrades else ROOT/'resources/science-originals'/(key+'.glb');raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
 source=upgrades.get(key,sources.get(key))
 if 'sha256' in source:assert hashlib.sha256(raw).hexdigest()==source['sha256']
 decoded=path.with_suffix('.mesh.json.gz');cache=json.loads(gzip.decompress(decoded.read_bytes())) if decoded.exists() else None
 points=[]
 def visit(index,parent):
  node=g['nodes'][index];m=product(parent,node_matrix(node))
  if 'mesh' in node:
   for j,primitive in enumerate(g['meshes'][node['mesh']]['primitives']):
    if cache:positions=cache['meshes'][node['mesh']]['primitives'][j]['positions']
    else:
     a=g['accessors'][primitive['attributes']['POSITION']];positions=[[x,y,z] for x in [a['min'][0],a['max'][0]] for y in [a['min'][1],a['max'][1]] for z in [a['min'][2],a['max'][2]]]
    points.extend(transform(m,p) for p in positions)
  for child in node.get('children',[]):visit(child,m)
 roots=g['scenes'][g.get('scene',0)]['nodes']
 for root in roots:visit(root,identity())
 bounds=[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)];span=max(b-a for a,b in bounds);center=[(a+b)/2 for a,b in bounds];scale=100/span
 normal=identity()
 for i in range(3):normal[i][i]=scale;normal[i][3]=-center[i]*scale
 # Some official exports reference a texture without providing its UV attribute.
 # Repair only reviewed uniform-texture cases; never invent a mapping for detailed textures.
 repairs=[]
 for repair in source.get('missing_uv_repairs',[]):
  primitive=g['meshes'][repair['mesh']]['primitives'][repair['primitive']];attribute='TEXCOORD_'+str(repair['texcoord'])
  assert attribute not in primitive['attributes'], 'Reviewed UV repair no longer matches the source'
  count=g['accessors'][primitive['attributes']['POSITION']]['count'];offset=len(binary);uv=b'\0'*(count*8)
  view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(uv),'target':34962})
  accessor=len(g['accessors']);g['accessors'].append({'bufferView':view,'componentType':5126,'count':count,'type':'VEC2','min':[0,0],'max':[0,0]})
  primitive['attributes'][attribute]=accessor;binary+=uv;g['buffers'][0]['byteLength']=len(binary)
  repairs.append({**repair,'count':count})
 def texture_uvs(value):
  if isinstance(value,dict):
   for name,item in value.items():
    if name.endswith('Texture') and isinstance(item,dict) and 'index' in item:
     yield item.get('extensions',{}).get('KHR_texture_transform',{}).get('texCoord',item.get('texCoord',0))
    yield from texture_uvs(item)
  elif isinstance(value,list):
   for item in value:yield from texture_uvs(item)
 for mesh in g['meshes']:
  for primitive in mesh['primitives']:
   if 'material' not in primitive:continue
   for uv in texture_uvs(g['materials'][primitive['material']]):
    assert 'TEXCOORD_'+str(uv) in primitive['attributes'], f'{key}: texture references missing TEXCOORD_{uv}'
 # Match the original wireframe's diagonal presentation, without changing the camera.
 angle=-math.pi/4;rot=identity();rot[1][1]=rot[2][2]=math.cos(angle);rot[1][2]=-math.sin(angle);rot[2][1]=math.sin(angle)
 matrix=product(rot,normal);parent=len(g['nodes']);g['nodes'].append({'name':'Atlas presentation transform','children':roots,'matrix':[matrix[i][j] for j in range(4) for i in range(4)]});g['scenes']=[{'nodes':[parent]}];g['scene']=0
 text=json.dumps(g,separators=(',',':')).encode();text+=b' '*(-len(text)%4);blob=struct.pack('<III',0x46546c67,2,28+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
 (OUT/(key+'.glb')).write_bytes(blob)
 manifest.append({'key':key,'ids':ids,'url':'images/detailed/'+key+'.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'bytes':len(blob),'source':source['page'],'download':source['download'],'sha256':hashlib.sha256(raw).hexdigest(),'uv_repairs':repairs,'credit':source.get('credit', 'NASA IGOAL' if key=='iss' else 'NASA VTAD' if key=='hubble' else 'NASA 3D Resources'),'original_file':str(path.relative_to(ROOT)),'version':source.get('version','NASA original'),'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'] if 'indices' in p),'textures':len(g.get('images',[])),'materials':len(g.get('materials',[]))})
(ROOT/'resources/detailed-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(OUT/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
template=(ROOT/'resources/detailed-models.template.js').read_text();(ROOT/'static/detailed-models.js').write_text(template.replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
print('Modèles couleur : '+', '.join(m['key'] for m in manifest)+' — '+str(sum(m['bytes'] for m in manifest))+' octets, chargés à la demande.')
