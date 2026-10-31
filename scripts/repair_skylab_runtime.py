"""Install the Skylab planar-cap repair after the preserved presentation transform."""
import hashlib,json,struct
from pathlib import Path
from repair_skylab_caps import repair
ROOT=Path(__file__).resolve().parents[1]
def build():
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());source=sources['skylab'];source.setdefault('compatibility',{})['skylab_planar_caps']=True
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());info=next(m for m in manifest if m['key']=='skylab');path=ROOT/'static/images/detailed/skylab.glb';raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];current=json.loads(raw[20:20+n]);original=(ROOT/source['file']).read_bytes();on=struct.unpack_from('<I',original,12)[0];g=json.loads(original[20:20+on]);binary=original[28+on:]
 g['materials']=current['materials'];g['nodes']=current['nodes'];g['scenes']=current['scenes'];g['scene']=current.get('scene',0)
 binary,report=repair(ROOT,g,binary,source)
 data=json.dumps(g,separators=(',',':')).encode();data+=b' '*(-len(data)%4);blob=struct.pack('<III',0x46546c67,2,28+len(data)+len(binary))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary;path.write_bytes(blob)
 info.update(bytes=len(blob),url='images/detailed/skylab.glb?v='+hashlib.sha256(blob).hexdigest()[:12],triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']))
 info.setdefault('compatibility',{})['skylab_planar_caps']={k:v for k,v in report.items() if k!='coverage_polygons'}
 for file,value in [('resources/detailed-model-sources.json',sources),('resources/detailed-model-manifest.json',manifest),('resources/skylab-planar-cap-repair.json',report)]:
  (ROOT/file).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 (ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text())
 for row in inventory:
  if row['key']=='skylab':row.update(runtime_url=info['url'],runtime_bytes=info['bytes'],triangles=info['triangles'])
 (ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
 for plane in report['planes']:print('Skylab cap',plane['x'],plane['old_triangles'],'overlapping triangles ->',plane['new_triangles'],'disjoint triangles; area',round(plane['union_area'],4),'m2')
 print('Runtime',len(blob),'bytes; other fifteen primitives and original buffers retained')
if __name__=='__main__':build()
