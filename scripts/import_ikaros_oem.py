"""Import JAXA public Earth/EME2000/UTC OEM states, never TLE extrapolations.
EME2000 axes are used as the J2000/ICRF approximation (frame bias <0.1 arcsec).
Downsample to 30 minutes outside the first two days; keep file boundaries.
"""
import concurrent.futures,datetime as dt,hashlib,json,re,urllib.request,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE='https://data.darts.isas.jaxa.jp/pub/orbits/ikaros/ver1.0/OEM/';folder=ROOT/'resources/ikaros-oem';folder.mkdir(exist_ok=True)
def stamp(s):return dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc).timestamp()
def run():
 html=urllib.request.urlopen(BASE,timeout=25).read().decode();names=[n for n in re.findall(r'href="([^"/]+\.txt)"',html) if n.startswith('20210329')]
 def load(name):
  p=folder/name
  if not p.exists():
   first=urllib.request.urlopen(urllib.request.Request(BASE+name,headers={'Range':'bytes=0-0'}),timeout=20);assert first.status==206;size=int(first.headers['Content-Range'].split('/')[-1]);first.close();chunks=[]
   for start in range(0,size,524288):
    stop=min(size-1,start+524287);part=folder/(name+'.part-'+str(start))
    if not part.exists():
     for attempt in range(4):
      try:
       response=urllib.request.urlopen(urllib.request.Request(BASE+name,headers={'Range':f'bytes={start}-{stop}'}),timeout=20);assert response.status==206;data=response.read();assert len(data)==stop-start+1;part.write_bytes(data);break
      except Exception:
       if attempt==3:raise
    chunks.append(part)
   p.write_bytes(b''.join(c.read_bytes() for c in chunks))
   for c in chunks:c.unlink()

  data=p.read_bytes();text=data.decode();assert all(s in text for s in ['CENTER_NAME = EARTH','REF_FRAME = EME2000','TIME_SYSTEM = UTC','OBJECT_NAME = IKAROS'])
  rows=[]
  for line in text.splitlines():
   if re.match(r'^20\d\d-\d\d-\d\dT',line):
    bits=line.split();t=stamp(bits[0]);row=[int(t),*map(float,bits[1:7])]
    if t%1800==0 or t<stamp('2010-05-23T00:00:00'):rows.append(row)
  assert rows;print(name,len(rows),flush=True);return rows,{'url':BASE+name,'sha256':hashlib.sha256(data).hexdigest(),'first_epoch':rows[0][0],'last_epoch':rows[-1][0]}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(load,names))
 rows=sorted({r[0]:r for records,_ in results for r in records}.values());out=ROOT/'static/ephemerides/ikaros';out.mkdir(exist_ok=True);years={}
 for year in range(2010,2013):
  a=stamp(f'{year}-01-01');b=stamp(f'{year+1}-01-01');samples=[r for r in rows if a-1800<=r[0]<=b+1800]
  if not samples:continue
  record={'id':36577,'frame':'ICRF','time_scale':'UTC','origin':399,'max_interval_seconds':1800,'trajectory_span_seconds':604800,'source':'JAXA/ISAS DARTS · OEM EME2000 (approximation ICRF)','url':BASE,'samples':samples};raw=json.dumps(record,separators=(',',':'));file=out/f'{year}.json';file.write_text(raw);years[str(year)]={'file':str(file.relative_to(ROOT/'static')),'first_epoch':samples[0][0],'last_epoch':samples[-1][0],'sha256':hashlib.sha256(raw.encode()).hexdigest(),'samples':len(samples)}
 index={'id':36577,'frame':'ICRF','time_scale':'UTC','source':'JAXA/ISAS DARTS OEM','url':BASE,'years':years};(out.parent/'ikaros-index.json').write_text(json.dumps(index,separators=(',',':')));(folder/'manifest.json').write_text(json.dumps({'sources':[s for _,s in results],'frame_note':record['source']},indent=2));print('IKAROS archive',len(rows),rows[0][0],rows[-1][0],flush=True)
if __name__=='__main__':run()
