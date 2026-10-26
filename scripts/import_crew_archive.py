"""Import GCAT human-spaceflight records, preserving visits and whole-career rides.
Never infer station occupancy from a launch alone, or add EVA time to flight time.
"""
import argparse, csv, datetime as dt, hashlib, json, pathlib, re, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://planet4589.org/space/astro/tsv/'
FILES = ['astro', 'rides', 'segments', 'missions', 'expeditions', 'evas', 'roletags']
STATIONS = {'ISS':['iss'], 'Mir':['mir'], 'Skylab':['skylab'], 'Skylab 1':['skylab'],
 'Salyut-1':['salyut-1'], 'Salyut 3':['salyut','almaz'], 'Salyut 4':['salyut'],
 'Salyut 5':['salyut','almaz'], 'Salyut 6':['salyut'], 'Salyut 7':['salyut'],
 'TG':['tiangong'], 'TG1':['tiangong-1'], 'TG2':['tiangong-2']}
def stamp(value):
    m = re.fullmatch(r'(\d{4})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2})(\d{2})(?::(\d{2}))?\??', value.strip())
    if not m:return None
    y,month,d,h,minute,sec=m.groups()
    try:return dt.datetime(int(y),dt.datetime.strptime(month,'%b').month,int(d),int(h),int(minute),int(sec or 0),tzinfo=dt.timezone.utc).isoformat().replace('+00:00','Z')
    except ValueError:return None
def seconds(value):
    if not re.fullmatch(r'\d+(?::\d+){2,3}',value):return None
    parts=[int(v) for v in value.split(':')]
    if len(parts)==3:parts.append(0)
    return parts[0]*86400+parts[1]*3600+parts[2]*60+parts[3]
