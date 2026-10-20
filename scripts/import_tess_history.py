"""Archive official NASA/JPL Horizons vectors by year; never extrapolate past their bounds."""
import datetime as dt,hashlib,json,pathlib,re,time,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'static/ephemerides/tess';OUT.mkdir(exist_ok=True,parents=True)
INDEX=ROOT/'static/ephemerides/tess-index.json';index=json.loads(INDEX.read_text()) if INDEX.exists() else {'source':'NASA/JPL Horizons','url':'https://ssd.jpl.nasa.gov/horizons/','years':{}}
now=dt.datetime.now(dt.timezone.utc)
def fetch(start,stop,step):
 params={'COMMAND':"'-95'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':start,'STOP_TIME':stop,'STEP_SIZE':step,'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"}
 doc=json.load(urllib.request.urlopen('https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params),timeout=120));text=doc.get('result','')
 if not all(s in text for s in ['TESS (spacecraft) (-95)','Earth (399)','ICRF','JDUT','KM-S','$$SOE','$$EOE']):raise ValueError(doc.get('error') or text[:400])
 rows=[]
 for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
  fields=[f.strip() for f in line.split(',')];rows.append([round((float(fields[0])-2440587.5)*86400),*[float(f) for f in fields[2:8]]])
 if len(rows)<2 or any(b[0]<=a[0] or b[0]-a[0]>3601 for a,b in zip(rows,rows[1:])):raise ValueError('Invalid or incomplete vector samples')
 return rows
for year in reversed(range(2018,now.year+1)):
 if str(year) in index['years'] and year<now.year:continue
 try:
  start=f'{year}-01-01' if year>2018 else '2018-04-19';stop=f'{year+1}-01-01' if year<now.year else (now+dt.timedelta(days=1)).date().isoformat();print('TESS Horizons',year,flush=True)
  rows=fetch(start,stop,"'1 h'") if year>2018 else fetch(start,'2018-06-01',"'10 m'")[:-1]+fetch('2018-06-01',stop,"'1 h'")
  doc={'id':43435,'frame':'ICRF','time_scale':'UTC','source':'NASA/JPL Horizons · trajectoire archivée','url':index['url'],'fetched':now.isoformat(),'epoch':dt.datetime.fromtimestamp(rows[0][0],dt.timezone.utc).isoformat(),'period_seconds':13.7*86400,'samples':rows};raw=json.dumps(doc,separators=(',',':')).encode();name=f'{year}-{hashlib.sha256(raw).hexdigest()[:12]}.json';(OUT/name).write_bytes(raw)
  index['years'][str(year)]={'file':'ephemerides/tess/'+name,'first_epoch':rows[0][0],'last_epoch':rows[-1][0],'samples':len(rows)};tmp=INDEX.with_suffix('.tmp');tmp.write_text(json.dumps(index,separators=(',',':')));tmp.replace(INDEX);print('Saved',year,len(rows),'official samples',flush=True)
 except Exception as error:print('TESS history unavailable for',year,':',error,flush=True)
