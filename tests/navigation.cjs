const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8');
let chosen=null,focused=false,scrolled=false;
const ctx={selected:99,catalog:Array.from({length:102},(_,id)=>({id})),matches:()=>true,resultsPage:0,resultsPageSize:100,choose:id=>{chosen=id;ctx.selected=id;},$:()=>({querySelector:()=>({focus:()=>focused=true,scrollIntoView:()=>scrolled=true})})};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function navigateSatellite('),source.indexOf("document.addEventListener('keydown',navigateSatellite")),ctx);
const event=(key,code='',editing=false)=>({key,code,target:{closest:()=>editing?{}:null},preventDefault(){this.prevented=true;},stopPropagation(){}});
ctx.navigateSatellite(event('ArrowDown'));assert.equal(chosen,100);assert.equal(ctx.resultsPage,1);assert.ok(focused&&scrolled);
ctx.navigateSatellite(event('8','Numpad8'));assert.equal(chosen,99);assert.equal(ctx.resultsPage,0);
ctx.navigateSatellite(event('ArrowDown','',true));assert.equal(chosen,99);
for(const area of ['.collection-navigation','#advanced-panel','#workspace-navigation']){const e=event('ArrowDown');e.target.closest=selector=>selector.includes(area)?{}:null;ctx.navigateSatellite(e);assert.equal(chosen,99,'Arrow keys in menus must not switch the selected satellite');}
ctx.selected=101;ctx.navigateSatellite(event('ArrowDown'));assert.equal(chosen,99);
ctx.selected=null;ctx.navigateSatellite(event('ArrowUp'));assert.equal(chosen,99);
console.log('Navigation satellites : flèches, pavé numérique, pagination, limites et saisie : OK');
