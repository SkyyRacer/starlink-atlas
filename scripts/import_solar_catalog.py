"""Build the local solar-system catalogue from JPL discovery and NAIF PCK data.
Unpublished radii and unresolvable Horizons identities remain unknown.
"""
import argparse, hashlib, html.parser, json, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
PLANETS=[('soleil','Soleil',10),('mercure','Mercure',199),('venus','Vénus',299),('terre','Terre',399),('mars','Mars',499),('jupiter','Jupiter',599),('saturne','Saturne',699),('uranus','Uranus',799),('neptune','Neptune',899)]
PARENTS={'Mars':'mars','Jupiter':'jupiter','Saturn':'saturne','Uranus':'uranus','Neptune':'neptune'}
class Tables(html.parser.HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.stack=[];self.cells=[]
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.stack.append([])
  elif tag in {'td','th'} and self.stack:self.cells.append([])
 def handle_data(self,value):
  for cell in self.cells:cell.append(value)
 def handle_endtag(self,tag):
  if tag in {'td','th'} and self.cells:
   cell=' '.join(' '.join(self.cells.pop()).split())
   if self.stack:self.stack[-1].append(cell)
  elif tag=='tr' and self.stack:self.rows.append(self.stack.pop())
def normalize(value):return re.sub('[^a-z0-9]','',value.lower())
def provisional(value):
 m=re.search(r'(?:S\s*/?\s*)?(\d{4})[_\s]*(?:\()?([JSMUNPE])[_\s]*(\d+)',value,re.I)
 return 's'+m[1]+m[2].lower()+str(int(m[3])) if m else normalize(value)
def build(source):
 sources=[]
 for file,url in [('discovery.html','https://ssd.jpl.nasa.gov/sats/discovery.html'),('phys_par.html','https://ssd.jpl.nasa.gov/sats/phys_par/'),('pck00011.tpc','https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc'),('major-bodies.json','https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND=MB&MAKE_EPHEM=NO')]:
  sources.append({'url':url,'sha256':hashlib.sha256((source/file).read_bytes()).hexdigest()})
 pck=(source/'pck00011.tpc').read_text();active=False;data=[]
 for line in pck.splitlines():
  if line.strip()=='\\begindata':active=True
  elif line.strip()=='\\begintext':active=False
  elif active:data.append(line)
 parameters={}
 for code,key,value in re.findall(r'BODY(\d+)_(\w+)\s*=\s*\(([^)]*)\)','\n'.join(data),re.S):
  parameters.setdefault(code,{})[key]=[float(v.replace('D','E')) for v in re.findall(r'[+-]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][+-]?\d+)?',value)]
 raw=json.loads((source/'major-bodies.json').read_text())['result'];identities={}
 for line in raw.splitlines():
  m=re.match(r'\s*(-?\d+)\s{2}',line)
  if not m:continue
  ident=int(m[1])
  if not 300<=ident<100000:continue
  fields=[line[11:45].strip(),line[45:57].strip(),*line[57:].split()]
  for value in fields:
   if value:identities.setdefault(provisional(value),set()).add(ident)
 physical=Tables();physical.feed((source/'phys_par.html').read_text());radii={}
 for row in physical.rows:
  if len(row)>=6 and row[2].isdigit():
   match=re.match(r'([\d.]+)',row[4])
   if match:radii[int(row[2])]=float(match[1])
 def geometry(ident):
  values=parameters.get(str(ident),{});radius=values.get('RADII')
  if not radius and ident in radii:radius=[radii[ident]]*3
  rotation={k:v for k,v in values.items() if k in {'POLE_RA','POLE_DEC','PM','NUT_PREC_RA','NUT_PREC_DEC','NUT_PREC_PM'}}
  group=str(ident//100) if ident>=100 else str(ident)
  angles=parameters.get(group,{}).get('NUT_PREC_ANGLES',[])
  return {'radii_km':radius,'rotation':rotation,'nutation_angles':angles}
 bodies=[{'key':key,'name':name,'id':ident,'kind':'star' if ident==10 else 'planet','parent':None if ident==10 else 'soleil',**geometry(ident)} for key,name,ident in PLANETS]
 discovery=Tables();discovery.feed((source/'discovery.html').read_text());parent=None;missing=[]
 for row in discovery.rows:
  if len(row)==1 and row[0].startswith('Satellites of'):
   parent=next((key for label,key in PARENTS.items() if re.search(r'\b'+label+r'\b',row[0])),None);continue
  if parent is None or len(row)!=6:continue
  roman,name,designation,year,discoverer,reference=row;label=name or designation
  if not label:continue
  candidates=identities.get(provisional(name),set()) if name else set()
  if not candidates:candidates=identities.get(provisional(designation),set())
  prefix=str(dict((k,i) for k,_,i in PLANETS)[parent])[0]
  candidates={i for i in candidates if str(i).startswith(prefix)}
  ident=next(iter(candidates)) if len(candidates)==1 else None
  if ident is None:missing.append({'name':label,'parent':parent,'designation':designation})
  bodies.append({'key':'moon-'+str(ident) if ident else parent+'-'+normalize(label),'name':label,'id':ident,'kind':'moon','parent':parent,'designation':designation or None,'discovered':year,'reference':reference,**(geometry(ident) if ident else {'radii_km':None,'rotation':{},'nutation_angles':[]})})
 bodies.append({'key':'lune','name':'Lune','id':301,'kind':'moon','parent':'terre',**geometry(301)})
 result={'frame':'ICRF','origin':'Earth center (399)','time_scale':'UTC','sources':sources,'bodies':bodies,'unresolved':missing}
 output=ROOT/'static/solar/catalog.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 print(json.dumps({'bodies':len(bodies),'moons_by_parent':{p:sum(b['kind']=='moon' and b['parent']==p for b in bodies) for p in ['terre',*PARENTS.values()]},'unknown_identity':missing,'radii':sum(bool(b['radii_km']) for b in bodies)},indent=2,ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source-dir',type=pathlib.Path,required=True);a=p.parse_args();build(a.source_dir)
