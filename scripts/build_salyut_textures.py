"""Original UV-unwrapped Salyut textile/paint textures, not copied photographs.
Reference: NASA Salyut retrospective and RP-1357; user-supplied Salyut-1
renderings and Salyut-7 orbital photo used as visual colour/layout guides.
Surface weathering, stitches and secondary lettering placement are interpreted.
Requires Pillow; generated PNGs are read by the standard-library GLB builder.
"""
from pathlib import Path
import math,random
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'resources/historical-station-textures';OUT.mkdir(exist_ok=True)
W,H=2048,1024
FONT='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def main():
 for number in range(1,8):
  early=number==1;almaz=number in (2,3,5);base=(46,57,37) if early else (76,84,59) if almaz else (216,212,195);rng=random.Random(1349+number)
  im=Image.new('RGB',(W,H));pixels=im.load()
  for y in range(H):
   xstation=(y/H-.5)*(16 if number==7 else 15.8)
   for x in range(W):
    noise=rng.randrange(-5,6);weave=(x%4==0)-(y%4==0);wrinkle=4*math.sin(x*.045+y*.071)*math.sin(x*.013-y*.023)
    c=base
    if number in (6,7) and (-4.45<xstation<-3.65 or -2.4<xstation<-1.8):c=(104,48,25)
    v=noise+weave+wrinkle;pixels[x,y]=tuple(max(0,min(255,int(k+v))) for k in c)
  d=ImageDraw.Draw(im)
  # Circumferential and axial stitched blanket boundaries, not metallic hoops.
  seam=(28,34,24) if early or almaz else (141,132,109)
  for x in range(0,W,128):
   d.line((x,0,x,H),fill=seam,width=2)
   for y in range(0,H,12):d.line((x-3,y,x+3,y+5),fill=tuple(min(255,c+20) for c in seam),width=1)
  for y in range(0,H,112):
   d.line((0,y,W,y),fill=seam,width=2)
   for x in range(0,W,13):d.line((x,y-3,x+5,y+3),fill=tuple(min(255,c+20) for c in seam),width=1)
  # Upper-facing heat-control patches, several separate blankets rather than
  # one uniformly pale cylinder. Front/lower faces remain dark on DOS-1.
  if early or almaz:
   for center in [.24,.74]:
    u=int(center*W);d.rounded_rectangle((u-90,int(H*.22),u+90,int(H*.53)),radius=10,fill=(215,214,203),outline=(133,135,124),width=3)
  else:
   for center in [.12,.38,.64,.88]:
    u=int(center*W);d.rectangle((u-46,int(H*.24),u+46,int(H*.53)),fill=(225,222,207),outline=(130,120,94),width=2)
  # Several labels around the circumference keep the same readable orientation;
  # labels are drawn in UV space with no negative geometry scale or mirroring.
  def stencil(u,v,text,size,color,background=None):
   font=ImageFont.truetype(FONT,size);bbox=font.getbbox(text);layer=Image.new('RGBA',(bbox[2]-bbox[0]+16,bbox[3]-bbox[1]+12),background or (0,0,0,0));ld=ImageDraw.Draw(layer);ld.text((8-bbox[0],6-bbox[1]),text,font=font,fill=color);layer=layer.rotate(90,expand=True);im.paste(layer,(int(u*W-layer.width/2),int(v*H-layer.height/2)),layer)
  for center in [.10,.60]:
   if early:
    stencil(center,.31,'ЗАРЯ',44,(235,231,214,255));stencil(center+.028,.31,'СССР',28,(232,228,209,255));stencil(center,.62,'САЛЮТ',28,(151,30,22,255),(223,221,203,255))
   else:stencil(center,.31,'СССР',30,(224,218,191,255) if almaz else (134,36,24,255))
  if early:
   for y in [int(H*.17),int(H*.19)]:d.rectangle((0,y,W,y+5),fill=(113,36,25))
  im.save(OUT/f'salyut-{number}-hull.png',optimize=True)
 print('Seven original 2048 × 1024 Salyut UV maps generated')
if __name__=='__main__':main()
