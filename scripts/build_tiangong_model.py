from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
import json,math,struct,hashlib
# Original wireframe model: Tianhe spine plus Wentian and Mengtian in a T, with six solar wings.
lines=[]
def box(x,y,z,w,h,d):
 p=[(x+i*w,y+j*h,z+k*d) for k in (0,1) for j in (0,1) for i in (0,1)]
 for a,b in [(0,1),(0,2),(0,4),(1,3),(1,5),(2,3),(2,6),(3,7),(4,5),(4,6),(5,7),(6,7)]:lines.append([p[a],p[b]])
box(-2,-18,-2,4,27,4);box(-21,5,-2,42,4,4);box(-3,8,-3,6,4,6)
for x,y,w,h in [(-17,-17,13,6),(4,-17,13,6),(-24,12,7,22),(-24,-19,7,22),(17,12,7,22),(17,-19,7,22)]:
 box(x,y,0,w,h,.5)
 for i in range(1,6):
  yy=y+h*i/6;lines.append([(x,yy,.5),(x+w,yy,.5)])
box(-1,-25,-1,2,7,2)
vertices=[p for pair in lines for p in pair];raw=b''.join(struct.pack('<3f',*p) for p in vertices)
gltf={'asset':{'version':'2.0','generator':'Atlas original schematic Tiangong'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'mode':1,'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1},'emissiveFactor':[1,1,1],'extensions':{'KHR_materials_unlit':{}}}],'extensionsUsed':['KHR_materials_unlit'],'buffers':[{'byteLength':len(raw)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(raw),'target':34962}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(vertices),'type':'VEC3','min':[min(p[i] for p in vertices) for i in range(3)],'max':[max(p[i] for p in vertices) for i in range(3)]}]}
js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*(-len(js)%4);raw+=b'\0'*(-len(raw)%4);out=Path('static/images/tiangong.glb');out.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(raw))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(raw),0x004e4942)+raw)
s=Path('static/iss-visual.js').read_text();a=s.index(' segments:');b=s.index('\n get iconURI',a);s=s[:a]+' segments:'+json.dumps(lines,separators=(',',':'))+','+s[b:]
s=s.replace('window.AtlasISS=','window.AtlasTiangong=').replace('model.id=25544','model.id=48274').replace('viewBox="-58 -38 116 76"','viewBox="-40 -38 80 76"').replace('ctx.scale(size/110,size/110)','ctx.scale(size/64,size/64)')
import re
s=re.sub(r'iss\.glb\?v=[0-9a-f]+','tiangong.glb?v='+hashlib.sha256(out.read_bytes()).hexdigest()[:12],s)
s+='''\nwindow.AtlasStations={models:new Map([[25544,window.AtlasISS],[48274,window.AtlasTiangong]]),has(id){return this.models.has(id);},model(id){return this.models.get(id);},name(id){return id===48274?'Tiangong':'ISS';}};\n'''
Path('static/tiangong-visual.js').write_text(s)
