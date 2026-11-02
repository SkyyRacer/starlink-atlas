"""Extend the solar catalogue without changing the existing planet-page renderer.
NASA VTAD surfaces: observed maps. Unresolved surfaces: labelled Atlas illustrations.
Horizons primary-body IDs deliberately differ from system barycentre IDs.
"""
import json, pathlib, re, struct, hashlib, math
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'resources/dwarf-planets'; OUT=ROOT/'static/solar/dwarfs'
NASA='https://science.nasa.gov/dwarf-planets/'

def build():
 OUT.mkdir(parents=True,exist_ok=True)
 pck=(SRC/'pck.tpc').read_text();params={}
 for ident,k,v in re.findall(r'BODY(\d+)_(RADII|POLE_RA|POLE_DEC|PM)\s*=\s*\(([^)]*)\)',pck):
  params.setdefault(int(ident),{})[k]=[float(x.replace('D','E')) for x in re.findall(r'[+-]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][+-]?\d+)?',v)]
 bodies=[]
 def add(key,name,ident,radii,parent='soleil',**extra):
  p=params.get(2000001 if ident==20000001 else ident,{})
  body=dict(key=key,name=name,id=ident,kind='planet' if parent=='soleil' else 'moon',parent=parent,radii_km=radii,rotation={k:v for k,v in p.items() if k!='RADII'},nutation_angles=[],**extra)
  if parent=='soleil':body['dwarf']=True
  bodies.append(body);return body
 def facts(radius,mass,rotation,years=None,days=None):
  return {k:v for k,v in dict(mean_radius_km=radius,mass_kg=mass,rotation_days=rotation,orbital_years=years,orbital_days=days,source=NASA).items() if v is not None}
 add('pluton','Pluton',999,[1188.3]*3,physical=facts(1188.3,1.303e22,6.38723,247.94),surface='solar/dwarfs/pluton.webp',surface_note='Carte New Horizons NASA/JHUAPL/SwRI ; couverture et résolution variables.',source='https://science.nasa.gov/resource/pluto-3d-model/')
 add('ceres','Cérès',20000001,[482.2,482.1,445.9],page='ceres-naine',horizons_command='1;',physical=facts(469.7,9.3835e20,9.07417/24,4.61),surface='solar/dwarfs/ceres.webp',source='https://science.nasa.gov/resource/ceres-3d-model/',surface_note='Carte de surface NASA Dawn / VTAD.')
 add('eris','Éris',920136199,[1163]*3,physical=facts(1163,1.6466e22,None,557),surface='solar/dwarfs/eris.webp',surface_note='Surface illustrative : aucune carte résolue disponible. Orientation de surface non mesurée.',source=NASA+'eris/')
 add('haumea','Hauméa',920136108,[1161,852,513],physical=facts(None,4.006e21,3.915341/24,285),rotation_note='Pôle issu des occultations ; phase de rotation illustrative.',surface='solar/dwarfs/haumea.webp',surface_note='Forme triaxiale issue des occultations ; surface illustrative non cartographiée.',source='https://arxiv.org/abs/2006.03113')
 bodies[-1]['rotation']={'POLE_RA':[285.1,0,0],'POLE_DEC':[-10.6,0,0],'PM':[0,360/(3.915341/24),0]}
 add('makemake','Makémaké',20136472,[715]*3,horizons_command='136472;',physical=facts(715,None,22.8266/24,306),surface='solar/dwarfs/makemake.webp',surface_note='Surface illustrative non cartographiée ; pôle et phase de rotation inconnus.',source=NASA+'makemake/')
 bodies[-1]['rotation']={'POLE_RA':[0,0,0],'POLE_DEC':[90,0,0],'PM':[0,360/(22.8266/24),0]}
 for key,name,ident,radii,period in [('charon','Charon',901,[606]*3,6.387222),('nix','Nix',902,[25,17.5,16.5],24.85),('hydra','Hydra',903,[25.5,18,15.5],38.20),('kerberos','Kerbéros',904,[9.5,5,4.5],32.17),('styx','Styx',905,[8,4.5,4],20.16)]:
  b=add(key,name,ident,radii,'pluton',physical=facts(None,None,None,days=period),surface_note='Surface illustrative et orientation non mesurée.' if ident!=901 else 'Carte New Horizons NASA/JHUAPL/SwRI ; couverture partielle.',source='https://science.nasa.gov/pluto/moons/')
  if ident==901:b['surface']='solar/dwarfs/charon.webp'
 for key,name,ident,radius,parent,period in [('dysnomia','Dysnomia',120136199,350,'eris',15.785899),('hiiaka','Hiʻiaka',120136108,160,'haumea',49.462),('namaka','Namaka',220136108,85,'haumea',18.2783)]:
  add(key,name,ident,[radius]*3,parent,physical=facts(radius,None,None,days=period),surface_note='Rayon estimé ; surface illustrative non cartographiée. Position : solution satellitaire JPL Horizons.',source='https://ssd.jpl.nasa.gov/horizons/')
 add('mk2','MK2 · S/2015 (136472) 1',136472001,[87.5]*3,'makemake',physical=facts(None,None,None,days=18.023),orbit_model={'type':'schematic','radius_km':22250,'period_days':18.023,'epoch':1429883160},surface_note='Surface et position schématiques. Période et distance : orbite préliminaire ; orientation et phase non déterminées ici.',source='https://arxiv.org/abs/2509.05880')
 # Preserve reviewed reference textures when rebuilding the base catalogue.
 references=OUT/'surface-sources.json'
 if references.exists():
  replacements=json.loads(references.read_text())
  for b in bodies:
   reference=replacements.get(b['key'])
   if reference and (ROOT/'static'/reference['path']).exists():
    b.update(surface=reference['path'],surface_credit=reference['credit'],surface_source=reference['source'],surface_note=reference.get('note',b.get('surface_note','')))
 (OUT/'catalog.json').write_text(json.dumps(bodies,ensure_ascii=False,indent=2))
 catfile=ROOT/'static/solar/catalog.json';cat=json.loads(catfile.read_text());keys={b['key'] for b in bodies};cat['bodies']=[b for b in cat['bodies'] if b['key'] not in keys]+bodies;catfile.write_text(json.dumps(cat,ensure_ascii=False,separators=(',',':')))
 template=(ROOT/'static/jupiter/index.html').read_text()
 for b in bodies:
  if not b.get('dwarf'):continue
  folder=ROOT/'static'/b.get('page',b['key']);folder.mkdir(exist_ok=True);(folder/'index.html').write_text(template.replace('Jupiter',b['name']).replace('data-solar="jupiter"','data-solar="'+b['key']+'"'))
 return bodies

