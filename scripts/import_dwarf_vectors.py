"""Publish validated Horizons annual vectors for dwarf-planet pages.
Use --download to refresh a year, otherwise consume the saved NASA responses.
"""
import argparse,concurrent.futures,datetime as dt,hashlib,json,pathlib,time,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
BODIES=json.loads((ROOT/'static/solar/dwarfs/catalog.json').read_text())
def import_body(body,year,download):
 ident=body['id'];rawpath=ROOT/f'resources/dwarf-planets/horizons-{ident}.json'
 params={'format':'json','COMMAND':body.get('horizons_command',str(ident)),'EPHEM_TYPE':'VECTORS','CENTER':'500@399','START_TIME':f'{year}-01-01','STOP_TIME':f'{year+1}-01-02','STEP_SIZE':'6 h' if body['kind']=='moon' else '1 d','VEC_TABLE':'2','REF_PLANE':'FRAME','OUT_UNITS':'KM-S','TIME_TYPE':'UT','CSV_FORMAT':'YES'}
 url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
 if download:
  for attempt in range(3):
   try:
    result=json.load(urllib.request.urlopen(url,timeout=65))
    if '$$SOE' not in result.get('result',''):raise ValueError(result.get('error','No vectors'))
    rawpath.write_text(json.dumps(result));break
   except Exception:
    if attempt==2:raise
    time.sleep(2)
 else:result=json.loads(rawpath.read_text())
 text=result.get('result','');command=body.get('horizons_command');identity=(f'({ident})' in text if not command else f'Target body name: {command.rstrip(";")} ' in text)
 if not identity or not all(s in text for s in ['Earth (399)','ICRF','JDUT','KM-S','$$SOE','$$EOE']):raise ValueError(f'Wrong frame or identity: {ident}')
 rows=[]
 for line in text.split('$$SOE')[1].split('$$EOE')[0].splitlines():
  if not line.strip():continue
  f=line.split(',');rows.append([round((float(f[0])-2440587.5)*86400),*[float(x) for x in f[2:8]]])
 step=max(b[0]-a[0] for a,b in zip(rows,rows[1:]));data={'id':ident,'frame':'ICRF','origin':399,'time_scale':'UTC','samples':rows,'max_interval_seconds':step,'source':url,'sha256':hashlib.sha256(text.encode()).hexdigest()}
 dest=ROOT/f'static/solar/dwarfs/vectors/{ident}/{year}.json';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(data,separators=(',',':')));print(body['name'],len(rows),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--year',type=int,default=2026);p.add_argument('--download',action='store_true');a=p.parse_args()
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda b:import_body(b,a.year,a.download),[b for b in BODIES if not b.get('orbit_model')]))
