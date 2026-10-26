"""Reviewed export fixes; retain source geometry and original PNG texture bytes."""
import json,math
from build_science_models import identity,product,node_matrix

def prepare(root,doc,binary,source):
 config=source.get('compatibility',{})
 if not config:return binary,{}
 report={}
 if config.get('png_fallbacks'):
  # IGOAL embeds both WebP and original PNG for every texture. Prefer the PNG
  # fallback consistently, including alpha; no resampling or colour conversion.
  for texture in doc['textures']:
   assert 'source' in texture
   image=doc['images'][texture['source']]
   assert image['mimeType']=='image/png'
   texture.get('extensions',{}).pop('EXT_texture_webp',None)
   if not texture.get('extensions'):texture.pop('extensions',None)
  used={t['source'] for t in doc['textures']}
  images={old:new for new,old in enumerate(sorted(used))}
  removed_views={image['bufferView'] for i,image in enumerate(doc['images']) if i not in used}
  doc['images']=[image for i,image in enumerate(doc['images']) if i in used]
  for texture in doc['textures']:texture['source']=images[texture['source']]
  packed=bytearray();views=[];mapping={}
  for old,view in enumerate(doc['bufferViews']):
   if old in removed_views:continue
   start=view.get('byteOffset',0);payload=binary[start:start+view['byteLength']]
   packed.extend(b'\0'*(-len(packed)%4));mapping[old]=len(views)
   views.append({**view,'byteOffset':len(packed)});packed.extend(payload)
  packed.extend(b'\0'*(-len(packed)%4))
  for accessor in doc.get('accessors',[]):
   if 'bufferView' in accessor:accessor['bufferView']=mapping[accessor['bufferView']]
   for sparse in accessor.get('sparse',{}).values():
    if isinstance(sparse,dict) and 'bufferView' in sparse:sparse['bufferView']=mapping[sparse['bufferView']]
  for mesh in doc['meshes']:
   for primitive in mesh['primitives']:
    draco=primitive.get('extensions',{}).get('KHR_draco_mesh_compression')
    if draco:draco['bufferView']=mapping[draco['bufferView']]
  for image in doc['images']:image['bufferView']=mapping[image['bufferView']]
  doc['bufferViews']=views;doc['buffers'][0]['byteLength']=len(packed);binary=bytes(packed)
  for name in ['extensionsUsed','extensionsRequired']:
   if name in doc:doc[name]=[value for value in doc[name] if value!='EXT_texture_webp']
  report['png_images']=len(doc['images'])
 if config.get('neutral_vertex_colour_audit'):
  audit=json.loads((root/config['neutral_vertex_colour_audit']).read_text())
  assert audit['sha256']==source['sha256']
  removed=[]
  for entry in audit['entries']:
   primitive=doc['meshes'][entry['mesh']]['primitives'][entry['primitive']]
   assert doc['accessors'][primitive['attributes'][entry['attribute']]]['count']==entry['vertices']
   # Extra COLOR_n layers are not used by the material. Remove them with
   # neutral COLOR_0 so indexed semantics remain continuous and spec-compliant.
   attributes=[name for name in primitive['attributes'] if name.startswith('COLOR_')]
   for name in attributes:
    del primitive['attributes'][name]
    primitive.get('extensions',{}).get('KHR_draco_mesh_compression',{}).get('attributes',{}).pop(name,None)
   removed.append({**entry,'removed_attributes':attributes})
  report['neutral_vertex_colours']=removed
 report['material_modes']={}
 for material in doc['materials']:
  mode=config.get('material_modes',{}).get(material.get('name'))
  if mode:
   assert material.get('alphaMode')=='BLEND'
   material['alphaMode']=mode
   if mode=='MASK':material['alphaCutoff']=.5
   report['material_modes'][material['name']]=mode
 alignment=config.get('solar_alignment')
 if alignment:
  world={};names={node.get('name'):i for i,node in enumerate(doc['nodes'])}
  def visit(index,parent):
   node=doc['nodes'][index];world[index]=product(parent,node_matrix(node))
   for child in node.get('children',[]):visit(child,world[index])
  for index in doc['scenes'][doc.get('scene',0)]['nodes']:visit(index,identity())
  unit=lambda v:[x/math.sqrt(sum(y*y for y in v)) for x in v]
  dot=lambda a,b:sum(x*y for x,y in zip(a,b))
  cross=lambda a,b:[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  target=unit(alignment['normal_source']);report['solar_alignment']=[]
  for wing in alignment['joints']:
   joint=names[wing['joint']];plane=names[wing['plane_node']];node=doc['nodes'][joint]
   axis=unit([world[joint][i][2] for i in range(3)])
   normal=unit([world[plane][i][wing['normal_axis']] for i in range(3)])
   assert abs(dot(target,axis))<1e-5 and abs(dot(normal,axis))<1e-5
   angle=math.atan2(dot(axis,cross(normal,target)),dot(normal,target))
   # The IGOAL root has a mirrored scale. Its local positive rotation has
   # the opposite world handedness; account for that before changing a joint.
   columns=[[world[joint][i][j] for i in range(3)] for j in range(3)]
   if dot(columns[0],cross(columns[1],columns[2]))<0:angle=-angle
   x,y,z,w=node.get('rotation',[0,0,0,1]);s,c=math.sin(angle/2),math.cos(angle/2)
   rotation=unit([x*c+y*s,y*c-x*s,z*c+w*s,w*c-z*s])
   node['rotation']=rotation
   report['solar_alignment'].append({**wing,'angle_degrees':math.degrees(angle),'rotation':rotation})
 return binary,report

def solar_rig(doc,source):
 """Calibration in the final body frame, including the mirrored NASA root."""
 alignment=source.get('compatibility',{}).get('solar_alignment')
 if not alignment:return []
 world={};names={node.get('name'):i for i,node in enumerate(doc['nodes'])}
 def visit(index,parent):
  node=doc['nodes'][index];world[index]=product(parent,node_matrix(node))
  for child in node.get('children',[]):visit(child,world[index])
 for index in doc['scenes'][doc.get('scene',0)]['nodes']:visit(index,identity())
 column_major=lambda matrix:[matrix[i][j] for j in range(4) for i in range(4)]
 rig=[];groups=alignment.get('alpha_groups',[])
 alpha_for={name:group['joint'] for group in groups for name in group['beta_joints']}
 for group in groups:
  joint=names[group['joint']]
  reference=next(wing for wing in alignment['joints'] if wing['joint']==group['beta_joints'][0])
  plane=names[reference['plane_node']]
  normal=[world[plane][i][reference['normal_axis']] for i in range(3)];length=math.sqrt(sum(x*x for x in normal))
  rig.append({'name':group['joint'],'kind':'alpha','base_matrix':column_major(node_matrix(doc['nodes'][joint])),
              'body_from_joint':column_major(world[joint]),'normal_body':[x/length for x in normal]})
 for wing in alignment['joints']:
  joint=names[wing['joint']];plane=names[wing['plane_node']]
  normal=[world[plane][i][wing['normal_axis']] for i in range(3)];length=math.sqrt(sum(x*x for x in normal))
  rig.append({'name':wing['joint'],'kind':'beta','alpha':alpha_for.get(wing['joint']),'base_matrix':column_major(node_matrix(doc['nodes'][joint])),
              'body_from_joint':column_major(world[joint]),'normal_body':[x/length for x in normal]})
 return rig
