"""Mir white feature lines from the exact selected authored detailed assembly."""
import hashlib,json,struct
from pathlib import Path
import numpy as np
from build_tiangong_white import lines_from_model,write_glb
from build_science_models import length,minus
ROOT=Path(__file__).resolve().parents[1]
def build():
 detailed=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());info=next(r for r in detailed if r['key']=='mir');source=ROOT/'static'/info['url'].split('?')[0];raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
 def array(index):
  a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dim={'VEC3':3,'SCALAR':1}[a['type']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];size=np.dtype(dtype).itemsize
  return np.ndarray((a['count'],dim),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dim*size),size))
 # Compact each primitive first: the original author shares a large vertex array.
 for mesh in g['meshes']:
  for p in mesh['primitives']:
   indices=array(p['indices']).ravel();used,inverse=np.unique(indices,return_inverse=True);p['positions']=array(p['attributes']['POSITION'])[used].tolist();p['indices']=inverse.tolist()
 lines,parts=lines_from_model(source,decoded=g,max_edges_per_primitive=650);dest=ROOT/'static/images/science/mir.glb';blob=write_glb(lines,dest,generator='Atlas Mir white feature edges from selected detailed model',copyright=info['credit'])
 icon=sorted(lines,key=lambda e:length(minus(*e)),reverse=True)[:1800];project=lambda p:[.866*p[0]+.5*p[2],-.22*p[0]+.84*p[1]+.38*p[2]];drawing=[list(map(project,e)) for e in icon];lo=[min(p[k] for e in drawing for p in e) for k in range(2)];hi=[max(p[k] for e in drawing for p in e) for k in range(2)];span=max(hi[k]-lo[k] for k in range(2));drawing=[[[round((p[k]-(lo[k]+hi[k])/2)/span*100,3) for k in range(2)] for p in e] for e in drawing];draw=json.dumps({'segments':drawing},separators=(',',':')).encode();(ROOT/'static/images/science/mir.json').write_bytes(draw)
 manifest=json.loads((ROOT/'resources/science-model-manifest.json').read_text());row={'key':'mir','page_id':'mir','ids':[16609],'name':'Mir','kind':'selected-model-outline','credit':'Atlas · contours du modèle Mir sélectionné','source':info['source'],'glb':'images/science/mir.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'drawing':'images/science/mir.json?v='+hashlib.sha256(draw).hexdigest()[:12],'radius':round(max(length(p) for e in lines for p in e),3),'segments':len(icon),'line_segments':len(lines),'bytes':len(blob)+len(draw),'body_axes':True};manifest=[r for r in manifest if r['key']!='mir']+[row];(ROOT/'resources/science-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/science/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')));(ROOT/'static/science-visual.js').write_text((ROOT/'resources/science-visual.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))));sources=json.loads((ROOT/'resources/science-model-sources.json').read_text());sources['mir']={'enabled':True,'kind':row['kind'],'credit':row['credit'],'page':info['source'],'detailed_outline':'mir','geometry_note':'Same authored complete post-Priroda assembly and fixed array pose as selected detailed model. No measured historical attitude.'};(ROOT/'resources/science-model-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n');(ROOT/'resources/mir-white-model.json').write_text(json.dumps({'source_sha256':hashlib.sha256(raw).hexdigest(),'line_segments':len(lines),'bytes':len(blob),'bounds':[[min(p[k] for e in lines for p in e) for k in range(3)],[max(p[k] for e in lines for p in e) for k in range(3)]],'parts':parts},indent=2)+'\n');print('Mir white:',len(lines),'lines;',len(blob),'bytes')
if __name__=='__main__':build()
