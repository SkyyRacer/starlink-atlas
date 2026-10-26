const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
async function check(station){
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document,$=id=>document.getElementById(id);
 document.body.dataset.collection=station;$('atlas-controls').hidden=true;$('starlink-controls').hidden=true;$('iss-controls').hidden=false;
 const media={matches:true,addEventListener(){}};let pageScroll=0;
 const ctx={document,window:{document,innerWidth:1300,innerHeight:900,scrollTo(){pageScroll++;},AtlasTimeline:{live:true,time:Date.now()},addEventListener(){},dispatchEvent(){}},location:{assign(){}},Event:window.Event,MutationObserver:window.MutationObserver,URLSearchParams,matchMedia:()=>media,queueMicrotask,setTimeout,Date,Intl,navigator:{language:'fr'},AtlasPages:require('../static/pages.js'),AtlasCollections:require('../static/constellations.js'),AtlasTime:require('../static/time.js')};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('static/collection-menu.js','utf8'),ctx);Object.defineProperty($('collection-select'),'value',{writable:true,value:station});ctx.AtlasCollectionMenu.mount($('collection-select'));
 for(const script of ['desktop-panels.js','desktop-tools.js','workspace.js'])vm.runInContext(fs.readFileSync('static/'+script,'utf8'),ctx);
 assert.equal($('workspace-'+station).hidden,false);assert.equal($('workspace-'+station).getAttribute('aria-current'),'page');assert.equal($('workspace-'+(station==='iss'?'tiangong':'iss')).hidden,false);
 const rail=$('satellite-panel');rail.scrollTop=0;rail.getBoundingClientRect=()=>({top:100,bottom:500,height:400});
 $('iss-search').getBoundingClientRect=()=>({top:440-rail.scrollTop,bottom:480-rail.scrollTop,height:40});
 $('iss-search-results').getBoundingClientRect=()=>({top:510-rail.scrollTop,bottom:710-rail.scrollTop,height:200});
 $('workspace-objects').click();assert.equal($('workspace-close').hidden,false);assert.equal($('workspace-close').getAttribute('aria-label'),'Fermer Missions et équipage');assert.equal($('workspace-close').querySelector('svg').getAttribute('aria-hidden'),'true');assert.equal($('workspace-objects').textContent,'Équipage à bord');
 const results=$('iss-search-results');results.hidden=false;results.append(document.createElement('button'));
 $('iss-search').value='test';$('iss-search').dispatchEvent(new window.Event('input'));await new Promise(r=>setImmediate(r));
 assert.equal(rail.scrollTop,222);assert.equal(pageScroll,0);assert.equal(results.getBoundingClientRect().bottom,488);assert.ok($('iss-search').getBoundingClientRect().top>=112);
 $('iss-search').dispatchEvent(new window.Event('input'));await new Promise(r=>setImmediate(r));assert.equal(rail.scrollTop,222,'Do not keep scrolling when results already fit');
 const dialog=$('iss-mission-dialog');dialog.setAttribute('open','');$('iss-mission-close').dispatchEvent(new window.Event('pointerdown',{bubbles:true}));
 assert.equal($('workspace-objects').getAttribute('aria-expanded'),'true');assert.equal(rail.inert,false);
 dialog.removeAttribute('open');$('iss-mission-close').dispatchEvent(new window.Event('click',{bubbles:true}));assert.equal($('workspace-objects').getAttribute('aria-expanded'),'true');assert.equal(rail.scrollTop,222);
}
(async()=>{await check('iss');await check('tiangong');console.log('ISS and Tiangong: titled close header, profile closing preserves menu/scroll, search reveals results without scrolling the page OK.');})().catch(e=>{console.error(e);process.exitCode=1;});
