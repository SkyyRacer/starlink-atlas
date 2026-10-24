"""Rebuild reviewed mission groups from public identities, without inventing orbits.
No network request: --satcat is a validated public cache; GCAT evidence is pinned.
"""
import argparse,csv,datetime as dt,hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
def dump(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def resolve(rule,master,evidence):
 matches=rule['match'];output=[]
 for ident,row in master.items():
  if row['OBJECT_TYPE']!='PAY':continue
  proof=evidence.get(str(ident),{});reasons=[]
  if ident in matches.get('ids',[]):reasons.append('reviewed-norad')
  if any(re.search(p,row['OBJECT_NAME'],re.I) for p in matches['names']):reasons.append('satcat-name')
  if any(re.search(p,proof.get('Program',''),re.I) for p in matches['gcat_program']):reasons.append('gcat-program')
  for field,patterns in matches['gcat_fields'].items():
   if any(re.search(p,proof.get(field,''),re.I) for p in patterns):reasons.append('gcat-'+field)
  if reasons:output.append((ident,row,reasons))
 return output
# Public name prefixes continue to catch future additions between identity reviews.
PREFIXES={
 'intelsat':['INTELSAT '],'eutelsat':['EUTELSAT ','HOT BIRD '],'astra':['ASTRA '],
 'telesat':['ANIK '],'hispasat':['HISPASAT '],'turksat':['TURKSAT '],'asiasat':['ASIASAT '],
 'chinasat':['CHINASAT ','ZHONGXING '],'jcsat':['JCSAT '],'optus':['OPTUS ','AUSSAT '],
 'telkom':['TELKOM '],'palapa':['PALAPA '],'ekspress':['EXPRESS-','EXPRESS ','EKSPRESS '],
 'yamal':['YAMAL '],'gorizont':['GORIZONT '],'molniya':['MOLNIYA '],'raduga':['RADUGA '],
 'ekran':['EKRAN '],'milstar':['MILSTAR '],'aehf':['AEHF '],'wgs':['WGS '],'muos':['MUOS '],
 'skynet':['SKYNET '],'syracuse':['SYRACUSE '],'sicral':['SICRAL '],'spainsat':['SPAINSAT '],
 'guowang':['GUOWANG ','SATNET '],'galaxyspace':['YINHE-','GALAXYSPACE '],'lynk':['LYNK ','LYNKTOWER '],
 'hiber':['HIBER-'],'kepler-comms':['KEPLER-'],'kineis':['KINEIS-','KINEIS '],'myriota':['MYRIOTA '],
 'astrocast':['ASTROCAST-','ASTROCAST '],'luch':['LUCH '],
 'soyuz':['SOYUZ '],'progress':['PROGRESS '],'shenzhou':['SHENZHOU '],'tianzhou':['TIANZHOU '],
 'space-shuttle':['STS-'],'cygnus':['CYGNUS '],'starliner':['STARLINER '],
 'cso':['CSO-'],'ceres':['CERES '],'landsat':['LANDSAT '],'spot':['SPOT '],
 'pleiades':['PLEIADES '],'worldview':['WORLDVIEW-'],'kompsat':['KOMPSAT '],
 'gaofen':['GAOFEN-'],'yaogan':['YAOGAN '],'jilin':['JILIN-'],'superview':['SUPERVIEW '],
 'risat':['RISAT-'],'cartosat':['CARTOSAT-'],'resourcesat':['RESOURCESAT-'],
 'egyptsat':['EGYPTSAT-'],'dubaisat':['DUBAISAT-'],'gokturk':['GOKTURK-'],
 'noaa-poes':['NOAA '],'dmsp':['DMSP '],'meteor':['METEOR '],'elektro-l':['ELEKTRO-L '],
 'insat':['INSAT-'],'jason':['JASON '],'arctica-m':['ARKTIKA-M '],
 'usa-nrol':['USA ','NROL-'],'sbirs':['SBIRS '],'stss':['STSS '],
 'kondor':['KONDOR-'],'meridian':['MERIDIAN '],'shijian':['SHIJIAN-'],'shiyan':['SHIYAN-'],
 'tjs':['TJS-'],'sar-lupe':['SAR-LUPE '],'sarah':['SARAH-'],'ofek':['OFEQ '],'igs':['IGS '],
}
AGGREGATES={'usa-nrol','pleiades','worldview','kompsat','egnos','waas','heritage-inactive','almaz','transit'}
EPHEMERIDES=json.loads((ROOT/'resources/mission-ephemerides.json').read_text())
DEEP_CONFIG={row['key']:row for row in EPHEMERIDES['missions']+EPHEMERIDES['unavailable']}
DEEP=set(DEEP_CONFIG)|{row['key'] for row in EPHEMERIDES['unavailable']}
def main():
 p=argparse.ArgumentParser();p.add_argument('--satcat',type=pathlib.Path,default=ROOT/'data-seed/satcat-all.csv');p.add_argument('--seed-dir',type=pathlib.Path,default=ROOT/'data-seed');a=p.parse_args()
 master={int(r['NORAD_CAT_ID']):r for r in csv.DictReader(a.satcat.open())}
 evidence=json.loads((ROOT/'resources/mission-identities.json').read_text())
 rules=json.loads((ROOT/'resources/mission-selection-rules.json').read_text())
 registry=json.loads((ROOT/'resources/constellations.json').read_text());by_id={x['id']:x for x in registry}
 baseline=set(json.loads((ROOT/'resources/collection-baseline.json').read_text())['existing_group_ids'])
 original_owners={i:x['id'] for x in registry if x['id'] in baseline and not x.get('parent') and not x.get('aggregate') for i in x['ids']}
 report={'satcat_source':'https://celestrak.org/pub/satcat.csv','satcat_sha256':hashlib.sha256(a.satcat.read_bytes()).hexdigest(),'gcat_sources':evidence['sources'],'groups':{}}
 # Update Landsat in place so the existing URL, filters and colors survive.
 rules.append({'id':'landsat','label':'Landsat — toutes générations','category':'observation','description':'Archives et générations d’observation Landsat','match':{'names':['^LANDSAT [1-9](?: \\(.*\\))?$'],'gcat_program':[],'gcat_fields':{}}})
 for rule in rules:
  key=rule['id'];matches=resolve(rule,master,evidence['objects']);ids=sorted(i for i,_,_ in matches)
  if not ids:raise ValueError('No verified payload for '+key)
  row=by_id.get(key,{'id':key});row.update(label=rule['label'],description=rule['description'],category=rule['category'],keywords=rule['label']+' '+rule['description']+' satellites histoire',group='active',catalog_queries=[],prefixes=PREFIXES.get(key,[]),contains=[],ids=ids,frame_radius=7500000,orbit_types=[])
  if key not in baseline:row['extension']='historical-2026-10-23'
  if key in AGGREGATES or any(i in original_owners and original_owners[i]!=key for i in ids):row['aggregate']=True
  if key in ['giove','beidou-1']:row['parent']='galileo' if key=='giove' else 'beidou'
  if key in DEEP:row.update(trajectory='horizons',frame_radius=DEEP_CONFIG.get(key,{}).get('frame_radius',250000000000 if key in ['spitzer','kepler','ikaros'] else 2500000000))
  if key in DEEP:row['deep_category']=DEEP_CONFIG.get(key,{}).get('deep_category','Autres missions')
  if key in ['egnos','waas']:row['description']='Satellites hôtes de charges utiles '+key.upper()+', historiques ou actuels';row['data_note']='La présence dans ce groupe ne signifie pas que le relais de navigation émet à la date consultée.'
  if key=='sputnik-1':row['data_note']='Rentrée : 3 janvier 1958 dans le SATCAT local, 4 janvier dans l’historique NASA. Les sources divergent d’un jour ; aucune position n’est inventée pour cette période.'
  types=set()
  for _,m,_ in matches:
   if m['ORBIT_CENTER']!='EA':types.add(m['ORBIT_CENTER']);continue
   try:
    apogee=float(m['APOGEE']);perigee=float(m['PERIGEE']);period=float(m['PERIOD'])
   except ValueError:continue
   types.add('LEO' if apogee<2000 else 'GEO' if 1380<period<1500 and perigee>30000 else 'MEO' if 2000<perigee<30000 and apogee<36000 else 'HEO')
  row['orbit_types']=(DEEP_CONFIG.get(key,{}).get('orbit_types',[('L1' if key in ['dscovr','aditya-l1'] else 'L2' if key=='spektr-rg' else 'HELIO')]) if key in DEEP else sorted(types) if types else ['UNKNOWN'])
  if key=='heritage-inactive':row['data_note']='Mission terminée et présence en orbite sont deux états distincts. ERS-2, rentré en 2024, n’apparaît qu’aux dates historiques disposant de données.'
  unavailable={x['key']:x['reason'] for x in json.loads((ROOT/'resources/mission-ephemerides.json').read_text())['unavailable']}
  if key in unavailable:row['data_note']=unavailable[key]
  if key not in DEEP:
   row['frame_radius']=150000000 if 'HEO' in types else 47000000 if 'GEO' in types else 33000000 if 'MEO' in types else 7500000
  by_id[key]=row
  rows=[]
  for ident,m,reasons in matches:
   values=dict(m);values['NORAD_CAT_ID']=ident
   # SATCAT's numeric fields remain strings exactly as in the checked source.
   rows.append(values)
  a.seed_dir.mkdir(parents=True,exist_ok=True);dump(a.seed_dir/(key+'-catalog.json'),rows)
  report['groups'][key]={'objects':len(ids),'ids':ids,'trajectory':row.get('trajectory','sgp4'),'identities':[{ 'id':i,'name':m['OBJECT_NAME'],'launch':m['LAUNCH_DATE'] or None,'decay':m['DECAY_DATE'] or None,'center':m['ORBIT_CENTER'],'matched_by':reasons} for i,m,reasons in matches]}
 registry=sorted(by_id.values(),key=lambda r:r['id']);dump(ROOT/'resources/constellations.json',registry);dump(ROOT/'resources/mission-catalog-audit.json',report)
 print(json.dumps({'groups':len(registry),'reviewed_groups':len(report['groups']),'verified_objects':len({i for g in report['groups'].values() for i in g['ids']})}))
if __name__=='__main__':main()
