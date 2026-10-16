"""Offline CLI import preserves the source and forward validity of SupGP."""
import datetime as dt,json,os,pathlib,socket,subprocess,tempfile,time,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
binary=root/'target/release/starlink-atlas'
with tempfile.TemporaryDirectory() as tmp:
 data=pathlib.Path(tmp);row=json.loads((root/'resources/supgp-example.json').read_text())[0]
 (data/'satcat.json').write_text(json.dumps([dict(row,LAUNCH_DATE='2026-09-20',DECAY_DATE='')]))
 env=dict(os.environ,DATA_DIR=str(data),OFFLINE='1')
 subprocess.run([str(binary),'--import',str(root/'resources/supgp-example.json')],cwd=root,env=env,check=True,capture_output=True)
 assert len(list(data.glob('supgp-*.json')))==1 and not list(data.glob('gp-import-*.json'))
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 env['BIND']=f'127.0.0.1:{port}'
 process=subprocess.Popen([str(binary)],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  base=f'http://127.0.0.1:{port}'
  for _ in range(100):
   try:urllib.request.urlopen(base+'/api/catalog').close();break
   except OSError:time.sleep(.05)
  epoch=dt.datetime.fromisoformat(row['EPOCH']).replace(tzinfo=dt.timezone.utc)
  def points(at):
   date=at.isoformat().replace('+','%2B')
   return json.load(urllib.request.urlopen(base+'/api/positions?at='+date))['points']
  assert points(epoch-dt.timedelta(seconds=1))==[]
  rows=points(epoch+dt.timedelta(seconds=1))
  assert len(rows)==1 and rows[0]['source']=='CelesTrak SupGP / SpaceX'
 finally:process.terminate();process.wait(timeout=5)
print('Import SupGP : source conservée et aucune position avant son époque : OK')
