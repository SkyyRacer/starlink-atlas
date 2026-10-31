const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
for(const mode of ['all','starlink','iss']){
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document,$=id=>document.getElementById(id);
 document.body.dataset.collection=mode;$('atlas-controls').hidden=mode!=='all';$('iss-controls').hidden=mode!=='iss';
 Object.defineProperty($('collection-select'),'value',{writable:true,value:mode});
 const context={document,window:{addEventListener(){},dispatchEvent(){}},Event:window.Event,MutationObserver:window.MutationObserver,matchMedia:()=>({matches:true,addEventListener(){}}),AtlasPages:require('../static/pages.js'),AtlasCollections:require('../static/constellations.js'),URLSearchParams,queueMicrotask};
 vm.createContext(context);vm.runInContext(fs.readFileSync('static/collection-menu.js','utf8'),context);context.AtlasCollectionMenu.mount($('collection-select'));
 vm.runInContext(fs.readFileSync('static/mission-menu.js','utf8'),context);vm.runInContext(fs.readFileSync('static/workspace.js','utf8'),context);
 const nav=document.querySelector('.collection-navigation'),trigger=mode==='all'?$('workspace-objects'):nav;
 assert.equal(trigger.nextElementSibling,$('workspace-station-control'),'Satellite menu precedes stations on '+mode);
 assert.equal((mode==='all'?trigger:$('collection-menu-button')).textContent,'Tous les objets');
 if(mode!=='all'){assert.equal($('workspace-objects').closest('#workspace-navigation'),null);assert.equal($('workspace-objects').previousElementSibling,$('globe-home'));assert.equal($('workspace-objects').textContent,mode==='iss'?'Équipage à bord':'Liste des objets');}
 assert.equal($('workspace-station-control').nextElementSibling,$('workspace-deep-control'),'Deep-space menu follows stations');
 const missions=[...$('workspace-deep-space').querySelectorAll('a')];assert.equal(missions.length,require('../static/pages.js').definitions.filter(row=>row.trajectory).length);assert.ok(missions.some(link=>link.textContent.includes('James Webb')));
 const categories=[...$('workspace-deep-space').querySelectorAll('.deep-menu-category')];assert.equal(categories.length,5);
 const titles=categories.map(section=>section.querySelector('summary').textContent);assert.deepEqual(titles,[...titles].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base',numeric:true})));
 for(const section of categories){const labels=[...section.querySelectorAll('a')].map(link=>link.textContent);assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base',numeric:true})),'Each mission category is alphabetical');}
 for(const section of categories){assert.equal(section.tagName,'DETAILS');assert.ok(section.classList.contains('atlas-category'),'Reuse satellite menu accordion styling');}
 const search=$('deep-mission-search');search.value='Voyager';search.dispatchEvent(new window.Event('input'));
 assert.equal(categories.filter(section=>!section.hidden).length,1);assert.equal(missions.filter(link=>!link.hidden).length,2);assert.equal($('workspace-deep-space').querySelector('details:not([hidden])').open,true);
 search.value='zzzzzz';search.dispatchEvent(new window.Event('input'));assert.equal($('workspace-deep-space').querySelector('.deep-menu-empty').hidden,false);
 search.value='';search.dispatchEvent(new window.Event('input'));assert.equal(missions.filter(link=>!link.hidden).length,missions.length);
 $('workspace-deep-button').click();assert.equal($('workspace-deep-space').hidden,false);assert.equal($('workspace-deep-button').getAttribute('aria-expanded'),'true');$('workspace-stations-button').click();assert.equal($('workspace-deep-space').hidden,true,'Opening stations closes distant missions');
 assert.ok(categories.every(section=>!section.hasAttribute('open')),'Closing collapses every mission category');
 $('workspace-deep-button').click();search.value='Voyager';search.dispatchEvent(new window.Event('input'));$('workspace-deep-space').scrollTop=230;
 $('workspace-deep-button').click();assert.equal(search.value,'');assert.equal($('workspace-deep-space').scrollTop,0);assert.ok(categories.every(section=>!section.hasAttribute('open')));assert.ok(missions.every(link=>!link.hidden));
 const key=(name,extra={})=>{const event=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(event,{key:name,...extra});search.dispatchEvent(event);return event;};
 $('workspace-deep-button').click();search.value='Voyager';search.dispatchEvent(new window.Event('input'));
 const matches=missions.filter(link=>!link.hidden);let openedMission=null;for(const link of missions)link.click=()=>{openedMission=link.id;};
 assert.equal(key('Tab').defaultPrevented,true);assert.equal(search.getAttribute('aria-activedescendant'),matches[0].id);
 key('Tab');assert.equal(search.getAttribute('aria-activedescendant'),matches[1].id);key('Tab');assert.equal(search.getAttribute('aria-activedescendant'),matches[0].id);
 key('ArrowUp');assert.equal(search.getAttribute('aria-activedescendant'),matches[1].id);key('ArrowDown');assert.equal(search.getAttribute('aria-activedescendant'),matches[0].id);
 key('Tab',{shiftKey:true});assert.equal(search.getAttribute('aria-activedescendant'),matches[1].id);key('Enter');assert.equal(openedMission,matches[1].id);assert.equal($('workspace-deep-space').hidden,true);assert.equal(search.getAttribute('aria-activedescendant'),null);
 $('workspace-deep-button').click();search.value='Voyager';search.dispatchEvent(new window.Event('input'));openedMission=null;key('Enter');assert.equal(openedMission,null);assert.equal(search.getAttribute('aria-activedescendant'),matches[0].id);key('Enter');assert.equal(openedMission,matches[0].id);
 $('workspace-deep-button').click();search.value='Kepler';search.dispatchEvent(new window.Event('input'));openedMission=null;key('Enter');assert.equal(openedMission,'deep-mission-option-kepler','One result opens immediately with Enter');
 $('workspace-deep-button').click();search.value='zzzz';search.dispatchEvent(new window.Event('input'));openedMission=null;key('Enter');assert.equal(openedMission,null);assert.equal($('workspace-deep-space').querySelector('.deep-menu-empty').hidden,false);$('workspace-deep-button').click();
 const fixture=document.createElement('div');fixture.innerHTML='<details open><summary>Category</summary><input type="checkbox" checked><input type="color" value="#123456"></details>';fixture.scrollTop=99;
 context.AtlasCollectionMenu.reset(fixture);assert.equal(fixture.scrollTop,0);assert.equal(fixture.querySelector('details').hasAttribute('open'),false);assert.equal(fixture.querySelector('input[type=checkbox]').hasAttribute('checked'),true);assert.equal(fixture.querySelector('input[type=color]').value,'#123456');
 fixture.id='advanced-panel';fixture.innerHTML='<section id="advanced-color-section"><details open><summary>Colors</summary></details></section>';fixture.scrollTop=99;
 context.AtlasCollectionMenu.reset(fixture);assert.equal(fixture.scrollTop,99);assert.ok(fixture.querySelector('details').hasAttribute('open'),'Atlas colours retain their state');
 const stations=[...$('workspace-stations').querySelectorAll('a')].map(link=>link.textContent.trim());assert.deepEqual(stations,[...stations].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base',numeric:true})),'Stations remain alphabetical on '+mode);
 assert.equal(nav.hidden,mode==='all','No duplicate satellite menu on Atlas');
 assert.equal($('workspace-home').hidden,mode==='all');assert.equal($('workspace-home').textContent,'Retour à l’Atlas');assert.equal($('workspace-home').getAttribute('href'),'/atlas');
}
const {document}=parseHTML(fs.readFileSync('static/moon.html','utf8')).window;
assert.equal(document.getElementById('return-earth').textContent,'Retour à l’Atlas');
console.log('Header navigation: Atlas, satellite, station and Moon labels, order and return links OK.');
