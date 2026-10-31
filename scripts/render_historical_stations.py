"""Offline review of original GLB geometry/materials (not a Cesium screenshot).
Requires numpy and Pillow. Rasterises the actual GLB triangles and embedded
base-colour textures to verify silhouettes, winding and surface assignments.
"""
import io,json,math,struct
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
def render(file,width=480,height=340,at=None,eye_position=None):
 blob=file.read_bytes();size=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+size]);binary=blob[28+size:]
 def array(index):
  a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];n={'VEC3':3,'VEC2':2,'VEC4':4,'SCALAR':1}[a['type']];return np.frombuffer(binary,dtype='<f4' if a['componentType']==5126 else '<u4',count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n).copy()
 key=g.get('extras',{}).get('atlasHistoricalStation',g.get('extras',{}).get('atlasOriginalRecreation',{})).get('key');info=next((m for m in json.loads((ROOT/'resources/detailed-model-manifest.json').read_text()) if m['key']==key),{});hidden=set()
 dates={'salyut-1':'1971-06-17','salyut-3':'1974-07-10','salyut-4':'1975-06-01','salyut-5':'1976-07-15','salyut-6':'1978-01-13','salyut-7':'1982-06-27'};at=at or dates.get(key,'2000-01-01')
 def hide(index):
  hidden.add(index)
  for child in g['nodes'][index].get('children',[]):hide(child)
 for visitor in info.get('docked_visitors',[]):
  if visitor.get('visibility')!='always' and not any(v['start']<=at<v['end'] for v in visitor['intervals']):hide(next(i for i,n in enumerate(g['nodes']) if n.get('name')==visitor['node']))
 textures=[];alphas=[]
 for img in g['images']:
  v=g['bufferViews'][img['bufferView']];tex=np.asarray(Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA'),dtype=float)/255;textures.append(tex[:,:,:3]**2.2);alphas.append(tex[:,:,3])
 eye=np.array(eye_position or [22,-28,-22.],dtype=float);eye*=1.6 if key!='tiangong' and any(visitor.get('visibility')=='always' or any(v['start']<=at<v['end'] for v in visitor['intervals']) for visitor in info.get('docked_visitors',[])) else 1;forward=-eye/np.linalg.norm(eye);right=np.cross(forward,[0,0,-1]);right/=np.linalg.norm(right);up=np.cross(right,forward);basis=np.array([right,up,forward]);light=np.array([.3,-.5,-.8]);light/=np.linalg.norm(light);image=np.zeros((height,width,3))+np.array([.022,.038,.062]);depth=np.full((height,width),1e30);focal=width*1.55
 for index,node in enumerate(g['nodes']):
  if index in hidden or 'mesh' not in node:continue
  for primitive in g['meshes'][node['mesh']]['primitives']:
   p=array(primitive['attributes']['POSITION']);normals=array(primitive['attributes']['NORMAL']);uv=array(primitive['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in primitive['attributes'] else np.zeros((len(p),2));tris=array(primitive['indices']).reshape(-1,3);definition=g['materials'][primitive['material']];material=definition['pbrMetallicRoughness'];color=np.array(material['baseColorFactor'][:3])**2.2;metal=material['metallicFactor'];rough=material['roughnessFactor'];tex=textures[g['textures'][material['baseColorTexture']['index']]['source']] if 'baseColorTexture' in material else None
   camera=(p-eye)@basis.T;screen=camera[:,:2]/camera[:,2,None]*focal;screen[:,0]+=width/2;screen[:,1]=height/2-screen[:,1]
   for tri in tris:
    q=screen[tri];z=camera[tri,2];lo=np.maximum(np.floor(q.min(axis=0)).astype(int),[0,0]);hi=np.minimum(np.ceil(q.max(axis=0)).astype(int),[width-1,height-1])
    if np.any(hi<lo):continue
    # Backface culling agrees with the browser's opaque, single-sided material.
    face=np.cross(p[tri[1]]-p[tri[0]],p[tri[2]]-p[tri[0]])
    if np.dot(face,eye-p[tri].mean(axis=0))<=0:continue
    xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5);den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
    if abs(den)<1e-10:continue
    a=((q[1,1]-q[2,1])*(xx-q[2,0])+(q[2,0]-q[1,0])*(yy-q[2,1]))/den;b=((q[2,1]-q[0,1])*(xx-q[2,0])+(q[0,0]-q[2,0])*(yy-q[2,1]))/den;weights=np.stack([a,b,1-a-b],axis=-1);inside=np.all(weights>=0,axis=-1);inv=weights/z;inv/=inv.sum(axis=-1,keepdims=True);zz=(inv*z).sum(axis=-1);sl=(slice(lo[1],hi[1]+1),slice(lo[0],hi[0]+1));mask=inside&(zz<depth[sl]);
    if not mask.any():continue
    n=inv@normals[tri];n/=np.maximum(1e-12,np.linalg.norm(n,axis=-1,keepdims=True));diffuse=np.maximum(0,n@light);view=eye-(inv@p[tri]);view/=np.linalg.norm(view,axis=-1,keepdims=True);half=view+light;half/=np.linalg.norm(half,axis=-1,keepdims=True);spec=np.maximum(0,(n*half).sum(axis=-1))**max(4,2/(rough*rough));base=color
    if tex is not None:
     coords=inv@uv[tri];tx=(coords[:,:,0]*tex.shape[1]).astype(int)%tex.shape[1];ty=(coords[:,:,1]*tex.shape[0]).astype(int)%tex.shape[0];base=base*tex[ty,tx]
     if definition.get('alphaMode')=='MASK':mask &= alphas[g['textures'][material['baseColorTexture']['index']]['source']][ty,tx]>=definition.get('alphaCutoff',.5)
    rgb=base*(.32+.85*diffuse[:,:,None])+(0.04*(1-metal)+metal*base)*spec[:,:,None]*1.8;image[sl][mask]=rgb[mask];depth[sl][mask]=zz[mask]
 return Image.fromarray((np.clip(image,0,1)**(1/2.2)*255).astype('uint8'))
def main():
 audit=json.loads((ROOT/'resources/historical-station-models.json').read_text());w,h=480,380;sheet=Image.new('RGB',(w*3,h*3+80),'#080f19');draw=ImageDraw.Draw(sheet)
 font='/System/Library/Fonts/Supplemental/Arial.ttf';title=ImageFont.truetype(font,26);small=ImageFont.truetype(font,14);draw.text((22,12),'ATLAS · Stations historiques',font=title,fill='white');draw.text((22,48),'Reconstitutions documentées · aperçu hors navigateur des géométries et matériaux',font=small,fill='#b6c6d3')
 for index,item in enumerate(audit['models']):
  col,row=index%3,index//3;x,y=col*w,80+row*h;im=render(ROOT/f"resources/detailed-originals/{item['key']}-atlas.glb",w*2,(h-40)*2).resize((w,h-40),Image.Resampling.LANCZOS);sheet.paste(im,(x,y+34));draw.text((x+18,y+10),item['key'].replace('salyut','Saliout').replace('tiangong','Tiangong'),font=title,fill='white');draw.text((x+18,y+h-22),f"{item['family']} · {item['solar_arrays']} panneaux · {item['length_m']} m",font=small,fill='#a5c2cc')
 out=ROOT/'resources/historical-stations-preview.jpg';sheet.save(out,quality=94);print(out)
if __name__=='__main__':main()
