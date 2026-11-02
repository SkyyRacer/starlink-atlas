"""Bounded, explicitly theoretical backups outside published mission archives.
IKAROS: two-body heliocentric propagation from the last JAXA OEM state.
SRG: nominal 180-day L2 halo least-squares fit to the 2019 MPE archive.
Cassini: short endpoint bridges only; no post-destruction trajectory.
No generated samples are added to primary observational files.
"""
import bisect,datetime as dt,hashlib,json,math
from pathlib import Path
import numpy as np
from spiceypy import prop2b
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'static/ephemerides/theoretical';OUT.mkdir(exist_ok=True);UTC=dt.timezone.utc
MU=132712440018.;cache={}
def stamp(s):return dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def hermite(a,b,t):
 d=b[0]-a[0];u=(t-a[0])/d
 p=[(2*u**3-3*u*u+1)*a[k]+(u**3-2*u*u+u)*d*a[k+3]+(-2*u**3+3*u*u)*b[k]+(u**3-u*u)*d*b[k+3] for k in [1,2,3]]
 v=[((6*u*u-6*u)*a[k]+(3*u*u-4*u+1)*d*a[k+3]+(-6*u*u+6*u)*b[k]+(3*u*u-2*u)*d*b[k+3])/d for k in [1,2,3]];return p+v

def planet(id,t):
 y=dt.datetime.fromtimestamp(t,UTC).year;key=(id,y)
 if key not in cache:
  rows=json.loads((ROOT/f'static/solar/history/{id}/{y}.json').read_text())['samples'];cache[key]=(rows,[r[0] for r in rows])
 rows,epochs=cache[key];i=max(0,min(len(rows)-2,bisect.bisect_right(epochs,t)-1));return np.array(hermite(rows[i],rows[i+1],t))
def primary(key):
 index=json.loads((ROOT/f'static/ephemerides/{key}-index.json').read_text());rows=[]
 for e in index['years'].values():rows+=json.loads((ROOT/'static'/e['file']).read_text())['samples']
 return sorted({r[0]:r for r in rows}.values())
def pad(t,lat,lon):
 a=math.radians(lat);jd=t/86400+2440587.5;angle=math.radians(lon+280.46061837+360.98564736629*(jd-2451545));r=6378.137
 p=np.array([r*math.cos(a)*math.cos(angle),r*math.cos(a)*math.sin(angle),r*math.sin(a)]);v=np.array([-p[1],p[0],0])*7.292115e-5;return np.concatenate((p,v))
def bridge(start,first,lat,lon):
 return lambda t:hermite([start,*pad(start,lat,lon)],first,t)
def propagate(row,center,mu):
 epoch=row[0];state=np.array(row[1:])-planet(center,epoch)
 return lambda t:np.array(prop2b(mu,state,t-epoch))+planet(center,t)
def basis(t):
 sun=planet(10,t)[:3];x=-sun/np.linalg.norm(sun);pole=np.array([0,-math.sin(math.radians(23.4392911)),math.cos(math.radians(23.4392911))]);y=np.cross(pole,x);y/=np.linalg.norm(y);z=np.cross(x,y);return np.array([x,y,z]).T

