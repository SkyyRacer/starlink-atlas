"""White ISS derived from the pinned NASA IGOAL assembly, like Tiangong.
Regenerate the local decoded build cache with scripts/decode_iss_white.cjs if
its source hash changes. The realistic GLB and its solar rig are read-only.
"""
import gzip,hashlib,json,re
from pathlib import Path
from build_tiangong_white import lines_from_model,write_glb,length,minus
ROOT=Path(__file__).resolve().parents[1]
def build():
 info=next(x for x in json.loads((ROOT/'resources/detailed-model-manifest.json').read_text()) if x['key']=='iss');source=ROOT/'static'/info['url'].split('?')[0];cache=json.loads(gzip.decompress((ROOT/'resources/iss-white-coarse.mesh.json.gz').read_bytes()));assert hashlib.sha256(source.read_bytes()).hexdigest()==cache['sha256'],'Regenerate the ISS decoded cache from the current detailed assembly'
 lines,parts=lines_from_model(source,cache);out=ROOT/'static/images/iss.glb';blob=write_glb(lines,out,generator='Atlas white feature-line adaptation of NASA IGOAL ISS',copyright='NASA IGOAL assembly; white adaptation Atlas; original source and credits in SOURCES.md')
 icon_lines=sorted(lines,key=lambda edge:length(minus(*edge)),reverse=True)[:1600]
 # Preserve the existing sizing, colours, lazy loader and interaction contract.
 p=ROOT/'static/iss-visual.js';s=p.read_text();a=s.index(' segments:');b=s.index('\n get iconURI',a);s=s[:a]+' segments:'+json.dumps(icon_lines,separators=(',',':'))+','+s[b:];s=re.sub(r'iss.glb\?v=[0-9a-f]+','iss.glb?v='+hashlib.sha256(blob).hexdigest()[:12],s);s=s.replace('C.Model.fromGltfAsync({url:', 'C.Model.fromGltfAsync({upAxis:C.Axis.Z,forwardAxis:C.Axis.X,url:');s=s.replace('// Original schematic. No real attitude, docking configuration or scale is implied.','// White outline of the NASA IGOAL assembly. Fixed schematic pose, no live attitude telemetry.');p.write_text(s)
 report={'source':info['source'],'source_file':str(source.relative_to(ROOT)),'source_sha256':cache['sha256'],'credit':'NASA IGOAL · adaptation filaire Atlas','bytes':len(blob),'line_segments':len(lines),'icon_segments':len(icon_lines),'parts':parts,'note':'Feature edges of the calibrated detailed assembly. No textures, no camera or attitude changes; realistic ISS and its solar animation untouched.'};(ROOT/'resources/iss-white-model.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('ISS white:',len(lines),'lines,',len(blob),'bytes')
if __name__=='__main__':build()
