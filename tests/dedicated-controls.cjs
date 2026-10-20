const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
(async()=>{
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document,$=id=>document.getElementById(id);
 document.body.dataset.collection='hubble';$('atlas-controls').hidden=true;$('starlink-controls').hidden=false;$('iss-controls').hidden=true;
 const media={matches:true,addEventListener(){}};
 const ctx={document,window:{document,innerWidth:1300,innerHeight:900,AtlasTimeline:{live:true,time:Date.now()},addEventListener(){},dispatchEvent(){}},location:{assign(){}},Event:window.Event,MutationObserver:window.MutationObserver,URLSearchParams,matchMedia:()=>media,queueMicrotask,setTimeout,Date,Intl,navigator:{language:'fr'},AtlasPages:require('../static/pages.js'),AtlasCollections:require('../static/constellations.js'),AtlasTime:require('../static/time.js')};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('static/collection-menu.js','utf8'),ctx);Object.defineProperty($('collection-select'),'value',{writable:true,value:'hubble'});ctx.AtlasCollectionMenu.mount($('collection-select'));
 for(const script of ['desktop-panels.js','desktop-tools.js','workspace.js'])vm.runInContext(fs.readFileSync('static/'+script,'utf8'),ctx);
 assert.equal($('advanced-tools').hidden,true);assert.ok($('advanced-filters').closest('#starlink-controls'));assert.equal($('advanced-filters').inert,false);
 assert.equal($('advanced-model-options').closest('.globe-tools'),document.querySelector('.globe-tools'));assert.equal($('advanced-model-options').inert,false);assert.equal($('detailed-model-label').hidden,true);
 assert.equal($('workspace-debris').hidden,true);assert.equal($('workspace-debris').closest('#scene-left-stack'),null);assert.equal($('workspace-debris-navigation').hidden,false);assert.equal($('workspace-debris-page').getAttribute('href'),'/debris');
 $('view-3d').setAttribute('aria-pressed','true');await new Promise(r=>setImmediate(r));assert.equal($('scene-left-stack').dataset.view,'3d');
 $('workspace-objects').getBoundingClientRect=()=>({left:350,bottom:95});$('workspace-objects').click();assert.equal($('satellite-panel').style.top,'95px');assert.equal($('satellite-panel').style.left,'350px');
 const g=ctx.window.AtlasWorkspace.submenuGeometry({left:1200,bottom:95},1300,900,350);assert.equal(g.left,930);assert.equal(g.top,95);assert.equal(g.maxHeight,785);
 const below=ctx.window.AtlasWorkspace.submenuGeometry({left:350,bottom:70},1300,900,350,110);assert.equal(below.top,110);assert.equal(below.maxHeight,770);
 document.querySelector('body>header').getBoundingClientRect=()=>({bottom:120});$('workspace-objects').click();$('workspace-objects').click();assert.equal($('satellite-panel').style.top,'120px');
 console.log('Dedicated pages: tools removed, filters retained, inline model options, view switching, lower debris link and attached submenu bounds OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
