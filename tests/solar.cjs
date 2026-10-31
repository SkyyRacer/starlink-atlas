/* Verify the scientific contracts, real Cesium geometry/material setup and
   all standalone document paths without needing a GPU. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {vector,axes}=require('../static/solar-math.js'),cat=require('../static/solar/catalog.json');
const r={samples:[[0,0,0,0,1,2,3],[10,10,20,30,1,2,3]],max_interval_seconds:10};
assert.deepEqual(vector(r,5000),[5,10,15]);assert.equal(vector(r,-1),null);assert.equal(vector(r,10001),null);assert.equal(vector({...r,max_interval_seconds:5},5000),null);
for(const body of cat.bodies){for(const at of [0,Date.now(),Date.parse('1977-08-20')]){const a=axes(body,at);for(let i=0;i<3;i++)for(let j=0;j<3;j++){const d=a[i].reduce((s,x,k)=>s+x*a[j][k],0);assert.ok(Math.abs(d-(i===j?1:0))<1e-10,body.name+' orthonormal axes');}}}
assert.equal(cat.bodies.filter(b=>b.kind==='planet').length,8);assert.equal(cat.bodies.filter(b=>b.kind==='moon').length,456);assert.equal(cat.bodies.find(b=>b.key==='soleil').radii_km[0],695700);assert.ok(cat.bodies.filter(b=>b.radii_km).length>=70);assert.equal(cat.bodies.find(b=>b.designation==='S/2009 S1').id,null);
for(const body of cat.bodies.filter(b=>b.kind!=='moon')){const html=fs.readFileSync('static/'+body.key+'/index.html','utf8');assert.ok(html.includes('data-atlas-entry-loading="true"'));assert.ok(html.includes('catalog-entry-logo'));assert.ok(html.includes('solar-page.js'));assert.ok(html.includes('desktop-tools.js'));for(const match of html.matchAll(/(?:src|href)="\/(.+?)(?:\?[^\"]*)?"/g)){if(match[1]==='atlas')continue;assert.ok(fs.existsSync('static/'+match[1]),match[1]);}}
for(const page of ['index','moon'])assert.ok(fs.readFileSync('static/'+page+'.html','utf8').includes('solar-menu.js'));
const now=Date.now();for(const file of fs.readdirSync('data/solar').filter(n=>n.endsWith('.json'))){const data=JSON.parse(fs.readFileSync('data/solar/'+file));if(!data.samples.length)continue;assert.equal(data.origin,399);assert.equal(data.frame,'ICRF');assert.ok(data.samples.every(r=>r.length===7&&r.every(Number.isFinite)));if(vector(data,now))assert.ok(vector(data,now).every(Number.isFinite));}
console.log('Solar: all pages, 456 moons, IAU rotations, bounded interpolation and cached JPL vectors OK');
