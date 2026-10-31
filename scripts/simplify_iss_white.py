"""Build-only topology-preserving mesh reduction before extracting white edges.
Needs numpy and fast-simplification. Stores a portable stdlib-readable cache.
"""
import gzip,json,sys,re
from pathlib import Path
import numpy as np
if len(sys.argv)>1:sys.path.insert(0,sys.argv[1])
import fast_simplification
ROOT=Path(__file__).resolve().parents[1];g=json.loads(gzip.decompress((ROOT/'resources/iss-white-source.mesh.json.gz').read_bytes()))
for mesh in g['meshes']:
 if not re.search(r'^(Airlock\.|BEAM\.|Bishop_Airlock|Columbus\.|Cupola|JEM_(PM|ELM|EF|ELP|SHP|SHY)|MLM\.|MRM[12]\.|Node[123]\.|PMA[123]\.|PMM\.|[PS][46]_.*Array|IROSA_Deployed|Truss_|[PS][16]_Radiator|USLab\.|Zarya|Zvezda|Russian_RSNode|SSRMS_|ELP_PRIME|SHP_PRIME|WR[RPY]\.)',mesh.get('name','')):
  mesh['primitives']=[];continue
 for p in mesh['primitives']:
  points=np.array(p['positions'],dtype=np.float64);faces=np.array(p['indices'],dtype=np.int32).reshape(-1,3);points,inv=np.unique(np.round(points,5),axis=0,return_inverse=True);faces=inv[faces].astype(np.int32);faces=faces[np.all(np.diff(np.sort(faces,axis=1),axis=1)!=0,axis=1)]
  target=500 if 'Truss' in mesh.get('name','') else 220
  if len(faces)>target:points,faces=fast_simplification.simplify(points,faces,target_count=target,agg=7)
  p['positions']=points.tolist();p['indices']=faces.flatten().tolist()
g['simplification']='Welded vertices; up to 220 faces per main-assembly primitive, 500 for truss parts. Layout remains the calibrated NASA assembly.'
(ROOT/'resources/iss-white-coarse.mesh.json.gz').write_bytes(gzip.compress(json.dumps(g,separators=(',',':')).encode(),compresslevel=9))
print('Reduced ISS build geometry',sum(len(p['indices'])//3 for m in g['meshes'] for p in m['primitives']),'triangles')
