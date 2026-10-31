"""Compact white feature-line models derived from the three Atlas detailed GLBs.
Preserves source assembly frames and docked craft; drops textures, decals and
small fasteners. White display remains schematic, without real-time attitude.
"""
import collections,hashlib,json,math,re,struct
from pathlib import Path
from build_science_models import glb,identity,product,transform,node_matrix,unit,cross,minus,dot,length
ROOT=Path(__file__).resolve().parents[1]
KEYS={'tiangong':48274,'tiangong-1':37820,'tiangong-2':41765}
SKIP=re.compile(r'fasten|stud|buckle|seam|name |identification|flag|dark cells|flexible solar cells|solar leaf cells|radiator recessed|mast diagonal|panel tension|grab rail|handrail foot',re.I)

def lines_from_model(path,decoded=None,max_edges_per_primitive=None):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=decoded if decoded is not None else json.loads(raw[20:20+n]);blob=raw[28+n:];lines={};parts=[]
 def array(index):
  a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dim={'SCALAR':1,'VEC3':3}[a['type']];typ={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];fmt='<'+typ*dim;stride=v.get('byteStride',struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [struct.unpack_from(fmt,blob,start+j*stride) for j in range(a['count'])]
 def visit(i,parent):
  node=g['nodes'][i];matrix=product(parent,node_matrix(node));name=node.get('name','')
  if 'mesh' in node and g['meshes'][node['mesh']]['primitives'] and not SKIP.search(name):
   parts.append(name)
   for primitive in g['meshes'][node['mesh']]['primitives']:
    if primitive.get('mode',4)!=4:continue
    pts=[tuple(round(v,4) for v in transform(matrix,p)) for p in (primitive['positions'] if 'positions' in primitive else array(primitive['attributes']['POSITION']))];indices=primitive['indices'] if 'positions' in primitive else [v[0] for v in array(primitive['indices'])];edges=collections.defaultdict(list)
    for j in range(0,len(indices),3):
     tri=[pts[indices[j+k]] for k in range(3)];normal=unit(cross(minus(tri[1],tri[0]),minus(tri[2],tri[0])))
     if length(normal)<.5:continue
     for a,b in zip(tri,tri[1:]+tri[:1]):
      if a!=b:edges[tuple(sorted((a,b)))].append(normal)
    # A smooth cylinder has no creased longitudinal edges. Keep four body
    # meridians as schematic construction lines so it reads as a connected hull.
    if re.search(r'cabin|module|section|shoulder|cone|neck|capsule',name,re.I):
     axis=1 if name.startswith(('Wentian','Mengtian')) else 2 if 'Shenzhou nadir' in name else 0
     transverse=[k for k in range(3) if k!=axis];center={k:(min(p[k] for p in pts)+max(p[k] for p in pts))/2 for k in transverse}
     for edge in edges:
      a,b=edge
      if abs(a[axis]-b[axis])>.25 and any(abs(a[k]-center[k])<.001 and abs(b[k]-center[k])<.001 for k in transverse):lines[edge]=edge
    feature_edges=[]
    for edge,normals in edges.items():
     if length(minus(*edge))<.055:continue
     if len(normals)==1 or any(abs(dot(normals[0],v))<math.cos(math.radians(18)) for v in normals[1:]):feature_edges.append(edge)
    if max_edges_per_primitive and len(feature_edges)>max_edges_per_primitive:
     feature_edges.sort(key=lambda e:length(minus(*e)),reverse=True);count=max_edges_per_primitive//2;tail=feature_edges[count:];feature_edges=feature_edges[:count]+[tail[int(i*len(tail)/(max_edges_per_primitive-count))] for i in range(max_edges_per_primitive-count)]
    for edge in feature_edges:lines[edge]=edge
  for child in node.get('children',[]):visit(child,matrix)
 for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,identity())
 return list(lines.values()),parts

