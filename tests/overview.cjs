const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8');let attached=null,adds=0;
const tiles={addTo(){adds++;attached=this;}},map={hasLayer:layer=>attached===layer};const context={map,tiles};vm.createContext(context);
vm.runInContext(source.match(/function attachPlanisphere\(\)\{[^\n]+/)[0],context);
for(let zoom=0;zoom<18;zoom++)vm.runInContext('attachPlanisphere()',context);
assert.equal(adds,1);assert.equal(attached,tiles);assert.doesNotMatch(source,/\bAtlasOverview\b|overviewAttached/);assert.equal(fs.existsSync('static/overview.js'),false);assert.doesNotMatch(fs.readFileSync('static/index.html','utf8'),/overview\.js/);
console.log('One persistent detailed map across zoom levels; old mosaic and switching code removed OK.');
