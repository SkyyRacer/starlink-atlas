"""Decode public NASA Eyes Dynamo data and produce checked offline backups.
Positions/velocities are converted to geocentric ICRF km, UTC seconds. Main
Horizons archives remain authoritative; unsupported/stale Eyes data are excluded.
"""
from pathlib import Path
import bisect,datetime,hashlib,json,math,re,struct,urllib.request
ROOT=Path(__file__).resolve().parents[1];ARCHIVE=ROOT/'resources/nasa-eyes/dynamo';RUNTIME=ROOT/'static/ephemerides/nasa-eyes';RUNTIME.mkdir(exist_ok=True)
LEAPS=[(1972,6),(1972,12),(1973,12),(1974,12),(1975,12),(1976,12),(1977,12),(1978,12),(1979,12),(1981,6),(1982,6),(1983,6),(1985,6),(1987,12),(1989,12),(1990,12),(1992,6),(1993,6),(1994,6),(1995,12),(1997,6),(1998,12),(2005,12),(2008,12),(2012,6),(2015,6),(2016,12)]
UTC=datetime.timezone.utc
LEAP_TIMES=[datetime.datetime(y+(m==12),1 if m==12 else m+1,1,tzinfo=UTC).timestamp() for y,m in LEAPS]
def et(unix):return unix-946727957.816+sum(unix>=t for t in LEAP_TIMES)
class Reader:
 def __init__(self,data):self.data=data;self.i=0
 def get(self,fmt):v=struct.unpack_from('<'+fmt,self.data,self.i);self.i+=struct.calcsize('<'+fmt);return v[0] if len(v)==1 else list(v)
 def string(self):j=self.data.index(b'\0',self.i);v=self.data[self.i:j].decode();self.i=j+1;return v
class Dynamo:
 def __init__(self,path):
  self.path=path;raw=self.download('def');r=Reader(raw);self.version=r.get('h');self.kind=r.string();self.digits=r.get('B') if self.version==2 else 0;self.header=r.get('2d') if self.kind=='orb' else None;self.root=self.parse(r,'def')
 def download(self,name):
  file=ARCHIVE/self.path/(name+'.dyn');file.parent.mkdir(parents=True,exist_ok=True)
  if not file.exists():file.write_bytes(urllib.request.urlopen('https://eyes.nasa.gov/assets/dynamic/dynamo/'+self.path+'/'+name+'.dyn',timeout=30).read())
  return file.read_bytes()
 def parse(self,r,name):
  leaf=r.get('B')==1 if self.version==2 or name=='def' else True;n=r.get('i');assert 0<=n<1000000
  if leaf:
   size={'pos':7,'orb':9,'quat':5,'ori':8,'lin':4}[self.kind];rows=[r.get(str(size)+'d') for _ in range(n)];return {'rows':rows,'start':rows[0][0],'end':rows[-1][0]}
  digits=self.digits if self.version==2 else math.ceil(math.log10(n));children=[]
  for i in range(n):
   start=r.get('d');end=r.get('d') if self.version==1 else None;child={'name':('' if name=='def' else name+'_')+str(i).zfill(digits),'start':start,'end':end}
   if self.version==2 and children:children[-1]['end']=start
   children.append(child)
  if self.version==2:children.pop()
  return {'children':children,'start':children[0]['start'],'end':children[-1]['end']}
 def state(self,t):
  node=self.root
  if not node['start']<=t<=node['end']:return None
  while 'children' in node:
   child=next((x for x in node['children'] if x['start']<=t<=x['end']),None)
   if child is None:return None
   if 'node' not in child:child['node']=self.parse(Reader(self.download(child['name'])),child['name'])
   node=child['node']
  rows=node['rows'];i=max(0,min(len(rows)-2,bisect.bisect_right([row[0] for row in rows],t)-1));a,b=rows[i:i+2];dt=b[0]-a[0];u=(t-a[0])/dt
  if self.kind=='pos':
   p=[(2*u**3-3*u*u+1)*a[k]+(u**3-2*u*u+u)*dt*a[k+3]+(-2*u**3+3*u*u)*b[k]+(u**3-u*u)*dt*b[k+3] for k in (1,2,3)]
   v=[((6*u*u-6*u)*a[k]+(3*u*u-4*u+1)*dt*a[k+3]+(-6*u*u+6*u)*b[k]+(3*u*u-2*u)*dt*b[k+3])/dt for k in (1,2,3)];return p+v
  if self.kind=='orb':
   left,right=project(a,t),project(b,t);return [(1-u)*x+u*y for x,y in zip(left,right)]
  return None

def rotate(q,v):
 w,x,y,z=q;vx,vy,vz=v;tx=2*(y*vz-z*vy);ty=2*(z*vx-x*vz);tz=2*(x*vy-y*vx);return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx]
