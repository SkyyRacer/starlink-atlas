"""Replace six-hour Cassini archives with hourly official Horizons state vectors."""
from pathlib import Path
import hashlib,json,datetime as dt,time,urllib.request,urllib.parse,runpy
ROOT=Path(__file__).resolve().parents[1];UTC=dt.timezone.utc;parse=runpy.run_path(str(ROOT/'scripts/import_mission_ephemerides.py'))['parse'];indexpath=ROOT/'static/ephemerides/cassini-index.json';index=json.loads(indexpath.read_text());rawdir=ROOT/'resources/cassini-hourly';rawdir.mkdir(exist_ok=True)
for year,entry in sorted(index['years'].items()):
 old=json.loads((ROOT/'static'/entry['file']).read_text());start=dt.datetime.fromtimestamp(old['samples'][0][0],UTC);stop=dt.datetime.fromtimestamp(old['samples'][-1][0],UTC)
 if year=='2017':stop=dt.datetime(2017,9,15,10,30,tzinfo=UTC)
 path=rawdir/(year+'.json');params={'format':'json','COMMAND':"'-82'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'"+start.strftime('%Y-%m-%d %H:%M:%S')+"'",'STOP_TIME':"'"+stop.strftime('%Y-%m-%d %H:%M:%S')+"'",'STEP_SIZE':"'1 h'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"}
 if not path.exists():
  url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
  for retry in range(3):
   try:
    raw=urllib.request.urlopen(url,timeout=150).read();result=json.loads(raw);rows=parse(result.get('result',''),{'command':-82});path.write_bytes(raw);break
   except Exception:
    if retry==2:raise
    time.sleep(2+retry)
 else:result=json.loads(path.read_text());rows=parse(result['result'],{'command':-82})
 old.update(samples=rows,max_interval_seconds=3600);text=json.dumps(old,separators=(',',':'));out=ROOT/'static'/entry['file'];tmp=out.with_suffix('.tmp');tmp.write_text(text);tmp.replace(out);entry.update(first_epoch=rows[0][0],last_epoch=rows[-1][0],samples=len(rows),sha256=hashlib.sha256(text.encode()).hexdigest());indexpath.write_text(json.dumps(index,separators=(',',':')));print(year,len(rows),flush=True);time.sleep(.3)
index['max_interval_seconds']=3600;index['source_sha256']=hashlib.sha256(''.join(x['sha256'] for x in index['years'].values()).encode()).hexdigest();indexpath.write_text(json.dumps(index,separators=(',',':')))
print('DONE',flush=True)
