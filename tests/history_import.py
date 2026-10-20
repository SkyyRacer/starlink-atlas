"""End-to-end offline Parquet import, UTC, daily sampling, and merge regression."""
import gzip,json,pathlib,subprocess,sys,tempfile
import duckdb
root=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    p=pathlib.Path(tmp);(p/'data').mkdir()
    (p/'data/satcat.json').write_text(json.dumps([{'NORAD_CAT_ID':100123,'OBJECT_NAME':'STARLINK-TEST','OBJECT_ID':'2019-029A'},{'NORAD_CAT_ID':25544,'OBJECT_NAME':'ISS','OBJECT_ID':'1998-067A'},{'NORAD_CAT_ID':99999,'OBJECT_NAME':'TEST DEB','OBJECT_ID':'1959-001B'}]))
    c=duckdb.connect();c.execute("SET TimeZone='Europe/Paris'")
    c.execute('''CREATE TABLE rows AS SELECT 100123 AS norad_id, e::TIMESTAMPTZ AS epoch,
    53.0::FLOAT inclination,80.0::FLOAT raan,0.001::FLOAT eccentricity,
    20.0::FLOAT arg_perigee,30.0::FLOAT mean_anomaly,15.1::DOUBLE mean_motion,
    0.0::DOUBLE mean_motion_dot,0.00001::DOUBLE bstar,'2019-029A' intl_designator
    FROM (VALUES ('2019-06-12T10:00:00Z'),('2019-06-12T12:00:00Z'),('2019-06-13T00:15:00Z'),('2019-10-27T01:30:00Z')) AS t(e)''')
    for ident in [25544,99999]:c.execute("INSERT INTO rows SELECT ?,epoch,inclination,raan,eccentricity,arg_perigee,mean_anomaly,mean_motion,mean_motion_dot,bstar,intl_designator FROM rows WHERE norad_id=100123 AND epoch='2019-06-12T12:00:00Z'",[ident])
    c.execute('COPY rows TO ? (FORMAT PARQUET)',[str(p/'tle_2019.parquet')]);c.close()
    command=[sys.executable,str(root/'scripts/import_public_history.py'),'--data-dir',str(p/'data'),'--work-dir',str(p/'work'),'--local-parquet-dir',str(p),'--first-year','2019','--last-year','2019']
    subprocess.run(command,check=True,capture_output=True)
    h=p/'data/history'
    def rows(day):
        with gzip.open(h/(day+'.json.gz'),'rt') as f:return json.load(f)
    assert rows('2019-06-12')[0]['EPOCH']=='2019-06-12T12:00:00.000000'
    assert rows('2019-06-13')[0]['EPOCH']=='2019-06-13T00:15:00.000000'
    assert rows('2019-10-27')[0]['EPOCH']=='2019-10-27T01:30:00.000000'
    subprocess.run(command+['--merge'],check=True,capture_output=True)
    assert {v['NORAD_CAT_ID'] for v in rows('2019-06-12')}=={100123,25544,99999}
    m=json.loads((h/'manifest.json').read_text());assert m['observations']==5;assert set(m['object_coverage'])=={'100123','25544','99999'}
    failed=subprocess.run(command+['--last-year','2020'],capture_output=True,text=True)
    assert failed.returncode!=0 and '2020' in failed.stderr
    m=json.loads((h/'manifest.json').read_text());assert '2020' in m['import_failures'];assert m['year_scopes']['2019']=='all'
    assert {v['NORAD_CAT_ID'] for v in rows('2019-06-12')}=={100123,25544,99999},'An unavailable year must preserve completed archives'
print('Import Parquet : stations, constellations, débris, préparation parallèle, UTC été/hiver, sélection quotidienne et fusion OK')
