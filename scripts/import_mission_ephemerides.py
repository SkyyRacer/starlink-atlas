"""Import official geocentric ICRF spacecraft vectors; preserve source bounds.
Six-hour state vectors are interpolated with their velocity, never extrapolated.
Each year is fetched lazily by the browser. Missing ephemerides remain missing.
"""
import argparse,concurrent.futures,datetime as dt,hashlib,json,pathlib,re,urllib.parse,urllib.request,time,http.client
ROOT=pathlib.Path(__file__).resolve().parents[1];UTC=dt.timezone.utc
CONFIG=json.loads((ROOT/'resources/mission-ephemerides.json').read_text())
def parse(text,mission):
 if not all(x in text for x in ['Earth (399)','ICRF','JDUT','KM-S',f'({mission["command"]})']):raise ValueError('Incorrect target, frame, time scale or units')
 body=text.split('$$SOE')[1].split('$$EOE')[0];samples=[]
 for line in body.splitlines():
  if not line.strip():continue
  f=[s.strip() for s in line.split(',')]
  if len(f)<8:raise ValueError('Incomplete state vector')
  row=[round((float(f[0])-2440587.5)*86400),*[float(x) for x in f[2:8]]]
  if samples and not 0<row[0]-samples[-1][0]<=21601:raise ValueError('Gap or duplicate in state vectors')
  if any(not __import__('math').isfinite(x) for x in row):raise ValueError('Non-finite state vector')
  samples.append(row)
 if len(samples)<2:raise ValueError('Insufficient vectors')
 return samples

def refresh_needed(mission,now=None,margin_days=2):
 now=now or dt.datetime.now(UTC)
 if mission.get('stop') and dt.datetime.fromisoformat(mission['stop']).replace(tzinfo=UTC)<=now:return False
 path=ROOT/'static/ephemerides'/(mission['key']+'-index.json')
 try:
  entries=json.loads(path.read_text())['years'].values()
  return not any(row['first_epoch']<=now.timestamp() and row['last_epoch']>=(now+dt.timedelta(days=margin_days)).timestamp() and (ROOT/'static'/row['file']).is_file() for row in entries)
 except (OSError,ValueError,KeyError,TypeError):return True

def atomic_text(path,text):
 temporary=path.with_name(path.name+'.tmp');temporary.write_text(text);temporary.replace(path)

