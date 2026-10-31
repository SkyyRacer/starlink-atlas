"""A warm foreground ephemeris must not wait behind a cold background request."""
import fcntl,json,pathlib,subprocess,sys,tempfile,time
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as temp:
 cache=pathlib.Path(temp);at=1793062800;start=at//2764800*2764800
 (cache/f'599-{start}-v1.json').write_text(json.dumps({'id':599,'samples':[[start,1,2,3,0,0,0],[start+2764800,1,2,3,0,0,0]]}))
 with (cache/'horizons.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  script="from scripts import solar_vectors as s;import pathlib,json;s.CACHE=pathlib.Path("+repr(temp)+");print(json.dumps(s.vectors({'id':599,'kind':'planet'},"+str(at)+")))"
  before=time.monotonic();result=subprocess.run([sys.executable,'-c',script],cwd=root,capture_output=True,text=True,timeout=2,check=True)
  assert json.loads(result.stdout)['id']==599
  print('Warm cache bypasses the busy Horizons lock:',round(time.monotonic()-before,3),'seconds')

# The public Horizons API requires one quoted value when date and time contain spaces.
import urllib.parse,io
from unittest.mock import patch
sys.path.insert(0,str(root))
from scripts import solar_vectors
with tempfile.TemporaryDirectory() as temp:
 solar_vectors.CACHE=pathlib.Path(temp)
 # An error produced before the encoding correction must not poison the fixed request.
 at=1505435400;start=at//2764800*2764800
 (solar_vectors.CACHE/f'699-{start}-v1.json').write_text(json.dumps({'samples':[],'checked':time.time(),'request_version':2}))
 def reply(request,timeout):
  params=urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
  for key in ['START_TIME','STOP_TIME']:
   assert params[key][0].startswith("'20") and params[key][0].endswith("'")
   assert params[key][0].count("'")==2,params[key]
  return io.BytesIO(json.dumps({'result':'invalid fixture'}).encode())
 with patch('urllib.request.urlopen',reply):
  result=solar_vectors.vectors({'id':699,'kind':'planet'},at)
  assert result['request_version']==3
 print('Historical Horizons date values are quoted exactly once; stale errors are retried')
