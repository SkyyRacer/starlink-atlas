"""Lossless, page-scoped browser payloads and content-addressed lazy resources."""
import pathlib
import copy,datetime as dt,gzip,hashlib,json,re
UTC=dt.timezone.utc

def encode(value):return json.dumps(value,separators=(',',':'),ensure_ascii=False).encode()
def write_resource(out,label,value):
    encoded=gzip.compress(encode(value),mtime=0)
    filename=f'data/{label}-{hashlib.sha256(encoded).hexdigest()[:20]}.json.gz'
    (out/filename).write_bytes(encoded)
    return filename

def prepare_live(bundle,history,updates,now):
    # This is exactly the same seven-day window the browser previously fetched.
    day=now.date();rows=list(bundle['orbits']);manifest=bundle['catalog_response'].get('history') or {}
    for offset in range(-3,4):
        stamp=(day+dt.timedelta(days=offset)).isoformat()
        for path in [history/(stamp+'.json.gz'),updates/(stamp+'.json.gz')]:
            if path.is_file():
                rows.extend({'elements':r.get('elements',r),'source':r.get('source','Archive publique Julien Simon / Space-Track')} for r in json.loads(gzip.decompress(path.read_bytes())))
            elif path.parent==history and stamp in manifest.get('remote_days',[]):
                # Never claim a complete live window if an archive was unavailable during export.
                return bundle['orbits'],None
    def epoch(row):
        value=dt.datetime.fromisoformat(row['elements']['EPOCH'].replace('Z','+00:00'))
        return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    midnight=dt.datetime.combine(day,dt.time(),UTC)
    start=max(midnight,now-dt.timedelta(minutes=1))
    end=midnight+dt.timedelta(days=1)
    # Exclude elements that cannot be valid anywhere in the live window. Keep
    # the full observations resource for historical dates; do not drop objects.
    def usable(row):
        stamp=epoch(row)
        padding=dt.timedelta(seconds=1)
        if row['source']=='CelesTrak SupGP / SpaceX':
            return stamp<=end+padding and stamp+dt.timedelta(days=1)+padding>=start
        return stamp-dt.timedelta(days=3)-padding<=end and stamp+dt.timedelta(days=3)+padding>=start
    # Keep orphan identifiers too: the engine also counts their unavailable
    # positions, even when no SATCAT lifetime is present for them.
    known={row['NORAD_CAT_ID'] for row in bundle.get('raw_catalog',[])}
    rows=[row for row in rows if usable(row) or ('raw_catalog' in bundle and row['elements']['NORAD_CAT_ID'] not in known)]
    # Keep every element that could be closest at any time from the export to the end of this UTC day.
    # A future-dated or obsolete object must not disable the fast path for all pages.
    bounds={}
    for row in rows:
        key=(row['elements']['NORAD_CAT_ID'],row['source']);stamp=epoch(row)
        before,after=bounds.get(key,(None,None))
        if stamp<start:before=max(before,stamp) if before else stamp
        if stamp>=end:after=min(after,stamp) if after else stamp
        bounds[key]=(before,after)
    live=[];seen=set()
    for row in rows:
        key=(row['elements']['NORAD_CAT_ID'],row['source']);stamp=epoch(row);before,after=bounds[key]
        if (before is None or stamp>before-dt.timedelta(seconds=1)) and (after is None or stamp<after+dt.timedelta(seconds=1)):
            identity=encode(row)
            if identity not in seen:live.append(row);seen.add(identity)
    return live,{'from':start.isoformat(),'until':end.isoformat()}

