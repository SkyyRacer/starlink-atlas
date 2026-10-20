"""Import daily orbital snapshots for every supported object from a pinned public Parquet archive.
Requires duckdb; normal application startup still needs only Rust.
"""
import argparse, datetime as dt, gzip, json, os, pathlib, urllib.request
import duckdb
import concurrent.futures,hashlib,time

SOURCE='juliensimon/space-track-tle-history'
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--data-dir',default='data')
    parser.add_argument('--work-dir',default='history-work')
    parser.add_argument('--catalog-file')
    parser.add_argument('--local-parquet-dir',help='Optional local files with the same Parquet schema, for offline import and tests')
    parser.add_argument('--merge',action='store_true',help='Merge additional satellites into existing daily files')
    parser.add_argument('--scope',choices=['all','starlink'],default='all')
    parser.add_argument('--first-year',type=int,default=1959)
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
    if args.scope=='all' and not args.catalog_file:
        for file in sorted(data.glob('*-catalog.json')):
            extra=json.loads(file.read_text())
            if isinstance(extra,list):catalog.extend(extra)
    prototypes=pathlib.Path(__file__).resolve().parents[1]/'resources/prototypes-catalog.json'
    if not args.catalog_file and prototypes.exists():
        extra=json.loads(prototypes.read_text());catalog.extend(extra)
        (data/'supplemental-catalog.json').write_text(json.dumps(extra,indent=2))
    # Catalogue snapshots may use the browser's normalized id/name fields.
    normalized=[{'NORAD_CAT_ID':v.get('NORAD_CAT_ID',v.get('id')),'OBJECT_NAME':v.get('OBJECT_NAME',v.get('name','')),'OBJECT_ID':v.get('OBJECT_ID',v.get('designator',''))} for v in catalog]
    satellites=[(v['NORAD_CAT_ID'],v['OBJECT_NAME'],v.get('OBJECT_ID') or '') for v in normalized if isinstance(v['NORAD_CAT_ID'],int) and (args.scope=='all' or v['OBJECT_NAME'].startswith('STARLINK'))]
    if not satellites:raise RuntimeError('No supported objects in the supplied catalogue.')
    satellites=list({v[0]:v for v in satellites}.values())
    manifest.setdefault('requested_objects',{})[args.scope]=sorted(v[0] for v in satellites)
    manifest.setdefault('object_coverage',{})
    def connection(tag):
        connection=duckdb.connect();connection.execute("SET TimeZone='UTC'")
        extension=work/'extensions';extension.mkdir(exist_ok=True)
        connection.execute('SET extension_directory = ?',[str(extension)])
        (work/'temp'/tag).mkdir(parents=True,exist_ok=True)
        connection.execute('SET temp_directory = ?',[str(work/'temp'/tag)]);connection.execute("SET memory_limit='512MB'");connection.execute('SET threads=2')
        if not args.local_parquet_dir:
            connection.execute('LOAD httpfs');connection.execute('SET http_retries=2');connection.execute('SET http_timeout=120')
        connection.execute('CREATE TABLE selected_objects(id INTEGER,name VARCHAR,designator VARCHAR)');connection.executemany('INSERT INTO selected_objects VALUES (?,?,?)',satellites)
        return connection
    # Download/select several years in parallel, but commit daily files and the manifest serially.
    if not args.local_parquet_dir:
        bootstrap=duckdb.connect();extension=work/'extensions';extension.mkdir(exist_ok=True);bootstrap.execute('SET extension_directory = ?',[str(extension)]);bootstrap.execute('INSTALL httpfs');bootstrap.close()
    c=connection('writer')
    query="""SELECT cast(epoch AS DATE)::VARCHAR AS observation_day, s.name, s.designator, norad_id,
    strftime(epoch,'%Y-%m-%dT%H:%M:%S.%f') epoch_text,
    inclination,raan,eccentricity,arg_perigee,mean_anomaly,mean_motion,mean_motion_dot,bstar
    FROM read_parquet(?) p JOIN selected_objects s ON p.norad_id=s.id
    QUALIFY row_number() OVER(PARTITION BY norad_id,cast(epoch AS DATE)
      ORDER BY abs(date_diff('second',epoch,date_trunc('day',epoch)+INTERVAL '12 hours')),epoch)=1
    ORDER BY observation_day,norad_id"""

    years=list(range(args.first_year,args.last_year+1))
    if args.scope=='all':years.reverse() # Restore recent dates first.
    def done(year):return str(year) in manifest['years'] and not args.merge and manifest.get('year_scopes',{}).get(str(year))==args.scope
    fingerprint=hashlib.sha256(json.dumps([manifest['revision'],satellites]).encode()).hexdigest()[:16]
    cache=work/'selected-years'/fingerprint;cache.mkdir(parents=True,exist_ok=True)
    def prepare(year):
        dest=cache/f'{year}.parquet'
        if dest.exists():return dest
        url=str(pathlib.Path(args.local_parquet_dir)/f'tle_{year}.parquet') if args.local_parquet_dir else f'https://huggingface.co/datasets/{SOURCE}/resolve/{manifest["revision"]}/data/tle_{year}.parquet'
        print(f'{year}: fetching real observations…',flush=True)
        if not args.local_parquet_dir:
            raw_dir=work/'raw-years'/manifest['revision'];raw_dir.mkdir(parents=True,exist_ok=True);raw=raw_dir/f'tle_{year}.parquet'
            legacy=work/'raw-years'/f'tle_{year}.parquet'
            if legacy.exists() and not raw.exists():os.replace(legacy,raw)
            if not raw.exists():
                download=raw.with_suffix('.parquet.part')
                for attempt in range(3):
                    try:
                        # Bypass stale partial CDN responses and validate the complete body.
                        request=urllib.request.Request(url+f'?download=true&atlas_retry={attempt}',headers={'Accept-Encoding':'identity'})
                        with urllib.request.urlopen(request,timeout=180) as response,open(download,'wb') as output:
                            if response.status!=200:raise RuntimeError(f'Expected full download, received HTTP {response.status}')
                            expected=response.headers.get('Content-Length');received=0
                            while chunk:=response.read(8*1024*1024):output.write(chunk);received+=len(chunk)
                            if expected and received!=int(expected):raise RuntimeError('Incomplete Parquet download length')
                        with open(download,'rb') as check:
                            if check.read(4)!=b'PAR1':raise RuntimeError('Invalid Parquet download')
                            check.seek(-4,2)
                            if check.read()!=b'PAR1':raise RuntimeError('Incomplete Parquet download')
                        os.replace(download,raw);break
                    except Exception:
                        download.unlink(missing_ok=True)
                        if attempt==2:raise
                        time.sleep(2*(attempt+1))
            url=str(raw)
        connection_=connection(str(year));temp=dest.with_suffix('.parquet.tmp')
        try:connection_.execute('COPY ('+query+") TO '"+str(temp).replace("'","''")+"' (FORMAT PARQUET)",[url]);os.replace(temp,dest)
        finally:connection_.close()
        return dest
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=3)
    jobs={year:pool.submit(prepare,year) for year in years if not done(year)} if pool else {}
    for year in years:
        if done(year):print(f'{year}: already imported',flush=True);continue
        print(f'{year}: selecting supported objects’ daily observations…',flush=True)
        try:cached=jobs[year].result()
        except Exception as error:
            manifest.setdefault('import_failures',{})[str(year)]=str(error)[:800]
            print(f'{year}: source unavailable; recorded for retry: {error}',flush=True);continue
        manifest.setdefault('import_failures',{}).pop(str(year),None)
        cursor=c.execute('SELECT * FROM read_parquet(?)',[str(cached)])
        current=None;writer=None;count=0;day_count=0;first_epoch=None;last_epoch=None
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
                    with gzip.open(temp,'wt',compresslevel=3) as f:json.dump([merged[k][1] for k in sorted(merged)],f,separators=(',',':'))
                    manifest['days'][current]=len(merged)
                else:manifest['days'][current]=day_count
                os.replace(temp,dest);writer=None
        try:
            while batch:=cursor.fetchmany(10000):
                for row in batch:
                    day,name,designator,norad,epoch,inc,raan,ecc,arg,mean,motion,dot,bstar=row
                    if day!=current:
                        if day.endswith('-01'):print(f'{year}: writing {day[:7]}…',flush=True)
                        close_day();current=day;day_count=0;writer=gzip.open(hist/(day+'.json.gz.tmp'),'wt',encoding='utf8',compresslevel=3);writer.write('[')
                    v={'OBJECT_NAME':name,'OBJECT_ID':designator,'NORAD_CAT_ID':norad,'EPOCH':epoch,'INCLINATION':inc,'RA_OF_ASC_NODE':raan,'ECCENTRICITY':ecc,'ARG_OF_PERICENTER':arg,'MEAN_ANOMALY':mean,'MEAN_MOTION':motion,'MEAN_MOTION_DOT':dot,'MEAN_MOTION_DDOT':0,'BSTAR':bstar,'CLASSIFICATION_TYPE':'U','EPHEMERIS_TYPE':0,'ELEMENT_SET_NO':0,'REV_AT_EPOCH':0}
                    if day_count:writer.write(',')
                    writer.write(json.dumps(v,separators=(',',':'),allow_nan=False));day_count+=1;count+=1
                    first_epoch=min(first_epoch or epoch,epoch);last_epoch=max(last_epoch or epoch,epoch)
                    coverage=manifest['object_coverage'].setdefault(str(norad),{'first_epoch':epoch,'last_epoch':epoch})
                    coverage['first_epoch']=min(coverage['first_epoch'],epoch);coverage['last_epoch']=max(coverage['last_epoch'],epoch)
            close_day()
        finally:
            if writer is not None:writer.close()
        if not count:
            print(f'{year}: no matching observations available',flush=True);continue
        manifest.setdefault('year_scopes',{})[str(year)]=args.scope
        previous=manifest['years'].get(str(year),{})
        manifest['years'][str(year)]={'observations':sum(n for day,n in manifest['days'].items() if day.startswith(str(year))), 'first_epoch':min(first_epoch,previous.get('first_epoch',first_epoch)),'last_epoch':max(last_epoch,previous.get('last_epoch',last_epoch))}
        manifest['first_epoch']=min(v['first_epoch'] for v in manifest['years'].values())
        manifest['last_epoch']=max(v['last_epoch'] for v in manifest['years'].values())
        manifest['observations']=sum(manifest['days'].values())
        manifest['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
        temp=manifest_path.with_suffix('.tmp');temp.write_text(json.dumps(manifest,indent=2));os.replace(temp,manifest_path)
        print(f'{year}: {count:,} observations imported · {first_epoch} → {last_epoch}',flush=True)
    if pool:pool.shutdown()
    manifest['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    temp=manifest_path.with_suffix('.tmp');temp.write_text(json.dumps(manifest,indent=2));os.replace(temp,manifest_path)
    failed={year:error for year,error in manifest.get('import_failures',{}).items() if args.first_year<=int(year)<=args.last_year}
    if failed:raise SystemExit(f'Import incomplete; retry these years: {", ".join(sorted(failed))}')
    print('Import finished. Archives are available to the application.',flush=True)
if __name__=='__main__':main()
