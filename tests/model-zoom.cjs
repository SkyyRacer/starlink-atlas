const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.createContext(ctx);const source=fs.readFileSync('static/globe.js','utf8');vm.runInContext(source,ctx);const zoom=ctx.window.AtlasGlobe.modelZoomRange;
for(const radius of [18,55,75]){let range=3500000;for(let i=0;i<9;i++)range=zoom(range,1,1,radius);assert.ok(range<radius*5,'Model reachable within nine plus clicks');assert.ok(range>=radius*1.5);for(let i=0;i<40;i++)range=zoom(range,1,1,radius);assert.equal(range,radius*1.5);assert.ok(zoom(range,-1,1,radius)>range);}
assert.ok(zoom(1e5,1,.1)>zoom(1e5,1,1),'Trackpad increments remain gentle');assert.ok(zoom(1e5,1,1)<1e5);
assert.match(source,/if\(zoomModel\(direction\)\)return/);assert.match(source,/event\.preventDefault\(\);event\.stopImmediatePropagation/);assert.match(source,/if\(data.selected!==lastSelection\)followPitch=-.8/);
console.log('Zoom modèles : cible locale, neuf crans au plus, limite de proximité, zoom arrière, trackpad et vue réinitialisée OK.');

for(const [width,height] of [[1400,800],[390,700],[700,390]]){const range=ctx.window.AtlasGlobe.detailedRange(75,width,height);assert.ok(range>75&&range<650);const halfAngle=Math.atan(Math.tan(Math.PI/6)*Math.min(1,width/height));assert.ok(Math.asin(75/range)<halfAngle,'The entire mesh fits both viewport dimensions');}
assert.match(source,/if\(lastData.selected!==id\)onSelect\(id\)/);assert.match(source,/AtlasGlobe.detailedRange\(radius/);
