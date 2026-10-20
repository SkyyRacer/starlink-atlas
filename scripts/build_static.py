"""Export a self-contained GitHub Pages site; no external Python packages required."""
import argparse,gzip,hashlib,json,os,pathlib,re,shutil,subprocess,tempfile,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',default='public');p.add_argument('--data-dir',default='data');p.add_argument('--history-dir');p.add_argument('--remote-history');p.add_argument('--compact-cache',action='store_true');p.add_argument('--wasm',default='web-core/target/wasm32-unknown-unknown/release/atlas_web_core.wasm');a=p.parse_args()
out=pathlib.Path(a.output).resolve();data=pathlib.Path(a.data_dir).resolve();history=pathlib.Path(a.history_dir).resolve() if a.history_dir else data/'history';wasm=(ROOT/a.wasm).resolve()
if not wasm.is_file():raise SystemExit('Compilez le moteur WASM avant cet export.')
# Only replace an existing dedicated generated site, never an arbitrary directory.
if out.exists():
 if not (out/'.atlas-generated').exists():raise SystemExit('Dossier de sortie existant non reconnu : choisissez un autre dossier.')
 shutil.rmtree(out)
shutil.copytree(ROOT/'static',out);(out/'.atlas-generated').touch();(out/'.nojekyll').touch()
with tempfile.TemporaryDirectory() as tmp:
 subprocess.run([str(ROOT/'target/release/starlink-atlas'),'--export-web',tmp],env=dict(os.environ,DATA_DIR=str(data),HISTORY_DIR=str(history)),cwd=ROOT,check=True)
 bundle=json.loads((pathlib.Path(tmp)/'bundle.json').read_text())
 (out/'news.json').write_text(json.dumps(bundle.pop('news',{'items':[]}),ensure_ascii=False))
 for name,key in [('iss-missions.json','iss_missions'),('iss-evas.json','iss_evas'),('tiangong-missions.json','tiangong_missions')]:
  cache=data/name
  if cache.is_file():bundle[key]=json.loads(cache.read_text())
 # Drop duplicate elements with identical satellite/source/epoch; preserve all distinct observations.
 rows={}
 for row in bundle['orbits']:
  e=row['elements'];rows[(e['NORAD_CAT_ID'],e['EPOCH'],row['source'])]=row
 bundle['orbits']=list(rows.values())
 from compact_web_data import compact
 updates=compact(bundle,data,prune=a.compact_cache)
 manifest=bundle['catalog_response'].get('history') or {'days':{},'observations':0}
 manifest['remote_base']=a.remote_history
 manifest['remote_days']=list(manifest.get('days',{}))
 manifest['local_days']=[]
 manifest['local_files']={}
 versions=data/'history-versions';versions.mkdir(exist_ok=True);current_versions=set()
 original_days=dict(manifest.get('days',{}))
 manifest['source_label']='Julien Simon / Space-Track et collectes CelesTrak, échantillonnées par jour'
 for file in sorted(updates.glob('*.json.gz')):
  compressed=file.read_bytes();observed=json.loads(gzip.decompress(compressed));day=file.name[:10];manifest['local_days'].append(day)
  name=hashlib.sha256(compressed).hexdigest()+'.json.gz';current_versions.add(name);version=versions/name
  if not version.exists():version.write_bytes(compressed)
  manifest['local_files'][day]='data/observations/'+name
  manifest['observations']=manifest.get('observations',0)-manifest.get('days',{}).get(day,0)+len(observed)+original_days.get(day,0);manifest.setdefault('days',{})[day]=len(observed)+original_days.get(day,0)
  epochs=[r['elements']['EPOCH'] for r in observed]
  if epochs:manifest['last_epoch']=max([manifest.get('last_epoch',''),*epochs])
 bundle['catalog_response']['history']=manifest
 bundle['catalog_response']['message']='Collecte périodique · données de cette visite figées jusqu’au rechargement'
 encoded=json.dumps(bundle,separators=(',',':'),ensure_ascii=False).encode();stamp=hashlib.sha256(encoded).hexdigest()[:20];bundle['catalog_response']['snapshot']=stamp
 encoded=json.dumps(bundle,separators=(',',':'),ensure_ascii=False).encode()
 (out/'data').mkdir();filename=f'data/edition-{stamp}.json.gz';(out/filename).write_bytes(gzip.compress(encoded,mtime=0))
 from web_payloads import build_resources
 import datetime as dt
 resources,collections=build_resources(out,bundle,history,updates,dt.datetime.now(dt.timezone.utc))
 (out/'edition.json').write_text(json.dumps({'bundle':filename,'edition':stamp,'resources':resources,'collections':collections}))