def write_glb(lines,path,generator='Atlas Tiangong white feature edges from detailed reconstruction',copyright='Original Atlas geometry, CC BY 4.0'):
 raw=glb(lines);n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);blob=raw[28+n:];g['nodes'][0].pop('rotation',None);g['asset']['generator']=generator;g['asset']['copyright']=copyright;js=json.dumps(g,separators=(',',':')).encode();js+=b' '*(-len(js)%4);out=struct.pack('<III',0x46546c67,2,28+len(js)+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob;path.write_bytes(out);return out

def build():
 detailed=json.loads((ROOT/'resources/detailed-model-manifest.json').read_text());manifest=json.loads((ROOT/'resources/science-model-manifest.json').read_text());sources=json.loads((ROOT/'resources/science-model-sources.json').read_text());report=[]
 for key,ident in KEYS.items():
  info=next(m for m in detailed if m['key']==key);source=ROOT/'static'/info['url'].split('?')[0];lines,parts=lines_from_model(source);dest=ROOT/('static/images/tiangong.glb' if key=='tiangong' else f'static/images/science/{key}.glb');blob=write_glb(lines,dest)
  project=lambda p:[.866*p[0]+.5*p[2],-.22*p[0]+.84*p[1]+.38*p[2]]
  icon_lines=sorted(lines,key=lambda e:length(minus(*e)),reverse=True)[:1600]
  drawing=[list(map(project,edge)) for edge in icon_lines];lo=[min(p[i] for edge in drawing for p in edge) for i in range(2)];hi=[max(p[i] for edge in drawing for p in edge) for i in range(2)];span=max(hi[i]-lo[i] for i in range(2));drawing=[[[round((p[i]-(lo[i]+hi[i])/2)/span*100,3) for i in range(2)] for p in edge] for edge in drawing];drawing_blob=json.dumps({'segments':drawing},separators=(',',':')).encode()
  if key=='tiangong':
   p=ROOT/'static/tiangong-visual.js';s=p.read_text();a=s.index(' segments:');b=s.index('\n get iconURI',a);s=s[:a]+' segments:'+json.dumps(icon_lines,separators=(',',':'))+','+s[b:];s=re.sub(r'tiangong.glb\?v=[0-9a-f]+','tiangong.glb?v='+hashlib.sha256(blob).hexdigest()[:12],s);p.write_text(s)
  else:
   drawfile=ROOT/f'static/images/science/{key}.json';drawfile.write_bytes(drawing_blob)
   row={'key':key,'page_id':key,'ids':[ident],'name':key.replace('tiangong','Tiangong'),'kind':'original-reconstruction-outline','credit':'Atlas · contours de la reconstitution détaillée','source':info['source'],'glb':f'images/science/{key}.glb?v='+hashlib.sha256(blob).hexdigest()[:12],'drawing':f'images/science/{key}.json?v='+hashlib.sha256(drawing_blob).hexdigest()[:12],'radius':round(max(length(p) for e in lines for p in e),3),'segments':len(icon_lines),'line_segments':len(lines),'bytes':len(blob)+len(drawing_blob),'body_axes':True}
   manifest=[m for m in manifest if m['key']!=key]+[row];sources[key]={'enabled':True,'kind':row['kind'],'credit':row['credit'],'page':info['source'],'detailed_outline':key,'geometry_note':'Contours derived from the current Atlas detailed assembly, including the docked Shenzhou. Fixed illustrative white pose, no real attitude claim.'}
  report.append({'key':key,'id':ident,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'line_segments':len(lines),'bytes':len(blob),'parts':parts});print(key,len(lines),'lines',len(blob),'bytes')
 (ROOT/'resources/science-model-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/images/science/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')));(ROOT/'resources/science-model-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n');(ROOT/'static/science-visual.js').write_text((ROOT/'resources/science-visual.template.js').read_text().replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False,separators=(',',':'))));(ROOT/'resources/tiangong-white-models.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':build()
