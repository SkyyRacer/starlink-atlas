"""Check the native API and real live coverage before opening the public service."""
import argparse,collections,datetime as dt,json,urllib.request

def coverage(satellites,points,now):
    def parse(value):
        if not value:return None
        parsed=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
        return parsed.replace(tzinfo=dt.timezone.utc) if parsed.tzinfo is None else parsed
    active=[s for s in satellites if (not parse(s.get('launch')) or parse(s['launch'])<=now) and (not parse(s.get('decay')) or parse(s['decay'])>now)]
    visible={p['id'] for p in points};issues=[];partial=[]
    starlink=[s for s in active if s.get('name','').startswith('STARLINK')]
    if not points:issues.append('Aucune position actuelle disponible.')
    if len(starlink)>=1000 and sum(s['id'] in visible for s in starlink)<len(starlink)*.8:issues.append('Moins de 80 % des Starlink attendus disposent de positions actuelles.')
    for family in ['gps','galileo','glonass','beidou','oneweb','iridium']:
        members=[s for s in active if s.get('family')==family or family in s.get('collections',[])]
        if len(members)<10:continue
        count=sum(s['id'] in visible for s in members)
        if count<len(members)*.5:issues.append(f'{family} : couverture insuffisante ({count}/{len(members)}).')
        elif count<len(members)*.7:partial.append(f'{family} : couverture partielle ({count}/{len(members)}).')
    for ident in [25544,48274]:
        if any(s['id']==ident for s in active) and ident not in visible:issues.append(f'Position actuelle de la station {ident} absente.')
    return {'positions':len(visible),'blocking':issues,'warnings':partial}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('url',nargs='?',default='http://127.0.0.1:3000');a=p.parse_args();base=a.url.rstrip('/')
    def read(path):
        with urllib.request.urlopen(base+path,timeout=90) as response:return json.load(response)
    read('/api/config');catalog=read('/api/catalog?collection=all');positions=read('/api/positions?collection=all')
    result=coverage(catalog['satellites'],positions['points'],dt.datetime.now(dt.timezone.utc))
    print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(1 if result['blocking'] else 0)
