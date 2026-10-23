const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const {document}=parseHTML(fs.readFileSync('static/index.html','utf8')),$=id=>document.getElementById(id),AtlasPages=require('../static/pages.js');
const satellites=[{id:1,collections:['iss']},{id:2,collections:['tiangong']},{id:3,collections:['hubble','tess']},{id:4,collections:['debris']}];
const selected=new Set(['iss','hubble']);const ctx={document,$,AtlasPages,collectionMode:'all',points:satellites.map(s=>({id:s.id})),byId:new Map(satellites.map(s=>[s.id,s])),matches:s=>s.collections.some(k=>selected.has(k))};
vm.createContext(ctx);const source=fs.readFileSync('static/app.js','utf8');vm.runInContext(source.slice(source.indexOf('function updateAtlasCounts('),source.indexOf('function updateDebrisCoverage(){')),ctx);ctx.updateAtlasCounts();
assert.equal($('atlas-count-debris').textContent,'0 visible / 1');assert.equal($('atlas-count-iss').textContent,'1 visible / 1');
assert.equal(document.querySelector('[data-category=stations] .atlas-category-total').textContent,'1 visible / 2');assert.equal(document.querySelector('[data-category=science] .atlas-category-total').textContent,'1 visible / 1','An object in two families counts once per category');
selected.clear();ctx.updateAtlasCounts();assert.equal(document.querySelector('[data-category=stations] .atlas-category-total').textContent,'0 visible / 2');
ctx.points=[];ctx.updateAtlasCounts();assert.equal($('atlas-count-iss').textContent,'0 visible / 0');console.log('Atlas visible/available counts, category deduplication, deselection and date without positions OK.');

ctx.points=satellites.map(s=>({id:s.id}));ctx.byId.set(5,{id:5,collections:['hubble']});ctx.points.push({id:5});ctx.updateAtlasCounts();
assert.equal(document.querySelector('[data-category=science] [data-observe=hubble]').hidden,true,'Hide view action for multiple available satellites');
assert.equal(document.querySelector('[data-category=stations] [data-observe=iss]').hidden,false,'Keep view action for a single available satellite');
ctx.points=ctx.points.filter(p=>p.id!==5);ctx.updateAtlasCounts();assert.equal(document.querySelector('[data-observe=hubble]').hidden,false,'Restore view action when only one satellite is available at the consulted date');

let memberships=0;ctx.AtlasPages={...AtlasPages,memberships:s=>{memberships++;return AtlasPages.memberships(s);}};delete ctx.updateAtlasCounts.cache;ctx.updateAtlasCounts();const before=memberships;ctx.points=ctx.points.map(p=>({...p}));ctx.updateAtlasCounts();assert.equal(memberships,before,'New positions with unchanged availability do not rebuild category counters');
