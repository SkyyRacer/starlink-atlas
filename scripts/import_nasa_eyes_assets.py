"""Download public NASA Eyes data/model assets, keeping sources and hashes.
Only asset data is imported; the Eyes application is not bundled or embedded.
"""
from pathlib import Path
import argparse,base64,concurrent.futures,hashlib,json,mimetypes,re,struct,urllib.parse,urllib.request
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'resources/nasa-eyes';OUT.mkdir(exist_ok=True)
def download(url,path):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():return path.read_bytes()
 data=urllib.request.urlopen(url,timeout=60).read();path.write_bytes(data);return data

def pack_model(url,key):
 folder=OUT/'models'/key;original=download(url,folder/'source.gltf');g=json.loads(original)
 assert g['asset']['version']=='2.0'
 binary=bytearray();offsets=[];sources=[{'url':url,'sha256':hashlib.sha256(original).hexdigest()}]
 def asset(uri):
  if uri.startswith('data:'):return base64.b64decode(uri.split(',',1)[1])
  remote=urllib.parse.urljoin(url,uri);name=Path(urllib.parse.unquote(urllib.parse.urlparse(uri).path)).name;data=download(remote,folder/name);sources.append({'url':remote,'sha256':hashlib.sha256(data).hexdigest()});return data
 def append(data):binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(data);return offset
 for buffer in g.get('buffers',[]):offsets.append(append(asset(buffer['uri'])))
 for view in g.get('bufferViews',[]):view['byteOffset']=view.get('byteOffset',0)+offsets[view.get('buffer',0)];view['buffer']=0
 for image in g.get('images',[]):
  if 'uri' not in image:continue
  uri=image.pop('uri');payload=asset(uri);mime=image.get('mimeType') or mimetypes.guess_type(uri)[0]
  assert mime in ['image/png','image/jpeg','image/webp'],mime
  image['mimeType']=mime;image['bufferView']=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':append(payload),'byteLength':len(payload)})
 binary.extend(b'\0'*(-len(binary)%4));g['buffers']=[{'byteLength':len(binary)}];text=json.dumps(g,separators=(',',':')).encode();text+=b' '*(-len(text)%4)
 raw=struct.pack('<III',0x46546c67,2,28+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
 path=folder/'original.glb';path.write_bytes(raw);(folder/'provenance.json').write_text(json.dumps(sources,indent=2));return path,hashlib.sha256(raw).hexdigest(),len(raw)

def main(metadata):
 rows=json.loads(metadata.read_text());mapping={m['key']:m for m in json.loads((ROOT/'resources/mission-ephemerides.json').read_text())['missions']};upgrades=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());report=[]
 jobs={}
 for row in rows:
  if not row.get('models'):continue
  eyes=row['key'];key=eyes.removeprefix('sc_').replace('_','-');key='voyager' if key.startswith('voyager-') else key
  if key in jobs:continue
  jobs[key]=row['models'][0]
 # Published asset exists even when Kepler is not in the current scene registry.
 jobs['kepler']='https://eyes.nasa.gov/assets/static/models/sc_kepler/Kepler.gltf'
 def model(job):
  key,url=job
  try:
   path,sha,size=pack_model(url,key);ids=[10321,10271] if key=='voyager' else [mapping[key]['id']];promote=key not in upgrades
   if promote:upgrades[key]={'file':str(path.relative_to(ROOT)),'ids':ids,'sha256':sha,'page':'https://eyes.nasa.gov/apps/solar-system/#/sc_'+key.replace('-','_'),'download':url,'credit':'NASA/JPL-Caltech · Eyes on the Solar System','version':'NASA Eyes · original texturé','material_finishes':{},'note':'Source glTF regroupée en GLB, géométrie et textures conservées.'}
   return {'key':key,'status':'downloaded','runtime_enabled':promote,'file':str(path.relative_to(ROOT)),'sha256':sha,'bytes':size,'source':url,'ids':ids}
  except Exception as error:return {'key':key,'status':'unavailable','error':str(error),'source':url}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for result in pool.map(model,jobs.items()):report.append(result);print(json.dumps(result),flush=True)
 (ROOT/'resources/detailed-model-sources.json').write_text(json.dumps(upgrades,ensure_ascii=False,indent=2)+'\n')
 # Keep each orbital/attitude definition separately, with public endpoint provenance.
 endpoints=sorted({endpoint for row in rows for endpoint in row.get('dynamo',[])})
 def orbit(endpoint):
  url='https://eyes.nasa.gov/assets/dynamic/dynamo/'+endpoint+'/def.dyn';path=OUT/'dynamo'/endpoint/'def.dyn'
  try:
   data=download(url,path);return {'endpoint':endpoint,'source':url,'file':str(path.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'status':'downloaded'}
  except Exception as error:return {'endpoint':endpoint,'source':url,'status':'unavailable','error':str(error)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:definitions=list(pool.map(orbit,endpoints))
 stars=ROOT/'static/images/sky/nasa-eyes';stars.mkdir(parents=True,exist_ok=True);star_sources=[]
 for name in [*(f'stars.{i}.bin' for i in range(6)),'galaxies.0.bin']:
  url='https://eyes.nasa.gov/assets/static/stars/'+name;data=download(url,stars/name);count=struct.unpack_from('<I',data)[0];assert len(data)==4+count*23
  star_sources.append({'url':url,'file':str((stars/name).relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'count':count})
 manifest={'source':'NASA/JPL-Caltech Eyes on the Solar System','url':'https://eyes.nasa.gov/apps/solar-system/','imported':'2026-10-27','models':report,'missions':[{k:v for k,v in row.items() if k!='definition'} for row in rows],'definitions':definitions,'stars':star_sources}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(stars/'manifest.json').write_text(json.dumps({'source':manifest['source'],'files':star_sources},separators=(',',':')))
 print('DONE',sum(m['status']=='downloaded' for m in report),'models',sum(m['runtime_enabled'] for m in report if m['status']=='downloaded'),'new runtime',len(definitions),'definitions',sum(m['count'] for m in star_sources),'stars/galaxies')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--metadata',type=Path,required=True);main(p.parse_args().metadata)
