"""Original schematic ISS wire model (metres), plus shared 2D line drawing."""
import json,math,struct,pathlib,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
lines=[]
def line(a,b):lines.append([list(a),list(b)])
def box(x,y,z,w,h,d):
    pts=[(x+i*w,y+j*h,z+k*d) for k in (0,1) for j in (0,1) for i in (0,1)]
    for a,b in [(0,1),(0,2),(0,4),(1,3),(1,5),(2,3),(2,6),(3,7),(4,5),(4,6),(5,7),(6,7)]:line(pts[a],pts[b])
# Main truss and eight paired solar wings, deliberately simplified.
box(-52,-1,-1,104,2,2)
for x in [-44,-28,25,41]:
    for y in [-32,4]:
        box(x,y,0,7,28,0.7)
        for yy in range(1,7):line((x,y+yy*4,0.7),(x+7,y+yy*4,0.7))
        line((x+3.5,y,0.7),(x+3.5,y+28,0.7))
# Pressurised spine, cross-module and radiators.
box(-3,-16,-3,6,37,6);box(-10,-5,-2,20,5,4)
box(-2,21,-2,4,10,4)
for x in [-19,11]:box(x,-12,-1,8,9,1)
# A small cupola and docking module.
box(-1,-22,-1,2,6,2);box(3,8,3,4,5,3)
vertices=[p for segment in lines for p in segment]
raw=b''.join(struct.pack('<3f',*p) for p in vertices)
lo=[min(p[i] for p in vertices) for i in range(3)];hi=[max(p[i] for p in vertices) for i in range(3)]
gltf={'asset':{'version':'2.0','generator':'Atlas original schematic ISS'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'rotation':[math.sin(math.radians(-35)),0,0,math.cos(math.radians(-35))]}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'mode':1,'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1},'emissiveFactor':[1,1,1],'extensions':{'KHR_materials_unlit':{}}}],'extensionsUsed':['KHR_materials_unlit'],'buffers':[{'byteLength':len(raw)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(raw),'target':34962}],'accessors':[{'bufferView':0,'componentType':5126,'count':len(vertices),'type':'VEC3','min':lo,'max':hi}]}
js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4);raw+=b'\0'*((-len(raw))%4)
(root/'static/images/iss.glb').write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(raw))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(raw),0x004e4942)+raw)
segments=json.dumps(lines,separators=(',',':'))
(root/'static/iss-visual.js').write_text("""'use strict';
// Original schematic. No real attitude, docking configuration or scale is implied.
window.AtlasISS={
 url:new URL('./images/iss.glb?v="""+hashlib.sha256((root/'static/images/iss.glb').read_bytes()).hexdigest()[:12]+"""',document.currentScript.src).href,
 segments:"""+segments+""",
 get iconURI(){const paths=this.segments.map(([a,b])=>`M${a[0]},${a[1]}L${b[0]},${b[1]}`).join(' ');return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-58 -38 116 76"><path d="${paths}" fill="none" stroke="white" stroke-width="1.2"/></svg>`);},
 draw2D(ctx,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.35);ctx.scale(size/110,size/110);
  ctx.beginPath();for(const [a,b] of this.segments){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}
  ctx.lineJoin='round';ctx.strokeStyle='#07111b';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1.7;ctx.stroke();ctx.restore();
 },
 async createModel(C,scene){
  const model=await C.Model.fromGltfAsync({url:this.url,modelMatrix:C.Matrix4.IDENTITY,minimumPixelSize:72,maximumScale:100000,color:C.Color.WHITE,colorBlendMode:C.ColorBlendMode.REPLACE,allowPicking:true,show:false});
  model.id=25544;scene.primitives.add(model);return model;
 }
};
""")
print(f'ISS model: {len(lines)} segments, {len(vertices)} vertices')