def build(source, output):
    tables={};sources=[]
    for name in FILES:
        raw=(source/(name+'.tsv')).read_bytes();lines=raw.decode().splitlines()
        sources.append({'url':BASE+name+'.tsv','sha256':hashlib.sha256(raw).hexdigest(),'updated':next((l.removeprefix('# Updated').strip() for l in lines if l.startswith('# Updated')),'')})
        tables[name]=[{k:(v or '').strip() for k,v in r.items()} for r in csv.DictReader(lines,delimiter='\t') if not (next(iter(r.values())) or '').startswith('#')]
    nationalities=json.loads((ROOT/'resources/astronaut-nationalities.json').read_text())
    people={}
    for a in tables['astro']:
        if not a['#No'].startswith('AS-'):continue
        surname,sep,given=a['Name'].partition(', ')
        if not sep:surname,_,given=a['Name'].partition(' ')
        surname=re.sub(r'\s*\([^)]*\)','',surname).strip()
        given=re.sub(r'\s*\([^)]*\)','',given).split(',')[0].strip()
        country=nationalities['codes'].get(a['Citizen'],{'code':a['Citizen'],'name':a['Citizen']})
        nationality=nationalities['people'].get(a['#No'],{}).get('nationalities',[country])
        nationality=[dict(n,source_code=a['Citizen'],source=nationalities['people'].get(a['#No'],{}).get('source',nationalities['country_codes_source'])) for n in nationality]
        people[a['#No']]={'id':a['#No'],'name':a['Name'] if not sep else given+' '+surname,'family_name':surname,'given_name':given.split(' ')[0], 'aliases':[n+' '+surname for n in re.findall(r"'([^']+)'",given)],
          'nationalities':nationality, 'agency':None,
          'flights':[], 'source_total_seconds':seconds(a['Duration'].rstrip('*')),
          'source_total_ongoing':a['Duration'].endswith('*'), 'expected_flights':int(a['NFL']) if a['NFL'].isdigit() else None}
    roles={r['#Tag']:r['Translation'] for r in tables['roletags']}
    missions={r['#HSFID']:r for r in tables['missions']}
    stations={key:{'crew':[],'flights':[],'visits':[],'history_complete':False,'source':'GCAT · J. McDowell','source_url':'https://planet4589.org/space/astro/web/','fetched_at':dt.datetime.now(dt.timezone.utc).isoformat()} for key in sorted({s for group in STATIONS.values() for s in group})}
    def station_keys(value):return STATIONS.get(value.replace('Salyut-','Salyut ') if value!='Salyut-1' else value,[])
    def person(ident,role='',agency=None):
        a=people[ident]
        return {k:v for k,v in a.items() if k not in {'flights','source_total_seconds','expected_flights','source_total_ongoing'}}|{'role':role,'agency':agency,'agency_abbrev':agency}
    flights={}
    for r in tables['rides']:
        if r['ID'] not in people:continue
        m=missions.get(r['HSFID']);start=stamp(r['LDate'])
        if not m or not start:continue
        duration=seconds(r['Duration'].rstrip('*'));ongoing=r['Duration'].endswith('*')
        end=(dt.datetime.fromisoformat(start.replace('Z','+00:00'))+dt.timedelta(seconds=duration)).isoformat().replace('+00:00','Z') if duration is not None and not ongoing else None
        role=roles.get(r['RoleCode'].split('/')[-1],r['Role'])
        a=person(r['ID'],role,r['Employer'] if r['Employer']!='-' else None)
        f=flights.setdefault(m['#HSFID'],{'id':m['#HSFID'],'name':m['Ship'],'launch':stamp(m['LDate']) or start,'end':stamp(m['EDate']),'precision':'Minute','status_id':3,'status':'Vol documenté','spacecraft':m['Ship'],'crew':[],'landing_crew':[],'url':BASE+'missions.tsv','station':m['Station']})
        if not any(p['id']==a['id'] for p in f['crew']):f['crew'].append(a)
        # Rides use one row for a continuous trip, even with changes of vehicle.
        people[r['ID']]['flights'].append({'id':r['RoleCode'],'name':r['Mission'],'launch':start,'end':end,'duration_seconds':duration,'ongoing':ongoing})
    for f in flights.values():
        for key in station_keys(f['station']):stations[key]['flights'].append(f)
    expeditions={r['HSFTAG']:r for r in tables['expeditions']}
    for s in tables['segments']:
        ident=s['ID'];e=expeditions.get(s['SegRoleCode'].split('/')[0])
        if ident not in people or not e:continue
        # Soyuz 10 docked but its crew never entered Salyut 1.
        if e['HSFTAG']=='D1EX1' or 'soft dock' in e['Ship'].lower():continue
        start,end=stamp(s['Date1']),stamp(s['Date2'])
        if not start:continue
        role=roles.get(s['SegRoleCode'].split('/')[-1],s['Role'])
        visit={'person':person(ident,role),'arrival':start,'departure':end,'mission':e['Ship'],'role':role,'approximate':'?' in s['Date1']+s['Date2']}
        for key in station_keys(e['Station']):stations[key]['visits'].append(visit)
    evas=[]
    for n,e in enumerate(tables['evas']):
        if e['ID'] not in people:continue
        start,end=stamp(e['Depress_Time']),stamp(e['Repress_Time'])
        if not start:continue
        # One participant record, with the explicitly named depressurisation convention.
        duration=e['Dur(DP)'];minutes=None
        if re.fullmatch(r'\d+:\d{2}',duration):h,m=map(int,duration.split(':'));minutes=h*60+m
        evas.append({'id':'gcat-eva-'+str(n),'name':e['#EVA_Name'],'start':start,'end':end,'duration':f'PT{minutes}M' if minutes is not None else None,'location':e['Ship'],'crew':[{'id':e['ID'],'name':people[e['ID']]['name']}]})
    doc={'source':'GCAT · J. McDowell · CC BY 4.0','sources':sources,'updated':sources[0]['updated'],'observed_at':dt.datetime.strptime(sources[0]['updated'],'%Y %b %d %H%M:%S').replace(tzinfo=dt.timezone.utc).isoformat(),'stations':stations,'people':people,'spacewalks':evas}
    output.parent.mkdir(parents=True,exist_ok=True);tmp=output.with_suffix('.tmp');tmp.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':')));tmp.replace(output)
    print(json.dumps({'people':len(people),'rides':sum(len(a['flights']) for a in people.values()),'eva_participations':len(evas),'stations':{k:{'flights':len(v['flights']),'visits':len(v['visits'])} for k,v in stations.items()}},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source-dir',type=pathlib.Path,required=True);p.add_argument('--download',action='store_true');p.add_argument('--output',type=pathlib.Path,default=ROOT/'static/crew-archive.json');a=p.parse_args()
    if a.download:
        a.source_dir.mkdir(parents=True,exist_ok=True)
        marker=a.source_dir/'collected-at.txt'
        try:recent=time.time()-float(marker.read_text())<86400 and all((a.source_dir/(n+'.tsv')).is_file() for n in FILES)
        except (OSError,ValueError):recent=False
        if not recent:
            downloaded={}
            for name in FILES:
                raw=urllib.request.urlopen(BASE+name+'.tsv',timeout=45).read()
                if len(raw)<100 or not raw.startswith(b'#'):raise ValueError('Invalid GCAT response: '+name)
                downloaded[name]=raw
            for name,raw in downloaded.items():(a.source_dir/(name+'.tsv')).write_bytes(raw)
            marker.write_text(str(time.time()))
    build(a.source_dir,a.output)
