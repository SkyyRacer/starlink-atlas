"""Preserve PDS Arrokoth shape in kilometres; package buffers for local Cesium."""
from pathlib import Path
import json,re,struct,math,hashlib
ROOT=Path(__file__).resolve().parents[1];source=ROOT/'resources/encounter-bodies';out=ROOT/'static/solar/encounters'
def pck(name,ident):
 active=False;lines=[]
 for line in (source/name).read_text().splitlines():
  if '\\begindata' in line:active=True;continue
  if '\\begintext' in line:active=False
  if active:lines.append(line)
 return {key:[float(v.replace('D','E')) for v in values.split()] for key,values in re.findall(r'BODY'+str(ident)+r'_(\w+)\s*=\s*\(([^)]*)\)','\n'.join(lines),re.S)}
vertices=[];faces=[]
for line in (source/'mu69_merged.obj').read_text().splitlines():
 if line.startswith('v '):vertices.append([float(v) for v in line.split()[1:4]])
 elif line.startswith('f '):
  face=[int(v.split('/')[0])-1 for v in line.split()[1:]]
  for i in range(1,len(face)-1):faces.append([face[0],face[i],face[i+1]])
normals=[[0.,0.,0.] for _ in vertices]
for face in faces:
 a,b,c=[vertices[i] for i in face];u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
 for index in face:
  for i in range(3):normals[index][i]+=n[i]
normals=[[v/max(1e-12,math.hypot(*n)) for v in n] for n in normals]
raw=struct.pack('<'+'f'*(len(vertices)*3),*[v*1000 for p in vertices for v in p])+struct.pack('<'+'f'*(len(normals)*3),*[v for p in normals for v in p])+struct.pack('<'+'I'*(len(faces)*3),*[v for face in faces for v in face]);(out/'arrokoth.bin').write_bytes(raw)
base='https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/data/pck/'
a=pck('nh_arrokoth_001.tpc',2486958);p=pck('pck00011.tpc',999)
manifest={'bodies':{'999':{'key':'pluton','name':'Pluton','id':999,'kind':'dwarf','radii_km':p['RADII'],'rotation':{k:p[k] for k in ['POLE_RA','POLE_DEC','PM']},'surface':'solar/encounters/pluto-color.jpg','texture_offset':.5,'source':'https://science.nasa.gov/resource/pluto-global-color-map/','credit':'NASA/JHUAPL/SwRI','note':'Mosaïque couleur New Horizons ; couverture et résolution variables selon les régions.'},'2486958':{'key':'arrokoth','name':'Arrokoth','id':2486958,'kind':'minor','radii_km':[max(abs(p[i]) for p in vertices) for i in range(3)],'rotation':{k:a[k] for k in ['POLE_RA','POLE_DEC','PM']},'mesh':{'file':'solar/encounters/arrokoth.bin','vertices':len(vertices),'indices':len(faces)*3,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'source':'https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived:arrokoth_geophysics-v1.0/','credit':'NASA/PDS · New Horizons · Beyer/Spencer et al.','note':'Modèle scientifique MU69_MERGED, avec zones non observées modélisées par les auteurs ; teinte rouge uniforme illustrative, pas de texture globale inventée.'}},'rotation_source':base}
(out/'catalog.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(len(vertices),'vertices',len(faces),'facets',len(raw),'bytes');print('Pluto PCK',p);print('Arrokoth PCK',a)
