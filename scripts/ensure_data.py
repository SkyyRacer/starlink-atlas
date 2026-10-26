#!/usr/bin/env python3
"""Check/repair site data, refresh existing providers, retain verified last-good files.
Backups never alter observation epochs or turn archived positions into live ones.
"""
import argparse,datetime as dt,gzip,hashlib,json,os,pathlib,re,shutil,struct,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
MISSION_IDS={row['key']:row['id'] for row in json.loads((ROOT/'resources/mission-ephemerides.json').read_text())['missions']}
MISSION_IDS['tess']=43435

def validate(path):
 try:
  size=path.stat().st_size
  if not size:raise ValueError('fichier vide')
  suffix=path.suffix.lower()
  if suffix=='.glb':
   with path.open('rb') as file:header=file.read(20);length=struct.unpack_from('<I',header,12)[0];document=json.loads(file.read(length))
   if header[:4]!=b'glTF' or struct.unpack_from('<I',header,8)[0]!=size or 'meshes' not in document:raise ValueError('modèle GLB incomplet')
  elif suffix in {'.json','.gz'}:
   with (gzip.open(path,'rt') if suffix=='.gz' else path.open()) as file:value=json.load(file)
   if not isinstance(value,(dict,list)):raise ValueError('document de données incorrect')
   mission=path.parent.name if path.parent.name in MISSION_IDS else path.stem.removesuffix('-index')
   if 'ephemerides' in path.parts and mission in MISSION_IDS and isinstance(value,dict) and value.get('id') is not None and value.get('id')!=MISSION_IDS[mission]:raise ValueError('identité de mission incorrecte')
   if isinstance(value,dict) and 'samples' in value and 'ephemerides' in path.parts:
    rows=value['samples'];previous=None
    if value.get('frame')!='ICRF' or value.get('time_scale')!='UTC' or not rows:raise ValueError('référentiel ou vecteurs absents')
    import math
    for row in rows:
     if len(row)!=7 or not all(isinstance(x,(int,float)) and math.isfinite(x) for x in row):raise ValueError('vecteur incorrect')
     if previous is not None and (row[0]<=previous or row[0]-previous>value.get('max_interval_seconds',21600)+1):raise ValueError('dates de vecteurs non ordonnées')
     previous=row[0]
   if path.name.startswith(('gp-','supgp-')) and not path.name.endswith('-status.json'):
    if not isinstance(value,list) or not value:raise ValueError('éléments orbitaux absents')
    if not any(isinstance(row,dict) and isinstance(row.get('NORAD_CAT_ID'),int) and row.get('EPOCH') for row in value):raise ValueError('éléments orbitaux incorrects')
  elif suffix in {'.png','.webp','.jpg','.jpeg','.wasm'}:
   with path.open('rb') as file:head=file.read(16);file.seek(max(0,size-16));tail=file.read()
   if suffix=='.png' and (not head.startswith(b'\x89PNG\r\n\x1a\n') or b'IEND' not in tail):raise ValueError('image PNG incomplète')
   if suffix=='.webp' and (head[:4]!=b'RIFF' or head[8:12]!=b'WEBP' or struct.unpack_from('<I',head,4)[0]+8!=size):raise ValueError('image WebP incomplète')
   if suffix in {'.jpg','.jpeg'} and (head[:2]!=b'\xff\xd8' or not tail.endswith(b'\xff\xd9')):raise ValueError('image JPEG incomplète')
   if suffix=='.wasm' and head[:4]!=b'\0asm':raise ValueError('moteur WASM incorrect')
  elif suffix=='.tsv':
   with path.open() as file:
    if '\t' not in file.readline():raise ValueError('table TSV incorrecte')
  return True,None
 except (OSError,ValueError,TypeError,struct.error,EOFError) as error:return False,str(error)

def atomic_copy(source,target):
 target.parent.mkdir(parents=True,exist_ok=True);temp=target.with_name(target.name+'.repair.tmp');shutil.copy2(source,temp);os.replace(temp,target)

