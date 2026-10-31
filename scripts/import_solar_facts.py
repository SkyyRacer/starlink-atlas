"""Import published JPL physical parameters and descriptive mean moon periods.
The latter describe a period only and never replace the Horizons ephemerides.
"""
from html.parser import HTMLParser
from pathlib import Path
import argparse,json,re,hashlib
class Rows(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def finish_cell(self):
  if self.cell is not None and self.row is not None:self.row.append(' '.join(''.join(self.cell).split()))
  self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.finish_cell();self.row=[]
  elif tag in ('td','th'):self.finish_cell();self.cell=[]
 def handle_endtag(self,tag):
  if tag in ('td','th'):self.finish_cell()
  elif tag=='tr':
   self.finish_cell()
   if self.row:self.rows.append(self.row)
   self.row=None
 def handle_data(self,text):
  if self.cell is not None:self.cell.append(text)
def rows(path):p=Rows();p.feed(path.read_text());return p.rows
def num(value):
 m=re.match(r'\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)',value.replace(',',''))
 return float(m[1]) if m else None
def main(folder):
 root=Path(__file__).resolve().parents[1];path=root/'static/solar/catalog.json';catalog=json.loads(path.read_text());bodies={b['id']:b for b in catalog['bodies'] if b['id']}
 names={'Mercury':199,'Venus':299,'Earth':399,'Mars':499,'Jupiter':599,'Saturn':699,'Uranus':799,'Neptune':899}
 for row in rows(folder/'planet-phys.html'):
  if row[0] in names and len(row)>7:
   body=bodies[names[row[0]]];body['physical']={'mean_radius_km':num(row[2]),'mass_kg':num(row[3])*1e24,'rotation_days':num(row[5]),'orbital_years':num(row[6]),'source':'https://ssd.jpl.nasa.gov/planets/phys_par.html'}
 for row in rows(folder/'phys_par.html'):
  if len(row)>=9 and row[2].isdigit() and int(row[2]) in bodies:
   gm=num(row[3]);radius=num(row[6]);facts=bodies[int(row[2])].setdefault('physical',{});facts['source']='https://ssd.jpl.nasa.gov/sats/phys_par/'
   if gm and gm>0:facts['mass_kg']=gm/6.67430e-20
   if radius and radius>0:
    facts['mean_radius_km']=radius
    if not bodies[int(row[2])].get('radii_km'):bodies[int(row[2])]['radii_km']=[radius]*3
 for row in rows(folder/'moon-elements.html'):
  if len(row)>14 and row[3].isdigit() and int(row[3]) in bodies:
   period=num(row[13])
   if period and period>0:bodies[int(row[3])].setdefault('physical',{}).update(orbital_days=period,period_source='https://ssd.jpl.nasa.gov/sats/elem/')
 for body in bodies.values():
  if body['kind']=='moon':
   rate=(body.get('rotation',{}).get('PM') or [0,0])[1]
   if rate:body.setdefault('physical',{})['rotation_days']=360/rate
 for file,url in [('planet-phys.html','https://ssd.jpl.nasa.gov/planets/phys_par.html'),('moon-elements.html','https://ssd.jpl.nasa.gov/sats/elem/')]:
  catalog['sources']=[s for s in catalog['sources'] if s['url']!=url]+[{'url':url,'sha256':hashlib.sha256((folder/file).read_bytes()).hexdigest()}]
 path.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
 print(json.dumps({key:sum(bool(b.get('physical',{}).get(key)) for b in bodies.values()) for key in ['mass_kg','orbital_days','rotation_days']},ensure_ascii=False))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,required=True);main(parser.parse_args().source_dir)
