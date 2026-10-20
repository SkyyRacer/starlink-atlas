const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('static/app.js','utf8'),code=app.split('\n').find(line=>line.startsWith('function sizeMap()'));
let immersive=true,space,resizes=0,invalidations=0;const container={style:{},closest:()=>({style:{setProperty(k,v){space=v;}}})},globe={style:{}};
const context={document:{body:{classList:{contains:()=>immersive}}},timelineElement:{offsetHeight:56},getComputedStyle:()=>({bottom:'22px'}),map:{getContainer:()=>container,invalidateSize:()=>invalidations++},globeController:{resize:()=>resizes++},$:()=>globe};
vm.createContext(context);vm.runInContext(code,context);context.sizeMap();assert.equal(container.style.bottom,'0px');assert.equal(globe.style.bottom,'0px');assert.equal(space,'90px','Panel clearances still follow the chronology');
context.timelineElement.offsetHeight=250;context.sizeMap();assert.equal(container.style.bottom,'0px','Expanded timeline must overlay the Earth, not shrink it');assert.equal(space,'284px');assert.equal(globe.style.bottom,'0px');
immersive=false;context.sizeMap();assert.equal(container.style.bottom,'284px','Existing layout restored outside desktop workspace');assert.equal(resizes,3);assert.equal(invalidations,2);
console.log('Earth viewport: full height even with expanded chronology; panel clearance and legacy layout preserved.');
