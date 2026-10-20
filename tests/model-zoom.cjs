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
