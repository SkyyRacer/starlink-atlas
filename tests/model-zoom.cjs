const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.createContext(ctx);const source=fs.readFileSync('static/globe.js','utf8');vm.runInContext(source,ctx);const zoom=ctx.window.AtlasGlobe.modelZoomRange;
for(const radius of [18,55,75]){let range=3500000;for(let i=0;i<9;i++)range=zoom(range,1,1,radius);assert.ok(range<radius*5,'Model reachable within nine plus clicks');assert.ok(range>=radius*1.5);for(let i=0;i<40;i++)range=zoom(range,1,1,radius);assert.equal(range,radius*1.5);assert.ok(zoom(range,-1,1,radius)>range);}
assert.ok(zoom(1e5,1,.1)>zoom(1e5,1,1),'Trackpad increments remain gentle');assert.ok(zoom(1e5,1,1)<1e5);
assert.match(source,/if\(zoomModel\(direction\)\)return/);assert.match(source,/event\.preventDefault\(\);event\.stopImmediatePropagation/);assert.match(source,/if\(data.selected!==lastSelection\)followPitch=-.8/);
console.log('Zoom modèles : cible locale, neuf crans au plus, limite de proximité, zoom arrière, trackpad et vue réinitialisée OK.');

for(const [width,height] of [[1400,800],[390,700],[700,390]]){const range=ctx.window.AtlasGlobe.detailedRange(75,width,height);assert.ok(range>75&&range<650);const halfAngle=Math.atan(Math.tan(Math.PI/6)*Math.min(1,width/height));assert.ok(Math.asin(75/range)<halfAngle,'The entire mesh fits both viewport dimensions');}
assert.match(source,/if\(lastData.selected!==id\)onSelect\(id\)/);assert.match(source,/AtlasGlobe.detailedRange\(radius/);

const overview=ctx.window.AtlasGlobe.overviewZoomHeight;
for(const start of [2e7,1e8,1e9]){let height=start,clicks=0;while(height>3e6&&clicks<20){height=overview(height,1);clicks++;}assert.ok(clicks<=12,'Distant Earth remains reachable within twelve clicks');}
assert.equal(overview(150000,1),150000);assert.equal(overview(4e9,-1),4e9);
assert.ok(overview(2e7,1,.1)>overview(2e7,1,1),'Small trackpad movements keep fine control');
assert.ok(overview(2e7,-1)>2e7);assert.ok(overview(2e7,1)<1.2e7);

let previousFraction=0;
for(const height of [2e5,5e5,1e6,3e6,1e7,2e7,1e8]){const fraction=1-overview(height,1)/height;assert.ok(fraction>=previousFraction,'Zoom slows progressively toward Earth');previousFraction=fraction;}
const below=overview(2999999,1)/2999999,above=overview(3000001,1)/3000001;
assert.ok(Math.abs(below-above)<1e-6,'No abrupt speed change near Earth');
assert.ok(1-overview(5e5,1)/5e5<.2,'Nearby Earth remains easy to control');

for(const radius of [18,55,75]){let close=radius*1.5;for(let i=0;i<60;i++)close=zoom(close,1,1,radius,true);assert.equal(close,Math.max(2,radius*.35),'Extra proximity only with detailed model');assert.equal(zoom(close,1,1,radius,false),radius*1.5,'White model restores normal minimum');assert.ok(zoom(radius,1,.1,radius,true)>zoom(radius,1,1,radius,true),'Fine HD zoom remains gradual');}

const distant=ctx.window.AtlasGlobe.distantZoomRange;
for(const range of [10000,1e7,1e10,2.6e13,1e14]){
 assert.ok(distant(range,1)<range);assert.ok(distant(range,-1)>range);
 assert.ok(distant(range,1)/range>.45,'No teleport toward Earth at interstellar distances');
 assert.ok(distant(range,1,.05)>distant(range,1,1),'Gentle trackpad steps');
 assert.ok(zoom(range,1,.05,50,true,true)>range*.8,'Detailed distant models also avoid the Earth zoom cap');
}
assert.equal(distant(1000,1),1000);assert.equal(distant(1e15,-1),1e15);
console.log('Distant zoom: continuous from 1 km to 1e15 m, including detailed models and Voyager distances.');

const nearest=ctx.window.AtlasGlobe.nearestModelPixel;
for(const pixels of [
 [[30,20],[31,20],[32,20],[60,40]],
 Array.from({length:41},(_,i)=>[40,i+10]),
 Array.from({length:50},(_,i)=>[i+20,30]).filter(([x])=>x<35||x>55),
 [[0,0],[99,79],[20,60]]
])for(const mouse of [{x:30,y:20},{x:50,y:35},{x:99,y:0},{x:0,y:79}]){
 let probes=0;const hit=(p,w,h)=>{probes++;return pixels.some(([x,y])=>Math.abs(x-p.x)<=(w-1)/2&&Math.abs(y-p.y)<=(h-1)/2);};
 const result=nearest(mouse,100,80,hit);assert.ok(result,'Visible model contour is found');
 const wanted=Math.min(...pixels.map(([x,y])=>Math.hypot(x-mouse.x,y-mouse.y)));
 assert.ok(Math.abs(Math.hypot(result.x-mouse.x,result.y-mouse.y)-wanted)<1e-8,'Off-model zoom targets the nearest visible part, including thin antennas and gaps');
 assert.ok(probes<=128,'Bounded geometry picks per wheel gesture');
}
assert.equal(nearest({x:5,y:5},100,80,()=>false),null,'No invented surface when model is hidden');
console.log('Pointer zoom: exact surface pixel, closest silhouette outside the model, thin antennas, holes and bounded picks OK.');
