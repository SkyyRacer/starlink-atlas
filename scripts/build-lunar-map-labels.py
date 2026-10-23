"""Build a compact text atlas and spherical surface patches, without polar UVs.
Pillow and NumPy are build-time dependencies only. All patches share one GPU mesh.
"""
import json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
FONTS = Path('/System/Library/Fonts/Supplemental')
REGIONS = {
 'Oceanus Procellarum': 'OCÉAN DES TEMPÊTES', 'Mare Frigoris': 'MER DU FROID',
 'Mare Imbrium': 'MER DES PLUIES', 'Mare Australe': 'MER AUSTRALE',
 'Mare Tranquillitatis': 'MER DE LA TRANQUILLITÉ', 'Mare Fecunditatis': 'MER DE LA FÉCONDITÉ',
 'Mare Nubium': 'MER DES NUÉES', 'Mare Serenitatis': 'MER DE LA SÉRÉNITÉ',
 'Mare Crisium': 'MER DES CRISES', 'Mare Insularum': 'MER DES ÎLES',
 'Mare Humorum': 'MER DES HUMEURS', 'Mare Nectaris': 'MER DU NECTAR',
 'Mare Vaporum': 'MER DES VAPEURS', 'Mare Orientale': 'MER ORIENTALE',
 'Mare Moscoviense': 'MER DE MOSCOU', 'Mare Ingenii': 'MER DE L’INGÉNIOSITÉ',
 'Sinus Iridum': 'BAIE DES ARCS-EN-CIEL', 'Sinus Medii': 'BAIE DU CENTRE',
 'Lacus Somniorum': 'LAC DES SONGES', 'Mare Cognitum': 'MER DE LA CONNAISSANCE',
}
W = H = 2048
channels = [Image.new('L', (W, H)) for _ in range(3)]
occupied, placed = [], []
xpack, ypack, rowheight = 4, 4, 0
features = json.loads((ROOT/'static/images/moon/features.json').read_text())
for f in sorted(features, key=lambda f: -f['diameter']):
 region = f['type'] != 'AA'
 tier = 0 if region and f['diameter'] >= 500 else 1 if f['diameter'] >= 180 else 2
 font = ImageFont.truetype(str(FONTS/('Arial Bold.ttf' if region else 'Arial.ttf')), [56, 38, 26][tier])
 name = REGIONS.get(f['name'], f['name'].upper() if region else f['name'])
 words = name.split(); lines = []; line = ''
 for word in words:
  candidate = (line+' '+word).strip()
  if line and font.getlength(candidate) > [460, 330, 250][tier]: lines.append(line); line = word
  else: line = candidate
 lines.append(line); text = '\n'.join(lines)
 canvas = Image.new('L', (1024, 384)); draw = ImageDraw.Draw(canvas)
 box = draw.multiline_textbbox((0, 0), text, font=font, spacing=8, stroke_width=3)
 draw.multiline_text((8-box[0], 8-box[1]), text, font=font, spacing=8, align='center', fill=255, stroke_width=3, stroke_fill=64)
 tile = canvas.crop((0, 0, box[2]-box[0]+16, box[3]-box[1]+16))
 # Collision decisions are made once in geography space, never during rotation.
 lon, lat = math.radians(f['lon']), math.radians(f['lat'])
 center = np.array([math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat)])
 east = np.array([-math.sin(lon), math.cos(lon), 0])
 north = np.cross(center, east)
 width, height = tile.width/2*math.pi/2048, tile.height/2*math.pi/2048
 overlap = False
 for previous in occupied:
  d = previous['center']; denom = float(np.dot(d,center))
  if denom<=0: continue
  dx,dy = float(np.dot(d,east))/denom, float(np.dot(d,north))/denom
  # Bound the rotated previous rectangle in this tangent frame.
  pw = abs(float(np.dot(previous['east'],east)))*previous['w']/2+abs(float(np.dot(previous['north'],east)))*previous['h']/2
  ph = abs(float(np.dot(previous['east'],north)))*previous['w']/2+abs(float(np.dot(previous['north'],north)))*previous['h']/2
  if abs(dx)<width/2+pw+.004 and abs(dy)<height/2+ph+.004: overlap=True;break
 if overlap: continue
 occupied.append({'center':center,'east':east,'north':north,'w':width,'h':height})
 if xpack+tile.width+4>W: xpack=4;ypack+=rowheight+4;rowheight=0
 if ypack+tile.height+4>H: raise ValueError('Text atlas overflow')
 channels[tier].paste(tile,(xpack,ypack))
 placed.append({'name':name,'lon':f['lon'],'lat':f['lat'],'tier':tier,'rect':[xpack,ypack,tile.width,tile.height],'width':width,'height':height})
 xpack+=tile.width+4;rowheight=max(rowheight,tile.height)
Image.merge('RGB',channels).save(ROOT/'static/images/moon/map-names.webp',lossless=True)
(ROOT/'static/images/moon/map-names.json').write_text(json.dumps({'width':W,'height':H,'features':placed},ensure_ascii=False,indent=2)+'\n')
print(f'{len(placed)} spherical name patches; one 2K texture, {(ROOT/"static/images/moon/map-names.webp").stat().st_size//1024} KiB')
