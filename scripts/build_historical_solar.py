"""Add documented historical solar articulation to existing detailed assets only."""
import hashlib,json,struct
from pathlib import Path
from historical_solar_rig import apply
ROOT=Path(__file__).resolve().parents[1]
def build():
 manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());audits=json.loads((ROOT/'resources/historical-solar-tracking.json').read_text()) if (ROOT/'resources/historical-solar-tracking.json').exists() else []
 for info in manifest:
  key=info['key']
  if key not in {'mir','salyut-1','salyut-2','salyut-3','salyut-4','salyut-5','salyut-6','salyut-7','skylab'}:continue
  path=ROOT/'static'/info['url'].split('?')[0];raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
  # A repeat build must start from the normalized unrigged asset. Mir's
  # restore and the general detailed builder now call the same preparation.
  if any(n.get('name','').startswith('Atlas solar hinge ') for n in g['nodes']):
   print(key,'already rigged');continue
  binary,rig,audit=apply(g,binary,key)
  encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
  path.write_bytes(blob);info['url']='images/detailed/'+key+'.glb?v='+hashlib.sha256(blob).hexdigest()[:12];info['bytes']=len(blob);info['solar_rig']=rig
  if audit.get('solar_partition'):info.setdefault('compatibility',{})['solar_partition']=audit['solar_partition']
  sources[key]['historical_solar_tracking']=True
  policy='Fixed deployed arrays; nominal station Sun pointing.' if key in {'skylab','salyut-1'} else 'Documented one-axis array tracking; nominal 180-degree sweep, source-mesh hinge calibration. Historical commands, failures, parking angles and exact mechanical stops are not measured.'
  info['solar_tracking_note']=policy;sources[key]['solar_tracking_note']=policy
  audits[:]=[a for a in audits if a['key']!=key]
  audits.append({'key':key,'joints':len(rig),'policy':policy,**audit});print(key,len(rig),'tracking joints')
 for path,data in [('resources/detailed-model-sources.json',sources),('resources/detailed-model-manifest.json',manifest),('resources/historical-solar-tracking.json',audits)]:
  (ROOT/path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 (ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text());bykey={r['key']:r for r in manifest}
 for row in inventory:
  if row['key'] in {a['key'] for a in audits}:row.update(runtime_url=bykey[row['key']]['url'],runtime_bytes=bykey[row['key']]['bytes'])
 (ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':build()