if history.exists() and not a.remote_history:shutil.copytree(history,out/'data/history')
(out/'data/observations').mkdir(exist_ok=True)
for file in versions.glob('*.json.gz'):
 if file.name not in current_versions and time.time()-file.stat().st_mtime>7*86400:file.unlink()
 else:shutil.copyfile(file,out/'data/observations'/file.name)
for file in (ROOT/'browser').glob('*.js'):shutil.copyfile(file,out/file.name)
shutil.copyfile(wasm,out/'atlas_web_core.wasm')
# A new asset release invalidates only reusable rendering caches, never page data.
asset_version=hashlib.sha256(b''.join(f.read_bytes() for f in sorted((ROOT/'static').rglob('*')) if f.is_file() and f.name!='asset-sw.js')+wasm.read_bytes()).hexdigest()[:16]
sw=out/'asset-sw.js';sw.write_text(sw.read_text().replace('atlas-rendering-v1','atlas-rendering-'+asset_version))
worker_file=out/'browser-worker.js';worker_file.write_text(worker_file.read_text().replace("importScripts('constellations.js')","importScripts('constellations.js?v="+hashlib.sha256((out/'constellations.js').read_bytes()).hexdigest()[:12]+"')").replace("'atlas_web_core.wasm'","'atlas_web_core.wasm?v="+hashlib.sha256(wasm.read_bytes()).hexdigest()[:12]+"'"))
transport_file=out/'transport.js';transport_file.write_text(transport_file.read_text().replace("'browser-worker.js'","'browser-worker.js?v="+hashlib.sha256(worker_file.read_bytes()).hexdigest()[:12]+"'"))
# Project Pages are under /repository/. Keep every local resource relative to that path.
for file in out.glob('*.js'):
 text=file.read_text().replace("'/images/","'./images/").replace("'/vendor/","'./vendor/").replace('"/vendor/','"./vendor/').replace('`/vendor/','`./vendor/')
 if file.name=='pages.js':text=text.replace("const routeRoot='/'","const routeRoot='./'")
 if file.name=='app.js':text=text.replace('async function getRaw(url){','async function getRaw(url){if(window.AtlasStatic)return window.AtlasStatic.handle(url);')
 file.write_text(text)
index=out/'index.html';text=index.read_text().replace('href="/','href="./').replace('src="/','src="./');text=text.replace('<script src="./app.js','<script src="./transport.js?v='+hashlib.sha256(transport_file.read_bytes()).hexdigest()[:12]+'"></script><script src="./app.js');
# Hash the actual exported files after route and resource rewrites.
for name in set(re.findall(r'(?:src|href)="\./([^"?]+)\?v=[a-f0-9]+"',text)):
 asset=out/name
 if asset.is_file():text=re.sub(re.escape(name)+r'\?v=[a-f0-9]+',name+'?v='+hashlib.sha256(asset.read_bytes()).hexdigest()[:12],text)
index.write_text(text)
# Distinct static documents share assets via a base URL under /repository/.
root_html=index.read_text().replace('<head>','<head><base href="./">',1).replace('<title>Starlink Atlas — Observatoire orbital</title>','<title>Atlas — Tous les satellites</title>')
index.write_text(root_html)
for page,title in [('atlas','Atlas — Tous les satellites'),*[(row['id'],row['label']+' — '+row['description']) for row in json.loads((ROOT/'resources/constellations.json').read_text())]]:
 folder=out/page;folder.mkdir()
 html=root_html.replace('<base href="./">','<base href="../">').replace('<title>Atlas — Tous les satellites</title>',f'<title>{title}</title>')
 (folder/'index.html').write_text(html)
size=sum(f.stat().st_size for f in out.rglob('*') if f.is_file())
if size>950_000_000:raise SystemExit(f'Site trop proche de la limite GitHub Pages : {size} octets. Déplacer les archives historiques avant publication.')
print(json.dumps({'output':str(out),'bytes':size,'edition':stamp,'catalogue':len(bundle['catalog_response']['satellites']),'orbits':len(bundle['orbits'])},indent=2))
