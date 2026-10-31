"""Import bounded UTC/ICRF Horizons windows for documented mission replays.
One-minute state vectors around flybys, ten-minute vectors for other events.
Never substitutes another spacecraft or extrapolates a missing trajectory.
"""
from pathlib import Path
import datetime as dt,hashlib,json,time,urllib.parse,urllib.request,runpy
ROOT=Path(__file__).resolve().parents[1];UTC=dt.timezone.utc
parse=runpy.run_path(str(ROOT/'scripts/import_mission_ephemerides.py'))['parse']
config=json.loads((ROOT/'resources/mission-ephemerides.json').read_text());catalog=json.loads((ROOT/'static/mission-events/catalog.json').read_text())
missions={m['key']:m for m in config['missions']};out=ROOT/'static/mission-events';rawdir=ROOT/'resources/mission-event-sources';rawdir.mkdir(exist_ok=True)
manifestpath=out/'windows.json';manifest=json.loads(manifestpath.read_text()) if manifestpath.exists() else {'version':1,'events':{}}
def write(path,value):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,separators=(',',':')));tmp.replace(path)
# Prioritise close encounters and Cassini, including the reported historical failure.
queue=[(key,e) for key,events in catalog['missions'].items() for e in events if not e.get('unavailable') and key in missions]
queue.sort(key=lambda item:(item[0]!='cassini',item[1]['kind']!='flyby'))
for key,event in queue:
 ident=event['id'];mission=missions[key];step=60 if event['kind']=='flyby' else 600
 if ident in manifest['events'] and (ROOT/'static'/manifest['events'][ident]['file']).exists():continue
 index=json.loads((ROOT/'static/ephemerides'/f'{key}-index.json').read_text());entries=list(index['years'].values())
 first=min(e['first_epoch'] for e in entries);last=max(e['last_epoch'] for e in entries)
 # The final Cassini kernel covers the last approach beyond the regular hourly grid.
 if key=='cassini':last=max(last,dt.datetime(2017,9,15,10,30,tzinfo=UTC).timestamp())
 centre=event['at']/1000;start=max(first,centre-event['before_hours']*3600);stop=min(last,centre+event['after_hours']*3600)
 if stop-start<step:print('NO COVERAGE',ident,flush=True);continue
 stamp=lambda t:dt.datetime.fromtimestamp(t,UTC).strftime('%Y-%m-%d %H:%M:%S')
 params={'format':'json','COMMAND':f"'{mission['command']}'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'"+stamp(start)+"'",'STOP_TIME':"'"+stamp(stop)+"'",'STEP_SIZE':f"'{step//60} m'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"}
 url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params);source=rawdir/(ident+'.json')
 try:
  if source.exists():raw=json.loads(source.read_text())
  else:
   with urllib.request.urlopen(url,timeout=100) as response:raw=json.load(response)
  rows=parse(raw.get('result',''),mission);write(source,raw)
  record={'id':mission['id'],'frame':'ICRF','origin':399,'time_scale':'UTC','max_interval_seconds':step,'samples':rows,'source':url}
  file='mission-events/'+ident+'.json';write(ROOT/'static'/file,record)
  manifest['events'][ident]={'mission':key,'file':file,'first_epoch':rows[0][0],'last_epoch':rows[-1][0],'samples':len(rows),'sha256':hashlib.sha256((ROOT/'static'/file).read_bytes()).hexdigest()};write(manifestpath,manifest)
  print('OK',ident,len(rows),flush=True)
 except Exception as error:print('ERROR',ident,str(error)[:200],flush=True)
 time.sleep(.25)
print('DONE',flush=True)
