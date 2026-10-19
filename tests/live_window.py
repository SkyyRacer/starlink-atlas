import datetime as dt,pathlib,sys,tempfile
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from web_payloads import prepare_live
UTC=dt.timezone.utc;today=dt.datetime(2026,10,19,12,tzinfo=UTC)
def row(ident,stamp,source='CelesTrak GP / Space-Track'):
 return {'elements':{'NORAD_CAT_ID':ident,'EPOCH':stamp},'source':source}
rows=[row(1,'2026-10-15T00:00:00'),row(1,'2026-10-18T22:00:00'),row(1,'2026-10-19T10:00:00'),row(1,'2026-10-19T10:00:00.000001'),row(1,'2026-10-20T04:00:00'),row(1,'2026-10-21T12:00:00'),row(2,'2026-10-25T05:30:16'),row(3,'2016-01-01T00:00:00'),row(4,'2026-10-18T22:00:00','CelesTrak SupGP / SpaceX'),row(4,'2026-10-19T06:00:00','CelesTrak SupGP / SpaceX')]
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp);live,window=prepare_live({'orbits':rows,'catalog_response':{}},root,root,today)
 assert window['from']=='2026-10-19T11:59:00+00:00' and window['until']=='2026-10-20T00:00:00+00:00'
 def closest(values,ident,at):
  eligible=[r for r in values if r['elements']['NORAD_CAT_ID']==ident and abs((at-dt.datetime.fromisoformat(r['elements']['EPOCH']).replace(tzinfo=UTC)).total_seconds())<=72*3600 and (r['source']!='CelesTrak SupGP / SpaceX' or 0<=(at-dt.datetime.fromisoformat(r['elements']['EPOCH']).replace(tzinfo=UTC)).total_seconds()<=86400)]
  return min(eligible,key=lambda r:abs(int((at-dt.datetime.fromisoformat(r['elements']['EPOCH']).replace(tzinfo=UTC)).total_seconds())),default=None)
 for second in range(12*3600-60,86400,137):
  at=today.replace(hour=0)+dt.timedelta(seconds=second)
  for ident in [1,2,3,4]:assert closest(rows,ident,at)==closest(live,ident,at)
 assert len(live)<len(rows)
print('Fenêtre rapide : époques futures / anciennes isolées, sélection exacte sur toute la fenêtre, SupGP et quasi-égalités conservés OK')
