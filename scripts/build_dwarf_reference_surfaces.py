"""UV asset conversion, not new observations: GIF inverse projection and NASA UV atlas.
Input references are retained verbatim; no AI-generated scientific terrain.
Run with numpy, Pillow and scipy (only needed for offline asset conversion).
"""
import hashlib,io,json,math,pathlib,struct
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter,map_coordinates,distance_transform_edt
from scipy.optimize import least_squares
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'resources/dwarf-planets';OUT=ROOT/'static/solar/dwarfs'
def image_sample(image,uv):
 a=np.asarray(image.convert('RGB'),dtype=float);x=np.clip(uv[...,0],0,1)*(a.shape[1]-1);y=np.clip(uv[...,1],0,1)*(a.shape[0]-1)
 return np.stack([map_coordinates(a[:,:,i],[y,x],order=1,mode='nearest') for i in range(3)],axis=-1)
def fill_missing(rgb,valid):
 if not valid.all():
  indices=distance_transform_edt(~valid,return_distances=False,return_indices=True);rgb[~valid]=rgb[tuple(i[~valid] for i in indices)]
 return rgb
def nasa_makemake():
 blob=(SRC/'makemake.glb').read_bytes();z=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+z]);binary=blob[28+z:]
 def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']];return np.frombuffer(binary,dtype=dtype,count=a['count']*count,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],count)
 primitive=g['meshes'][0]['primitives'][0];vertices=acc(primitive['attributes']['POSITION']);uv=acc(primitive['attributes']['TEXCOORD_0']);triangles=acc(primitive['indices']).reshape(-1,3)
 ix=g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index'];image=g['images'][g['textures'][ix]['source']];v=g['bufferViews'][image['bufferView']];tex=Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]))
 width,height=2048,1024;rgb=np.zeros((height,width,3));valid=np.zeros((height,width),bool)
 # The source atlas has six UV islands. Reproject its actual vertex UVs;
 # treating that image as an equirectangular map would paint white boxes.
 p=vertices/np.linalg.norm(vertices,axis=1)[:,None];lon=np.arctan2(p[:,1],p[:,0]);lat=np.arcsin(np.clip(p[:,2],-1,1));coords=np.c_[(lon/(2*np.pi)+.5)*(width-1),(.5-lat/np.pi)*(height-1)]
 for tri in triangles:
  q=coords[tri].copy();u=uv[tri]
  if np.ptp(q[:,0])>width/2:q[q[:,0]<width/2,0]+=width-1
  lo=np.maximum(0,np.floor(q.min(0)).astype(int));hi=np.minimum([2*width-2,height-1],np.ceil(q.max(0)).astype(int))
  if (hi<lo).any():continue
  xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));den=(q[1,1]-q[2,1])*(q[0,0]-q[2,0])+(q[2,0]-q[1,0])*(q[0,1]-q[2,1])
  if abs(den)<1e-10:continue
  a=((q[1,1]-q[2,1])*(xx-q[2,0])+(q[2,0]-q[1,0])*(yy-q[2,1]))/den;b=((q[2,1]-q[0,1])*(xx-q[2,0])+(q[0,0]-q[2,0])*(yy-q[2,1]))/den;c=1-a-b;inside=(a>=-1e-5)&(b>=-1e-5)&(c>=-1e-5)
  if not inside.any():continue
  sample=a[...,None]*u[0]+b[...,None]*u[1]+c[...,None]*u[2];colors=image_sample(tex,sample);ix=xx[inside]%(width-1);iy=yy[inside];rgb[iy,ix]=colors[inside];valid[iy,ix]=True
 rgb=fill_missing(rgb,valid);rgb[:,-1]=rgb[:,0];Image.fromarray(np.clip(rgb,0,255).astype('uint8')).save(OUT/'makemake-reference.webp',quality=94)
 return {'source':'https://science.nasa.gov/resource/makemake-3d-model/','reference':'https://commons.wikimedia.org/wiki/File:Makemake_Animation.gif','credit':'NASA VTAD · animation Charlestpt, domaine public','method':'Reprojection des coordonnées UV du modèle NASA original ; surface illustrative, non cartographiée.'}
