/* Desktop Earth workspace: attached submenus and local scene controls. */
(()=>{
 const $=id=>document.getElementById(id),desktop=matchMedia('(min-width: 901px)');
 const header=document.querySelector('body>header');
 const rail=$('satellite-panel'),bar=$('workspace-navigation'),objects=$('workspace-objects'),close=$('workspace-close');
 const nav=document.querySelector('.collection-navigation'),menu=$('collection-menu-button'),tools=$('advanced-tools'),news=$('orbital-news-button');
 const debris=$('workspace-debris'),debrisButton=$('workspace-debris-button'),debrisMenu=$('workspace-debris-menu');
 const isAtlas=document.body.dataset.collection==='all'||!$('atlas-controls').hidden;
 const isStation=AtlasPages.hasCrew(document.body.dataset.collection);
 const isDeep=!!AtlasPages.definition(document.body.dataset.collection)?.trajectory;
 close.firstChild.textContent='';
 if(isStation){close.setAttribute('aria-label','Fermer Missions et équipage');}
 const search=document.querySelector('.object-search'),searchMenu=nav.querySelector('.collection-menu-panel');
 const categorySearch=document.createElement('div');categorySearch.id='workspace-category-search';
 const sceneTools=document.querySelector('.globe-tools'),stack=document.createElement('div');stack.id='scene-left-stack';document.querySelector('.view').append(stack);
 const stationLinks=document.createElement('nav');stationLinks.id='workspace-stations';stationLinks.setAttribute('aria-label','Stations spatiales');stationLinks.hidden=true;
 const stationControl=document.createElement('div');stationControl.id='workspace-station-control';
 const stationButton=document.createElement('button');stationButton.id='workspace-stations-button';stationButton.type='button';stationButton.textContent='Stations spatiales';stationButton.className='workspace-dropdown';stationButton.setAttribute('aria-expanded','false');stationButton.setAttribute('aria-controls','workspace-stations');
 stationControl.append(stationButton,stationLinks);bar.append(stationControl);
 const deepControl=document.createElement('div');deepControl.id='workspace-deep-control';
 const deepButton=document.createElement('button');deepButton.id='workspace-deep-button';deepButton.type='button';deepButton.textContent='Missions lointaines';deepButton.className='workspace-dropdown';deepButton.setAttribute('aria-expanded','false');deepButton.setAttribute('aria-controls','workspace-deep-space');
 const deepLinks=document.createElement('nav');deepLinks.id='workspace-deep-space';deepLinks.hidden=true;deepLinks.setAttribute('aria-label','Missions lointaines');
 const missionMenu=window.AtlasMissionMenu.mount({panel:deepLinks,definitions:AtlasPages.definitions,url:id=>AtlasPages.url(id),current:document.body.dataset.collection,close:()=>closeDeep()});
 const deepSearch=missionMenu.search,clearMissionChoice=missionMenu.clear;
 deepControl.append(deepButton,deepLinks);stationControl.after(deepControl);
 function closeDeep(restore=false){if(!deepLinks.hidden)globalThis.AtlasCollectionMenu?.reset(deepLinks);clearMissionChoice();deepSearch.setAttribute('aria-expanded','false');deepLinks.hidden=true;deepButton.setAttribute('aria-expanded','false');if(restore)deepButton.focus({preventScroll:true});}
 deepButton.addEventListener('click',()=>{const open=deepLinks.hidden;closeStations();if(open){setObjects(false);closeMenu();closeTools();closeDebris();closeNews();deepLinks.hidden=false;deepLinks.scrollTop=0;deepSearch.setAttribute('aria-expanded','true');deepButton.setAttribute('aria-expanded','true');positionSubmenu(deepLinks,deepButton,350);}});
 deepControl.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&event.target===deepButton){event.preventDefault();if(deepLinks.hidden)deepButton.click();deepSearch.focus({preventScroll:true});}if(event.key==='Escape'){event.preventDefault();closeDeep(true);}});

 for(const button of [menu,objects,tools,news,debrisButton])button.classList.add('workspace-dropdown');
 const sceneActions=document.createElement('div');sceneActions.id='scene-actions';stack.append(sceneActions);
 const placements=[];let mounted=false,opened=false;
 const frozenControls=isAtlas?document.createElement('div'):null;
 if(frozenControls){frozenControls.id='workspace-frozen-controls';frozenControls.hidden=true;rail.prepend(frozenControls);}
 const titleRow=!isAtlas?document.createElement('div'):null;
 if(titleRow){titleRow.id='workspace-title-row';titleRow.hidden=true;document.querySelector('.observation-title').before(titleRow);}
 function submenuGeometry(rect,width,height,preferred=350,headerBottom=0){
  const w=Math.min(preferred,Math.max(160,width-40));
  const top=Math.ceil(Math.max(rect.bottom,headerBottom));
  return {left:Math.max(20,Math.min(rect.left,width-w-20)),top,width:w,maxHeight:Math.max(100,Math.min(height*.5,height-top-20))};
 }
 window.AtlasWorkspace={submenuGeometry};
 function positionSubmenu(panel,trigger,width){
  if(!desktop.matches||!Number.isFinite(window.innerWidth)||!Number.isFinite(window.innerHeight))return;
  const scale=window.AtlasUI?.scale||1;
  const rect=trigger.getBoundingClientRect(),headerBottom=header.getBoundingClientRect().bottom;
  const g=submenuGeometry(rect,window.innerWidth,window.innerHeight,width*scale,headerBottom);
  if(panel===rail&&!isAtlas){g.left=20;g.width=Math.min(440*scale,window.innerWidth-40);if(Number.isFinite(rect.top)&&rect.top-headerBottom>160){g.top=Math.ceil(headerBottom+10);g.maxHeight=Math.floor(rect.top-g.top-10);}}
  if(window.AtlasUI)window.AtlasUI.place(panel,g);else for(const key of ['left','top','width','maxHeight'])panel.style[key]=g[key]+'px';
  panel.style.right='auto';panel.style.bottom='auto';
 }
 function positionDebris(){
  if(!mounted||debrisMenu.hidden||!Number.isFinite(window.innerHeight))return;
  const anchor=debrisButton.getBoundingClientRect(),bounds=stack.getBoundingClientRect();
  const headerBottom=header.getBoundingClientRect().bottom;
  const scale=window.AtlasUI?.scale||1;
  const width=Math.min(320*scale,window.innerWidth-40);
  debrisMenu.style.left=Math.max(20,Math.min(bounds.left,window.innerWidth-width-20))/scale+'px';
  debrisMenu.style.width=width/scale+'px';debrisMenu.style.right='auto';debrisMenu.style.top='auto';
  debrisMenu.style.bottom=Math.max(20,window.innerHeight-anchor.top+10)/scale+'px';
  debrisMenu.style.maxHeight=Math.max(80,Math.min(window.innerHeight*.5,anchor.top-headerBottom-30))/scale+'px';
 }
 function positionMenus(){
  if(!mounted)return;
  positionDebris();
  if(!stationLinks.hidden)positionSubmenu(stationLinks,stationButton,230);
  if(!deepLinks.hidden)positionSubmenu(deepLinks,deepButton,350);
  if(opened)positionSubmenu(rail,objects,350);
  if(menu.getAttribute('aria-expanded')==='true')positionSubmenu(searchMenu,menu,350);
  if(tools.getAttribute('aria-expanded')==='true')positionSubmenu($('advanced-panel'),tools,360);
  if($('orbital-news-dialog').open)positionSubmenu($('orbital-news-dialog'),news,440);
 }
 if(isAtlas){
  rail.classList.add('workspace-categories-panel');$('atlas-controls').before(categorySearch);
  close.setAttribute('aria-label','Fermer Tous les objets');
  const group=document.createElement('details');group.className='atlas-category workspace-debris-category';
  const summary=document.createElement('summary');summary.textContent='Débris spatiaux';const categoryCount=document.createElement('span');categoryCount.className='atlas-category-total';summary.append(categoryCount);group.append(summary);
  const link=document.createElement('a');link.className='workspace-debris-category-link';link.href=AtlasPages.url('debris');link.append(document.createTextNode('Voir la page Débris spatiaux'));
  const count=document.createElement('small');link.append(count);group.append(link);document.querySelector('.atlas-family-list').append(group);
  const counter=$('atlas-count-debris'),sync=()=>{if(count.textContent!==counter.textContent)count.textContent=counter.textContent;if(categoryCount.textContent!==counter.textContent)categoryCount.textContent=counter.textContent;};sync();
  new MutationObserver(sync).observe(counter,{childList:true,characterData:true,subtree:true});
  const card=document.querySelector('.atlas-debris-card');card.querySelector('.atlas-page-link').textContent='Isoler les débris';card.querySelector('[data-observe]').hidden=true;
 }
 for(const [id,mode] of [['workspace-home','all'],['workspace-iss','iss'],['workspace-tiangong','tiangong'],['workspace-debris-page','debris']])$(id).href=AtlasPages.url(mode);
 $('workspace-debris-page').textContent='Isoler les débris';
 $('workspace-debris-atlas').href=AtlasPages.url('all')+'?debris=1';$('workspace-home').hidden=isAtlas;
 for(const [id,mode] of [['workspace-iss','iss'],['workspace-tiangong','tiangong']])if(document.body.dataset.collection===mode)$(id).setAttribute('aria-current','page');
 function closeStations(restoreFocus=false){closeDeep();if(!stationLinks.hidden)globalThis.AtlasCollectionMenu?.reset(stationLinks);stationLinks.hidden=true;stationButton.setAttribute('aria-expanded','false');if(restoreFocus)stationButton.focus({preventScroll:true});}
 function closeDebris(){if(!debrisMenu.hidden)globalThis.AtlasCollectionMenu?.reset(debrisMenu);debrisMenu.hidden=true;debrisButton.setAttribute('aria-expanded','false');}
 function move(node,parent){const marker=document.createComment('workspace original position');node.before(marker);placements.push({node,marker});parent.append(node);}
 function closeMenu(){if(menu.getAttribute('aria-expanded')==='true')menu.click();}
 function closeTools(){if(tools.getAttribute('aria-expanded')==='true')tools.click();}
 function closeNews(){const dialog=$('orbital-news-dialog');if(dialog.open)dialog.close();}
 function setObjects(open,restoreFocus=false){
  if(open)closeStations();
  if(opened&&!open)globalThis.AtlasCollectionMenu?.reset(rail);
  opened=desktop.matches&&open;rail.hidden=desktop.matches&&!opened;document.body.classList.toggle('workspace-objects-open',opened);objects.setAttribute('aria-expanded',String(opened));
  if(desktop.matches)rail.inert=!opened;
  if(isAtlas&&desktop.matches){if(opened)categorySearch.append(search);else searchMenu.prepend(search);}
  if(opened){positionSubmenu(rail,objects,350);rail.scrollTop=0;(isAtlas?$('object-search'):close).focus({preventScroll:true});}
  else if(restoreFocus)objects.focus({preventScroll:true});
 }
 function syncRecenter(){
  if(!mounted)return;
  const target=$('advanced-model-options').dataset.following==='true'?sceneActions:sceneTools.querySelector('.globe-buttons');
  if($('globe-home').parentElement!==target)target.append($('globe-home'));
  if(isAtlas&&debris.parentElement!==target)target.append(debris);
  if(!isAtlas){$('globe-home').after(objects);if(opened)positionSubmenu(rail,objects,350);}
 }
 function syncView(){syncRecenter();const view=$('view-3d').getAttribute('aria-pressed')==='true'?'3d':'2d';if(stack.dataset.view!==view)stack.dataset.view=view;}
 function layout(){
  if(desktop.matches){
   if(mounted){positionMenus();return;}mounted=true;document.body.classList.add('earth-workspace');document.body.classList.toggle('dedicated-workspace',!isAtlas);
   move($('workspace-iss'),stationLinks);move($('workspace-tiangong'),stationLinks);
   if(!stationLinks.querySelector('[data-historical-station]'))for(const row of AtlasPages.definitions.filter(row=>row.category==='stations'&&row.station_menu!==false&&!row.station_id)){const link=document.createElement('a');link.href=AtlasPages.url(row.id);link.textContent=row.label;link.className='workspace-link';link.dataset.historicalStation=row.id;stationLinks.append(link);}
   stationLinks.append(...[...stationLinks.querySelectorAll('a')].sort((a,b)=>a.textContent.trim().localeCompare(b.textContent.trim(),'fr',{sensitivity:'base',numeric:true})));
   move(nav,bar);move(tools,bar);move(news,bar);if(isAtlas)move(debris,sceneActions);move($('globe-home'),sceneActions);move(sceneTools,stack);
   tools.hidden=!isAtlas;debris.hidden=!isAtlas;close.hidden=false;
   if(isAtlas){frozenControls.hidden=false;move(close,frozenControls);move(categorySearch,frozenControls);move(document.querySelector('#atlas-controls .atlas-actions'),frozenControls);bar.prepend(nav);nav.after(objects);nav.classList.add('workspace-primary-menu');move(document.querySelector('.atlas-debris-card'),$('workspace-debris-content'));move(debrisMenu,document.body);}
   else{titleRow.hidden=false;move(document.querySelector('.observation-title'),titleRow);move(close,titleRow);move(objects,sceneActions);$('workspace-debris-navigation').hidden=false;}
   if(isAtlas){objects.after(stationControl);nav.hidden=true;}else{nav.after(stationControl);nav.hidden=false;}stationControl.after(deepControl);
   menu.setThematic?.(!isAtlas);objects.textContent=isAtlas?'Tous les objets':isStation?'Équipage à bord':isDeep?'Simuler le trajet':'Liste des objets';
   setObjects(false);syncView();
  }else{
   if(!mounted)return;closeStations();setObjects(false);closeMenu();closeTools();closeDebris();menu.setThematic?.(false);closeNews();
   debrisMenu.removeAttribute('style');nav.hidden=false;
   for(const {node,marker} of placements.splice(0))marker.replaceWith(node);
   if(frozenControls)frozenControls.hidden=true;if(titleRow)titleRow.hidden=true;
   tools.hidden=false;close.hidden=false;document.body.classList.remove('earth-workspace','dedicated-workspace');nav.classList.remove('workspace-primary-menu');mounted=false;
  }
  window.dispatchEvent(new Event('resize'));
 }
 stationButton.addEventListener('click',()=>{closeDeep();const open=stationLinks.hidden;if(open){setObjects(false);closeMenu();closeTools();closeDebris();closeNews();stationLinks.hidden=false;stationButton.setAttribute('aria-expanded','true');positionSubmenu(stationLinks,stationButton,230);}else closeStations();});
 stationControl.addEventListener('keydown',event=>{if(event.key==='ArrowDown'&&event.target===stationButton){event.preventDefault();if(stationLinks.hidden)stationButton.click();stationLinks.querySelector('a')?.focus({preventScroll:true});}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!stationLinks.hidden){event.preventDefault();closeStations(true);}});
 objects.addEventListener('click',()=>{if(isDeep){closeMenu();closeTools();closeDebris();closeNews();window.dispatchEvent(new Event('atlas:mission-events-toggle'));return;}const next=!opened;if(next){closeMenu();closeTools();closeDebris();closeNews();}setObjects(next);});
 close.addEventListener('click',()=>setObjects(false,true));
 menu.addEventListener('click',()=>{if(desktop.matches&&menu.getAttribute('aria-expanded')==='true'){closeStations();setObjects(false);closeTools();closeDebris();closeNews();positionSubmenu(searchMenu,menu,350);}});
 tools.addEventListener('click',()=>{if(desktop.matches&&tools.getAttribute('aria-expanded')==='true'){closeStations();setObjects(false);closeMenu();closeDebris();closeNews();positionSubmenu($('advanced-panel'),tools,360);}});
 news.addEventListener('click',()=>{if(desktop.matches){closeStations();setObjects(false);closeMenu();closeTools();closeDebris();positionSubmenu($('orbital-news-dialog'),news,440);}});
 document.addEventListener('atlas:lunar-view',()=>closeDebris());
 document.addEventListener('atlas:observe',()=>{if(desktop.matches)setObjects(false);});
 rail.addEventListener('click',event=>{if(desktop.matches&&event.target.closest('.satellite-result'))setObjects(false);});
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!desktop.matches||!opened||document.querySelector('dialog[open]'))return;
  event.preventDefault();setObjects(false,true);
 });
 document.addEventListener('pointerdown',event=>{
  if(!desktop.matches||document.querySelector('dialog[open]'))return;
  if(!stationLinks.hidden&&!stationControl.contains(event.target))closeStations();
  if(!deepLinks.hidden&&!deepControl.contains(event.target))closeDeep();
  if(opened&&!rail.contains(event.target)&&!objects.contains(event.target))setObjects(false);
  if(!$('advanced-panel').hidden&&!$('advanced-panel').contains(event.target)&&!tools.contains(event.target))closeTools();
  if(!debrisMenu.hidden&&!debris.contains(event.target)&&!debrisMenu.contains(event.target))closeDebris();
 });
 debrisButton.addEventListener('click',()=>{const open=debrisMenu.hidden;if(open){closeStations();setObjects(false);closeMenu();closeTools();closeNews();}debrisMenu.hidden=!open;debrisButton.setAttribute('aria-expanded',String(open));if(open)positionDebris();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!debrisMenu.hidden){event.preventDefault();closeDebris();debrisButton.focus({preventScroll:true});}});
 // Reveal station search results by scrolling the menu, without moving the page.
 let searchRevealQueued=false;
 function revealStationResults(){
  if(!isStation||!opened||!desktop.matches||document.querySelector('dialog[open]'))return;
  const input=$('iss-search'),results=$('iss-search-results');if(results.hidden||!results.childElementCount)return;
  const panel=rail.getBoundingClientRect();if(panel.height<=0)return;
  const field=input.getBoundingClientRect(),viewportHeight=window.innerHeight||panel.height;
  const scale=window.AtlasUI?.scale||1;
  const limit=Math.max(72,Math.min(viewportHeight*.32,panel.height-field.height-80)/scale);
  if(results.style.maxHeight!==limit+'px')results.style.maxHeight=limit+'px';
  const top=panel.top+12,bottom=panel.bottom-12;
  if(field.top<top)rail.scrollTop=Math.max(0,rail.scrollTop+(field.top-top)/scale);
  const current=input.getBoundingClientRect(),list=results.getBoundingClientRect();
  const delta=Math.min(Math.max(0,list.bottom-bottom),Math.max(0,current.top-top));
  if(delta>0)rail.scrollTop+=delta/scale;
 }
 function queueSearchReveal(){if(searchRevealQueued)return;searchRevealQueued=true;queueMicrotask(()=>{searchRevealQueued=false;revealStationResults();});}
 if(isStation){
  $('iss-search').addEventListener('input',queueSearchReveal);
  new MutationObserver(queueSearchReveal).observe($('iss-search-results'),{childList:true,attributes:true,attributeFilter:['hidden']});
 }
 new MutationObserver(syncRecenter).observe($('advanced-model-options'),{attributes:true,attributeFilter:['data-following']});
 new MutationObserver(syncView).observe($('view-3d'),{attributes:true,attributeFilter:['aria-pressed']});
 stack.addEventListener('scroll',positionDebris);
 window.addEventListener('scroll',positionMenus,{passive:true});
 window.addEventListener('resize',positionMenus);desktop.addEventListener('change',layout);layout();
 if(isAtlas&&new URLSearchParams(window.location?.search||'').get('debris')==='1'){const box=document.querySelector('[data-family="debris"]');if(box&&!box.checked)$('atlas-debris-toggle').click();}
})();
