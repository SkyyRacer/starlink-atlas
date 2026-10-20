"""Fill recent public orbital history without rescanning or replacing old years."""
import argparse,datetime as dt,json,pathlib,urllib.request
import duckdb
from compact_web_data import compact
SOURCE='juliensimon/space-track-tle-history'
def main():
 p=argparse.ArgumentParser();p.add_argument('--data-dir',default='data');p.add_argument('--work-dir',required=True);p.add_argument('--catalog-file',required=True);p.add_argument('--days',type=int,default=14);p.add_argument('--since',type=dt.date.fromisoformat);a=p.parse_args()
 data=pathlib.Path(a.data_dir);work=pathlib.Path(a.work_dir);work.mkdir(parents=True,exist_ok=True);catalog=json.loads(pathlib.Path(a.catalog_file).read_text());objects=[(v.get('id',v.get('NORAD_CAT_ID')),v.get('name',v.get('OBJECT_NAME')),v.get('designator',v.get('OBJECT_ID')) or '') for v in catalog]
 revision=json.load(urllib.request.urlopen(f'https://huggingface.co/api/datasets/{SOURCE}',timeout=60))['sha'];since=a.since or (dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=a.days)).date();rows=[]
 c=duckdb.connect();extension=work/'extensions';extension.mkdir(exist_ok=True);temp=work/'recent-temp';temp.mkdir(exist_ok=True);c.execute('SET extension_directory = ?',[str(extension)]);c.execute('SET temp_directory = ?',[str(temp)]);c.execute("SET memory_limit='512MB'");c.execute('SET threads=2');c.execute('INSTALL httpfs');c.execute('LOAD httpfs');c.execute('SET http_timeout=120');c.execute('SET http_retries=2');c.execute("SET TimeZone='UTC'");c.execute('CREATE TABLE objects(id INTEGER,name VARCHAR,designator VARCHAR)');c.executemany('INSERT INTO objects VALUES (?,?,?)',objects)
 for year in range(since.year,dt.datetime.now(dt.timezone.utc).year+1):
  url=f'https://huggingface.co/datasets/{SOURCE}/resolve/{revision}/data/tle_{year}.parquet'
  query="""SELECT norad_id,name,designator,strftime(epoch,'%Y-%m-%dT%H:%M:%S.%f'),inclination,raan,eccentricity,arg_perigee,mean_anomaly,mean_motion,mean_motion_dot,bstar
  FROM read_parquet(?) p JOIN objects o ON p.norad_id=o.id WHERE epoch >= ?::TIMESTAMPTZ
  QUALIFY row_number() OVER(PARTITION BY norad_id,cast(epoch AS DATE) ORDER BY abs(date_diff('second',epoch,date_trunc('day',epoch)+INTERVAL '12 hours')),epoch)=1"""
  print(f'{year}: fetching recent daily observations since {since}',flush=True);cursor=c.execute(query,[url,since.isoformat()+'T00:00:00Z'])
  while batch:=cursor.fetchmany(10000):
   for ident,name,designator,epoch,inc,raan,ecc,arg,mean,motion,dot,bstar in batch:
    elements={'NORAD_CAT_ID':ident,'OBJECT_NAME':name,'OBJECT_ID':designator,'EPOCH':epoch,'INCLINATION':inc,'RA_OF_ASC_NODE':raan,'ECCENTRICITY':ecc,'ARG_OF_PERICENTER':arg,'MEAN_ANOMALY':mean,'MEAN_MOTION':motion,'MEAN_MOTION_DOT':dot,'MEAN_MOTION_DDOT':0,'BSTAR':bstar,'CLASSIFICATION_TYPE':'U','EPHEMERIS_TYPE':0,'ELEMENT_SET_NO':0,'REV_AT_EPOCH':0}
    rows.append({'elements':elements,'source':'Archive publique Julien Simon / Space-Track'})
 if not rows:raise RuntimeError('No recent observations; existing archives preserved')
 compact({'orbits':rows},data)
 metadata={'source':SOURCE,'revision':revision,'since':since.isoformat(),'fetched_at':dt.datetime.now(dt.timezone.utc).isoformat(),'observations':len(rows),'objects':len({r['elements']['NORAD_CAT_ID'] for r in rows}),'last_epoch':max(r['elements']['EPOCH'] for r in rows)};(data/'history-recent-source.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata),flush=True)
if __name__=='__main__':main()
