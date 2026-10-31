"""Targeted Tiangong material/cap fixes; preserve other detailed models."""
import hashlib,json,struct
from pathlib import Path
from model_compatibility import prepare
ROOT=Path(__file__).resolve().parents[1]
def build():
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());audit=[]
 for info in manifest:
  key=info['key']
  if key not in {'tiangong','tiangong-1','tiangong-2'}:continue
  source=sources[key];source.setdefault('compatibility',{})['remove_internal_caps']=True
  source.setdefault('material_finishes',{}).update({name:{'metallicFactor':metal,'roughnessFactor':rough} for name,metal,rough in [('tg-white',.1,.52),('tg-grey',.38,.5),('tg-frame',.86,.4),('silver',.82,.42),('steel',.92,.38)]})
  source['normal_map_scales']={'tg-white':.08,'tg-grey':.08,'tg-frame':.06,'silver':.08}
  path=ROOT/'static'/info['url'].split('?')[0];raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
  if info.get('compatibility',{}).get('removed_internal_faces'):raise ValueError('Restore the unpatched normalized runtime before repeating this operation')
  binary,report=prepare(ROOT,g,binary,source)
  for material in g['materials']:
   finish=source['material_finishes'].get(material['name'])
   if finish:material['pbrMetallicRoughness'].update(finish)
  data=json.dumps(g,separators=(',',':')).encode();data+=b' '*(-len(data)%4);blob=struct.pack('<III',0x46546c67,2,28+len(data)+len(binary))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary;path.write_bytes(blob)
  info.update(url='images/detailed/'+key+'.glb?v='+hashlib.sha256(blob).hexdigest()[:12],bytes=len(blob),compatibility=report,material_finishes=source['material_finishes'],triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']))
  audit.append({'key':key,'removed_internal_triangles':sum(len(r['triangle_indices']) for r in report['removed_internal_faces']),'report':report});print(key,audit[-1]['removed_internal_triangles'],'internal triangles removed')
 for file,value in [('resources/detailed-model-sources.json',sources),('resources/detailed-model-manifest.json',manifest),('resources/tiangong-surface-stability.json',audit)]:
  (ROOT/file).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 (ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());bykey={m['key']:m for m in manifest}
 for row in inventory:
  if row['key'] in {r['key'] for r in audit}:row.update(runtime_url=bykey[row['key']]['url'],runtime_bytes=bykey[row['key']]['bytes'],triangles=bykey[row['key']]['triangles'])
 (ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':build()
