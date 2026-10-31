"""Stable Skylab PBR highlights; preserve NASA's compressed mesh and colours."""
import hashlib,json,struct
from pathlib import Path
from model_compatibility import prepare
ROOT=Path(__file__).resolve().parents[1]
def build():
 sources=json.loads((ROOT/'resources/detailed-model-sources.json').read_text());source=sources['skylab'];manifest=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());info=next(r for r in manifest if r['key']=='skylab')
 source['material_finishes'].update({name:{'metallicFactor':metal,'roughnessFactor':rough} for name,metal,rough in [('blinn4SG',.7,.5),('anisotropic1SG',.8,.48),('initialShadingGr',.55,.5),('apollohorns_blin',.8,.44),('apollohorns_bli1',.45,.48),('blinn11SG',.2,.46),('blinn14SG',.2,.46),('lambert7SG',.2,.46),('blinn17SG',.2,.46)]})
 source['render_lighting']={'light_color':[1,1,1],'ibl_factor':[.6,.45]}
 path=ROOT/'static/images/detailed/skylab.glb';raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:]
 # Exported Maya specular colours include 2.0 and 1.38 multipliers. Keep
 # neutral colour, bound its energy and retain coloured-metal PBR highlights.
 overrides={m['name']:{'specularColorFactor':[min(1,max(0,v)) for v in m['extensions']['KHR_materials_specular']['specularColorFactor']],'specularFactor':.65} for m in g['materials'] if 'KHR_materials_specular' in m.get('extensions',{})}
 source.setdefault('compatibility',{})['material_specular']=overrides
 binary,report=prepare(ROOT,g,binary,source)
 for m in g['materials']:
  finish=source['material_finishes'].get(m['name'])
  if finish:m['pbrMetallicRoughness'].update(finish)
 data=json.dumps(g,separators=(',',':')).encode();data+=b' '*(-len(data)%4);blob=struct.pack('<III',0x46546c67,2,28+len(data)+len(binary))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary;path.write_bytes(blob)
 info.update(bytes=len(blob),url='images/detailed/skylab.glb?v='+hashlib.sha256(blob).hexdigest()[:12],compatibility=report,material_finishes=source['material_finishes'],render_lighting=source['render_lighting'])
 for file,value in [('resources/detailed-model-sources.json',sources),('resources/detailed-model-manifest.json',manifest),('resources/skylab-reflection-stability.json',{'source':info['original_file'],'source_sha256':info['sha256'],'source_buffers_preserved':True,'material_finishes':source['material_finishes'],'material_specular':overrides,'render_lighting':source['render_lighting'],'geometry_audit':'Five coincident triangle pairs found in decoded source cache, within the same primitives; no widespread overlapping module caps as on Tiangong. Original Draco geometry left untouched.'})]:
  (ROOT/file).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'static/images/detailed/manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 (ROOT/'static/detailed-models.js').write_text((ROOT/'resources/detailed-models.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))))
 inventory=json.loads((ROOT/'resources/model-runtime-manifest.json').read_text())
 for row in inventory:
  if row['key']=='skylab':row.update(runtime_url=info['url'],runtime_bytes=info['bytes'])
 (ROOT/'resources/model-runtime-manifest.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
 print('Skylab: bounded source specular factors, broader metal reflections, calibrated IBL; original Draco buffers unchanged')
if __name__=='__main__':build()
