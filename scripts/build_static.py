"""Export a self-contained GitHub Pages site; no external Python packages required."""
import argparse,gzip,hashlib,json,os,pathlib,re,shutil,subprocess,tempfile
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
 # Drop duplicate elements with identical satellite/source/epoch; preserve all distinct observations.
 rows={}
 for row in bundle['orbits']:
  e=row['elements'];rows[(e['NORAD_CAT_ID'],e['EPOCH'],row['source'])]=row
 bundle['orbits']=list(rows.values())
 from compact_web_data import compact
 updates=compact(bundle,data,prune=a.compact_cache)
 manifest=bundle['catalog_response'].get('history') or {'days':{},'observations':0}
 manifest['remote_base']=a.remote_history
 manifest['remote_days']=list(manifest.get('days',{})) if a.remote_history else []
 manifest['local_days']=[]
 manifest['source_label']='Julien Simon / Space-Track et collectes CelesTrak, échantillonnées par jour'
 for file in sorted(updates.glob('*.json.gz')):
  observed=json.loads(gzip.decompress(file.read_bytes()));day=file.name[:10];manifest['local_days'].append(day)
  manifest['observations']=manifest.get('observations',0)-manifest.get('days',{}).get(day,0)+len(observed);manifest.setdefault('days',{})[day]=len(observed)
  epochs=[r['elements']['EPOCH'] for r in observed]
  if epochs:manifest['last_epoch']=max([manifest.get('last_epoch',''),*epochs])
 bundle['catalog_response']['history']=manifest
 bundle['catalog_response']['message']='Collecte périodique · données de cette visite figées jusqu’au rechargement'
 encoded=json.dumps(bundle,separators=(',',':'),ensure_ascii=False).encode();stamp=hashlib.sha256(encoded).hexdigest()[:20];bundle['catalog_response']['snapshot']=stamp
 encoded=json.dumps(bundle,separators=(',',':'),ensure_ascii=False).encode()
 (out/'data').mkdir();filename=f'data/edition-{stamp}.json.gz';(out/filename).write_bytes(gzip.compress(encoded,mtime=0))
 (out/'edition.json').write_text(json.dumps({'bundle':filename,'edition':stamp}))
if history.exists() and not a.remote_history:shutil.copytree(history,out/'data/history')
(out/'data/history').mkdir(exist_ok=True)
for file in updates.glob('*.json.gz'):shutil.copyfile(file,out/'data/history'/file.name)
for file in (ROOT/'browser').glob('*.js'):shutil.copyfile(file,out/file.name)
shutil.copyfile(wasm,out/'atlas_web_core.wasm')
# Project Pages are under /repository/. Keep every local resource relative to that path.
for file in out.glob('*.js'):
 text=file.read_text().replace("'/vendor/","'./vendor/").replace('"/vendor/','"./vendor/').replace('`/vendor/','`./vendor/')
 if file.name=='app.js':text=text.replace('async function get(url){','async function get(url){if(window.AtlasStatic)return window.AtlasStatic.handle(url);')
 file.write_text(text)
index=out/'index.html';text=index.read_text().replace('href="/','href="./').replace('src="/','src="./');text=text.replace('<script src="./app.js','<script src="./transport.js"></script><script src="./app.js');index.write_text(text)
size=sum(f.stat().st_size for f in out.rglob('*') if f.is_file())
if size>950_000_000:raise SystemExit(f'Site trop proche de la limite GitHub Pages : {size} octets. Déplacer les archives historiques avant publication.')
print(json.dumps({'output':str(out),'bytes':size,'edition':stamp,'catalogue':len(bundle['catalog_response']['satellites']),'orbits':len(rows)},indent=2))
