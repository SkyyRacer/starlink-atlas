import copy,gzip,json,pathlib,sys,tempfile
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from compact_web_data import compact
with tempfile.TemporaryDirectory() as temp:
 root=pathlib.Path(temp)
 def row(epoch,source='CelesTrak GP / Space-Track'):
  return {'elements':{'NORAD_CAT_ID':1,'EPOCH':epoch},'source':source}
 bundle={'orbits':[row('2026-01-01T02:00:00'),row('2026-01-01T11:00:00'),row('2026-01-01T18:00:00'),row('2026-01-01T12:30:00','CelesTrak SupGP / SpaceX')]}
 for i in range(3):(root/f'gp-{i}.json').write_text('[]')
 directory=compact(bundle,root)
 assert len(list(root.glob('gp-*.json')))==3,'ordinary local export must never prune original feeds'
 observations=json.loads(gzip.decompress((directory/'2026-01-01.json.gz').read_bytes()))
 assert len(observations)==2
 assert next(r for r in observations if r['source']=='CelesTrak GP / Space-Track')['elements']['EPOCH']=='2026-01-01T11:00:00'
 assert any(r['source']=='CelesTrak SupGP / SpaceX' for r in observations),'SupGP identity/validity marker is preserved'
 assert len(bundle['orbits'])==3,'two newest GP records and the supplemental record'
 compact({'orbits':[]},root,prune=True)
 assert len(list(root.glob('gp-*.json')))==2
 assert len(json.loads(gzip.decompress((directory/'2026-01-01.json.gz').read_bytes())))==2
print('Archives quotidiennes, validité des sources et conservation des fichiers locaux : OK')