def fetch(mission,output,stop,recent=False):
 stop=min(stop,mission.get('stop',stop));output.mkdir(parents=True,exist_ok=True);key=mission['key'];cache=output/(key+'-source.json')
 start=mission['launch'];year=dt.datetime.now(UTC).year
 if recent:start=max(start,(dt.datetime(year,1,1,tzinfo=UTC)-dt.timedelta(hours=6)).replace(tzinfo=None).isoformat(sep=' '))
 if start>=stop:return None
 requested_start=start;raw=None
 if cache.exists():
  previous=json.loads(cache.read_text())
  if previous.get('stop')==stop and previous.get('start',mission['launch'])==requested_start and previous.get('step_seconds',21600)==mission.get('step_seconds',21600):raw=previous['raw']
 for attempt in range(8):
  if raw:break
  params={'format':'json','COMMAND':f"'{mission['command']}'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@399'",'START_TIME':"'"+start+"'",'STOP_TIME':"'"+stop+"'",'STEP_SIZE':f"'{mission.get('step_seconds',21600)//60} m'",'VEC_TABLE':"'2'",'REF_PLANE':"'FRAME'",'OUT_UNITS':"'KM-S'",'TIME_TYPE':"'UT'",'CSV_FORMAT':"'YES'"}
  url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
  for retry in range(4):
   try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Atlas-official-history-import'}),timeout=180) as response:raw=json.load(response)
    break
   except (OSError,http.client.HTTPException):
    if retry==3:raise
    time.sleep(2**retry)

  message=raw.get('result','')+' '+raw.get('error','')
  if '$$SOE' not in message:
   (output/(key+'-error.txt')).write_text(message)
   match=re.search(r'prior to.*?(\d{4}-[A-Za-z]{3}-\d{2}\s+\d\d:\d\d:\d\d(?:\.\d+)?)',message,re.S)
   after=re.search(r'after.*?(\d{4}-[A-Za-z]{3}-\d{2}\s+\d\d:\d\d:\d\d(?:\.\d+)?)',message,re.S|re.I)
   if match:
    start=(dt.datetime.strptime(match[1].split('.')[0],'%Y-%b-%d %H:%M:%S')+dt.timedelta(minutes=1)).isoformat(sep=' ')
   elif after:
    stop=(dt.datetime.strptime(after[1].split('.')[0],'%Y-%b-%d %H:%M:%S')-dt.timedelta(minutes=2)).isoformat(sep=' ')
   elif 'Insufficient ephemeris data' in message and dt.datetime.fromisoformat(stop).replace(tzinfo=UTC)>dt.datetime.now(UTC)+dt.timedelta(days=2):
    # Some kernels end in TDB and report only a generic boundary error. Retry
    # a shorter official interval; never synthesize or extend returned vectors.
    stop=(dt.datetime.fromisoformat(stop)-dt.timedelta(days=2)).isoformat(sep=' ')
   else:raise ValueError(key+': '+message[-650:])
   if start>=stop:raise ValueError(key+': no overlapping source interval')
   raw=None
  else:atomic_text(cache,json.dumps({'start':requested_start,'stop':stop,'step_seconds':mission.get('step_seconds',21600),'raw':raw}));break
 if raw is None:raise ValueError('No vectors for '+key)
 text=raw.get('result','');samples=parse(text,mission)
 stamp=hashlib.sha256(text.encode()).hexdigest();folder=ROOT/'static/ephemerides'/key;folder.mkdir(parents=True,exist_ok=True)
 index={'id':mission['id'],'source':'NASA/JPL Horizons','url':CONFIG['url'],'frame':'ICRF','time_scale':'UTC','max_interval_seconds':mission.get('step_seconds',21600),'source_sha256':stamp,'years':{}}
 if recent:
  previous_index=folder.parent/(key+'-index.json')
  if previous_index.exists():index['years']=json.loads(previous_index.read_text()).get('years',{})
 years={dt.datetime.fromtimestamp(r[0],UTC).year for r in samples}
 if recent:years={y for y in years if y>=year}
 for year in sorted(years):
  left=dt.datetime(year,1,1,tzinfo=UTC).timestamp();right=dt.datetime(year+1,1,1,tzinfo=UTC).timestamp()
  selected=[i for i,r in enumerate(samples) if left<=r[0]<right]
  lo=max(0,min(selected)-1);hi=min(len(samples),max(selected)+2);rows=samples[lo:hi]
  doc={'id':mission['id'],'frame':'ICRF','time_scale':'UTC','source':'NASA/JPL Horizons · trajectoire interpolée','url':CONFIG['url'],'fetched':dt.datetime.now(UTC).isoformat(),'max_interval_seconds':mission.get('step_seconds',21600),'trajectory_span_seconds':7*86400,'samples':rows}
  data=json.dumps(doc,separators=(',',':'));filename=str(year)+'.json';atomic_text(folder/filename,data)
  index['years'][str(year)]={'file':'ephemerides/'+key+'/'+filename,'first_epoch':rows[0][0],'last_epoch':rows[-1][0],'samples':len(rows),'sha256':hashlib.sha256(data.encode()).hexdigest()}
 atomic_text(folder.parent/(key+'-index.json'),json.dumps(index,separators=(',',':')))
 print(json.dumps({'key':key,'samples':len(samples),'years':len(years),'first_epoch':samples[0][0],'last_epoch':samples[-1][0]}),flush=True)
 return index

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--mission',action='append');parser.add_argument('--recent',action='store_true');parser.add_argument('--if-needed',action='store_true');parser.add_argument('--keep-on-error',action='store_true');parser.add_argument('--cache-dir',type=pathlib.Path,default=pathlib.Path('/private/tmp/atlas-expansion/horizons-cache'));parser.add_argument('--stop',default=(dt.datetime.now(UTC)+dt.timedelta(days=14)).date().isoformat());args=parser.parse_args()
 def refresh(m):
  try:
   if args.if_needed and not refresh_needed(m):return None
   return fetch(m,args.cache_dir,args.stop,args.recent)
  except Exception as error:
   if not args.keep_on_error:raise
   print('::warning::'+m['key']+' : éphémérides non actualisées ; archives validées conservées. '+str(error)[:300],flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
  for result in executor.map(refresh,[m for m in CONFIG['missions'] if not args.mission or m['key'] in args.mission]):pass
if __name__=='__main__':
 main()
 from refine_mission_encounters import refine
 refine()
