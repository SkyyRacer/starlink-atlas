"""Derived CC BY Mir asset: subtle PBR microstructure, unchanged authored mesh/UV; photo-referenced colour adaptation.
Surface relief is illustrative, not measured historic damage or new hardware.
"""
import hashlib,io,json,struct
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def build():
 source=ROOT/'resources/detailed-originals/mir-celestia.glb';raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);binary=bytearray(raw[28+n:]);original_length=len(binary);report=[]
 def image(array,name):
  out=io.BytesIO();Image.fromarray(array.astype('uint8'),'RGB').save(out,format='PNG');data=out.getvalue();binary.extend(b'\0'*(-len(binary)%4));v=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary.extend(data);i=len(g['images']);g['images'].append({'name':name,'mimeType':'image/png','bufferView':v});t=len(g['textures']);g['textures'].append({'source':i,'sampler':0});return t
 for index,im in enumerate(list(g['images'])):
  name=im.get('name','')
  if name not in ['metallwhite.png','chrome.png','paneliss3.png']:continue
  v=g['bufferViews'][im['bufferView']];texture=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB');rgb=np.asarray(texture,dtype=float)/255;h,w=rgb.shape[:2];y,x=np.mgrid[:h,:w];rng=np.random.default_rng(16609+index)
  # Existing cell and metal texture patterns stay registered to their original UVs.
  lum=rgb.mean(axis=2);noise=rng.normal(0,1,(h,w));micro=.16*noise+.10*np.sin(x*1.37+y*.21)
  if name=='paneliss3.png':height=.12*lum+.018*micro;base=.29;variation=.045;normal_scale=.18
  elif name=='chrome.png':height=.025*micro+.008*np.sin(y*1.9);base=.24;variation=.035;normal_scale=.16
  else:height=.10*lum+.07*micro;base=.49;variation=.065;normal_scale=.25
  dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.5;dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.5;norm=np.stack([-dx*2,-dy*2,np.ones_like(dx)],axis=2);norm/=np.linalg.norm(norm,axis=2,keepdims=True);normal=image(np.clip((norm*.5+.5)*255,0,255),name+' · subtle surface normal')
  rough=np.clip(base+variation*(noise*.3+(1-lum)),.14,.75);orm=np.stack([np.ones_like(rough),rough,np.ones_like(rough)],axis=2);roughness=image(orm*255,name+' · surface roughness')
  mats=[]
  for m in g['materials']:
   p=m['pbrMetallicRoughness'];t=p.get('baseColorTexture',{}).get('index')
   if t is not None and g['textures'][t]['source']==index:
    m['normalTexture']={'index':normal,'scale':normal_scale};p['metallicRoughnessTexture']={'index':roughness};p['roughnessFactor']=1;mats.append(m['name'])
  report.append({'source_texture':name,'materials':mats,'normal_scale':normal_scale})
 from color_mir_textures import apply as colours
 colour_report=colours(g,binary,image)
 from remap_mir_markings import apply as repair_markings
 marking_report=repair_markings(g,binary,image)
 # Bake tangent frames once so every browser uses the same normal-map orientation.
 def array(i,dim):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype='<f4' if a['componentType']==5126 else '<u4'
  return np.frombuffer(binary,dtype=dtype,count=a['count']*dim,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim).astype(float)
 for mesh in g['meshes']:
  attrs=mesh['primitives'][0]['attributes'];pos=array(attrs['POSITION'],3);uv=array(attrs['TEXCOORD_0'],2);normal=array(attrs['NORMAL'],3);tan=np.zeros_like(pos);bitan=np.zeros_like(pos)
  for p in mesh['primitives']:
   if not g['materials'][p['material']].get('normalTexture'):continue
   tri=array(p['indices'],1).astype(int).reshape(-1,3);e1=pos[tri[:,1]]-pos[tri[:,0]];e2=pos[tri[:,2]]-pos[tri[:,0]];d1=uv[tri[:,1]]-uv[tri[:,0]];d2=uv[tri[:,2]]-uv[tri[:,0]];det=d1[:,0]*d2[:,1]-d1[:,1]*d2[:,0];inv=np.zeros_like(det);np.divide(1,det,out=inv,where=np.abs(det)>1e-12);t=(e1*d2[:,1,None]-e2*d1[:,1,None])*inv[:,None];b=(e2*d1[:,0,None]-e1*d2[:,0,None])*inv[:,None]
   for k in range(3):np.add.at(tan,tri[:,k],t);np.add.at(bitan,tri[:,k],b)
  normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12);tan-=normal*np.sum(tan*normal,axis=1,keepdims=True);lengths=np.linalg.norm(tan,axis=1);missing=lengths<1e-12;axes=np.zeros_like(normal);axes[:,0]=1;axes[np.abs(normal[:,0])>.9]=[0,1,0];tan[missing]=np.cross(axes[missing],normal[missing]);tan/=np.maximum(np.linalg.norm(tan,axis=1,keepdims=True),1e-12);hand=np.where(np.sum(np.cross(normal,tan)*bitan,axis=1)<0,-1,1);data=np.column_stack([tan,hand]).astype('<f4').tobytes();binary.extend(b'\0'*(-len(binary)%4));v=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data),'target':34962});binary.extend(data);a=len(g['accessors']);g['accessors'].append({'bufferView':v,'componentType':5126,'count':len(pos),'type':'VEC4'})
  for p in mesh['primitives']:
   if g['materials'][p['material']].get('normalTexture'):p['attributes']['TANGENT']=a
 binary.extend(b'\0'*(-len(binary)%4));g['buffers'][0]['byteLength']=len(binary);g['asset']['generator']='Atlas surface adaptation of DaveBowman2001 Mir';g['extras']['surface_adaptation']='Subtle illustrative normal/roughness maps; original geometry and UVs preserved; interpreted PBR and photo-referenced colour finish.';encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);blob=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary;(ROOT/'resources/detailed-originals/mir-celestia-surfaces.glb').write_bytes(blob)
 (ROOT/'resources/mir-surface-details.json').write_text(json.dumps({'source':str(source.relative_to(ROOT)),'source_sha256':hashlib.sha256(raw).hexdigest(),'original_binary_bytes':original_length,'geometry_preserved':True,'original_colour_images_preserved':True,'surfaces':report,'colour_textures':colour_report,'marking_uv_repair':marking_report},indent=2)+'\n');print('Mir surface maps:',len(report),'families;',len(blob),'bytes')
if __name__=='__main__':build()
