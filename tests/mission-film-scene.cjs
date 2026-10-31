const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={console,URL,TextDecoder,TextEncoder,performance,atob,TransformStream,ReadableStream,WritableStream,CompressionStream,DecompressionStream,WebAssembly,fetch,Request,Response,Headers,Blob,AbortController,setTimeout,clearTimeout};ctx.global=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('static/vendor/cesium/Cesium.js','utf8'),ctx);vm.runInContext(fs.readFileSync('static/mission-film-scene.js','utf8'),ctx);
const C=ctx.Cesium,primitives=new Set(),viewer={scene:{primitives:{add(p){primitives.add(p);return p;},remove(p){primitives.delete(p);p.destroy();}}}};
const epoch=Date.UTC(1977,7,20),rows=Array.from({length:1001},(_,i)=>({time:epoch+i*86400000,position:[2e10+i*12345,3e9+Math.sin(i*.01)*1e6,-1e10+i*456]}));
const trail=ctx.AtlasMissionFilmScene.trail(C,viewer,rows),rotation=C.Matrix3.fromRotationZ(.72),matrix=C.Matrix4.fromRotationTranslation(rotation,new C.Cartesian3(-2e13,-3e12,1e13));
function verify(at){
 trail.update(at,matrix);let segments=0,last;
 for(const p of primitives){if(!p.show)continue;const geometry=p.geometryInstances.geometry,values=geometry.attributes.position.values;segments+=geometry.indices.length/2;
  assert.equal(p.appearance.material,undefined,'Uses Cesium default line shader, no fragment date mask');
  for(let i=0;i<values.length;i+=3){const world=C.Matrix4.multiplyByPoint(p.modelMatrix,new C.Cartesian3(...values.slice(i,i+3)),new C.Cartesian3());assert.ok([world.x,world.y,world.z].every(Number.isFinite));}
  last=p;
 }
 const index=(at-epoch)/86400000;assert.equal(segments,Math.max(0,Math.ceil(Math.min(rows.length-1,index))),'Exactly the past segments are submitted, including one partial endpoint');
 if(index>0&&index<1000){const p=last,values=p.geometryInstances.geometry.attributes.position.values,world=C.Matrix4.multiplyByPoint(p.modelMatrix,new C.Cartesian3(...values.slice(-3)),new C.Cartesian3()),i=Math.floor(index),u=index-i,position=rows[i].position.map((x,j)=>x+u*(rows[i+1].position[j]-x)),expected=C.Matrix4.multiplyByPoint(matrix,new C.Cartesian3(...position.map(v=>v*1000)),new C.Cartesian3());assert.ok(C.Cartesian3.distance(world,expected)<.02,'One continuous endpoint in the floating frame, accurate to centimetres despite interplanetary coordinates');}
}
for(const i of [0,1,255,256,256.5,777.125,999.9,1000,400.5,2.25])verify(epoch+i*86400000);
trail.update(epoch+2.25*86400000,matrix,true,.4);assert.ok([...primitives].filter(p=>p.show).every(p=>p.geometryInstances.attributes.color.value[3]===102),'Both completed and partial trajectory buffers support the same fade opacity');trail.update(epoch+2.25*86400000,matrix,true,1);assert.ok([...primitives].filter(p=>p.show).every(p=>p.geometryInstances.attributes.color.value[3]===255),'Trajectory opacity returns to fully visible');trail.update(epoch+2.25*86400000,matrix,false);assert.ok([...primitives].every(p=>!p.show));verify(epoch+2.25*86400000);trail.destroy();assert.equal(primitives.size,0);
console.log('Archived trail: no future GPU vertices, continuous chunk seams, reversible time, local coordinate precision and disposal OK');
