"""Bake the NASA Eyes point catalogues into the existing ICRF sky projection.
No stars are invented; only point sprites are rasterized for the shared sky shader.
"""
from pathlib import Path
import hashlib,json,math,struct
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'static/images/sky/nasa-eyes';W,H=8192,4096
image=Image.new('RGB',(W,H));pixels=image.load();tilt=math.radians(23.439291111);cs,sn=math.cos(tilt),math.sin(tilt);records=[]
for path in sorted(SOURCE.glob('*.bin')):
 raw=path.read_bytes();count=struct.unpack_from('<I',raw)[0];assert len(raw)==4+count*23
 for i in range(count):
  mag,absolute,r,g,b,a,y,z=struct.unpack_from('<ffBBBfff',raw,4+i*23)
  x=z;fy=-a*cs-y*sn;fz=-a*sn+y*cs;length=math.sqrt(x*x+fy*fy+fz*fz)
  if not length or not math.isfinite(mag):continue
  lon=math.atan2(fy,x);lat=math.asin(max(-1,min(1,fz/length)));u=(.5-lon/(2*math.pi))%1;v=.5-lat/math.pi
  records.append((mag,u,v,r,g,b))
for mag,u,v,r,g,b in sorted(records,reverse=True):
 flux=10**(-.4*mag);peak=min(255,55+240*flux**.28);sigma=min(2.2,.7+.9*flux**.18);radius=math.ceil(sigma*3);cx=u*W;cy=v*H;stretch=min(12,1/max(.08,math.sin(v*math.pi)));bright=max(1,r,g,b)
 for dy in range(-radius,radius+1):
  yy=round(cy)+dy
  if not 0<=yy<H:continue
  for dx in range(-math.ceil(radius*stretch),math.ceil(radius*stretch)+1):
   xx=(round(cx)+dx)%W;d=((round(cx)+dx-cx)/stretch)**2+(yy-cy)**2;strength=peak*math.exp(-d/(2*sigma*sigma))
   if strength<1:continue
   old=pixels[xx,yy];pixels[xx,yy]=tuple(min(255,int(old[k]+strength*color/bright)) for k,color in enumerate((r,g,b)))
path=SOURCE/'eyes-starmap-8k.webp';image.save(path,quality=94,method=6)
manifest={'source':'NASA/JPL-Caltech Eyes on the Solar System','catalogue':'https://eyes.nasa.gov/assets/static/stars/','records':len(records),'projection':'ICRF/J2000; u=0.5-RA/(2*pi), v_image=0.5-Dec/pi','width':W,'height':H,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'note':'Rasterization of original Eyes stellar/galaxy positions and colours; no embedded Sun. The existing independent Atlas Sun shader is retained.'}
(SOURCE/'projection.json').write_text(json.dumps(manifest,indent=2));print(path,len(records),path.stat().st_size)
