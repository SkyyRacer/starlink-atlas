"""Original, readable lab-name decals and restrained thermal-coating detail maps.
Pillow is only needed to regenerate the PNGs; the GLB builder reads saved assets.
Text/flag positioning is an Atlas presentation, not a historical marking survey.
"""
from pathlib import Path
import math
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'resources/tiangong-lab-surfaces';OUT.mkdir(exist_ok=True)
CHINESE='/System/Library/Fonts/STHeiti Light.ttc';LATIN='/System/Library/Fonts/Supplemental/Arial.ttf'
def main():
 for number,chinese in [(1,'天宫一号'),(2,'天宫二号')]:
  im=Image.new('RGBA',(1024,256),(0,0,0,0));d=ImageDraw.Draw(im);d.text((512,88),chinese,font=ImageFont.truetype(CHINESE,128),anchor='mm',fill=(39,45,51,255));d.text((512,213),'TIANGONG-'+str(number),font=ImageFont.truetype(LATIN,56),anchor='mm',fill=(57,66,76,255));im.save(OUT/f'tiangong-{number}-name.png',optimize=True)
  small=Image.new('RGBA',(512,128),(0,0,0,0));s=ImageDraw.Draw(small);s.text((256,64),'TG-'+str(number)+'  /  CMSA',font=ImageFont.truetype(LATIN,58),anchor='mm',fill=(54,60,66,255));small.save(OUT/f'tiangong-{number}-service.png',optimize=True)
 for key,label in [('tianhe','天和'),('wentian','问天'),('mengtian','梦天'),('tianzhou','天舟')]:
  im=Image.new('RGBA',(1024,256),(0,0,0,0));d=ImageDraw.Draw(im);d.text((512,90),label,font=ImageFont.truetype(CHINESE,140),anchor='mm',fill=(36,43,50,255));d.text((512,216),key.upper(),font=ImageFont.truetype(LATIN,52),anchor='mm',fill=(57,66,76,255));im.save(OUT/(key+'-name.png'),optimize=True)
 n=256;normal=Image.new('RGB',(n,n));rough=Image.new('RGB',(n,n))
 for y in range(n):
  for x in range(n):
   normal.putpixel((x,y),(int(128+3*math.cos(x*.09+y*.05)),int(128+3*math.sin(y*.08-x*.04)),255));r=int(223+12*math.sin(x*.03)*math.cos(y*.04));rough.putpixel((x,y),(255,r,255))
 normal.save(OUT/'thermal-micro-normal.png',optimize=True);rough.save(OUT/'thermal-roughness.png',optimize=True);print('Tiangong-1/2 readable Chinese/Latin decals and coating maps generated')
if __name__=='__main__':main()