def build_resources(out,bundle,history,updates,now):
    live_rows,window=prepare_live(bundle,history,updates,now)
    resources={}
    definitions=json.loads((pathlib.Path(__file__).resolve().parents[1]/'resources/constellations.json').read_text())
    identities={}
    def family(row):
        ident=row.get('id',row.get('NORAD_CAT_ID'));name=row.get('name',row.get('OBJECT_NAME',''))
        return row.get('family') or identities.get(ident) or ('iss' if ident==25544 else 'gps' if re.match(r'^(?:GPS (?:B|III)|NAVSTAR \d)',name) else 'galileo' if re.match(r'^(?:GSAT\d{4}(?:\s|\(|$)|GIOVE-[AB]|GALILEO(?:[ -]|$))',name) else 'starlink')
    identities={row['id']:family(row) for row in bundle['catalog_response']['satellites']}
    scopes={row['id']:row.get('collections',[family(row)]) for row in bundle['catalog_response']['satellites']}
    def belongs(ident,mode):return mode in scopes.get(ident,[])
    archive_days=[(file,json.loads(gzip.decompress(file.read_bytes()))) for file in sorted(updates.glob('*.json.gz'))]
    from retired_resources import refresh
    import itertools
    refresh(out,bundle['catalog_response']['satellites'],itertools.chain(bundle['orbits'],*(rows for _,rows in archive_days)))
    navigation_histories={}
    for definition in definitions:
        constellation=definition['id']
        if constellation=='starlink':continue
        navigation_history=copy.deepcopy(bundle['catalog_response'].get('history') or {'days':{},'local_days':[],'local_files':{},'remote_days':[],'remote_base':None,'observations':0})
        navigation_history['source_label']='Archives publiques et collectes locales · '+definition['label']
        epochs=[]
        for file,observed in archive_days:
            rows=[row for row in observed if belongs(row.get('elements',row)['NORAD_CAT_ID'],constellation)]
            if not rows:continue
            day=file.name[:10];navigation_history['days'][day]=len(rows);navigation_history['local_days']=list(dict.fromkeys([*navigation_history['local_days'],day]));navigation_history['local_files'][day]=write_resource(out,constellation+'-day-'+day,rows);navigation_history['observations']+=len(rows);epochs.extend(row.get('elements',row)['EPOCH'] for row in rows)
        if epochs:navigation_history.update(first_epoch=min([*epochs,*([navigation_history['first_epoch']] if navigation_history.get('first_epoch') else [])]),last_epoch=max([*epochs,*([navigation_history['last_epoch']] if navigation_history.get('last_epoch') else [])]))
        navigation_histories[constellation]=navigation_history
        resources[constellation+'_history']=write_resource(out,constellation+'-history',navigation_history)
    for key in ['config','sources','iss_missions','iss_evas','tiangong_missions']:
        if key in bundle:resources[key]=write_resource(out,key,bundle[key])
    manifest=bundle['catalog_response'].get('history')
    if manifest:resources['history']=write_resource(out,'history-index',manifest)
    # Per-object metadata is not needed to draw or search the constellation.
    details={}
    latest={}
    for item in bundle['orbits']:
        el=item['elements'];ident=el['NORAD_CAT_ID']
        if ident not in latest or el['EPOCH']>latest[ident]['EPOCH']:latest[ident]=el
    raw_details={row['NORAD_CAT_ID']:row for row in bundle['raw_catalog']}
    def orbit_info(ident):
        el=latest.get(ident)
        if el:return {'mean_motion':el['MEAN_MOTION'],'eccentricity':el['ECCENTRICITY'],'inclination':el['INCLINATION'],'epoch':el['EPOCH']}
        raw=raw_details.get(ident,{})
        try:return {'perigee_km':float(raw['PERIGEE']),'apogee_km':float(raw['APOGEE']),'period_minutes':float(raw['PERIOD']) if raw.get('PERIOD') not in [None,''] else None,'inclination':float(raw['INCLINATION']) if raw.get('INCLINATION') not in [None,''] else None}
        except (ValueError,TypeError,KeyError):return None
    slim=[]
    for satellite in bundle['catalog_response']['satellites']:
        row=dict(satellite);verification=row.pop('verification',None);slim.append(row)
        orbit=orbit_info(row['id'])
        if verification or orbit:details.setdefault(str(row['id']//1000),{})[str(row['id'])]={'verification':verification,'orbit':orbit,'orbit_check':bundle.get('orbit_checks',{}).get('objects',{}).get(str(row['id']))}
    resources['details']={key:write_resource(out,'details-'+key,rows) for key,rows in details.items()}
    collections={}
    for mode in ['all',*[row['id'] for row in definitions]]:
        accept=lambda ident: mode=='all' or belongs(ident,mode)
        catalog=copy.copy(bundle['catalog_response']);catalog['satellites']=[s for s in slim if accept(s['id'])]
        # The detailed archive index is fetched only when a historic date needs it.
        active_history=navigation_histories.get(mode,manifest)
        if active_history:catalog['history']={k:v for k,v in active_history.items() if k not in ['days','remote_days','local_days','local_files','remote_base']}
        if mode=='debris':catalog['source']='https://celestrak.org/pub/satcat.csv'
        elif mode in navigation_histories:catalog['source']='https://celestrak.org/NORAD/elements/gp.php?GROUP='+next(row['group'] for row in definitions if row['id']==mode)+'&FORMAT=JSON'
        current=[r for r in bundle['orbits'] if accept(r['elements']['NORAD_CAT_ID'])]
        live=[r for r in live_rows if accept(r['elements']['NORAD_CAT_ID'])]
        # Field names and source labels appear once; values retain their exact JSON precision.
        fields=sorted({key for row in current+live for key in row['elements']})
        sources=list(dict.fromkeys(row['source'] for row in current+live))
        pack=lambda rows:[[sources.index(r['source']),*[r['elements'].get(k) for k in fields]] for r in rows]
        raw=[{k:v for k,v in r.items() if k in ['NORAD_CAT_ID','LAUNCH_DATE','DECAY_DATE']} for r in bundle['raw_catalog'] if accept(r['NORAD_CAT_ID'])]
        gcat={key:{'launch_time':value['launch_time']} for key,value in bundle['gcat'].items() if accept(int(key)) and value.get('launch_time')}
        payload={'orbit_fields':fields,'orbit_sources':sources,'packed_orbits':[],'packed_live':pack(live),'live_window':window,'raw_catalog':raw,'gcat':gcat}
        observations={'orbit_fields':fields,'orbit_sources':sources,'packed_orbits':pack(current)}
        collections[mode]={'catalog':write_resource(out,'catalog-'+mode,catalog),'engine':write_resource(out,'orbits-'+mode,payload),'observations':write_resource(out,'observations-'+mode,observations)}
    return resources,collections
