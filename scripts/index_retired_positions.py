"""Index actual last archived observations of decayed payloads, without propagation.
Reads each required daily file at most once, backwards. No network or history rewrite.
Run after importing history; the small result is lazy-loaded only by retired pages.
"""
import argparse,bisect,csv,datetime as dt,gzip,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def instant(value):
 value=dt.datetime.fromisoformat(value.replace('Z','+00:00'));return value.replace(tzinfo=dt.timezone.utc) if value.tzinfo is None else value.astimezone(dt.timezone.utc)
def build(data,output):
 catalog={}
 for folder in [ROOT/'data-seed',data]:
  for file in folder.glob('*-catalog.json'):
   rows=json.loads(file.read_text())
   if isinstance(rows,list):
    for row in rows:
     if row.get('DECAY_DATE') and row.get('OBJECT_TYPE','PAY')=='PAY':catalog[int(row['NORAD_CAT_ID'])]=row
 facts_file=ROOT/'resources/mission-lifetimes.json';facts=json.loads(facts_file.read_text())['objects'] if facts_file.exists() else {}
 for ident,row in catalog.items():
  for field,key in [('LAUNCH_DATE','launch_time'),('DECAY_DATE','decay_time')]:
   day=row.get(field,'');exact=facts.get(str(ident),{}).get(key,'')
   if len(day)==10 and exact.startswith(day):row[field]=exact
 today=dt.datetime.now(dt.timezone.utc);catalog={i:r for i,r in catalog.items() if instant(r['DECAY_DATE'])<=today}
 directories=[data/'history',data/'history-updates'];paths={}
 for directory in directories:
  for file in directory.glob('????-??-??.json.gz'):paths.setdefault(file.name[:10],[]).append(file)
 days=sorted(paths);pending={};result={};observations=output.parent/'retired-observations';observations.mkdir(parents=True,exist_ok=True)
 manifest_file=data/'history/manifest.json';coverage=json.loads(manifest_file.read_text()).get('object_coverage',{}) if manifest_file.exists() else {}
 # Coverage bounds refer to the daily archive; include newer provider archives too.
 latest_updates={}
 for file in (data/'history-updates').glob('????-??-??.json.gz'):
  with gzip.open(file,'rt') as f:rows=json.load(f)
  for row in rows:
   element=row.get('elements',row);ident=element.get('NORAD_CAT_ID');epoch=element.get('EPOCH','')
   if ident in catalog and instant(epoch)<instant(catalog[ident]['DECAY_DATE']):latest_updates[ident]=max(latest_updates.get(ident,''),epoch[:10])
 for ident,row in catalog.items():
  last=coverage.get(str(ident),{}).get('last_epoch','')[:10]
  bound=min(row['DECAY_DATE'],max(last,latest_updates.get(ident,''))) if last else row['DECAY_DATE']
  n=bisect.bisect_right(days,bound)-1
  if n>=0:pending.setdefault(n,set()).add(ident)
 processed=0
 for n in range(len(days)-1,-1,-1):
  wanted=pending.pop(n,set())
  if not wanted:continue
  found={}
  for file in paths[days[n]]:
   with gzip.open(file,'rt') as f:rows=json.load(f)
   for row in rows:
    e=row.get('elements',row);ident=e.get('NORAD_CAT_ID');epoch=e.get('EPOCH','')
    if ident not in wanted or not epoch:continue
    # Match the runtime lifetime rule: date-only decay means the start of that UTC day.
    if instant(epoch)>=instant(catalog[ident]['DECAY_DATE']) or (catalog[ident].get('LAUNCH_DATE') and instant(epoch)<instant(catalog[ident]['LAUNCH_DATE'])):continue
    if ident not in found or instant(epoch)>instant(found[ident]['at']):found[ident]={'at':epoch.rstrip('Z')+'Z','source':row.get('source','Archive publique Julien Simon / Space-Track'),'observation':row}
  for ident,entry in found.items():
   row=entry.pop('observation');(observations/(str(ident)+'.json')).write_text(json.dumps(row,separators=(',',':')));result[str(ident)]=entry
  if n:
   for ident in wanted-found.keys():
    if days[n-1]>=catalog[ident].get('LAUNCH_DATE','')[:10]:pending.setdefault(n-1,set()).add(ident)
  processed+=1
  if processed%250==0:print(f'{processed} daily files; {len(result)}/{len(catalog)} objects located',flush=True)
 doc={'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'description':'Latest actual observation in the imported daily archives before the verified end date/time; not the physical reentry position.','objects':result}
 output.parent.mkdir(exist_ok=True,parents=True);output.write_text(json.dumps(doc,separators=(',',':')))
 print(json.dumps({'objects':len(catalog),'located':len(result),'unavailable':len(catalog)-len(result),'daily_files_read':processed}),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--data-dir',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,default=ROOT/'static/retired-positions.json');a=p.parse_args();build(a.data_dir,a.output)
