"""Import real daily station observations from IAU CPS SatChecker's public archive.
No propagation or synthetic replacement elements: TLE fields are converted to OMM.
"""
import argparse,datetime as dt,hashlib,json,pathlib,urllib.request,urllib.parse
UTC=dt.timezone.utc

def tle_omm(row):
    a,b=row['tle_line1'],row['tle_line2']
    if len(a)<69 or len(b)<69 or a[:2]!='1 ' or b[:2]!='2 ' or a[2:7]!=b[2:7]:raise ValueError('Malformed TLE')
    for line in [a,b]:
        if sum(int(c) if c.isdigit() else 1 if c=='-' else 0 for c in line[:68])%10!=int(line[68]):raise ValueError('Invalid TLE checksum')
    exp=lambda value:float(value[0]+'.'+value[1:6])*10**int(value[6:])
    year=int(a[18:20]);year+=2000 if year<57 else 1900
    epoch=dt.datetime(year,1,1)+dt.timedelta(days=float(a[20:32])-1)
    designator=a[9:17].strip();launch_year=int(designator[:2]);launch_year+=2000 if launch_year<57 else 1900
    return {'OBJECT_NAME':row.get('satellite_name',''),'OBJECT_ID':str(launch_year)+'-'+designator[2:],'NORAD_CAT_ID':int(a[2:7]),'EPOCH':epoch.isoformat(timespec='microseconds'),'MEAN_MOTION':float(b[52:63]),'ECCENTRICITY':float('.'+b[26:33]),'INCLINATION':float(b[8:16]),'RA_OF_ASC_NODE':float(b[17:25]),'ARG_OF_PERICENTER':float(b[34:42]),'MEAN_ANOMALY':float(b[43:51]),'BSTAR':exp(a[53:61]),'MEAN_MOTION_DOT':float(a[33:43]),'MEAN_MOTION_DDOT':exp(a[44:52]),'EPHEMERIS_TYPE':int(a[62]),'CLASSIFICATION_TYPE':a[7],'ELEMENT_SET_NO':int(a[64:68]),'REV_AT_EPOCH':int(b[63:68])}

def main():
    p=argparse.ArgumentParser();p.add_argument('--data-dir',default='data');p.add_argument('--cached-responses',type=pathlib.Path);a=p.parse_args();data=pathlib.Path(a.data_dir);daily={};sources=[];rejected=0
    for ident in [25544,48274]:
        for kind in ['tle','omm']:
            url='https://satchecker.cps.iau.org/tools/get-'+kind+'-data/?'+urllib.parse.urlencode({'id':ident,'id_type':'catalog'})
            cache=a.cached_responses/(f'atlas-{ident}-all-tle.json' if kind=='tle' else f'atlas-{ident}-get-omm-data.json') if a.cached_responses else None
            raw=cache.read_bytes() if cache and cache.exists() else urllib.request.urlopen(url,timeout=90).read()
            sources.append({'id':ident,'url':url,'sha256':hashlib.sha256(raw).hexdigest()})
            for record in json.loads(raw)['data']:
                try:el=tle_omm(record) if kind=='tle' else record['orbital_elements']
                except (ValueError,KeyError):rejected+=1;continue
                if el['NORAD_CAT_ID']!=ident:raise ValueError('Wrong station ID')
                epoch=dt.datetime.fromisoformat(el['EPOCH'].removesuffix('Z'));day=epoch.date().isoformat();noon=epoch.replace(hour=12,minute=0,second=0,microsecond=0);rank=abs((epoch-noon).total_seconds());key=(ident,day)
                if key not in daily or rank<daily[key][0]:daily[key]=(rank,el)
    rows=[daily[key][1] for key in sorted(daily)];destination=data/'gp-import-stations-history.json';tmp=destination.with_suffix('.tmp');tmp.write_text(json.dumps(rows,separators=(',',':')));tmp.replace(destination)
    metadata={'source':'IAU CPS SatChecker · CelesTrak / Space-Track','documentation':'https://satchecker.readthedocs.io/en/latest/tools_data_access.html','fetched_at':dt.datetime.now(UTC).isoformat(),'sampling':'one actual observation nearest noon UTC per station and available day','sources':sources,'rejected_tles':rejected,'stations':{str(i):{'observations':sum(r['NORAD_CAT_ID']==i for r in rows),'first_epoch':min(r['EPOCH'] for r in rows if r['NORAD_CAT_ID']==i),'last_epoch':max(r['EPOCH'] for r in rows if r['NORAD_CAT_ID']==i)} for i in [25544,48274]}}
    (data/'station-history-source.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata['stations'],indent=2));print('Rejected invalid TLEs:',rejected)
if __name__=='__main__':main()
