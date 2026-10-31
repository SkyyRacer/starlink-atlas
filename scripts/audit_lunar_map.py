"""Compare local lunar maps and every selected feature with NASA/USGS files.
Read-only apart from the JSON audit report. Pillow and NumPy are build tools.
Download the official TIFF/KMZ to --source-dir before running this script.
"""
import argparse,datetime,hashlib,json,math,pathlib,xml.etree.ElementTree as ET,zipfile
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def correlation(a,b):return float(np.corrcoef(a.ravel(),b.ravel())[0,1])
def audit(source_dir):
 source=source_dir/'lroc-original-4k.tif';names=source_dir/'moon-names.kmz';local=ROOT/'static/images/moon'
 original=np.array(Image.open(source).convert('RGB'),dtype=np.float32);photo=np.array(Image.open(local/'lroc-4k.webp').convert('RGB'),dtype=np.float32)
 assert original.shape==photo.shape==(2048,4096,3),'Unexpected map dimensions'
 mse=float(np.mean((original-photo)**2));psnr=10*math.log10(255**2/mse)
 assert psnr>40,'Local photographic texture differs from its NASA source'
 a=np.array(Image.open(local/'lroc-4k.webp').convert('L').resize((1024,512)),dtype=np.float32)
 b=np.array(Image.open(local/'map-4k.webp').convert('L').resize((1024,512)),dtype=np.float32)
 registration={'aligned':correlation(a,b),'longitude_180_error':correlation(a,np.roll(b,512,axis=1)),'east_west_mirror_error':correlation(a,b[:,::-1]),'north_south_flip_error':correlation(a,b[::-1])}
 assert registration['aligned']>.99
 assert all(registration['aligned']>v+.3 for k,v in registration.items() if k!='aligned'),'Ambiguous surface orientation'
 ns={'k':'http://www.opengis.net/kml/2.2'}
 with zipfile.ZipFile(names) as z:xml=ET.fromstring(z.read('MOON_nomenclature_center_pts.kml'))
 official={}
 for p in xml.findall('.//k:Placemark',ns):
  row={s.attrib['name']:s.text for s in p.findall('.//k:SimpleData',ns)};row['name']=p.findtext('k:name',namespaces=ns);official[int(row['link'].rsplit('/',1)[-1])]=row
 features=json.loads((local/'features.json').read_text());max_error=0
 for f in features:
  r=official[f['source_id']];assert r['name']==f['name'],f['name']
  error=max(abs((f['lon']-float(r['center_lon'])+180)%360-180),abs(f['lat']-float(r['center_lat'])))
  max_error=max(max_error,error);assert error<1e-6,f['name']
 labels=json.loads((local/'map-names.json').read_text())['features']
 for label in labels:
  matches=[f for f in features if abs((label['lon']-f['lon']+180)%360-180)<1e-6 and abs(label['lat']-f['lat'])<1e-6]
  assert len(matches)==1,label['name']
 return {'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nasa_source':{'url':'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif','sha256':sha(source)},'usgs_source':{'url':'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz','sha256':sha(names)},'official_features':len(official),'checked_features':len(features),'checked_labels':len(labels),'max_coordinate_difference_degrees':max_error,'photo_source_psnr_db':psnr,'map_registration_correlation':registration,'files':{p.name:sha(p) for p in [local/'features.json',local/'map-names.json',local/'map-names.webp',local/'map-4k.webp',local/'lroc-4k.webp']},'limitations':['Surface is a reference mosaic, not an image observed at the selected date.','Geometry is a sphere; actual terrain relief is not rendered.','This source and coordinate audit does not assert a GPU screenshot verification.']}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=pathlib.Path,required=True);parser.add_argument('--output',type=pathlib.Path,default=ROOT/'resources/lunar-map-audit.json');args=parser.parse_args();result=audit(args.source_dir);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['checked_features','checked_labels','max_coordinate_difference_degrees','photo_source_psnr_db','map_registration_correlation']},ensure_ascii=False))