def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as file:
  for part in iter(lambda:file.read(1024*1024),b''):h.update(part)
 return h.hexdigest()

def repair(path,backup,alternatives,expected=None):
 valid,error=validate(path)
 if valid and expected and not digest(path).startswith(expected):valid,error=False,'empreinte différente du manifeste'
 if valid:
  # Copy only changed files. Never overwrite a usable backup with bad input.
  if not backup.exists() or digest(path)!=digest(backup):atomic_copy(path,backup)
  return {'state':'valid'}
 for source in [backup,*alternatives]:
  good,_=validate(source)
  if not good or (expected and not digest(source).startswith(expected)):continue
  atomic_copy(source,path)
  if source!=backup:atomic_copy(path,backup)
  return {'state':'restored','from':str(source),'reason':error}
 return {'state':'unavailable','reason':error}

def model_hashes(static):
 result={}
 try:
  for row in json.loads((static/'images/detailed/manifest.json').read_text()):
   path,_,query=row['url'].partition('?v=')
   if query:result[path]=query
 except (OSError,ValueError,KeyError):pass
 return result

def files(root):
 extensions={'.json','.gz','.glb','.png','.webp','.jpg','.jpeg','.wasm','.tsv'}
 if not root.exists():return set()
 return {p.relative_to(root) for p in root.rglob('*') if p.is_file() and p.suffix.lower() in extensions and not any(part in {'last-good','quarantine','history','history-versions','horizons-cache'} for part in p.relative_to(root).parts)}

def inspect(static,data,backup,fallbacks):
 report={};hashes=model_hashes(static)
 for label,folder,seeds in [('data',data,[ROOT/'data-seed',*[p/'data' for p in fallbacks]]),('static',static,[p/'static' for p in fallbacks])]:
  saved=backup/label;known=files(folder)|files(saved)
  for source in seeds:known|=files(source)
  recent=set()
  for prefix in ['gp-','supgp-']:
   recent.update(sorted([p for p in known if re.fullmatch(re.escape(prefix)+r'\d+\.json',p.name)],key=lambda p:int(p.stem[len(prefix):]),reverse=True)[:2])
  for relative in sorted(known):
   path=folder/relative
   if re.fullmatch(r'(gp|supgp)-\d+\.json',relative.name) and not path.exists() and relative not in recent:continue # deliberately compacted raw snapshots are retained in daily history
   expected=hashes.get(relative.as_posix()) if label=='static' else None
   if label=='static' and relative.parts[0]=='physical-facts':
    match=re.search(r'-([a-f0-9]{12})\.json$',relative.name)
    if match:expected=match[1]
   result=repair(path,saved/relative,[p/relative for p in seeds],expected)
   report[label+'/'+relative.as_posix()]=result
 return report

def history_report(folder,fallbacks):
 try:manifest=json.loads((folder/'manifest.json').read_text())
 except (OSError,ValueError):return {'state':'unavailable','days':0,'missing':[]}
 missing=[];restored=0
 for day in manifest.get('days',{}):
  # Dates from a manifest must never become arbitrary filesystem paths.
  try:dt.date.fromisoformat(day)
  except ValueError:continue
  path=folder/(day+'.json.gz')
  if path.is_file() and path.stat().st_size:continue
  for root in fallbacks:
   source=root/(day+'.json.gz');valid,_=validate(source)
   if valid:atomic_copy(source,path);restored+=1;break
  else:missing.append(day)
 return {'state':'available' if not missing else 'partial','days':len(manifest.get('days',{})),'missing':missing,'restored':restored,'verification':'index et présence des fichiers ; chaque archive est analysée à sa lecture'}

