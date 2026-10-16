const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8');
let views=0,loads=0,overviews=0;
const ctx={points:[{id:1,lat:20,lon:30}],displayMode:'2d',performance:{now:()=>0},planarMotion:{set(){}},map:{getZoom:()=>2,setView:()=>views++},constrainWorld:()=>overviews++,list(){},draw(){},loadPositions:()=>loads++};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function focusPlanisphere('),source.indexOf('function satelliteAtMapClick')),ctx);
ctx.choose(1,false);assert.equal(views,0);assert.equal(ctx.focusSelected,false);assert.equal(ctx.selected,1);
ctx.choose(1,true,'close');assert.equal(views,1);assert.equal(ctx.focusSelected,true);
ctx.choose(1);assert.equal(views,1);assert.equal(overviews,1);assert.equal(loads,3);
assert.ok(source.includes("choose(id,false)"));assert.ok(source.includes("map.on('dblclick'"));assert.ok(source.includes('doubleClickZoom:false'));
console.log('Planisphère : clic sans déplacement, double-clic et liste avec centrage : OK');

let homeCalls=0,resetUpdates=0,redraws=0;
Object.assign(ctx,{selected:1,focusSelected:true,positionRevision:7,track:[1],futureTrack:[1],track3d:[1],future3d:[1],displayMode:'3d',globeController:{home:()=>homeCalls++},updateMapReset:()=>resetUpdates++,scheduleDraw:()=>redraws++});
vm.runInContext(source.slice(source.indexOf('function closeSatellite('),source.indexOf('function focusPlanisphere(')),ctx);
ctx.closeSatellite();assert.equal(ctx.selected,null);assert.equal(ctx.focusSelected,false);assert.equal(ctx.positionRevision,8);assert.equal(ctx.track.length+ctx.futureTrack.length+ctx.track3d.length+ctx.future3d.length,0);assert.equal(homeCalls,1);
ctx.closeSatellite();assert.equal(homeCalls,1,'clicking empty space without an open satellite does nothing');
ctx.selected=1;ctx.displayMode='2d';const before=overviews;ctx.closeSatellite();assert.equal(overviews,before+1);assert.equal(resetUpdates,1);assert.equal(redraws,1);
console.log('Fermeture satellite : désélection, réponse périmée invalidée, recentrage 2D/3D et vide sans sélection : OK');
