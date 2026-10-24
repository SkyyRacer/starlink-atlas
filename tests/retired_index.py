"""Last-observation indexing must preserve actual epochs and skip unavailable data."""
import gzip,importlib.util,json,pathlib,tempfile
spec=importlib.util.spec_from_file_location('index_retired','scripts/index_retired_positions.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
 root=pathlib.Path(directory);module.ROOT=root;data=root/'data';hist=data/'history';updates=data/'history-updates';hist.mkdir(parents=True);updates.mkdir()
 catalogue=[{'NORAD_CAT_ID':1,'OBJECT_NAME':'A','OBJECT_TYPE':'PAY','LAUNCH_DATE':'2000-01-01','DECAY_DATE':'2000-01-05'},{'NORAD_CAT_ID':2,'OBJECT_NAME':'B','OBJECT_TYPE':'PAY','LAUNCH_DATE':'2000-01-04','DECAY_DATE':'2000-01-05'}];(data/'test-catalog.json').write_text(json.dumps(catalogue))
 def save(folder,day,rows):
  with gzip.open(folder/(day+'.json.gz'),'wt') as f:json.dump(rows,f)
 save(hist,'2000-01-03',[{'NORAD_CAT_ID':1,'EPOCH':'2000-01-03T12:00:00'},{'NORAD_CAT_ID':2,'EPOCH':'2000-01-03T12:00:00'}]);save(updates,'2000-01-04',[{'elements':{'NORAD_CAT_ID':1,'EPOCH':'2000-01-04T13:00:00'},'source':'CelesTrak GP / Space-Track'}]);save(hist,'2000-01-05',[{'NORAD_CAT_ID':1,'EPOCH':'2000-01-05T02:00:00'}]);(hist/'manifest.json').write_text(json.dumps({'object_coverage':{'1':{'last_epoch':'2000-01-03T12:00:00'}}}))
 output=root/'static/retired-positions.json';module.build(data,output);result=json.loads(output.read_text())['objects'];assert result['1']['at']=='2000-01-04T13:00:00Z';assert '2' not in result,'Do not invent a position before launch';assert json.loads((output.parent/'retired-observations/1.json').read_text())['elements']['EPOCH']=='2000-01-04T13:00:00'
print('Last archive index: precise observation, newer provider cache, launch/decay bounds and individual resource OK.')

# New deorbits may have disappeared from the current feed; their provider archive remains usable.
import sys
sys.path.insert(0,str(pathlib.Path('scripts').resolve()))
from retired_resources import refresh
with tempfile.TemporaryDirectory() as directory:
 out=pathlib.Path(directory);catalog=[{'id':1,'launch':'2000-01-01','decay':'2000-01-05'}]
 out.joinpath('retired-positions.json').write_text(json.dumps({'objects':{'1':{'at':'2000-01-04T12:00:00Z'}}}))
 record={'NORAD_CAT_ID':1,'EPOCH':'2000-01-04T12:00:00.500'}
 document=refresh(out,catalog,iter([record]));assert document['objects']['1']['at']=='2000-01-04T12:00:00.500000Z';assert (out/'retired-observations/1.json').exists()
print('Scheduled export: newest provider archive and fractional-second ordering preserved.')