def mission_report(static,now):
 output={}
 for mission in json.loads((ROOT/'resources/mission-ephemerides.json').read_text())['missions']:
  path=static/'ephemerides'/(mission['key']+'-index.json')
  try:
   index=json.loads(path.read_text());entries=list(index['years'].values());last=max(row['last_epoch'] for row in entries)
   current=any(row['first_epoch']<=now.timestamp()<=row['last_epoch'] and (static/row['file']).is_file() for row in entries)
   ended=mission.get('stop') and dt.datetime.fromisoformat(mission['stop']).replace(tzinfo=dt.timezone.utc)<now
   output[mission['key']]={'state':'current' if current else 'historical' if ended else 'expired','last_epoch':dt.datetime.fromtimestamp(last,dt.timezone.utc).isoformat()}
  except (OSError,ValueError,KeyError,TypeError):output[mission['key']]={'state':'unavailable'}
 for definition in json.loads((ROOT/'resources/constellations.json').read_text()):
  if definition.get('trajectory') and definition['id'] not in output:output[definition['id']]={'state':'no_verified_source'}
 return output

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data-dir',type=pathlib.Path,default=pathlib.Path(os.environ.get('DATA_DIR',str(ROOT.parents[1]/'outputs/starlink-atlas/data' if (ROOT.parents[1]/'outputs/starlink-atlas/data').exists() else ROOT/'data'))));p.add_argument('--static-dir',type=pathlib.Path,default=ROOT/'static');p.add_argument('--history-dir',type=pathlib.Path);p.add_argument('--backup-dir',type=pathlib.Path);p.add_argument('--fallback-root',type=pathlib.Path,action='append',default=[]);p.add_argument('--check-only',action='store_true');p.add_argument('--collect-timeout',type=int,default=600);a=p.parse_args()
 backup=a.backup_dir or a.data_dir/'last-good';backup.mkdir(parents=True,exist_ok=True);a.data_dir.mkdir(parents=True,exist_ok=True)
 started=time.time();report={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'collectors':[]}
 # Avoid concurrent repairs/collectors sharing temporary files.
 lock=backup/'running.lock'
 try:handle=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.close(handle)
 except FileExistsError:
  if time.time()-lock.stat().st_mtime>3600:lock.unlink();return main()
  print('Un contrôle de données est déjà en cours.');return
 try:
  report['before']=inspect(a.static_dir,a.data_dir,backup,a.fallback_root)
  if not a.check_only:
   commands=[('collecte', [str(ROOT/'target/release/starlink-atlas'),'--collect-once']),('missions-lointaines',[sys.executable,str(ROOT/'scripts/import_mission_ephemerides.py'),'--recent','--if-needed','--keep-on-error','--cache-dir',str(a.data_dir/'horizons-cache')])]
   for name,command in commands:
    try:
     result=subprocess.run(command,cwd=ROOT,env=dict(os.environ,DATA_DIR=str(a.data_dir),HISTORY_DIR=str(a.history_dir or a.data_dir/'history')),timeout=a.collect_timeout,check=False)
     report['collectors'].append({'name':name,'exit_code':result.returncode})
    except (OSError,subprocess.TimeoutExpired) as error:report['collectors'].append({'name':name,'error':str(error)})
   report['after']=inspect(a.static_dir,a.data_dir,backup,a.fallback_root)
  report['history']=history_report(a.history_dir or a.data_dir/'history',[ROOT/'data-seed/history',*[p/'data/history' for p in a.fallback_root]])
  report['missions']=mission_report(a.static_dir,dt.datetime.now(dt.timezone.utc))
  report['seconds']=round(time.time()-started,1)
  target=a.data_dir/'data-health.json';temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(report,ensure_ascii=False,indent=2));os.replace(temp,target)
  final=report.get('after',report['before']);counts={state:sum(row['state']==state for row in final.values()) for state in ['valid','restored','unavailable']}
  print(json.dumps({'files':counts,'missions':report['missions'],'report':str(target),'seconds':report['seconds']},ensure_ascii=False,indent=2))
 finally:lock.unlink(missing_ok=True)
if __name__=='__main__':main()
