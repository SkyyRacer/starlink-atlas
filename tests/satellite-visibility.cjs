const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const app=fs.readFileSync('static/app.js','utf8'),controller=app.slice(app.indexOf('// The map visibility switch'),app.indexOf('const chosenYears='));
function setup(mode,count){
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document,$=id=>document.getElementById(id);
 document.body.dataset.collection=mode;$('atlas-controls').hidden=mode!=='all';$('advanced-model-options').dataset.following='false';
 for(const input of document.querySelectorAll('[data-family]'))input.checked=input.hasAttribute('checked');
 let draws=0,scheduled=0;
 const context={document,$,CustomEvent:window.CustomEvent,Event:window.Event,MutationObserver:window.MutationObserver,queueMicrotask,catalog:Array.from({length:count},(_,id)=>({id:id+1})),collectionMode:mode,selected:null,displayMode:'3d',focusSelected:false,planarFocusMode:'overview',selectionRequest:4,positionRevision:2,track:[1],futureTrack:[1],track3d:[1],future3d:[1],scheduleDraw(){scheduled++;},draw(){draws++;context.syncSatelliteVisibility();}};
 context.window=context;vm.createContext(context);vm.runInContext(controller,context);vm.runInContext(fs.readFileSync('static/overview-selection.js','utf8'),context);
 return {window,document,$,context,api:context.AtlasSatelliteVisibility,button:$('overview-visibility'),get draws(){return draws;},get scheduled(){return scheduled;}};
}
(async()=>{
 for(const mode of ['hubble','iss','tiangong']){const a=setup(mode,1);assert.equal(a.button.hidden,true,'Single-satellite pages have no visibility switch');a.api.toggle();assert.equal(a.draws,0);}
 const a=setup('starlink',3),c=a.context;
 assert.equal(a.button.hidden,false);assert.equal(a.$('overview-selection'),null,'Dedicated pages do not gain an Atlas category selector');
 a.button.click();assert.equal(a.api.hidden,true);assert.equal(c.satelliteDisplayPass(1),false);assert.equal(c.satelliteDisplayPass(2),false);assert.equal(a.button.textContent,'Afficher les satellites');a.button.click();assert.equal(c.satelliteDisplayPass(2),true);
 c.selected=1;a.$('advanced-model-options').dataset.following='true';await new Promise(r=>setImmediate(r));assert.equal(a.button.hidden,false);assert.equal(a.button.textContent,'Masquer les autres satellites');
 const request=c.selectionRequest,revision=c.positionRevision;c.track=[11];c.track3d=[12];a.button.click();assert.equal(c.satelliteDisplayPass(1),true);assert.equal(c.satelliteDisplayPass(2),false);assert.equal(c.selected,1);assert.equal(c.selectionRequest,request,'Masking others cannot reset the follow camera');assert.equal(c.positionRevision,revision);assert.equal(c.track[0],11);assert.equal(c.track3d[0],12);
 c.selected=2;assert.equal(c.satelliteDisplayPass(2),true);assert.equal(c.satelliteDisplayPass(1),false,'Switching targets preserves the new selected object');a.button.click();assert.equal(c.satelliteDisplayPass(1),true);
 c.displayMode='2d';c.planarFocusMode='close';a.$('view-2d').setAttribute('aria-pressed','true');c.syncSatelliteVisibility();assert.equal(a.button.parentElement,a.$('map-creator'),'The switch stays visible in planisphere');a.button.click();assert.equal(c.satelliteDisplayPass(2),true);assert.equal(c.satelliteDisplayPass(1),false);
 c.displayMode='3d';a.$('view-2d').setAttribute('aria-pressed','false');c.syncSatelliteVisibility();await new Promise(r=>setImmediate(r));assert.equal(a.button.parentElement,a.document.querySelector('.globe-buttons').parentElement);
 const atlas=setup('all',4);atlas.context.selected=1;atlas.$('advanced-model-options').dataset.following='true';await new Promise(r=>setImmediate(r));const selected=[...atlas.document.querySelectorAll('[data-family]')].map(b=>b.checked);atlas.button.click();assert.equal(atlas.context.satelliteDisplayPass(1),true);assert.equal(atlas.context.satelliteDisplayPass(2),false);assert.deepEqual([...atlas.document.querySelectorAll('[data-family]')].map(b=>b.checked),selected,'Hiding others preserves Atlas family selection');assert.equal(atlas.$('overview-selection').hidden,true);assert.equal(atlas.button.hidden,false);
 atlas.$('advanced-model-options').dataset.following='false';await new Promise(r=>setImmediate(r));assert.equal(atlas.context.satelliteDisplayPass(2),true,'Returning to Atlas overview restores the chosen families');assert.equal(atlas.$('overview-selection').hidden,false);assert.equal(atlas.button.textContent,'Masquer les satellites');
 a.context.catalog=[{id:2}];a.context.syncSatelliteVisibility();assert.equal(a.button.hidden,true);assert.equal(c.satelliteDisplayPass(2),true,'A page reduced to one satellite cannot leave it hidden without a switch');
 const load=setup('galileo',0);assert.equal(load.button.hidden,true);load.context.catalog=[{id:1},{id:2}];load.context.syncSatelliteVisibility();assert.equal(load.button.hidden,false,'Asynchronous catalogue loading reveals the switch only for multiple objects');
 console.log('Satellite switch: single-page exclusion, multi-object overview, close views preserve target/camera/orbit, target changes, 2D/3D placement and Atlas family selection OK.');
})().catch(error=>{console.error(error);process.exitCode=1;});
