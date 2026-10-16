"""Import daily Starlink orbital snapshots from a pinned public Parquet archive.
Requires duckdb; normal application startup still needs only Rust.
"""
import argparse, datetime as dt, gzip, json, os, pathlib, urllib.request
import duckdb

SOURCE='juliensimon/space-track-tle-history'
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--data-dir',default='data')
    parser.add_argument('--work-dir',default='history-work')
    parser.add_argument('--catalog-file')
    parser.add_argument('--local-parquet-dir',help='Optional local files with the same Parquet schema, for offline import and tests')
    parser.add_argument('--merge',action='store_true',help='Merge additional satellites into existing daily files')
    parser.add_argument('--first-year',type=int,default=2018)
    parser.add_argument('--last-year',type=int,default=dt.datetime.now(dt.timezone.utc).year)
    args=parser.parse_args()
    data=pathlib.Path(args.data_dir).resolve();hist=data/'history';hist.mkdir(parents=True,exist_ok=True)
    work=pathlib.Path(args.work_dir).resolve();work.mkdir(parents=True,exist_ok=True)
    manifest_path=hist/'manifest.json'
    manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'source':SOURCE,'license_declared':'CC-BY-4.0','sampling':'one actual orbital observation nearest noon UTC per satellite per available day','years':{},'days':{},'time_zone':'UTC'}
    if 'revision' not in manifest:
        if args.local_parquet_dir:
            manifest['source']='local Parquet import';manifest['revision']='local'
        else:
            with urllib.request.urlopen(f'https://huggingface.co/api/datasets/{SOURCE}',timeout=60) as r:manifest['revision']=json.load(r)['sha']
    if bool(args.local_parquet_dir) != (manifest['revision']=='local'):
        raise RuntimeError('Do not mix local and public sources in the same history directory.')
    catalog=json.loads(pathlib.Path(args.catalog_file).read_text()) if args.catalog_file else json.loads((data/'satcat.json').read_text())
    prototypes=pathlib.Path(__file__).resolve().parents[1]/'resources/prototypes-catalog.json'
    if not args.catalog_file and prototypes.exists():
        extra=json.loads(prototypes.read_text());catalog.extend(extra)
        (data/'supplemental-catalog.json').write_text(json.dumps(extra,indent=2))
    satellites=[(v['NORAD_CAT_ID'],v['OBJECT_NAME'],v.get('OBJECT_ID') or '') for v in catalog if v.get('OBJECT_NAME','').startswith('STARLINK')]
    if not satellites:raise RuntimeError('No Starlink SATCAT loaded; start the application once first.')
    satellites=list({v[0]:v for v in satellites}.values())
    c=duckdb.connect()
    c.execute("SET TimeZone='UTC'")
    extension=work/'extensions';extension.mkdir(exist_ok=True)
    c.execute('SET extension_directory = ?',[str(extension)])
    c.execute('SET temp_directory = ?',[str(work/'temp')]);c.execute("SET memory_limit='768MB'");c.execute('SET threads=4')
    if not args.local_parquet_dir:
        c.execute('INSTALL httpfs');c.execute('LOAD httpfs');c.execute('SET http_retries=0');c.execute('SET http_timeout=120')
    c.execute('CREATE TABLE starlink(id INTEGER,name VARCHAR,designator VARCHAR)');c.executemany('INSERT INTO starlink VALUES (?,?,?)',satellites)
    for year in range(args.first_year,args.last_year+1):
        if str(year) in manifest['years'] and not args.merge:print(f'{year}: already imported',flush=True);continue
        url=str(pathlib.Path(args.local_parquet_dir)/f'tle_{year}.parquet') if args.local_parquet_dir else f'https://huggingface.co/datasets/{SOURCE}/resolve/{manifest["revision"]}/data/tle_{year}.parquet'
        print(f'{year}: reading archive and selecting Starlink daily observations…',flush=True)
        query="""SELECT cast(epoch AS DATE)::VARCHAR AS observation_day, s.name, s.designator, norad_id,
        strftime(epoch,'%Y-%m-%dT%H:%M:%S.%f') epoch_text,
        inclination,raan,eccentricity,arg_perigee,mean_anomaly,mean_motion,mean_motion_dot,bstar
        FROM read_parquet(?) p JOIN starlink s ON p.norad_id=s.id
        QUALIFY row_number() OVER(PARTITION BY norad_id,cast(epoch AS DATE)
          ORDER BY abs(date_diff('second',epoch,date_trunc('day',epoch)+INTERVAL '12 hours')),epoch)=1
        ORDER BY observation_day,norad_id"""
        cursor=c.execute(query,[url]);current=None;writer=None;count=0;day_count=0;first_epoch=None;last_epoch=None
        def close_day():
            nonlocal writer
            if writer is not None:
                writer.write(']');writer.close()
                temp=hist/(current+'.json.gz.tmp');dest=hist/(current+'.json.gz')
                if dest.exists():
                    with gzip.open(dest,'rt') as f:old=json.load(f)
                    with gzip.open(temp,'rt') as f:new=json.load(f)
                    noon=dt.datetime.fromisoformat(current+'T12:00:00')
                    merged={}
                    for v in old+new:
                        key=v['NORAD_CAT_ID'];distance=abs((dt.datetime.fromisoformat(v['EPOCH'])-noon).total_seconds())
                        if key not in merged or distance<merged[key][0]:merged[key]=(distance,v)
                    with gzip.open(temp,'wt') as f:json.dump([merged[k][1] for k in sorted(merged)],f,separators=(',',':'))
                    manifest['days'][current]=len(merged)
                else:manifest['days'][current]=day_count
                os.replace(temp,dest);writer=None
        try:
            while batch:=cursor.fetchmany(10000):
                for row in batch:
                    day,name,designator,norad,epoch,inc,raan,ecc,arg,mean,motion,dot,bstar=row
                    if day!=current:
                        if day.endswith('-01'):print(f'{year}: writing {day[:7]}…',flush=True)
                        close_day();current=day;day_count=0;writer=gzip.open(hist/(day+'.json.gz.tmp'),'wt',encoding='utf8');writer.write('[')
                    v={'OBJECT_NAME':name,'OBJECT_ID':designator,'NORAD_CAT_ID':norad,'EPOCH':epoch,'INCLINATION':inc,'RA_OF_ASC_NODE':raan,'ECCENTRICITY':ecc,'ARG_OF_PERICENTER':arg,'MEAN_ANOMALY':mean,'MEAN_MOTION':motion,'MEAN_MOTION_DOT':dot,'MEAN_MOTION_DDOT':0,'BSTAR':bstar,'CLASSIFICATION_TYPE':'U','EPHEMERIS_TYPE':0,'ELEMENT_SET_NO':0,'REV_AT_EPOCH':0}
                    if day_count:writer.write(',')
                    writer.write(json.dumps(v,separators=(',',':'),allow_nan=False));day_count+=1;count+=1
                    first_epoch=min(first_epoch or epoch,epoch);last_epoch=max(last_epoch or epoch,epoch)
            close_day()
        finally:
            if writer is not None:writer.close()
        if not count:raise RuntimeError(f'{year}: no Starlink observations; import stopped')
        previous=manifest['years'].get(str(year),{})
        manifest['years'][str(year)]={'observations':sum(n for day,n in manifest['days'].items() if day.startswith(str(year))), 'first_epoch':min(first_epoch,previous.get('first_epoch',first_epoch)),'last_epoch':max(last_epoch,previous.get('last_epoch',last_epoch))}
        manifest['first_epoch']=min(v['first_epoch'] for v in manifest['years'].values())
        manifest['last_epoch']=max(v['last_epoch'] for v in manifest['years'].values())
        manifest['observations']=sum(manifest['days'].values())
        manifest['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
        temp=manifest_path.with_suffix('.tmp');temp.write_text(json.dumps(manifest,indent=2));os.replace(temp,manifest_path)
        print(f'{year}: {count:,} observations imported · {first_epoch} → {last_epoch}',flush=True)
    print('Import finished. Restart the application to use the archives.',flush=True)
if __name__=='__main__':main()
