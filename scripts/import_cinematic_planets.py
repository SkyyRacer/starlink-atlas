"""Offline daily Horizons state vectors for uninterrupted historical films.
UTC, geocentric ICRF, km/s; yearly files overlap one day and never extrapolate.
Fine spacecraft encounter windows remain at their original minute cadence.
"""
from pathlib import Path
import concurrent.futures,datetime as dt,hashlib,json,math,time,urllib.parse,urllib.request
ROOT=Path(__file__).resolve().parents[1];UTC=dt.timezone.utc;OUT=ROOT/'static/solar/history';OUT.mkdir(exist_ok=True);RAW=ROOT/'resources/cinematic-planets';RAW.mkdir(exist_ok=True)
START=dt.datetime(1977,1,1,tzinfo=UTC);STOP=dt.datetime(2027,1,3,tzinfo=UTC)
BODIES=[10,199,299,399,499,599,699,799,899,999]
def one(ident):
 cache=RAW/(str(ident)+'.json');params={'format':'json','COMMAND':f"'{ident}'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'1977-01-01 00:00'",'STOP_TIME':"'2027-01-03 00:00'",'STEP_SIZE':"'1 d'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"};url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
 if ident==399:rows=[[int(t),0,0,0,0,0,0] for t in range(int(START.timestamp()),int(STOP.timestamp())+1,86400)]
 else:
  if cache.exists():raw=json.loads(cache.read_text())
  else:
   for attempt in range(3):
    try:
     raw=json.load(urllib.request.urlopen(url,timeout=150));assert '$$SOE' in raw.get('result','');cache.write_text(json.dumps(raw));break
    except Exception:
     if attempt==2:raise
     time.sleep(2)
  text=raw['result'];assert all(x in text for x in ['ICRF','Earth (399)','JDUT','KM-S',f'({ident})']);rows=[]
  for line in text.split('$$SOE')[1].split('$$EOE')[0].splitlines():
   if not line.strip():continue
   f=line.split(',');rows.append([round((float(f[0])-2440587.5)*86400),*[float(x) for x in f[2:8]]])
  assert len(rows)>18000 and all(all(math.isfinite(v) for v in r) for r in rows)
 directory=OUT/str(ident);directory.mkdir(exist_ok=True);entries={}
 for year in range(1977,2028):
  first=dt.datetime(year,1,1,tzinfo=UTC).timestamp()-86400;last=dt.datetime(year+1,1,1,tzinfo=UTC).timestamp()+86400;sample=[r for r in rows if first<=r[0]<=last]
  if len(sample)<2:continue
  record={'id':ident,'origin':399,'frame':'ICRF','time_scale':'UTC','max_interval_seconds':86400,'source':url,'samples':sample};file=f'solar/history/{ident}/{year}.json';text=json.dumps(record,separators=(',',':'));(ROOT/'static'/file).write_text(text);entries[str(year)]={'file':file,'first_epoch':sample[0][0],'last_epoch':sample[-1][0],'sha256':hashlib.sha256(text.encode()).hexdigest()}
 print(ident,len(rows),flush=True);return str(ident),entries
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:result=dict(pool.map(one,BODIES))
(OUT/'index.json').write_text(json.dumps({'version':1,'origin':399,'frame':'ICRF','time_scale':'UTC','bodies':result},separators=(',',':')));print('DONE',flush=True)
