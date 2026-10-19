"""Lossless, page-scoped browser payloads and content-addressed lazy resources."""
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
    maximum=max(map(epoch,rows),default=now)
    latest={}
    for row in rows:
        key=(row['elements']['NORAD_CAT_ID'],row['source'])
        latest[key]=max(latest.get(key,epoch(row)),epoch(row))
    # SGP4 source selection compares whole seconds; keep every near-tie in its
    # original current-feed / archive order, including sub-millisecond epochs.
    live=[];seen=set()
    for row in rows:
        key=(row['elements']['NORAD_CAT_ID'],row['source'])
        if latest[key]-epoch(row)<dt.timedelta(seconds=1):
            identity=encode(row)
            if identity not in seen:live.append(row);seen.add(identity)
    start=max(maximum,dt.datetime.combine(day,dt.time(),UTC))
    end=dt.datetime.combine(day+dt.timedelta(days=1),dt.time(),UTC)
    window={'from':start.isoformat(),'until':end.isoformat()} if start<end else None
    return live,window

def build_resources(out,bundle,history,updates,now):
    live_rows,window=prepare_live(bundle,history,updates,now)
    resources={}
    def family(row):
        ident=row.get('id',row.get('NORAD_CAT_ID'));name=row.get('name',row.get('OBJECT_NAME',''))
        return row.get('family') or ('iss' if ident==25544 else 'gps' if re.match(r'^(?:GPS (?:B|III)|NAVSTAR \d)',name) else 'galileo' if re.match(r'^(?:GSAT\d{4}(?:\s|\(|$)|GIOVE-[AB]|GALILEO(?:[ -]|$))',name) else 'starlink')
    identities={row['id']:family(row) for row in bundle['catalog_response']['satellites']}
    navigation_histories={}
    for constellation in ['galileo','gps']:
        navigation_history={'days':{},'local_days':[],'local_files':{},'remote_days':[],'remote_base':None,'observations':0,'source_label':'CelesTrak '+('GPS' if constellation=='gps' else 'Galileo')+' · collectes locales'}
        epochs=[]
        for file in sorted(updates.glob('*.json.gz')):
            rows=[row for row in json.loads(gzip.decompress(file.read_bytes())) if family(row.get('elements',row))==constellation]
            if not rows:continue
            day=file.name[:10];navigation_history['days'][day]=len(rows);navigation_history['local_days'].append(day);navigation_history['local_files'][day]=write_resource(out,constellation+'-day-'+day,rows);navigation_history['observations']+=len(rows);epochs.extend(row.get('elements',row)['EPOCH'] for row in rows)
        if epochs:navigation_history.update(first_epoch=min(epochs),last_epoch=max(epochs))
        navigation_histories[constellation]=navigation_history
        resources[constellation+'_history']=write_resource(out,constellation+'-history',navigation_history)
    for key in ['config','sources','iss_missions','iss_evas']:
        if key in bundle:resources[key]=write_resource(out,key,bundle[key])
    manifest=bundle['catalog_response'].get('history')
    if manifest:resources['history']=write_resource(out,'history-index',manifest)
    # Per-object metadata is not needed to draw or search the constellation.
    details={}
    slim=[]
    for satellite in bundle['catalog_response']['satellites']:
        row=dict(satellite);verification=row.pop('verification',None);slim.append(row)
        if verification:details.setdefault(str(row['id']//1000),{})[str(row['id'])]={'verification':verification}
    resources['details']={key:write_resource(out,'details-'+key,rows) for key,rows in details.items()}
    collections={}
    for mode in ['all','galileo','gps','iss','starlink']:
        accept=lambda ident: mode=='all' or identities.get(ident)==mode
        catalog=copy.copy(bundle['catalog_response']);catalog['satellites']=[s for s in slim if accept(s['id'])]
        # The detailed archive index is fetched only when a historic date needs it.
        active_history=navigation_histories.get(mode,manifest)
        if active_history:catalog['history']={k:v for k,v in active_history.items() if k not in ['days','remote_days','local_days','local_files','remote_base']}
        if mode in navigation_histories:catalog['source']='https://celestrak.org/NORAD/elements/gp.php?GROUP='+('gps-ops' if mode=='gps' else mode)+'&FORMAT=JSON'
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
