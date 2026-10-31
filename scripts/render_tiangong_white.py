"""Offline orthographic inspection of the actual white GLB line primitives."""
import json,struct,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def main():
 scale=2;w,h=520,400;out=Image.new('RGB',(w*3*scale,(h+65)*scale),'#080f19');d=ImageDraw.Draw(out);font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24*scale)
 for j,key in enumerate(['tiangong','tiangong-1','tiangong-2']):
  path=ROOT/('static/images/tiangong.glb' if key=='tiangong' else f'static/images/science/{key}.glb');raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);a=g['accessors'][0];v=g['bufferViews'][a['bufferView']];pts=[struct.unpack_from('<3f',raw,28+n+v.get('byteOffset',0)+k*12) for k in range(a['count'])]
  projected=[(.82*x+.57*y,-.25*x+.36*y-.90*z) for x,y,z in pts];lo=[min(p[i] for p in projected) for i in range(2)];hi=[max(p[i] for p in projected) for i in range(2)];factor=min((w-44)/(hi[0]-lo[0]),(h-40)/(hi[1]-lo[1]));p=[((j*w+w/2+(x-(lo[0]+hi[0])/2)*factor)*scale,(65+h/2+(y-(lo[1]+hi[1])/2)*factor)*scale) for x,y in projected]
  for a,b in zip(p[::2],p[1::2]):d.line([a,b],fill='#eff7ff',width=1)
  d.text(((j*w+18)*scale,16*scale),key.replace('tiangong','Tiangong'),font=font,fill='white')
 out=out.resize((w*3,h+65),Image.Resampling.LANCZOS);out.save(ROOT/'resources/tiangong-white-preview.jpg',quality=94)
if __name__=='__main__':main()
