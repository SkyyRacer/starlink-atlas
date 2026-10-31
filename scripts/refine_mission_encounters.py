"""Keep minute-level encounter vectors in the ordinary mission archives too.
The same measured state then drives the isolated model, system trace and film.
"""
from pathlib import Path
import datetime as dt,hashlib,json
ROOT=Path(__file__).resolve().parents[1];UTC=dt.timezone.utc
def refine(keys=None):
 manifestpath=ROOT/'static/mission-events/windows.json'
 if not manifestpath.exists():return
 windows=json.loads(manifestpath.read_text())['events'];groups={}
 for entry in windows.values():
  if keys and entry['mission'] not in keys:continue
  groups.setdefault(entry['mission'],[]).append(json.loads((ROOT/'static'/entry['file']).read_text()))
 for key,records in groups.items():
  p=ROOT/'static/ephemerides'/f'{key}-index.json'
  if not p.exists():continue
  index=json.loads(p.read_text());changed=False
  for year,entry in index['years'].items():
   path=ROOT/'static'/entry['file'];doc=json.loads(path.read_text());first,last=doc['samples'][0][0],doc['samples'][-1][0];near=[r for r in records if r['id']==doc['id'] and r['samples'][-1][0]>=first and r['samples'][0][0]<=last]
   if not near:continue
   spans=[(r['samples'][0][0],r['samples'][-1][0]) for r in near];rows={r[0]:r for r in doc['samples'] if not any(a<=r[0]<=b for a,b in spans)}
   for record in near:
    for r in record['samples']:
     if first<=r[0]<=last:rows[r[0]]=r
   sample=sorted(rows.values(),key=lambda r:r[0]);assert all(0<b[0]-a[0]<=doc.get('max_interval_seconds',21600)+1 for a,b in zip(sample,sample[1:])),key
   if sample==doc['samples']:continue
   doc['samples']=sample;doc['origin']=399;text=json.dumps(doc,separators=(',',':'));tmp=path.with_suffix('.tmp');tmp.write_text(text);tmp.replace(path);entry.update(samples=len(sample),first_epoch=sample[0][0],last_epoch=sample[-1][0],sha256=hashlib.sha256(text.encode()).hexdigest());changed=True
  if changed:index['source_sha256']=hashlib.sha256(''.join(e.get('sha256','') for e in index['years'].values()).encode()).hexdigest();p.write_text(json.dumps(index,separators=(',',':')));print('Refined',key,flush=True)
if __name__=='__main__':refine()
