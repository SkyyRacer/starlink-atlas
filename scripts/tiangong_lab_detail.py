"""Shared lab coatings, conformal decals and original external detail geometry."""
import math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def materials(m):
 def texture(file):
  m.g['images'].append({'bufferView':m.view((ROOT/'resources/tiangong-lab-surfaces'/file).read_bytes()),'mimeType':'image/png'});m.g['textures'].append({'source':len(m.g['images'])-1,'sampler':0});return len(m.g['textures'])-1
 normal=texture('thermal-micro-normal.png');rough=texture('thermal-roughness.png')
 for key,metal,roughness in [('tg-white',.10,.46),('tg-grey',.38,.33),('tg-frame',.86,.23)]:
  material=m.g['materials'][m.materials[key]];material['pbrMetallicRoughness'].update(metallicFactor=metal,roughnessFactor=roughness,metallicRoughnessTexture={'index':rough});material['normalTexture']={'index':normal,'scale':.3}
 if m.key=='tiangong':
  for label in ['tianhe','wentian','mengtian','tianzhou']:
   index=texture(label+'-name.png');m.materials[label+'-name']=len(m.g['materials']);m.g['materials'].append({'name':label+'-name','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':index},'metallicFactor':0,'roughnessFactor':.64},'alphaMode':'MASK','alphaCutoff':.4})
 number=2 if m.key=='tiangong-2' else 1
 for key,suffix in [('lab-name','name'),('lab-service','service')]:
  index=texture(f'tiangong-{number}-{suffix}.png');m.materials[key]=len(m.g['materials']);m.g['materials'].append({'name':key,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':index},'metallicFactor':0,'roughnessFactor':.64},'alphaMode':'MASK','alphaCutoff':.4,'doubleSided':False})
 # More specular metal and foil, without changing other stations' finishes.
 m.g['materials'][m.materials['gold']]['pbrMetallicRoughness'].update(metallicFactor=.9,roughnessFactor=.23)
 m.g['materials'][m.materials['steel']]['pbrMetallicRoughness'].update(metallicFactor=.92,roughnessFactor=.2)

def decal(m,name,x,r,theta,width,height,material):
 """UV right is observer right, UV top is zenith, on both sides of the cylinder.
 No negative geometry scale or mirrored texture is used. The surface follows
 the hull at a small depth-writing offset instead of floating on a flat plate.
 """
 sign=1 if math.cos(theta)>0 else -1;verts=[];normals=[];uv=[];faces=[];steps=24
 for j in range(steps+1):
  v=j/steps;t=theta+(v-.5)*sign*height/r
  for u in [0,1]:verts.append((x+(u-.5)*sign*width,r*math.cos(t),r*math.sin(t)));normals.append((0,math.cos(t),math.sin(t)));uv.append((u,v))
 for j in range(steps):
  a=j*2;faces.extend([(a,a+2,a+1),(a+1,a+2,a+3)])
 m.mesh(name,verts,normals,uv,faces,material)

def geometry(m):
 # Forward experiment-cabin flank, as in https://www.cast.cn/3g/news/5162.
 # Exact angular/metric decal coordinates are not published; offsets remain
 # an interpretation of exterior illustrations, not a measured paint survey.
 for theta,side in [(math.pi,'port'),(0,'starboard')]:
  decal(m,'Chinese flag '+side,3.2,1.693,theta,.56,.374,'tg-flag');decal(m,'Station name '+side,1.9,1.698,theta,1.36,.34,'lab-name');decal(m,'Resource identification '+side,-2.3,1.417,theta,.95,.20,'lab-service')
 # Short fasteners and exterior service panels follow the local cabin surface.
 for x,r in [(-4.1,1.4),(-2.0,1.4),(.45,1.675),(3.55,1.675)]:
  for theta in [.45,2.65,3.65,5.85]:
   decal(m,'Service access cover',x,r+.014,theta,.32,.25,'tg-white')
   for dx in [-.125,.125]:
    for dt in [-.09,.09]:
     t=theta+dt/r;m.tube('Access cover fastener',(x+dx,(r+.015)*math.cos(t),(r+.015)*math.sin(t)),(x+dx,(r+.032)*math.cos(t),(r+.032)*math.sin(t)),.014,mat='tg-frame',segments=8)
 for x,r in [(-4.4,1.4),(-3.1,1.4),(-1.6,1.4),(.4,1.675),(2.9,1.675),(3.8,1.675)]:
  for theta in [.9,2.2,4.1,5.3]:
   y,z=math.cos(theta),math.sin(theta);m.tube('Thermal blanket buckle',(x-.04,(r+.022)*y,(r+.022)*z),(x+.04,(r+.022)*y,(r+.022)*z),.022,mat='tg-frame',segments=8)
 # Distinct TG-2 experiment boxes; the source confirms their presence, while
 # these exterior dimensions and layout are a visual reconstruction.
 if m.key=='tiangong-2':
  m.box('POLAR experiment base',(.15,-.65,-1.57),(.78,.8,.15),'tg-frame');m.box('POLAR experiment housing',(.15,-.65,-1.82),(.64,.64,.38),'tg-white');m.box('POLAR detector face',(.15,-.65,-2.025),(.52,.52,.025),'dark');m.tube('Optical payload baffle',(.7,.6,-1.5),(.7,.6,-1.93),.16,mat='tg-frame',segments=32);m.tube('Optical payload aperture',(.7,.6,-1.935),(.7,.6,-1.947),.12,mat='glass',segments=32)
  m.box('Thermal payload blanket',(-.6,.8,-1.33),(.6,.5,.22),'gold')
  for node in m.g['nodes']:
   if node.get('name','').startswith('TG-1 '):node['name']=node['name'].replace('TG-1 ','TG-2 ',1)
  for mesh in m.g['meshes']:
   if mesh.get('name','').startswith('TG-1 '):mesh['name']=mesh['name'].replace('TG-1 ','TG-2 ',1)
