"""Seam-safe cylindrical UVs for the authored Mir core marking surfaces.
Triangles/positions/normals preserved, vertices expanded only to separate the UV seam.
Ink is placed only inside a verified uninterrupted hull patch, never in an atlas gap.
"""
import io,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def apply(g,binary,image):
 def array(i,d,typ='<f4'):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];return np.frombuffer(binary,dtype=typ,count=a['count']*d,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,d).copy()
 def accessor(data,kind,ctype):
  binary.extend(b'\0'*(-len(binary)%4));v=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':data.nbytes,'target':34963 if kind=='SCALAR' else 34962});binary.extend(data.tobytes());a=len(g['accessors']);row={'bufferView':v,'componentType':ctype,'count':len(data),'type':kind}
  if kind=='VEC3':row.update(min=data.min(0).tolist(),max=data.max(0).tolist())
  g['accessors'].append(row);return a
 p=next(p for m in g['meshes'] for p in m['primitives'] if p['material']==48);indices=array(p['indices'],1,'<u4').ravel();pos=array(p['attributes']['POSITION'],3)[indices];norm=array(p['attributes']['NORMAL'],3)[indices];center=(pos.min(0)+pos.max(0))/2;radius=np.hypot(pos[:,0]-center[0],pos[:,2]-center[2]);uv=np.column_stack([np.arctan2(pos[:,2]-center[2],pos[:,0]-center[0])/(2*np.pi)+.5,(pos[:,1]-pos[:,1].min())/np.ptp(pos[:,1])]);triuv=uv.reshape(-1,3,2)
 for tri in triuv:
  if np.ptp(tri[:,0])>.5:tri[tri[:,0]<.5,0]+=1
 w,h=2048,768;mask=Image.new('L',(w,h));d=ImageDraw.Draw(mask)
 for q,r in zip(triuv,radius.reshape(-1,3)):
  if np.mean(r)<1.7:continue
  for shift in [-1,0,1]:d.polygon([((x+shift)*w,y*h) for x,y in q],fill=255)
 # Compact uninterrupted patches. Padding keeps all marks away from UV island edges.
 a=(np.asarray(mask)>0).astype(np.int32);integral=np.pad(a.cumsum(0).cumsum(1),((1,0),(1,0)));chosen=[];rw,rh=260,158;pad=10
 for target in [.25,.75]:
  options=[]
  for y in range(18,h-rh-18,4):
   for x in range(18,w-rw-18,8):
    if any(abs(x-c[0])<400 for c in chosen):continue
    total=integral[y+rh+pad,x+rw+pad]-integral[y-pad,x+rw+pad]-integral[y+rh+pad,x-pad]+integral[y-pad,x-pad]
    if total!=(rw+2*pad)*(rh+2*pad):continue
    score=abs((x+rw/2)/w-target)+.12*abs((y+rh/2)/h-.5);options.append((score,x,y))
  if options:_,x,y=min(options);chosen.append([x,y,rw,rh])
 if not chosen:raise RuntimeError('No continuous hull patch large enough for the Mir markings')
 rng=np.random.default_rng(16609);small=Image.fromarray(np.uint8(np.clip(236+rng.normal(0,1.2,(96,256)),0,255))).resize((w,h),Image.Resampling.BICUBIC);base=np.asarray(small,dtype=float);tex=Image.fromarray(np.uint8(np.clip(np.stack([base,base-.5,base-5],2),0,255)),'RGB');ink=Image.new('RGBA',(w,h));d=ImageDraw.Draw(ink)
 for x,y,rw,rh in chosen:
  # Shape adjusted for the circumferential/axial physical scale of this cylinder.
  d.rectangle((x+8,y+8,x+108,y+83),fill='#a92520');gold='#e5c260';cx=x+29;cy=y+29
  points=[(cx+math.sin(i*math.pi/5)*11*(1 if i%2==0 else .4),cy-math.cos(i*math.pi/5)*15*(1 if i%2==0 else .4)) for i in range(10)];d.polygon(points,fill=gold);d.arc((x+21,y+35,x+49,y+70),275,115,fill=gold,width=4);d.line((x+21,y+64,x+44,y+39),fill=gold,width=4);d.line((x+34,y+37,x+46,y+51),fill=gold,width=4)
  label=Image.new('RGBA',(600,140));ld=ImageDraw.Draw(label);ld.text((0,0),'МИР',font=ImageFont.truetype(FONT,110),fill='#9f241e');label=label.crop(label.getbbox()).resize((128,76),Image.Resampling.LANCZOS);ink.alpha_composite(label,(x+121,y+7));label=Image.new('RGBA',(400,100));ld=ImageDraw.Draw(label);ld.text((0,0),'СССР',font=ImageFont.truetype(FONT,64),fill='#9f241e');label=label.crop(label.getbbox()).resize((88,38),Image.Resampling.LANCZOS);ink.alpha_composite(label,(x+135,y+106))
 ink_mask=np.asarray(ink)[:,:,3]>0;assert np.all(a[ink_mask]),'A marking crosses a missing surface';tex.paste(ink,(0,0),ink);tex.save(ROOT/'resources/mir-core-markings-atlas.png');mask.save(ROOT/'resources/mir-core-markings-coverage.png');texture=image(np.asarray(tex),'Mir core · dedicated seamless hull marking atlas');g['materials'][48]['pbrMetallicRoughness']['baseColorTexture']={'index':texture};g['materials'][48]['pbrMetallicRoughness']['baseColorFactor']=[.96,.96,.94,1]
 p['attributes']={'POSITION':accessor(pos.astype('<f4'),'VEC3',5126),'NORMAL':accessor(norm.astype('<f4'),'VEC3',5126),'TEXCOORD_0':accessor(uv.astype('<f4'),'VEC2',5126)};p['indices']=accessor(np.arange(len(pos),dtype='<u4').reshape(-1,1),'SCALAR',5125);g['extras']['marking_uv_repair']={'material':48,'mode':'dedicated cylindrical UV; seam vertices expanded; triangles retain original positions and normals','patches':chosen,'atlas_size':[w,h],'ink_pixels':int(ink_mask.sum()),'ink_outside_hull_pixels':int(np.sum(ink_mask&(a==0)))}
 return g['extras']['marking_uv_repair']
