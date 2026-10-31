"""Local Horizons cache. One remote request at a time, including across processes.
Never extrapolates, caches failures briefly, preserves UTC/ICRF geocentric vectors.
"""
import argparse,datetime as dt,fcntl,hashlib,json,math,os,pathlib,re,time,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
CAT=json.loads((ROOT/'static/solar/catalog.json').read_text())
CACHE=ROOT/'data/solar'; CACHE.mkdir(parents=True,exist_ok=True)
def vectors(body,at):
 ident=int(body['id']); moon=body['kind']=='moon'; step=600 if moon else 21600
 block=4*86400 if moon else 32*86400
 start=int(at//block)*block; stop=start+block
 path=CACHE/f'{ident}-{start}-v1.json'
 def cached():
  try:
   data=json.loads(path.read_text())
   if data.get('samples') or data.get('request_version')==3 and time.time()-data.get('checked',0)<300:return data
  except (OSError,ValueError):pass
  return None
 # Immutable valid blocks can be read without waiting for a distant JPL call.
 hit=cached()
 if hit is not None:return hit
 with (CACHE/'horizons.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  hit=cached()
  if hit is not None:return hit
  if ident==399:
   data={'id':ident,'samples':[[start,0,0,0,0,0,0],[stop,0,0,0,0,0,0]],'max_interval_seconds':block}
  else:
   params={'format':'json','COMMAND':f"'{ident}'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'"+dt.datetime.fromtimestamp(start,dt.timezone.utc).strftime('%Y-%m-%d %H:%M')+"'",'STOP_TIME':"'"+dt.datetime.fromtimestamp(stop,dt.timezone.utc).strftime('%Y-%m-%d %H:%M')+"'",'STEP_SIZE':f"'{step//60} m'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"}
   url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
   try:
    request=urllib.request.Request(url,headers={'User-Agent':'StarlinkAtlas/0.1 (https://github.com/SkyyRacer/starlink-atlas)'})
    with urllib.request.urlopen(request,timeout=50) as response: raw=json.load(response)
    text=raw.get('result','')
    if not all(x in text for x in ['Earth (399)','ICRF','JDUT','KM-S',f'({ident})','$$SOE','$$EOE']):raise ValueError('Trajectoire indisponible pour cette date dans Horizons')
    rows=[]
    for line in text.split('$$SOE')[1].split('$$EOE')[0].splitlines():
     if not line.strip():continue
     f=[x.strip() for x in line.split(',')]
     row=[round((float(f[0])-2440587.5)*86400),*[float(x) for x in f[2:8]]]
     if len(row)!=7 or not all(math.isfinite(x) for x in row):raise ValueError('Vecteur incorrect')
     if rows and not 0<row[0]-rows[-1][0]<=step+1:raise ValueError('Trajectoire discontinue')
     rows.append(row)
    if len(rows)<2:raise ValueError('Trajectoire insuffisante')
    data={'id':ident,'samples':rows,'max_interval_seconds':step,'source':url,'sha256':hashlib.sha256(text.encode()).hexdigest()}
   except Exception as error:
    data={'id':ident,'samples':[],'error':str(error),'checked':time.time()}
   time.sleep(.15)
  data.update(request_version=3,frame='ICRF',origin=399,time_scale='UTC')
  tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,separators=(',',':')));tmp.replace(path)
  return data
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--id',type=int);p.add_argument('--at',type=float,default=time.time());p.add_argument('--all',action='store_true');a=p.parse_args()
 bodies=[b for b in CAT['bodies'] if b.get('id') and (a.all or b['id']==a.id)]
 if not bodies:raise SystemExit('Corps inconnu')
 for b in bodies:
  data=vectors(b,a.at)
  if a.all:print(b['name'],len(data['samples']),flush=True)
  else:print(json.dumps(data,separators=(',',':')))