def surfaces(bodies):
 from PIL import Image
 import numpy as np
 import io
 registry_path=ROOT/'static/solar/moon-surfaces.json';registry=json.loads(registry_path.read_text())
 for name in ['pluto','ceres','charon']:
  b=(SRC/(name+'.glb')).read_bytes();size=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+size]);binary=b[28+size:];material=j['materials'][0];idx=material['pbrMetallicRoughness']['baseColorTexture']['index'];im=j['images'][j['textures'][idx]['source']];v=j['bufferViews'][im['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];image=Image.open(io.BytesIO(raw)).convert('RGB');image.thumbnail((4096,2048));image.save(OUT/({'pluto':'pluton'}.get(name,name)+'.webp'),quality=94)
 for index,body in enumerate(bodies):
  key=body['key'];path=OUT/(key+'.webp')
  if key not in ['pluton','ceres','charon']:
   rng=np.random.default_rng(174+index);w,h=2048,1024
   yy,xx=np.mgrid[-math.pi/2:math.pi/2:complex(h),-math.pi:math.pi:complex(w)];noise=np.zeros((h,w))
   # Periodic, pole-continuous albedo detail; an illustration, never a measured map.
   for freq in [2,4,8,16,32,64]:
    phase=rng.uniform(0,2*math.pi);noise+=np.sin(freq*np.cos(yy)*np.cos(xx)+phase)*np.cos(freq*np.cos(yy)*np.sin(xx)-phase)*np.sin(freq*np.sin(yy)+phase)/freq**.65
   noise/=max(.01,noise.std());palette={'eris':(225,225,217),'haumea':(205,200,186),'makemake':(172,105,67),'mk2':(63,61,59),'dysnomia':(74,73,70)};color=np.array(palette.get(key,(178,175,166)));pixels=np.clip(color[None,None,:]*(1+noise[:,:,None]*.055),0,255).astype('uint8');Image.fromarray(pixels).save(path,quality=91)
  if body['kind']=='moon':
   im=Image.open(path);registry['bodies'][str(body['id'])]={'path':'solar/dwarfs/'+key+'.webp','source':body['source'],'width':im.width,'height':im.height,'longitude_offset':.5,'longitude_sign':1,'credit':'NASA VTAD / New Horizons' if key=='charon' else 'Atlas · reconstitution illustrative','note':body['surface_note'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 Image.new('RGBA',(16,2),(166,160,145,128)).save(OUT/'haumea-ring.png')
 registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2))
if __name__=='__main__':surfaces(build())