def rz(a):return np.array([[np.cos(a),-np.sin(a),0],[np.sin(a),np.cos(a),0],[0,0,1]])
def rx(a):return np.array([[1,0,0],[0,np.cos(a),-np.sin(a)],[0,np.sin(a),np.cos(a)]])
def haumea_reference():
 gif=Image.open(SRC/'Haumea_Rotation.gif');frames=[];centres=[];covariances=[]
 for k in range(gif.n_frames):
  gif.seek(k);a=np.asarray(gif.convert('RGB'));yy,xx=np.nonzero(a.max(2)>10);frames.append(Image.fromarray(a));centres.append([(xx.min()+xx.max())/2,(yy.min()+yy.max())/2]);covariances.append(np.cov(np.c_[xx,yy].T)*4)
 covariances=np.array(covariances);centres=np.array(centres);angles=np.arange(len(frames))*2*np.pi/len(frames)
 def camera(x,k):return rz(x[4])@rx(x[3])@rz(angles[k]+x[5])
 def error(x):
  values=[]
  for k in range(len(frames)):
   p=camera(x,k)[:2]@np.diag(x[:3]);delta=(p@p.T-covariances[k])/60000;values.extend(delta.ravel())
  return values
 fits=[least_squares(error,[290,215,150,1.2,.9,p],bounds=([200,130,80,.2,-np.pi,-7],[400,310,230,2.9,np.pi,7])) for p in [0,1,2,3]];fit=min(fits,key=lambda f:np.linalg.norm(f.fun));x=fit.x
 width,height=2048,1024;lat,lon=np.mgrid[np.pi/2:-np.pi/2:complex(height),-np.pi:np.pi:complex(width)];unit=np.stack([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)],axis=-1);position=unit*x[:3];normal=unit/x[:3];normal/=np.linalg.norm(normal,axis=-1)[...,None];rgb=np.zeros((height,width,3));total=np.zeros((height,width))
 for k,frame in enumerate(frames):
  cam=camera(x,k);p=position@cam.T;n=normal@cam.T
  # Match each reference silhouette without inheriting its camera movement.
  pred=(cam[:2]@np.diag(x[:3]));pred=pred@pred.T;v,e=np.linalg.eigh(pred);inverse=e@np.diag(1/np.sqrt(v))@e.T;v,e=np.linalg.eigh(covariances[k]);adjust=e@np.diag(np.sqrt(v))@e.T@inverse
  xy=p[...,:2]@adjust.T+centres[k];uv=xy/np.array(frame.size);color=image_sample(frame,uv);weight=np.maximum(0,n[...,2])**24;weight*=color.max(2)>15
  # Remove only broad baked illumination; the site's Sun supplies the light.
  luminance=color.mean(2);broad=gaussian_filter(luminance,18);gain=np.clip(180/np.maximum(35,broad),.7,4.5);color*=gain[...,None];rgb+=color*weight[...,None];total+=weight
 valid=total>1e-10;rgb/=np.maximum(1e-10,total)[...,None];rgb=fill_missing(rgb,valid);row_light=gaussian_filter(rgb.mean(axis=(1,2)),8);rgb*=np.clip(180/np.maximum(35,row_light),.5,4)[:,None,None];grey=rgb.mean(axis=2)[...,None];rgb=grey+(rgb-grey)*1.4;cap=np.clip((np.abs(lat)-.92)/(.5*np.pi-.92),0,1);cap=cap*cap*(3-2*cap);rgb=rgb*(1-cap[...,None])+np.array([181,180,178])*cap[...,None];rgb[:,-1]=(rgb[:,-1]+rgb[:,0])/2;rgb[:,0]=rgb[:,-1];Image.fromarray(np.clip(rgb,0,255).astype('uint8')).save(OUT/'haumea-reference.webp',quality=94)
 return {'source':'https://commons.wikimedia.org/wiki/File:Haumea_Rotation.gif','credit':'Stephanie Hoover · CC0 1.0','method':'Adaptation par reprojection des 36 images de la référence sur une carte UV ; éclairage large corrigé, détails et zone rougeâtre issus du GIF. Illustration, pas une carte observée. Régions non visibles prolongées à partir des bords.','silhouette_fit_error':float(np.linalg.norm(fit.fun))}
def pluto_balance():
 source=np.asarray(Image.open(OUT/'pluton.webp').convert('RGB'),dtype=float);lum=source.mean(2);low=gaussian_filter(source,(5,5,0),mode=('nearest','wrap','nearest'));detail=source-low
 energy=np.sqrt(gaussian_filter(np.mean(detail*detail,axis=2),22,mode=('nearest','wrap')))
 # Limit excess local high-frequency contrast continuously instead of sharpening
 # poorly observed regions into fictitious terrain. Colour/large features retained.
 gain=np.minimum(1,7/np.maximum(1e-4,energy));gain=gaussian_filter(gain,16,mode=('nearest','wrap'));rgb=low+detail*gain[...,None]
 rgb[:,-1]=(rgb[:,-1]+rgb[:,0])/2;rgb[:,0]=rgb[:,-1];Image.fromarray(np.clip(rgb,0,255).astype('uint8')).save(OUT/'pluton-balanced.webp',quality=94)
 return {'source':'https://science.nasa.gov/resource/pluto-3d-model/','credit':'NASA/JHUAPL/SwRI / VTAD','method':'Atténuation douce des écarts de contraste haute fréquence ; aucune texture ajoutée aux zones non résolues. La carte source reste conservée.'}
def build():
 # Haumea deliberately keeps its original Atlas surface (user preference).
 methods={'makemake':nasa_makemake(),'pluton':pluto_balance()}
 for key,entry in methods.items():
  entry['note']='Carte New Horizons : écarts de netteté atténués ; les régions peu observées restent moins définies.' if key=='pluton' else 'Surface illustrative adaptée de la référence · '+entry['credit']+'. Aucune carte résolue disponible.'
  name={'haumea':'haumea-reference.webp','makemake':'makemake-reference.webp','pluton':'pluton-balanced.webp'}[key];entry['path']='solar/dwarfs/'+name;entry['sha256']=hashlib.sha256((OUT/name).read_bytes()).hexdigest()
 (OUT/'surface-sources.json').write_text(json.dumps(methods,ensure_ascii=False,indent=2))
 for path in [ROOT/'static/solar/catalog.json',OUT/'catalog.json']:
  data=json.loads(path.read_text());bodies=data['bodies'] if isinstance(data,dict) else data
  for b in bodies:
   if b['key'] not in methods:continue
   m=methods[b['key']];b['surface']=m['path'];b['surface_credit']=m['credit'];b['surface_source']=m['source']
   b['surface_note']=m['note']
  path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 print(json.dumps(methods,ensure_ascii=False,indent=2))
if __name__=='__main__':build()
