"""Use the actual licensed DaveBowman2001 Mir asset, not the Atlas reconstruction.
Keep the original mesh, UVs, materials and colour textures without surface repainting.
"""
import hashlib,json,math,struct
from pathlib import Path
from build_science_models import identity,product,node_matrix,transform
ROOT=Path(__file__).resolve().parents[1]
def build():
 path=ROOT/'resources/detailed-originals/mir-celestia.glb';raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:];sha=hashlib.sha256(raw).hexdigest();points=[]
 def visit(i,parent):
  node=g['nodes'][i];matrix=product(parent,node_matrix(node))
  if 'mesh' in node:
   for p in g['meshes'][node['mesh']]['primitives']:
    a=g['accessors'][p['attributes']['POSITION']]
    points.extend(transform(matrix,[x,y,z]) for x in [a['min'][0],a['max'][0]] for y in [a['min'][1],a['max'][1]] for z in [a['min'][2],a['max'][2]])
  for child in node.get('children',[]):visit(child,matrix)
 roots=g['scenes'][g.get('scene',0)]['nodes']
 for i in roots:visit(i,identity())
 lo=[min(p[k] for p in points) for k in range(3)];hi=[max(p[k] for p in points) for k in range(3)];center=[(lo[k]+hi[k])/2 for k in range(3)];scale=100/max(hi[k]-lo[k] for k in range(3));normal=identity()
 for i in range(3):normal[i][i]=scale;normal[i][3]=-center[i]*scale
 # Native Celestia axes to the current Z-up/X-forward Mir body frame.
 # Equivalent to the previous Y-up loader and -45 degree presentation with
 # its calibrated body basis removed. A proper rotation, never a mirror.
 body_axes=[[0,0,-1],[1,0,0],[0,-1,0]]
 rotation=identity()
 for i in range(3):
  for j in range(3):rotation[i][j]=body_axes[i][j]
 matrix=product(rotation,normal)
 g['nodes'].append({'name':'Atlas presentation transform','children':roots,'matrix':[matrix[i][j] for j in range(4) for i in range(4)]});g['scenes']=[{'nodes':[len(g['nodes'])-1]}];g['scene']=0
 from historical_solar_rig import apply
 binary,tracking,solar_audit=apply(g,binary,'mir')
 encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary;(ROOT/'static/images/detailed/mir.glb').write_bytes(blob)
 revision='e6d05411f1ab8aecbd8d72173711ae37f228deaf';page='https://github.com/CelestiaProject/CelestiaContent/tree/'+revision+'/extras-standard/mir';download='https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/'+revision+'/extras-standard/mir/models/mir.cmod'
 source={'enabled':True,'file':str(path.relative_to(ROOT)),'download':download,'page':page,'ids':[16609],'sha256':sha,'credit':'DaveBowman2001 · CC BY 4.0 · conversion Atlas','license':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','version':'Celestia Mir · modèle original complet après Priroda (1996)','conversion':'scripts/convert_mir_celestia.py; original source geometry, UV placement, colour texture images and material assignments preserved without repainting.','historical_solar_tracking':True,'body_axes':body_axes,'source_audit':'resources/model-research-2026-10-24/mir-source-audit.json','conversion_audit':'resources/mir-conversion-audit.json','note':'Modèle d’auteur texturé, non reconstitution Atlas. Configuration matérielle représentative de 1996 ; pas de télémétrie historique d’attitude ou d’articulations.'}
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());sources['mir']=source;(ROOT/'resources/detailed-model-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')
 info={'key':'mir','ids':[16609],'url':'images/detailed/mir.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'bytes':len(blob),'source':page,'download':download,'sha256':sha,'uv_repairs':[],'compatibility':{'solar_partition':solar_audit['solar_partition']},'solar_rig':tracking,'material_finishes':{},'presentation_focus_node':None,'body_axes':body_axes,'note':source['note'],'credit':source['credit'],'original_file':source['file'],'version':source['version'],'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']),'textures':len(g['images']),'original_colour_textures':9,'materials':len(g['materials'])}
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());manifest=[info if row['key']=='mir' else row for row in manifest];(ROOT/'resources/detailed-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')));(ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());inventory=[{'key':'mir','runtime_url':info['url'],'runtime_bytes':len(blob),'original_bytes':len(raw),'triangles':info['triangles'],'original_triangles':info['triangles'],'compression':'original'} if row['key']=='mir' else row for row in inventory];(ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n');(ROOT/'resources/mir-selected-author-model.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n');print('Mir author model:',info['triangles'],'triangles,',info['textures'],'textures,',len(blob),'bytes')
if __name__=='__main__':build()
