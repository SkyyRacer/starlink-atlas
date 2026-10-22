const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),geometry=require('../static/geometry');
const far2=geometry.pickRadius({mode:'2d',zoom:2,minZoom:2}),near2=geometry.pickRadius({mode:'2d',zoom:14,minZoom:2});assert.equal(far2,14);assert.ok(near2>=6&&near2<7);
for(const mode of ['2d','3d']){
 let previous=mode==='2d'?Infinity:0;
 for(let i=0;i<=20;i++){
  const radius=geometry.pickRadius({mode,zoom:i,minZoom:0,height:i*10000000});assert.ok(radius>=6&&radius<=14);
  assert.ok(mode==='2d'?radius<=previous:radius>=previous);previous=radius;
  assert.ok(geometry.pickRadius({mode,zoom:i,height:i*10000000,touch:true})<=17);
 }
}
assert.equal(geometry.nearestHit([{id:1,x:8,y:0},{id:2,x:3,y:0}],{x:0,y:0},far2),2);
assert.equal(geometry.nearestHit([{id:1,x:11,y:0}],{x:0,y:0},far2),1);
assert.equal(geometry.nearestHit([{id:1,x:11,y:0}],{x:0,y:0},near2),null);
assert.equal(geometry.nearestHit([{id:1,x:1,y:0,visible:false},{id:2,x:NaN,y:0}],{x:0,y:0},far2),null);
assert.equal(geometry.nearestHit([{id:1,x:1,y:0,radius:0},{id:2,x:3,y:0,radius:5}],{x:0,y:0},far2),2);
const app=fs.readFileSync('static/app.js','utf8');
const planar={collectionMode:'starlink',AtlasGeometry:geometry,hit:[{id:42,x:10,y:0}],map:{getZoom:()=>2,getMinZoom:()=>2},matchMedia:()=>({matches:false})};vm.createContext(planar);vm.runInContext(app.slice(app.indexOf('function satelliteAtMapClick('),app.indexOf("\nmap.on('click'")),planar);assert.equal(planar.satelliteAtMapClick({containerPoint:{x:0,y:0}}),42);planar.map.getZoom=()=>14;assert.equal(planar.satelliteAtMapClick({containerPoint:{x:0,y:0}}),null);
class Cartesian3{static subtract(a,b,out){out.x=a.x-b.x;out.y=a.y-b.y;out.z=a.z-b.z;return out;}static dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}}
const globe=fs.readFileSync('static/globe.js','utf8'),context={lastData:null,scienceLayer:{*hits(){}},AtlasGeometry:geometry,matchMedia:()=>({matches:false}),C:{Cartesian3,EllipsoidalOccluder:class{isPointVisible(p){return p.visible!==false;}},SceneTransforms:{worldToWindowCoordinates:(scene,p)=>({x:p.x,y:p.y})}},viewer:{scene:{pick:()=>null,globe:{ellipsoid:{}}},camera:{positionWC:{x:0,y:0,z:0},directionWC:{x:0,y:0,z:1},positionCartographic:{height:100000000}}},items:new Map(),issVisible:false,tiangongVisible:false};
vm.createContext(context);vm.runInContext(globe.slice(globe.indexOf('    function satelliteAtGlobeClick('),globe.indexOf('    if(hasMoon){',globe.indexOf('    function satelliteAtGlobeClick('))),context);
const marker=(x,y,z=1,visible=true,show=true)=>({show,position:{x,y,z,visible}});
context.items.set(1,marker(1,0,1,false));context.items.set(2,marker(2,0,-1));context.items.set(3,marker(3,0,1,true,false));context.items.set(4,marker(10,0));context.items.set(5,marker(12,0));
assert.equal(context.satelliteAtGlobeClick({x:0,y:0}),4);
context.viewer.camera.positionCartographic.height=100000;assert.equal(context.satelliteAtGlobeClick({x:0,y:0}),null);
context.viewer.scene.pick=()=>({id:5});assert.equal(context.satelliteAtGlobeClick({x:0,y:0}),5);
console.log('Zones de clic : zoom continu et borné, sélection du plus proche, planisphère / 3D, objets masqués ou derrière la Terre exclus.');
assert.equal(geometry.markerScale('all'),.75);assert.equal(geometry.markerScale('iss'),1);
for(const mode of ['2d','3d'])for(const scale of [0,1,5,20]){
 const options={mode,zoom:scale,minZoom:0,height:scale*1e7};const standard=geometry.pickRadius(options),atlas=geometry.pickRadius({...options,collection:'all'});
 assert.ok(atlas>=standard+2&&atlas<=18);assert.ok(atlas-standard<=4);
}

const defaultColorLine=app.split('\n').find(line=>line.startsWith('const atlasDefaultColor='));
assert.equal(vm.runInNewContext(defaultColorLine+';atlasDefaultColor("starlink")'),'#c8efff');
assert.equal(vm.runInNewContext(defaultColorLine+';atlasDefaultColor("debris")'),'#d9a15f');
