const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),{parseHTML}=require('linkedom');
const catalog=require('../static/solar/catalog.json'),surfaces=require('../static/solar/moon-surfaces.json'),math=require('../static/solar-math.js');
const keys=['pluton','ceres','eris','haumea','makemake'],counts=[5,0,1,2,1];
const {window}=parseHTML('<html><body><header><div id="workspace-deep-control"></div></header></body></html>'),document=window.document;
Object.defineProperty(document,'currentScript',{value:{src:'http://localhost:3003/solar-menu.js'}});window.location={href:'http://localhost:3003/atlas'};
vm.runInNewContext(fs.readFileSync('static/solar-menu.js','utf8'),{window,document,URL,innerWidth:1200,CustomEvent:window.CustomEvent});
const list=document.getElementById('solar-navigation-list'),section=document.getElementById('solar-dwarf-planets');assert.equal(list.lastElementChild,section);assert.equal(section.firstElementChild.textContent,'Planètes naines');assert.equal(section.open,undefined);
assert.deepEqual([...section.querySelectorAll('a')].map(a=>new URL(a.href).pathname),keys.map(k=>'/'+(k==='ceres'?'ceres-naine':k)+'/'));
section.open=true;document.dispatchEvent(new window.Event('pointerdown'));assert.equal(section.open,false,'Closing navigation resets its nested section');
for(let i=0;i<keys.length;i++){
 const b=catalog.bodies.find(b=>b.key===keys[i]);assert.equal(b.dwarf,true);assert.equal(b.kind,'planet');assert.ok(b.radii_km.every(r=>r>0));
 const {document:page}=parseHTML(fs.readFileSync('static/'+(b.page||b.key)+'/index.html','utf8'));assert.equal(page.body.dataset.solar,b.key);assert.match(page.title,new RegExp(b.name));
 for(const id of ['catalog-progress','lunar-shadows-toggle','sky-toggle','solar-list-toggle','play','date-entry','orbital-news-button'])assert.ok(page.getElementById(id),b.key+' shares '+id);
 assert.ok(fs.existsSync('static/'+b.surface));
 const moons=catalog.bodies.filter(m=>m.parent===b.key);assert.equal(moons.length,counts[i]);
 for(const body of [b,...moons]){
  if(body.kind==='moon'){assert.ok(surfaces.bodies[body.id]);assert.ok(fs.existsSync('static/'+surfaces.bodies[body.id].path));}
  if(body.orbit_model){assert.match(body.surface_note,/schématique/);continue;}
  const record=JSON.parse(fs.readFileSync('static/solar/dwarfs/vectors/'+body.id+'/2026.json','utf8'));assert.equal(record.id,body.id);assert.equal(record.origin,399);assert.equal(record.frame,'ICRF');assert.ok(record.samples.length>360);const p=math.vector(record,Date.parse('2026-11-02T00:00:00Z'));assert.ok(p?.every(Number.isFinite));assert.ok(Math.hypot(...p)>1e8);
  if(body.kind==='moon'){const parentRecord=JSON.parse(fs.readFileSync('static/solar/dwarfs/vectors/'+b.id+'/2026.json','utf8')),parent=math.vector(parentRecord,Date.parse('2026-11-02T00:00:00Z'));const separation=Math.hypot(...p.map((v,j)=>v-parent[j]));assert.ok(separation>1000&&separation<100000,body.name+' stays near its actual primary');}
 }
 if(['eris','haumea','makemake'].includes(b.key))assert.match(b.surface_note,/illustrative/);
}
const haumea=catalog.bodies.find(b=>b.key==='haumea');assert.ok(haumea.radii_km[0]/haumea.radii_km[2]>2,'Haumea uses its elongated shape');
console.log('Five dwarf pages, resettable nested menu, nine moons, local Horizons vectors, observed/illustrative surface provenance: OK');
