"""Precise lunar states for JUICE's documented 2024 encounter."""
from pathlib import Path
import json,urllib.parse,urllib.request,runpy,hashlib
ROOT=Path(__file__).resolve().parents[1];parse=runpy.run_path(str(ROOT/'scripts/import_mission_ephemerides.py'))['parse']
params={'format':'json','COMMAND':"'301'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'2024-08-17 00:00'",'STOP_TIME':"'2024-08-22 00:00'",'STEP_SIZE':"'10 m'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"};url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
p=ROOT/'resources/cinematic-planets/moon-juice.json'
if not p.exists():p.write_text(json.dumps(json.load(urllib.request.urlopen(url,timeout=90))))
rows=parse(json.loads(p.read_text())['result'],{'command':301});record={'id':301,'origin':399,'frame':'ICRF','time_scale':'UTC','max_interval_seconds':600,'source':url,'samples':rows};file='solar/history/moon-juice.json';text=json.dumps(record,separators=(',',':'));(ROOT/'static'/file).write_text(text);manifest=ROOT/'static/solar/history/encounters.json';existing=json.loads(manifest.read_text()) if manifest.exists() else {'files':[]};existing['files']=[e for e in existing['files'] if e['id']!=301]+[{'file':file,'id':301,'first_epoch':rows[0][0],'last_epoch':rows[-1][0],'sha256':hashlib.sha256(text.encode()).hexdigest()}];manifest.write_text(json.dumps(existing,separators=(',',':')));print('Lunar encounter',len(rows))
