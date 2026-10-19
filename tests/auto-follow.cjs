const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('static/globe.js','utf8');
const start=source.indexOf('        if(data.selected!==null&&'),end=source.indexOf('\n        if(motion.source',start);
assert.ok(start>=0&&end>start);
const context={lastSelection:null,lastSelectionRequest:null,following:false,releases:0};context.releaseFollow=()=>context.releases++;
vm.createContext(context);
function update(id,request){context.data={selected:id,selectionRequest:request};vm.runInContext(source.slice(start,end),context);context.lastSelection=id;context.lastSelectionRequest=request;}
update(null,0);assert.equal(context.following,false);
for(const id of [44235,25544]){update(id,1);assert.equal(context.following,true);context.following=false;update(id,1);assert.equal(context.following,false,'position refresh must preserve manual release');update(id,2);assert.equal(context.following,true,'clicking the same target must re-enable follow');}
assert.ok(source.includes("followButton.setAttribute('aria-pressed',String(following))"));
assert.ok(source.includes('if(following){\n            const snap=!followReady'));
console.log('Suivi automatique : Starlink, ISS, nouveau clic et libération manuelle conservée entre actualisations OK');
