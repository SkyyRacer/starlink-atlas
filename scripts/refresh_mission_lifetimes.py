"""Rebuild exact public lifetime facts from supplied GCAT/SATCAT snapshots.
Only unambiguous minute/second times agreeing with the SATCAT day are retained.
This utility performs no network request and never guesses missing precision.
"""
import csv,datetime as dt,json,pathlib,re,hashlib,argparse
parser=argparse.ArgumentParser();parser.add_argument('--gcat-satcat',type=pathlib.Path,required=True);parser.add_argument('--launchlog',type=pathlib.Path);args=parser.parse_args();root=pathlib.Path(__file__).resolve().parents[1];args.launchlog=args.launchlog or root/'data/gcat-launchlog.tsv';facts=json.loads((root/'resources/mission-identities.json').read_text());master={r['NORAD_CAT_ID']:r for r in csv.DictReader((root/'data-seed/satcat-all.csv').open())};satcat={};result={}
def parsed(raw):
 raw=' '.join(raw.strip().split())
 for fmt in ['%Y %b %d %H%M:%S','%Y %b %d %H%M']:
  try:return dt.datetime.strptime(raw,fmt).replace(tzinfo=dt.timezone.utc).isoformat().replace('+00:00','Z')
  except ValueError:pass
 return None
with args.gcat_satcat.open() as f:
 for row in csv.DictReader((line for line in f if not line.startswith('# Updated')),delimiter='\t'):
  i=row['Satcat'].strip()
  if not i.isdigit():continue
  i=str(int(i));cat=master.get(i)
  if i not in facts['objects'] or not cat:continue
  end=parsed(row['DDate'])
  if end and end[:10]==cat['DECAY_DATE'] and row['Status'].strip() in ['R','D','L']:result.setdefault(i,{})['decay_time']=end
by_piece={r['OBJECT_ID']:i for i,r in master.items() if i in facts['objects']}
with args.launchlog.open() as f:
 for row in csv.DictReader((line for line in f if not line.startswith('# Updated')),delimiter='\t'):
  i=by_piece.get(row['Piece'].strip())
  if not i:continue
  launch=parsed(row['Launch_Date'])
  if launch and launch[:10]==master[i]['LAUNCH_DATE']:result.setdefault(i,{})['launch_time']=launch
(root/'resources/mission-lifetimes.json').write_text(json.dumps({'sources':facts['sources']+[{'url':'https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv','sha256':hashlib.sha256(args.launchlog.read_bytes()).hexdigest()}],'objects':result},separators=(',',':')))
print('Exact matched dates',len(result),sum('decay_time' in r for r in result.values()));print({i:result.get(i) for i in ['433','37244','16609']})