def project(row,t):
 epoch,a,e,n,M,*q=row;M+=n*(t-epoch)
 if e<1:
  M=(M+math.pi)%(2*math.pi)-math.pi;E=M if e<.8 else math.copysign(math.pi,M)
  for _ in range(40):
   delta=(E-e*math.sin(E)-M)/(1-e*math.cos(E));E-=delta
   if abs(delta)<1e-12:break
  radius=a*(1-e*math.cos(E));p=[a*(math.cos(E)-e),a*math.sqrt(1-e*e)*math.sin(E),0];v=[-n*a*a/radius*math.sin(E),n*a*a/radius*math.sqrt(1-e*e)*math.cos(E),0]
 else:
  E=math.asinh(M/max(e,1.01))
  for _ in range(40):
   delta=(e*math.sinh(E)-E-M)/(e*math.cosh(E)-1);E-=delta
   if abs(delta)<1e-12:break
  radius=a*(e*math.cosh(E)-1);p=[a*(e-math.cosh(E)),a*math.sqrt(e*e-1)*math.sinh(E),0];v=[-n*a*a/radius*math.sinh(E),n*a*a/radius*math.sqrt(e*e-1)*math.cosh(E),0]
 return rotate(q,p)+rotate(q,v)
CACHE={}
def source(path):
 if path not in CACHE:CACHE[path]=Dynamo(path)
 return CACHE[path]
def planet(name,t):return source(name+'/sun/orb').state(t)
def mission_state(row,unix):
 t=et(unix);parent=None
 for start,name in row.get('parents',[]):
  if t>=(-math.inf if start is None else start):parent=name
 if parent is None:return None
 for endpoint in reversed(row.get('dynamo',[])):
  if any(part in endpoint.split('/') for part in ['ori','quat']):continue
  parts=endpoint.split('/');reference=parts[1] if len(parts)>1 else parent
  if reference!=parent:continue
  state=source(endpoint).state(t)
  if state is None:continue
  if parent=='earth':return state
  earth=planet('earth',t)
  if earth is None:return None
  if parent=='sun':return [a-b for a,b in zip(state,earth)]
  if parent in ['jupiter','saturn','venus','uranus','neptune']:
   origin=planet(parent,t)
   if origin:return [a+b-c for a,b,c in zip(state,origin,earth)]
 return None

def main():
 metadata=json.loads((ROOT/'resources/nasa-eyes/scene-missions.json').read_text());report=[]
 for row in metadata:
  name=row['key'].removeprefix('sc_').replace('_','-');indexfile=ROOT/'static/ephemerides'/(name+'-index.json')
  if not row.get('dynamo') or not indexfile.exists():continue
  index=json.loads(indexfile.read_text());year=2017 if name=='cassini' else 2026;entry=index['years'].get(str(year));output={'mission':name,'year':year,'status':'unavailable'}
  try:
   checks=[];archive=json.loads((ROOT/'static'/entry['file']).read_text());rows=archive['samples'];start=max(rows[0][0],datetime.datetime(year,1,1,tzinfo=UTC).timestamp());end=min(rows[-1][0],datetime.datetime(year+1,1,1,tzinfo=UTC).timestamp());samples=[]
   # Sample only within both published coverages; never extrapolate a source.
   for timestamp in range(int(start),int(end)+1,21600):
    state=mission_state(row,timestamp)
    if state is not None and all(math.isfinite(x) for x in state):samples.append([timestamp,*state])
   if len(samples)<2:raise ValueError('No overlapping source coverage')
   from bisect import bisect_left
   for sample in samples[::max(1,len(samples)//12)]:
    i=min(len(rows)-2,max(0,bisect_left([r[0] for r in rows],sample[0])-1));a,b=rows[i:i+2];dt=b[0]-a[0];u=(sample[0]-a[0])/dt
    position=[(2*u**3-3*u*u+1)*a[k]+(u**3-2*u*u+u)*dt*a[k+3]+(-2*u**3+3*u*u)*b[k]+(u**3-u*u)*dt*b[k+3] for k in (1,2,3)]
    checks.append(math.dist(position,sample[1:4]))
   error=max(checks);output.update(samples=len(samples),max_check_error_km=error)
   if error>10000:raise ValueError('Source differs from current Horizons by more than 10000 km; not enabled')
   data={'id':index['id'],'frame':'ICRF','origin':399,'time_scale':'UTC','source':'NASA/JPL Eyes · secours contrôlé avec Horizons','epoch':'2026-10-27T00:00:00Z','fetched':'2026-10-27T00:00:00Z','trajectory_span_seconds':30*86400,'max_interval_seconds':21600,'samples':samples,'validation':{'max_error_km':error,'checks':len(checks)}}
   out=RUNTIME/(name+'.json');out.write_text(json.dumps(data,separators=(',',':')));output.update(status='enabled',file=str(out.relative_to(ROOT/'static')),first_epoch=samples[0][0],last_epoch=samples[-1][0])
  except Exception as error:output['error']=str(error)
  report.append(output);print(json.dumps(output),flush=True)
 manifest={'source':'NASA/JPL-Caltech Eyes on the Solar System','url':'https://eyes.nasa.gov/apps/solar-system/','imported':'2026-10-27','missions':report}
 (RUNTIME/'index.json').write_text(json.dumps(manifest,separators=(',',':')));(ROOT/'resources/nasa-eyes/ephemeris-validation.json').write_text(json.dumps(manifest,indent=2))
if __name__=='__main__':main()
