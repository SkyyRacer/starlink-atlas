"""Import official SRG/eROSITA EDR FITS orbit tables, using only their UTC bounds.
MPE publishes NPOL geocentric J2000 positions (m) and velocities (m/s).
The UTC columns are cross-checked against MJD(TT), including TT-UTC=69.184s
in 2019. No osculating TLE is substituted for the L2 trajectory.
"""
from pathlib import Path
import datetime as dt,gzip,hashlib,json,math,struct,urllib.request
ROOT=Path(__file__).resolve().parents[1];BASE='https://erosita.mpe.mpg.de/edr/eROSITAObservations/OrbitFiles/';UTC=dt.timezone.utc
folder=ROOT/'resources/spektr-rg';folder.mkdir(exist_ok=True)
def header(raw,offset):
 fields={};cursor=offset
 while True:
  card=raw[cursor:cursor+80].decode('ascii');cursor+=80;key=card[:8].strip()
  if key=='END':break
  if card[8:10]=='= ':
   value=card[10:].strip();text=("'"+value.split("'")[1]+"'") if value.startswith("'") else value.split('/')[0].strip();fields[key]=text.strip("'").strip() if text.startswith("'") else float(text) if '.' in text or 'E' in text else int(text) if text.lstrip('-').isdigit() else text
 return fields,offset+math.ceil((cursor-offset)/2880)*2880
allrows=[];sources=[]
for month in ['201910','201911','201912']:
 name='srg_orbit_'+month+'.fits.gz';path=folder/name
 if not path.exists():path.write_bytes(urllib.request.urlopen(BASE+name,timeout=40).read())
 compressed=path.read_bytes();raw=gzip.decompress(compressed);h,offset=header(raw,0);h,offset=header(raw,offset)
 assert h['EXTNAME']=='ORBIT' and h['MISSION']=='SRG' and h['NAXIS1']==88
 assert [h['TTYPE'+str(i)] for i in range(1,11)]==['DATE','UTC','MJD','TIME','X','Y','Z','VX','VY','VZ']
 assert [h['TFORM'+str(i)] for i in range(1,11)]==['12A','12A']+['D']*8
 assert all(h['TUNIT'+str(i)]=='m' for i in range(5,8)) and all(h['TUNIT'+str(i)]=='m/s' for i in range(8,11))
 rows=[]
 for i in range(h['NAXIS2']):
  row=raw[offset+i*88:offset+(i+1)*88];date=row[:12].decode().strip();clock=row[12:24].decode().strip();unix=dt.datetime.fromisoformat(date+'T'+clock).replace(tzinfo=UTC).timestamp();mjd,sc,*state=struct.unpack('>8d',row[24:]);assert abs((mjd-40587)*86400-unix-69.184)<.001
  assert all(math.isfinite(v) for v in state);rows.append([int(unix),*[v/1000 for v in state]])
 allrows+=rows;sources.append({'url':BASE+name,'sha256':hashlib.sha256(compressed).hexdigest(),'samples':len(rows),'first_epoch':rows[0][0],'last_epoch':rows[-1][0]})
rows=sorted({r[0]:r for r in allrows}.values());assert all(0<b[0]-a[0]<=1800 for a,b in zip(rows,rows[1:]))
out=ROOT/'static/ephemerides/spektr-rg';out.mkdir(exist_ok=True)
record={'id':44432,'frame':'ICRF','origin':399,'time_scale':'UTC','max_interval_seconds':1800,'trajectory_span_seconds':604800,'source':'MPE/eROSITA · NPOL · archive orbitale J2000','url':BASE,'samples':rows}
text=json.dumps(record,separators=(',',':'));(out/'2019.json').write_text(text);sha=hashlib.sha256(text.encode()).hexdigest()
index={'id':44432,'source':record['source'],'url':BASE,'frame':'ICRF','time_scale':'UTC','max_interval_seconds':1800,'source_sha256':sha,'years':{'2019':{'file':'ephemerides/spektr-rg/2019.json','first_epoch':rows[0][0],'last_epoch':rows[-1][0],'samples':len(rows),'sha256':sha}}}
(out.parent/'spektr-rg-index.json').write_text(json.dumps(index,separators=(',',':')));(folder/'manifest.json').write_text(json.dumps({'sources':sources,'conversion':'UTC columns cross-checked with MJD(TT); metres to km; m/s to km/s; geocentric J2000/ICRS'},indent=2))
print('Spektr-RG',len(rows),dt.datetime.fromtimestamp(rows[0][0],UTC),dt.datetime.fromtimestamp(rows[-1][0],UTC))
# Available events get a small bounded window, retaining the measured half-hour states.
catpath=ROOT/'static/mission-events/catalog.json';cat=json.loads(catpath.read_text());winpath=ROOT/'static/mission-events/windows.json';windows=json.loads(winpath.read_text())
for event in cat['missions']['spektr-rg']:
 centre=event['at']/1000;sample=[r for r in rows if centre-86400<=r[0]<=centre+86400]
 if len(sample)<2:continue
 event.pop('unavailable',None);file='mission-events/'+event['id']+'.json';doc={**record,'samples':sample};text=json.dumps(doc,separators=(',',':'));(ROOT/'static'/file).write_text(text)
 windows['events'][event['id']]={'mission':'spektr-rg','file':file,'first_epoch':sample[0][0],'last_epoch':sample[-1][0],'samples':len(sample),'sha256':hashlib.sha256(text.encode()).hexdigest()}
catpath.write_text(json.dumps(cat,ensure_ascii=False,indent=2)+'\n');winpath.write_text(json.dumps(windows,separators=(',',':')))
