"""Source-to-GLB integrity checks for the actual large Mir model, not a mock."""
import hashlib,importlib.util,json,pathlib,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mir',ROOT/'scripts/convert_mir_celestia.py');mir=importlib.util.module_from_spec(spec);spec.loader.exec_module(mir)
source=(mir.SOURCE/'models/mir.cmod').read_bytes();materials,meshes=mir.parse(source);raw=mir.OUTPUT.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=raw[28+n:];assert struct.unpack_from('<I',raw,8)[0]==len(raw)
def data(index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);return binary[start:start+v['byteLength']]
attrs=g['meshes'][0]['primitives'][0]['attributes'];positions=data(attrs['POSITION']);normals=data(attrs['NORMAL']);uvs=data(attrs['TEXCOORD_0']);offset=0;groups={}
for mesh in meshes:
 attrs_source={sem:position for sem,fmt,position in mesh['attributes']}
 for i in range(mesh['count']):
  start=i*mesh['stride'];j=offset+i
  assert positions[j*12:j*12+12]==mesh['vertices'][start+attrs_source[0]:start+attrs_source[0]+12]
  assert normals[j*12:j*12+12]==mesh['vertices'][start+attrs_source[3]:start+attrs_source[3]+12]
  u,v=struct.unpack_from('<2f',mesh['vertices'],start+attrs_source[5]);actual=struct.unpack_from('<2f',uvs,j*8);assert actual[0]==u and abs(actual[1]-(1-v))<1e-5
 for group in mesh['groups']:
  groups.setdefault(group['material'],bytearray()).extend(b''.join(struct.pack('<I',x[0]+offset) for x in struct.iter_unpack('<I',group['indices'])))
 offset+=mesh['count']
assert len(g['meshes'][0]['primitives'])==len(groups)
for p in g['meshes'][0]['primitives']:assert data(p['indices'])==groups[p['material']],'Triangle order and material association preserved'
for image in g['images']:
 v=g['bufferViews'][image['bufferView']];blob=binary[v['byteOffset']:v['byteOffset']+v['byteLength']];assert blob==(mir.SOURCE/'textures/medres'/image['name']).read_bytes(),'Texture bytes preserved'
assert len(g['materials'])==len(materials)==60 and len(g['images'])==9
for original,converted in zip(materials,g['materials']):
 assert converted['pbrMetallicRoughness']['baseColorFactor'][:3]==list(original['diffuse'])
 assert converted['emissiveFactor']==list(original['emissive'])
 assert converted['extensions']['KHR_materials_specular']['specularColorFactor']==list(original['specular'])
 assert 0<=converted['pbrMetallicRoughness']['baseColorFactor'][3]<=1
assert 'DaveBowman2001' in g['asset']['copyright'] and 'CC BY 4.0' in g['asset']['copyright']
audit=json.loads((ROOT/'resources/mir-conversion-audit.json').read_text());assert audit['triangles']==446331 and audit['vertices']==433434
assert hashlib.sha256(raw).hexdigest()==audit['glb_sha256']
print('Mir : 446 331 triangles, positions, normales, UV, associations de matériaux, neuf textures et crédits vérifiés depuis le CMOD source.')
