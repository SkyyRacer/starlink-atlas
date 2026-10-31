"""White Salyut 1–7 feature edges from their selected, calibrated detailed GLBs."""
import hashlib,json
from pathlib import Path
from build_tiangong_white import lines_from_model,write_glb
from build_science_models import length,minus
ROOT=Path(__file__).resolve().parents[1]
def build():
 detailed=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text())
 manifest=json.loads((ROOT/'resources/science-model-manifest.json').read_text())
 sources=json.loads((ROOT/'resources/science-model-sources.json').read_text());reports=[]
 for number in range(1,8):
  key=f'salyut-{number}';info=next(m for m in detailed if m['key']==key)
  path=ROOT/'static'/info['url'].split('?')[0]
  lines,parts=lines_from_model(path,max_edges_per_primitive=220)
  assert lines and any('Soyuz' in p for p in parts),key+' must retain its docked craft'
  if len(lines)>5000:
   ranked=sorted(lines,key=lambda e:length(minus(*e)),reverse=True);tail=ranked[3000:]
   lines=ranked[:3000]+[tail[int(i*len(tail)/2000)] for i in range(2000)]
  blob=write_glb(lines,ROOT/f'static/images/science/{key}.glb',generator='Atlas Salyut white feature edges from detailed assembly')
  icon=sorted(lines,key=lambda e:length(minus(*e)),reverse=True)[:1000]
  project=lambda p:[.866*p[0]+.5*p[2],-.22*p[0]+.84*p[1]+.38*p[2]]
  drawing=[[project(p) for p in e] for e in icon]
  lo=[min(p[k] for e in drawing for p in e) for k in range(2)];hi=[max(p[k] for e in drawing for p in e) for k in range(2)];span=max(hi[k]-lo[k] for k in range(2))
  drawing=[[[round((p[k]-(lo[k]+hi[k])/2)/span*100,3) for k in range(2)] for p in e] for e in drawing]
  draw=json.dumps({'segments':drawing},separators=(',',':')).encode();(ROOT/f'static/images/science/{key}.json').write_bytes(draw)
  row={'key':key,'page_id':'salyut','ids':info['ids'],'name':f'Saliout {number}','kind':'detailed-model-outline','credit':'Atlas · contours du modèle détaillé','source':info['source'],'glb':f'images/science/{key}.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'drawing':f'images/science/{key}.json?v='+hashlib.sha256(draw).hexdigest()[:12],'radius':round(max(length(p) for e in lines for p in e),3),'segments':len(icon),'line_segments':len(lines),'bytes':len(blob)+len(draw),'body_axes':True}
  manifest=[m for m in manifest if m['key']!=key]+[row]
  sources[key]={'enabled':True,'kind':row['kind'],'page_id':'salyut','ids':info['ids'],'name':row['name'],'credit':row['credit'],'page':info['source'],'detailed_outline':key,'license':'CC BY 4.0 · original Atlas geometry','geometry_note':'Contours de l’assemblage détaillé propre à chaque Saliout ; Soyouz illustratif toujours présent comme sur le modèle détaillé, orientation orbitale nominale non mesurée.'}
  reports.append({'key':key,'ids':info['ids'],'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'line_segments':len(lines),'bytes':len(blob),'parts':parts})
  print(key,len(lines),'lines;',len(blob),'bytes')
 for name,data in [('resources/science-model-manifest.json',manifest),('resources/science-model-sources.json',sources),('resources/salyut-white-models.json',reports)]:
  (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'static/images/science/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
 (ROOT/'static/science-visual.js').write_text((ROOT/'resources/science-visual.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
if __name__=='__main__':build()
