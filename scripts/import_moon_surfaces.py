"""Import documented planetary-moon mosaics. Never upscale, never invent gaps.
Requires Pillow for verifying and downscaling observational image assets.
"""
import hashlib,io,json,pathlib,re,urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'static/solar/moons';OUT.mkdir(parents=True,exist_ok=True)
class Table(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.links=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='tr':self.row=[];self.links=[]
  if t=='a' and self.row is not None:self.links.append(d.get('href',''))
 def handle_data(self,d):
  if self.row is not None:self.row.append(d)
 def handle_endtag(self,t):
  if t=='tr' and self.row is not None:self.rows.append((' '.join(self.row),self.links));self.row=None
catalog=json.loads((ROOT/'static/solar/catalog.json').read_text());byname={b['name'].lower():b for b in catalog['bodies'] if b['kind']=='moon'}
manifest={'sources':[],'bodies':{'301':{'path':'images/moon/lroc-4k.webp','source':'https://svs.gsfc.nasa.gov/4720/','width':4096,'height':2048,'credit':'NASA LRO / SVS','longitude_offset':.5,'longitude_sign':1,'note':'Mosaïque de référence LRO ; sphère sans relief local.'}}}
def store(body,url,source,credit,offset=.5,sign=1,note='Mosaïque observationnelle partielle ; résolution variable, zones non observées possibles.'):
 target=OUT/f'{body["id"]}.webp'
 try:
  with urllib.request.urlopen(url,timeout=55) as r:raw=r.read()
  im=Image.open(io.BytesIO(raw)).convert('RGB');width,height=im.size
  if abs(width/height-2)>.03:print('Annotated/non-equirectangular image skipped:',body['name'],im.size,flush=True);return
  if width>8192:im.resize((8192,4096),Image.Resampling.LANCZOS).save(target,quality=92)
  else:im.save(target,quality=92)
  manifest['bodies'][str(body['id'])]={'path':str(target.relative_to(ROOT/'static')),'source':source,'source_image':url,'source_sha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'width':im.width if width<=8192 else 8192,'height':im.height if width<=8192 else 4096,'credit':credit,'longitude_offset':offset,'longitude_sign':sign,'note':note}
  print(body['name'],width,height,flush=True)
 except Exception as e:print(body['name'],type(e).__name__,str(e),flush=True)
for planet in ['mars','jupiter','saturn','uranus','neptune']:
 source=f'https://space.jpl.nasa.gov/tmaps/{planet}.html'
 with urllib.request.urlopen(source,timeout=25) as r:html=r.read().decode()
 parser=Table();parser.feed(html);selected={}
 for text,links in parser.rows:
  if 'fictitious' in text.lower() or 'fictional' in text.lower():continue
  jpg=next((urljoin(source,u) for u in links if u.endswith('.jpg')),None)
  if not jpg:continue
  for name,body in byname.items():
   if re.search(r'(?<![a-z])'+re.escape(name)+r'(?![a-z])',text,re.I):selected[body['id']]=(body,jpg)
 for body,url in selected.values():store(body,url,source,'NASA/JPL/USGS · Voyager/Viking/Galileo',offset=.5,sign=1,note='Mosaïque historique JPL/USGS ; lacunes possibles, sans détail inventé. Longitudes Est, méridien zéro au centre.')
# More recent, explicitly documented equidistant maps; reject plates/labels.
for ident,pia,page in [(603,'PIA08407','https://science.nasa.gov/photojournal/map-of-tethys-february-2008/'),(606,'PIA22770','https://science.nasa.gov/resource/titan-mosaic-the-surface-under-the-haze/')]:
 body=next(b for b in catalog['bodies'] if b.get('id')==ident)
 with urllib.request.urlopen(page,timeout=30) as r:html=r.read().decode()
 links=re.findall(r'href=[\"\']([^\"\']+)[\"\']',html)
 url=next((u for u in links if 'assets.science.nasa.gov' in u and u.endswith('/'+pia+'.jpg')),None)
 if url:store(body,url,page,'NASA/JPL/SSI/USGS',offset=.5,sign=1,note='Mosaïque Cassini de référence ; Titan en proche infrarouge, sans observation en direct.')
manifest['sources']=['https://space.jpl.nasa.gov/tmaps/','https://svs.gsfc.nasa.gov/4720/']
(ROOT/'static/solar/moon-surfaces.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Available detailed surfaces:',len(manifest['bodies']),flush=True)
