"""Install the user-supplied complete Mir GLB without rebuilding its geometry.
Retain every source binary buffer (positions, normals, indices and vertex colours).
Only add PBR response by surface family and a centred, uniform display transform.
"""
import hashlib,json,struct,zipfile
from pathlib import Path
from build_science_models import identity,product,node_matrix,transform
ROOT=Path(__file__).resolve().parents[1]

def save(path,value):
 (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def build(archive):
 with zipfile.ZipFile(archive) as z:
  raw=z.read('mir_atlas/mir_atlas_1996_complete.glb')
  metadata=json.loads(z.read('mir_atlas/mir_atlas_metadata.json'))
  package=ROOT/'resources/mir-user-pack';package.mkdir(exist_ok=True)
  for name in ['README.md','mir_atlas_metadata.json','mir_atlas_mobile_metadata.json','mir_atlas_preview.png','mir_atlas_preview_2.png','build_mir.py','render_preview.py']:
   (package/name).write_bytes(z.read('mir_atlas/'+name))
 original=ROOT/'resources/detailed-originals/mir-user-pack.glb';original.write_bytes(raw)
 n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
 assert g['asset']['version']=='2.0'
 points=[]
 def visit(i,parent):
  node=g['nodes'][i];matrix=product(parent,node_matrix(node))
  if 'mesh' in node:
   for p in g['meshes'][node['mesh']]['primitives']:
    a=g['accessors'][p['attributes']['POSITION']]
    points.extend(transform(matrix,[x,y,z]) for x in [a['min'][0],a['max'][0]] for y in [a['min'][1],a['max'][1]] for z in [a['min'][2],a['max'][2]])
  for child in node.get('children',[]):visit(child,matrix)
 roots=g['scenes'][g.get('scene',0)]['nodes']
 for i in roots:visit(i,identity())
 lo=[min(p[k] for p in points) for k in range(3)];hi=[max(p[k] for p in points) for k in range(3)]
 # All axes remain those documented in the pack: +X core aft, +Y Kvant-2,
 # +Z Priroda. Keep the existing nominal orbital frame, with no mirrored scale.
 scale=100/max(hi[k]-lo[k] for k in range(3));matrix=identity()
 for k in range(3):matrix[k][k]=scale;matrix[k][3]=-(lo[k]+hi[k])/2*scale
 g['nodes'].append({'name':'Atlas presentation transform','children':roots,'matrix':[matrix[i][j] for j in range(4) for i in range(4)]});g['scenes']=[{'nodes':[len(g['nodes'])-1]}];g['scene']=0
 # The export stores colours in COLOR_0, not texture images. A white PBR
 # factor preserves these colours; metal/roughness supplies existing reflections.
 finishes={};g.setdefault('materials',[])
 for mesh in g['meshes']:
  family=mesh.get('name','').split('__')[-1]
  metallic,roughness=(.75,.27) if family.startswith('metal') or family=='solar_frame' else (.72,.4) if family in ['foil','gold','gold_light'] else (.3,.3) if family.startswith('solar') else (.18,.16) if family=='window' else (.05,.72)
  name='Mir pack '+family
  if name not in finishes:
   finishes[name]=len(g['materials']);g['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':metallic,'roughnessFactor':roughness}})
  for p in mesh['primitives']:
   assert 'COLOR_0' in p['attributes'] and 'NORMAL' in p['attributes']
   p['material']=finishes[name]
 encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
 (ROOT/'static/images/detailed/mir.glb').write_bytes(blob)
 sha=hashlib.sha256(raw).hexdigest();url='images/detailed/mir.glb?v='+hashlib.sha256(blob).hexdigest()[:12]
 note='Modèle fourni · configuration complète de 1996, sans vaisseaux visiteurs. Dimensions et détails approximatifs ; orientation orbitale nominale, attitude historique non mesurée.'
 credit='Modèle fourni · Mir Atlas Complete 1996';page='https://www.nasa.gov/history/SP-4225/diagrams/mir/mir-diagram.htm'
 source={'enabled':True,'file':str(original.relative_to(ROOT)),'ids':[16609],'page':page,'download':'','sha256':sha,'version':'Mir Atlas Complete 1996 · archive fournie','credit':credit,'body_axes':identity()[:3],'solar_rig':[],'note':note,'provenance':'resources/mir-user-pack/README.md','license':'Fichier fourni par l’utilisateur ; aucune nouvelle licence attribuée par Atlas','material_finishes':{m['name']:m['pbrMetallicRoughness'] for m in g['materials']}}
 source['body_axes']=[[1,0,0],[0,1,0],[0,0,1]]
 source['added_materials']=g['materials']
 source['primitive_materials']=[[p['material'] for p in m['primitives']] for m in g['meshes']]
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());sources['mir']=source;save('resources/detailed-model-sources.json',sources)
 triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
 info={'key':'mir','ids':[16609],'url':url,'bytes':len(blob),'source':page,'download':'','sha256':sha,'uv_repairs':[],'compatibility':{'added_materials':source['added_materials'],'primitive_materials':source['primitive_materials']},'solar_rig':[],'material_finishes':source['material_finishes'],'presentation_focus_node':None,'body_axes':source['body_axes'],'note':note,'credit':credit,'original_file':source['file'],'version':source['version'],'triangles':triangles,'textures':len(g.get('images',[])),'materials':len(g['materials']),'docked_visitors':[]}
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());manifest=[info if r['key']=='mir' else r for r in manifest];save('resources/detailed-model-manifest.json',manifest)
 (ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 (ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());inventory=[{'key':'mir','runtime_url':url,'runtime_bytes':len(blob),'original_bytes':len(raw),'triangles':triangles,'original_triangles':triangles,'compression':'original'} if r['key']=='mir' else r for r in inventory];save('resources/model-runtime-manifest.json',inventory)
 save('resources/mir-user-pack-import.json',{'archive_sha256':hashlib.sha256(Path(archive).read_bytes()).hexdigest(),'source_sha256':sha,'runtime_sha256':hashlib.sha256(blob).hexdigest(),'source_binary_preserved':True,'bounds_m':[lo,hi],'triangles':triangles,'source_metadata':metadata,'note':note})
 print('Mir imported:',triangles,'triangles;',len(blob),'bytes; source binary preserved')
if __name__=='__main__':
 import sys
 build(sys.argv[1])