def build():
 jobs=[];ikaros=primary('ikaros');start=stamp('2010-05-20T21:58:22Z');end=stamp('2025-05-15T00:00:00Z')
 jobs+=[('ikaros',36577,start,ikaros[0][0],bridge(start,ikaros[0],30.4,130.98),'Liaison théorique entre le site de lancement et le premier état JAXA ; pas une simulation du lanceur.',60),('ikaros',36577,ikaros[-1][0],end,propagate(ikaros[-1],10,MU),'Propagation képlérienne héliocentrique depuis le dernier état JAXA, sans pression solaire ni perturbations planétaires. Incertitude croissante, position historique non validée.',21600)]
 srg=primary('spektr-rg');epoch=srg[0][0];w=math.tau/(180*86400);times=np.array([r[0] for r in srg]);values=np.array([basis(r[0]).T@r[1:4] for r in srg]);A=np.stack([np.ones(len(times)),np.cos(w*(times-epoch)),np.sin(w*(times-epoch))],axis=1);coef=np.linalg.lstsq(A,values,rcond=None)[0]
 def halo_pos(t):return basis(t)@(np.array([1,math.cos(w*(t-epoch)),math.sin(w*(t-epoch))])@coef)
 def halo(t):return np.concatenate((halo_pos(t),(halo_pos(t+30)-halo_pos(t-30))/60))
 # Start the nominal extrapolation from the archive state continuously, with a
 # one-orbit exponential correction; this is a model, not recovered manoeuvres.
 last=srg[-1];delta=np.array(last[1:4])-halo_pos(last[0]);dvel=np.array(last[4:])-halo(last[0])[3:];decay=180*86400
 def continuation(t):
  h=t-last[0];p=halo_pos(t)+(delta+(dvel+delta/decay)*h)*math.exp(-h/decay);v=(halo_pos(t+30)-halo_pos(t-30))/60+((dvel+delta/decay)-(delta+(dvel+delta/decay)*h)/decay)*math.exp(-h/decay);return np.concatenate((p,v))
 start=stamp('2019-07-13T12:30:57Z');end=(dt.datetime.now(UTC).replace(hour=0,minute=0,second=0,microsecond=0)+dt.timedelta(days=8)).timestamp()
 jobs+=[('spektr-rg',44432,start,srg[0][0],bridge(start,srg[0],45.92,63.34),'Transfert indicatif vers le premier état MPE ; courbe de raccordement, sans reconstruction des manœuvres.',21600),('spektr-rg',44432,last[0],end,continuation,'Halo nominal de 180 jours ajusté aux états MPE de 2019 ; extrapolation périodique sans manœuvres historiques, non observation.',21600)]
 cassini=primary('cassini');start=stamp('1997-10-15T08:43:00Z');end=stamp('2017-09-15T10:31:00Z')
 jobs+=[('cassini',25008,start,cassini[0][0],bridge(start,cassini[0],28.58,-80.58),'Raccordement théorique du site de lancement au premier état Horizons ; pas une reconstruction de la phase propulsée.',30),('cassini',25008,cassini[-1][0],end,propagate(cassini[-1],699,37931207.8),'Propagation balistique courte depuis le dernier état Horizons, bornée au début de rentrée vers 10:31 UTC ; frottement atmosphérique non modélisé.',5)]
 indexes={}
 for key,id,start,end,fn,note,step in jobs:
  rows=[[int(t),*[round(float(v),9) for v in fn(t)]] for t in list(range(int(start),int(end),step))+[int(end)]];assert all(math.isfinite(v) for r in rows for v in r)
  index=indexes.setdefault(key,{'id':id,'frame':'ICRF','time_scale':'UTC','theoretical':True,'source':'Atlas · reconstruction théorique bornée','years':{}})
  for year in range(dt.datetime.fromtimestamp(start,UTC).year,dt.datetime.fromtimestamp(end,UTC).year+1):
   a=stamp(f'{year}-01-01T00:00:00Z');b=stamp(f'{year+1}-01-01T00:00:00Z');sample=[r for r in rows if a-step<=r[0]<=b+step]
   if len(sample)<2:continue
   file=OUT/key/(str(year)+'-'+str(int(start))+'.json');file.parent.mkdir(exist_ok=True);record={'id':id,'origin':399,'frame':'ICRF','time_scale':'UTC','max_interval_seconds':step,'trajectory_span_seconds':604800,'theoretical':True,'theory_note':note,'source':'Théorique · Atlas (archives JAXA/MPE/Horizons prioritaires)','samples':sample};raw=json.dumps(record,separators=(',',':'));file.write_text(raw);index['years'][file.stem]={'file':str(file.relative_to(ROOT/'static')),'first_epoch':sample[0][0],'last_epoch':sample[-1][0],'sha256':hashlib.sha256(raw.encode()).hexdigest(),'theoretical':True,'samples':len(sample)}
 for key,index in indexes.items():
  (OUT/(key+'-index.json')).write_text(json.dumps(index,separators=(',',':')));print(key,len(index['years']),'theoretical files',flush=True)
 (ROOT/'resources/mission-theory-methods.json').write_text(json.dumps({'srg_epoch':epoch,'srg_period_days':180,'srg_halo_coefficients_km':coef.tolist(),'srg_fit_rms_km':float(np.sqrt(np.mean((A@coef-values)**2))),'notes':[{'mission':j[0],'first_epoch':j[2],'last_epoch':j[3],'method':j[5]} for j in jobs]},indent=2))
if __name__=='__main__':build()
