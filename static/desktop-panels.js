/* Desktop menus: existing controls and data handlers remain the source of truth. */
(function(root){
 function bindColor(source,target,sync){
  target.value=source.value;
  target.addEventListener('input',()=>{source.value=target.value;source.dispatchEvent(new Event('input',{bubbles:true}));sync();});
 }
 function mount(){
  const $=id=>document.getElementById(id),desktop=matchMedia('(min-width: 901px)'),panel=$('advanced-panel'),nav=document.querySelector('.collection-navigation'),menu=nav.querySelector('.collection-menu-panel'),menuButton=$('collection-menu-button'),search=document.querySelector('.object-search'),input=$('object-search');
  const placements=[];let attached=false,isOpen=false,proxies=[];
  function move(node,parent,first=false){const marker=document.createComment('original control position');node.before(marker);placements.push({node,marker});if(first)parent.prepend(node);else parent.append(node);}
  function restore(){for(const {node,marker} of placements.splice(0)){marker.replaceWith(node);}search.classList.remove('integrated-object-search');search.querySelector('label').textContent='Rechercher un objet à observer';input.placeholder='Nom d’un satellite ou d’une constellation…';attached=false;document.body.classList.remove('desktop-panel-layout');}
  function sync(){for(const {source,target} of proxies)target.value=source.value;}
  function syncModelView(){const is3d=$('view-3d').getAttribute('aria-pressed')==='true';panel.dataset.view=is3d?'3d':'2d';$('advanced-model-state').textContent=is3d?'Les options de modèle détaillé apparaissent lorsqu’un objet compatible est sélectionné.':'Les modèles détaillés sont accessibles dans la vue Terre 3D.';}
  function colorRow(source,name,parent){
   const label=document.createElement('label');label.className='panel-color-row';const text=document.createElement('span');text.textContent=name;
   const target=document.createElement('input');target.type='color';target.setAttribute('aria-label','Couleur : '+name);bindColor(source,target,sync);proxies.push({source,target});label.append(text,target);parent.append(label);
  }
  function colors(){
   const host=$('advanced-colors-content');host.replaceChildren();proxies=[];
   const debris=document.querySelector('.atlas-debris-card input[type=color]');if(debris)colorRow(debris,'Débris spatiaux',host);
   document.querySelectorAll('.atlas-category').forEach(category=>{
    if(category.classList.contains('workspace-debris-category'))return;
    const group=document.createElement('details');group.className='panel-color-group';const heading=document.createElement('summary');heading.textContent=category.querySelector('summary').childNodes[0].textContent.trim();group.append(heading);
    const bulk=category.querySelector('[data-theme-color]');if(bulk)colorRow(bulk,'Toute la rubrique',group);
    category.querySelectorAll('.atlas-family-card').forEach(card=>{const source=card.querySelector('input[type=color]');if(source)colorRow(source,card.querySelector('strong').textContent,group);});host.append(group);
   });
  }
  function close(restoreFocus=false){
   if(!isOpen)return;isOpen=false;panel.hidden=true;panel.inert=true;
   const button=$('advanced-tools');if(button.getAttribute('aria-expanded')==='true')button.click();
   if(restoreFocus)button.focus({preventScroll:true});
  }
  root.AtlasAdvanced={setOpen(value){
   const open=desktop.matches&&value;if(!open){panel.hidden=true;panel.inert=true;isOpen=false;return;}
   sync();panel.hidden=false;panel.inert=false;if(!isOpen){isOpen=true;$('advanced-panel-close').focus({preventScroll:true});}
  }};
  function layout(){
   if(!desktop.matches){close();if(attached)restore();return;}
   if(attached)return;attached=true;document.body.classList.add('desktop-panel-layout');
   move(search,menu,true);search.classList.add('integrated-object-search');
   search.querySelector('label').textContent='Rechercher un objet';input.placeholder='ISS, Starlink, Galileo…';
   $('advanced-filter-section').hidden=true;
   $('advanced-color-section').hidden=$('atlas-controls').hidden;if(!$('atlas-controls').hidden)colors();
   $('advanced-model-section').hidden=true;
   syncModelView();
  }
  function fitMenu(){if(!desktop.matches||menu.hidden||!Number.isFinite(root.innerHeight))return;const available=Math.max(140,root.innerHeight-menu.getBoundingClientRect().top-30);menu.style.maxHeight=available+'px';const list=$('collection-menu-list');list.style.maxHeight=Math.max(80,available-search.offsetHeight-55)+'px';}
  menuButton.addEventListener('click',()=>{if(desktop.matches&&!menu.hidden){input.focus({preventScroll:true});fitMenu();}});
  input.addEventListener('input',fitMenu);root.addEventListener('resize',fitMenu);
  input.addEventListener('keydown',event=>{
   if(!desktop.matches)return;
   if(input.closest('#workspace-category-search')){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();$('workspace-close').click();$('workspace-objects').focus({preventScroll:true});}return;}
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!menu.hidden)menuButton.click();menuButton.focus({preventScroll:true});}
   else if(!input.value&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();event.stopPropagation();menuButton.focus({preventScroll:true});menuButton.dispatchEvent(new KeyboardEvent('keydown',{key:event.key,bubbles:true}));}
  });
  $('advanced-panel-close').addEventListener('click',()=>close(true));
  document.addEventListener('keydown',event=>{const calendar=$('date-popover');if(event.key!=='Escape'||!isOpen||document.querySelector('dialog[open]')||(calendar&&!calendar.hidden))return;event.preventDefault();close(true);});
  $('atlas-reset').addEventListener('click',()=>queueMicrotask(sync));
  document.querySelectorAll('.atlas-color-control input,[data-theme-color]').forEach(control=>control.addEventListener('input',()=>queueMicrotask(sync)));
  new MutationObserver(syncModelView).observe($('view-3d'),{attributes:true,attributeFilter:['aria-pressed']});
  desktop.addEventListener('change',layout);layout();
 }
 const api={bindColor,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else{root.AtlasDesktopPanels=api;mount();}
})(typeof window!=='undefined'?window:globalThis);
