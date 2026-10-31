"""Official JPL flight-project target vectors for New Horizons' Arrokoth encounter."""
from pathlib import Path
import json,hashlib,urllib.parse,urllib.request,math
ROOT=Path(__file__).resolve().parents[1];rawpath=ROOT/'resources/cinematic-planets/arrokoth-pass.json';params={'format':'json','COMMAND':"'2486958'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'2018-12-29 00:00'",'STOP_TIME':"'2019-01-04 00:00'",'STEP_SIZE':"'10 m'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"};url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
if not rawpath.exists():rawpath.write_text(json.dumps(json.load(urllib.request.urlopen(url,timeout=90))))
text=json.loads(rawpath.read_text())['result'];assert all(x in text for x in ['Arrokoth','Earth (399)','ICRF','JDUT','KM-S']);rows=[]
for line in text.split('$$SOE')[1].split('$$EOE')[0].splitlines():
 if not line.strip():continue
 f=line.split(',');r=[round((float(f[0])-2440587.5)*86400),*[float(x) for x in f[2:8]]];assert all(math.isfinite(x) for x in r);rows.append(r)
record={'id':2486958,'origin':399,'frame':'ICRF','time_scale':'UTC','max_interval_seconds':600,'source':url,'samples':rows};file='solar/history/arrokoth-pass.json';raw=json.dumps(record,separators=(',',':'));(ROOT/'static'/file).write_text(raw)
p=ROOT/'static/solar/history/encounters.json';d=json.loads(p.read_text());d['files']=[e for e in d['files'] if e['id']!=2486958]+[{'id':2486958,'file':file,'first_epoch':rows[0][0],'last_epoch':rows[-1][0],'sha256':hashlib.sha256(raw.encode()).hexdigest()}];p.write_text(json.dumps(d,separators=(',',':')))
p=ROOT/'static/mission-events/catalog.json';d=json.loads(p.read_text())
for event in d['missions']['new-horizons']:
 if 'Arrokoth' in event['title']:event['target']='arrokoth'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print(len(rows),'Arrokoth states')
