"""Raster review of the generated GLBs; not a screenshot of Cesium."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from render_historical_stations import render,ROOT
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def sheet(name,title,file,views,scale=1):
 width,height=720,500;out=Image.new('RGB',(1440,610),'#080f19');draw=ImageDraw.Draw(out);font=ImageFont.truetype(FONT,26);small=ImageFont.truetype(FONT,15);draw.text((22,12),title,font=font,fill='white');draw.text((22,49),'Géométries et textures originales Atlas · aperçu hors navigateur · détails et poses interprétés',font=small,fill='#b4c9d3')
 for i,(label,eye) in enumerate(views):
  im=render(file,width*2,height*2,eye_position=eye).resize((width,height),Image.Resampling.LANCZOS);out.paste(im,(i*width,110));draw.text((i*width+22,80),label,font=font,fill='white')
 out.save(ROOT/'resources'/name,quality=95)
if __name__=='__main__':
 sheet('tiangong-recreation-preview.jpg','ATLAS · Tiangong — reconstitution originale',ROOT/'resources/detailed-originals/tiangong-atlas.glb',[('Vue de l’ensemble',[90,-110,-100]),('Modules et équipements',[30,-32,-28])])
 sheet('tiangong-1-recreation-preview.jpg','ATLAS · Tiangong-1 — reconstitution originale',ROOT/'resources/atlas-reference-recreations/tiangong-1.glb',[('Laboratoire seul',[22,-28,-22]),('Antenne et renforts des panneaux',[-22,-28,-22])])
