"""Offline view of the actual line GLB, for silhouette review."""
import json,struct
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def main():
 raw=(ROOT/'static/images/iss.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);a=g['accessors'][0];v=g['bufferViews'][a['bufferView']];pts=[struct.unpack_from('<3f',raw,28+n+v.get('byteOffset',0)+k*12) for k in range(a['count'])];w,h,scale=700,570,2;out=Image.new('RGB',(w*2*scale,h*scale),'#080f19');d=ImageDraw.Draw(out);font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22*scale)
 for j,project in enumerate([lambda x,y,z:(.82*x+.57*y,-.25*x+.36*y-.9*z),lambda x,y,z:(y,-x+.35*z)]):
  q=[project(*p) for p in pts];lo=[min(p[i] for p in q) for i in range(2)];hi=[max(p[i] for p in q) for i in range(2)];factor=min((w-40)/(hi[0]-lo[0]),(h-100)/(hi[1]-lo[1]));q=[((j*w+w/2+(x-(lo[0]+hi[0])/2)*factor)*scale,(h/2+25+(y-(lo[1]+hi[1])/2)*factor)*scale) for x,y in q]
  for a,b in zip(q[::2],q[1::2]):d.line([a,b],fill='#eef7ff',width=1)
  d.text(((j*w+20)*scale,20*scale),['ISS · modèle blanc','Modules, poutre et panneaux'][j],font=font,fill='white')
 out.resize((w*2,h),Image.Resampling.LANCZOS).save(ROOT/'resources/iss-white-preview.jpg',quality=94)
if __name__=='__main__':main()
