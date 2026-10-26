"""Build lazy physical fact shards from a pinned local GCAT satellite catalogue.
No orbit/model geometry is used to estimate physical dimensions or mass.
"""
import argparse,csv,hashlib,json,pathlib,re,datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]

def number(value):
 try:
  n=float(value)
  return n if 0<n<1e9 else None
 except (ValueError,TypeError):return None

def generation(row):
 bus=row.get('Bus','').strip();payload=row.get('PLName','').strip()
 if bus=='Starlink V2MO':return 'V2 Mini optimisé'
 if bus=='Starlink V2MD':return 'V2 Mini · Direct to Cell'
 if bus=='Starlink V2M':return 'V2 Mini'
 if bus.startswith('Starlink V3'):return 'V3'
 if re.search(r'V0\.9',payload):return 'V0.9'
 if re.search(r'V1\.0',payload):return 'V1.0'
 if re.search(r'Starlink Group [2345]-',payload) and bus=='Starlink':return 'V1.5'
 return None

def build(source,data_dir,out,additional=(),launchlog=None,payloadsource=None):
 catalog={}
 for file in [data_dir/'satcat.json',*sorted(data_dir.glob('*-catalog.json')),ROOT/'resources/prototypes-catalog.json']:
  if not file.is_file():continue
  for row in json.loads(file.read_text()):
   ident=row.get('NORAD_CAT_ID',row.get('id'))
   if isinstance(ident,int):catalog[ident]=row
 payloads={}
 if payloadsource:
  with payloadsource.open() as f:payloads={r['#JCAT'].strip():r for r in csv.DictReader(f,delimiter='\t') if (r.get('#JCAT') or '').startswith('S')}
 groups={};counts={'objects':0,'span':0,'length':0,'mass':0,'starlink_generations':0};sources=[]
 for path in [source,*additional]:
  raw=path.read_bytes();dated=next((line.removeprefix('# Updated').strip() for line in raw.decode().splitlines() if line.startswith('# Updated')),'')
  sources.append({'file':path.name,'source':'https://planet4589.org/space/gcat/tsv/cat/'+path.name,'updated':dated,'sha256':hashlib.sha256(raw).hexdigest()})
 def records():
  for path in [source,*additional]:
   with path.open() as file:yield from csv.DictReader(file,delimiter='\t')
 for raw_row in records():
   row={k:(v or '').strip() for k,v in raw_row.items() if k}
   if not row.get('Satcat','').isdigit():continue
   ident=int(row['Satcat']);sat=catalog.get(ident)
   if sat is None or ident in {25544,48274,16609}:continue
   if sat.get('OBJECT_TYPE')=='PAY' and not row.get('Type','').startswith('P'):continue
   if sat.get('OBJECT_TYPE')=='R/B' and not row.get('Type','').startswith('R'):continue
   piece=sat.get('OBJECT_ID',sat.get('designator')) or '';source_piece=row.get('Piece','')
   if re.match(r'^\d{4}-',piece) and re.match(r'^\d{4}-',source_piece):
    if piece!=source_piece:continue
   else:
    # GCAT retains Greek pre-1963 designators. Require the same NORAD,
    # launch day and payload/stage class instead of comparing unlike formats.
    launch=sat.get('LAUNCH_DATE',sat.get('launch')) or ''
    try:source_day=dt.datetime.strptime(row.get('LDate',''),'%Y %b %d').date().isoformat()
    except ValueError:continue
    if source_day!=launch[:10]:continue
    if sat.get('OBJECT_TYPE')=='PAY' and not row.get('Type','').startswith('P'):continue
   span=number(row.get('Span'));length=number(row.get('Length'));mass=number(row.get('Mass'))
   gen=generation(row);flat=gen is not None and (sat.get('OBJECT_NAME',sat.get('name','')) or '').startswith('STARLINK')
   # For a flat Starlink bus, GCAT Length is the thickness; its transverse
   # characteristic dimension records the long side of the panel-shaped body.
   if flat:length=number(row.get('Diameter'));length_flag=row.get('DFlag','')
   else:length_flag=row.get('LFlag','')
   if not any([span,length,mass,gen]):continue
   flags=('s' if span and row.get('SpanFlag') else '')+('l' if length and length_flag else '')+('m' if mass and row.get('MassFlag') else '')
   category=(payloads.get(row.get('#JCAT'),{}).get('Category') or '').strip() or None
   values=[span,length,mass,flags,gen,sat.get('LAUNCH_SITE') or None,None,category]
   groups.setdefault(str(ident//1000),{})[str(ident)]=values
   counts['objects']+=1
   for field,value in [('span',span),('length',length),('mass',mass),('starlink_generations',gen)]:counts[field]+=bool(value)
 counts['physical_objects']=counts['objects'];counts['launch_vehicles']=0
 if launchlog:
  launches={};days={}
  with launchlog.open() as f:
   for row in csv.DictReader(f,delimiter='\t'):
    tag=(row.get('#Launch_Tag') or '').strip();vehicle=(row.get('LV_Type') or '').strip();date=(row.get('Launch_Date') or '').strip()
    if not vehicle or vehicle=='-':continue
    launches.setdefault(tag,set()).add(vehicle)
    match=re.match(r'(\d{4} [A-Za-z]{3}\s+\d{1,2})',date)
    if match:
     try:day=dt.datetime.strptime(match[1],'%Y %b %d').date().isoformat();days.setdefault(day,set()).add(vehicle)
     except ValueError:pass
  for ident,sat in catalog.items():
   piece=sat.get('OBJECT_ID',sat.get('designator')) or '';match=re.match(r'^(\d{4}-\d{3})',piece)
   vehicles=launches.get(match[1],set()) if match else days.get((sat.get('LAUNCH_DATE',sat.get('launch')) or '')[:10],set())
   if not vehicles and match and int(match[1][:4])<1963 and str(ident) in groups.get(str(ident//1000),{}):vehicles=days.get((sat.get('LAUNCH_DATE',sat.get('launch')) or '')[:10],set())
   if len(vehicles)!=1:continue
   values=groups.setdefault(str(ident//1000),{}).setdefault(str(ident),[None,None,None,'',None,sat.get('LAUNCH_SITE') or None,None,None]);values[6]=next(iter(vehicles));counts['launch_vehicles']+=1
 for path,url in [(launchlog,'https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv'),(payloadsource,'https://planet4589.org/space/gcat/tsv/cat/psatcat.tsv')]:
  if path:
   raw=path.read_bytes();sources.append({'file':path.name,'source':url,'sha256':hashlib.sha256(raw).hexdigest(),'updated':next((l.removeprefix('# Updated').strip() for l in raw.decode().splitlines() if l.startswith('# Updated')),'')})
 counts['objects']=sum(len(rows) for rows in groups.values())
 out.mkdir(parents=True,exist_ok=True);files={}
 for group,rows in groups.items():
  data=json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode();name=group+'-'+hashlib.sha256(data).hexdigest()[:12]+'.json';(out/name).write_bytes(data);files[group]=name
 for file in out.glob('*.json'):
  if file.name not in files.values():file.unlink()
 metadata={'source':sources[0]['source'],'updated':sources[0]['updated'],'sha256':sources[0]['sha256'],'catalogues':sources,'fields':['span_m','length_m','mass_kg','approximate_flags','starlink_generation','launch_site','launch_vehicle','mission_category'],'counts':counts,'files':files}
 (ROOT/'resources/object-physical-facts-manifest.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False)+'\n')
 module=ROOT/'static/object-facts.js';text=module.read_text();start=' // GCAT_MANIFEST_BEGIN\n';end=' // GCAT_MANIFEST_END'
 a=text.index(start)+len(start);b=text.index(end,a);text=text[:a]+' const physicalManifest='+json.dumps(metadata,separators=(',',':'),ensure_ascii=False)+';\n'+text[b:];module.write_text(text)
 print(json.dumps(counts,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--additional-source',type=pathlib.Path,action='append',default=[]);p.add_argument('--launchlog',type=pathlib.Path);p.add_argument('--payloadsource',type=pathlib.Path);p.add_argument('--data-dir',type=pathlib.Path,default=ROOT/'data-seed');p.add_argument('--output',type=pathlib.Path,default=ROOT/'static/physical-facts');a=p.parse_args();build(a.source,a.data_dir,a.output,a.additional_source,a.launchlog,a.payloadsource)
