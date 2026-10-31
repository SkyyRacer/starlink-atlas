"""Colour finish and restored existing Mir markings, preserving authored UV placement.
Photo reference: NASA STS-86 photo 61 (red Cyrillic MIR and Soviet marking).
This is a texture interpretation, not a photogrammetric restoration.
"""
import io,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parents[1]
FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def apply(g,binary,append_image):
 source_images=list(g['images'][:9]);new={};report=[]
 def load(im):
  v=g['bufferViews'][im['bufferView']];return Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB')
 def star(cx,cy,r):return [(cx+math.sin(i*math.pi/5)*r*(1 if i%2==0 else .4),cy-math.cos(i*math.pi/5)*r*(1 if i%2==0 else .4)) for i in range(10)]
 def flag(d,x,y,s):
  # Same two rectangular footprint positions as the original author's atlas.
  x*=s;y*=s;w=45*s;h=18*s;d.rectangle((x,y,x+w,y+h),fill='#a82520');gold='#e3c16b';cx=x+8*s;cy=y+6*s;d.polygon(star(cx,cy,2.1*s),fill=gold);d.arc((cx-3*s,cy+1*s,cx+4*s,cy+8*s),280,115,fill=gold,width=max(1,s));d.line((cx-2*s,cy+7*s,cx+3*s,cy+2*s),fill=gold,width=max(1,s));d.line((cx+1*s,cy+1*s,cx+4*s,cy+4*s),fill=gold,width=max(1,s))
 for i,im in enumerate(source_images):
  name=im.get('name','')
  if name not in ['mir.png','multi.png','metallwhite.png','chrome.png','paneliss3.png','dock.png','dockkr.png']:continue
  original=load(im);w,h=original.size;size=(2048,2048) if name=='mir.png' else (1024,512) if name=='paneliss3.png' else (1024,1024);tex=original.resize(size,Image.Resampling.LANCZOS);a=np.asarray(tex,dtype=float);y,x=np.mgrid[:size[1],:size[0]];rng=np.random.default_rng(529931+i);noise=rng.normal(0,1,x.shape)
  if name in ['multi.png','mir.png']:
   # Warm multilayer insulation with subtle folds/sewn seams, without fake hardware.
   folds=2.3*np.sin(x*.063+np.sin(y*.035))*np.sin(y*.077)+noise*.55;seam=(np.minimum(x%256,256-x%256)<1.5)|(np.minimum(y%256,256-y%256)<1.5);a=np.clip(a+folds[:,:,None]-seam[:,:,None]*3.2,0,255)
  elif name=='metallwhite.png':
   grain=noise*.65+np.sin(y*.42)*.45;a=np.clip(np.ones_like(a)*np.array([239,241,237])+grain[:,:,None],0,255)
  elif name=='chrome.png':
   brush=noise*.8+1.5*np.sin(y*.37);a=np.clip(np.ones_like(a)*np.array([218,224,228])+brush[:,:,None],0,255)
  elif name in ['dock.png','dockkr.png']:
   # Preserve original copper/orange and gold thermal insulation hue and texture.
   a=np.clip(a+noise[:,:,None]*1.1,0,255)
  else:
   # Blue cell faces retain the original cell grid and UV rhythm.
   a=np.clip(a*np.array([.88,1.03,1.15]),0,255)
  tex=Image.fromarray(a.astype('uint8'),'RGB')
  if name=='mir.png':
   s=4;d=ImageDraw.Draw(tex)
   # Remove only the original tiny lettering; redraw it in the same UV region.
   patch=tex.crop((330*s,260*s,350*s,312*s)).resize((24*s,53*s),Image.Resampling.BICUBIC);tex.paste(patch,(291*s,214*s));d=ImageDraw.Draw(tex);flag(d,23,195,s);flag(d,273,195,s)
   label=Image.new('RGBA',(130*s,28*s));ld=ImageDraw.Draw(label);ld.text((0,-3*s),'МИР',font=ImageFont.truetype(FONT,19*s),fill='#9f241e');box=label.getbbox();label=label.crop(box).resize((34*s,15*s),Image.Resampling.LANCZOS).rotate(-90,expand=True);tex.paste(label,(304*s,214*s),label)
   small=Image.new('RGBA',(80*s,16*s));sd=ImageDraw.Draw(small);sd.text((0,0),'СССР',font=ImageFont.truetype(FONT,9*s),fill='#a32924');small=small.crop(small.getbbox()).resize((23*s,5*s)).rotate(-90,expand=True);tex.paste(small,(295*s,219*s),small)
   tex.save(ROOT/'resources/mir-colour-atlas.png')
  new[i]=append_image(np.asarray(tex),name+' · Atlas photo-referenced colour finish');report.append({'source':name,'size':list(tex.size),'role':'enhanced existing UV colour atlas'})
  if name=='paneliss3.png':
   # Opposite-facing primitives 26 and 41 are the authored back faces of paired wings.
   a=np.asarray(tex,dtype=float)/255;lum=a.mean(2);grid=np.max(a,2)-np.min(a,2);brightness=np.clip(.48+lum*.64,0,1);back=np.stack([brightness*215,brightness*183,brightness*112],axis=2);new['array_back']=append_image(back,'Solar array reverse · ochre backing and preserved conductor grid')
 for i,m in enumerate(g['materials']):
  p=m['pbrMetallicRoughness'];t=p.get('baseColorTexture',{}).get('index')
  if t is None:continue
  old=g['textures'][t]['source'];name=source_images[old].get('name','') if old<len(source_images) else ''
  if old in new:p['baseColorTexture']={**p['baseColorTexture'],'index':new[old]}
  if name=='metallwhite.png':p['baseColorFactor']=[.95,.95,.94,1];p['metallicFactor']=.22
  elif name in ['multi.png','mir.png']:p['baseColorFactor']=[.96,.95,.91,1];p['metallicFactor']=.06;p['roughnessFactor']=.78
  elif name=='chrome.png':p['baseColorFactor']=[.9,.91,.93,1];p['metallicFactor']=.83
  elif name=='paneliss3.png':
   p['baseColorFactor']=[.92,.95,1,1]
   if i in [26,41]:p['baseColorTexture']['index']=new['array_back'];p['baseColorFactor']=[1,1,1,1];p['metallicFactor']=.42
  elif name=='dock.png':p['baseColorFactor']=[.98,.84,.72,1];p['metallicFactor']=.48;p['roughnessFactor']=.48
  elif name=='dockkr.png':p['baseColorFactor']=[1,.94,.77,1];p['metallicFactor']=.66;p['roughnessFactor']=.36
 g['extras']['colour_adaptation']={'note':'Photo-referenced colours and clearer existing Soviet flag / МИР / СССР atlas markings. Same UV footprints; interpreted surface finish, no claim of exact colourimetry.','photo':'https://www.nasa.gov/history/SP-4225/sts86/photo/sts-86-photo-61.htm','array_back_materials':[26,41]}
 return report
