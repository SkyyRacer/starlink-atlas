'use strict';
/* A compact overview selector sharing the original Atlas visibility controls. */
(()=>{
 const $=id=>document.getElementById(id);
 const isAtlas=document.body.dataset.collection==='all'||!$('atlas-controls').hidden;
 const sources=isAtlas?[...document.querySelectorAll('.atlas-category[data-category]')]:[];
 const root=document.createElement('details');root.id='overview-selection';
 const summary=document.createElement('summary');summary.textContent='Satellites sélectionnés';root.append(summary);
 const panel=document.createElement('div');panel.className='overview-selection-panel';root.append(panel);
 const visibility=document.createElement('button');visibility.id='overview-visibility';visibility.type='button';visibility.textContent='Masquer les satellites';visibility.setAttribute('aria-pressed','false');
 const planarActions=document.createElement('div');planarActions.className='map-scene-actions';
 if($('map-creator')){$('map-creator').prepend(planarActions);if($('map-reset'))planarActions.append($('map-reset'));}
 const rows=[],groups=[];let hiddenSelection=null,applying=false;
 function commit(items,value,preserveHidden=false){
  if(!preserveHidden)hiddenSelection=null;
  applying=true;
  try{for(const row of items)row.source.checked=value;items[0]?.source.dispatchEvent(new Event('change',{bubbles:true}));}
  finally{applying=false;}
  sync();
 }
 visibility.addEventListener('click',()=>{
  const state=globalThis.AtlasSatelliteVisibility;
  if(!isAtlas||state?.focused){state?.toggle();sync();return;}
  const checked=rows.filter(row=>row.source.checked);
  if(checked.length){hiddenSelection=new Set(checked.map(row=>row.source.dataset.family));commit(rows,false,true);}
  else{const restore=hiddenSelection?rows.filter(row=>hiddenSelection.has(row.source.dataset.family)):rows;commit(restore,true,true);hiddenSelection=null;}
 });
 const actions=document.createElement('div');actions.className='overview-selection-actions';
 for(const [text,value] of [['Tout sélectionner',true],['Tout désélectionner',false]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',()=>commit(rows,value));actions.append(button);}panel.append(actions);
 for(const category of sources){
  const group=document.createElement('details'),title=document.createElement('summary');title.textContent=category.querySelector('summary').firstChild.textContent.trim();group.append(title);panel.append(group);
  const label=document.createElement('label'),bulk=document.createElement('input');bulk.type='checkbox';label.append(bulk,document.createTextNode('Toute la catégorie'));group.append(label);
  const members=[];
  for(const source of category.querySelectorAll('[data-family]')){
   const card=source.closest('.atlas-family-card'),label=document.createElement('label'),target=document.createElement('input'),text=document.createElement('span');target.type='checkbox';target.dataset.selectionFamily=source.dataset.family;text.textContent=card.querySelector('strong').textContent;label.append(target,text);group.append(label);
   const row={source,target};members.push(row);rows.push(row);
   target.addEventListener('change',()=>commit([row],target.checked));
  }
  bulk.addEventListener('change',()=>commit(members,bulk.checked));groups.push({bulk,members});
 }
 let lastFocused=null;
 function sync(){
  const state=globalThis.AtlasSatelliteVisibility,focused=state?.focused??$('advanced-model-options').dataset.following==='true';
  if(state&&lastFocused!==null&&lastFocused!==focused)state.refresh();lastFocused=focused;
  const hidden=isAtlas&&!focused?!rows.some(row=>row.source.checked):!!state?.hidden;
  visibility.setAttribute('aria-pressed',String(hidden));visibility.textContent=focused?(hidden?'Afficher les autres satellites':'Masquer les autres satellites'):(hidden?'Afficher les satellites':'Masquer les satellites');
  for(const row of rows)row.target.checked=row.source.checked;
  for(const {bulk,members} of groups){const n=members.filter(row=>row.source.checked).length;bulk.checked=n===members.length;bulk.indeterminate=n>0&&n<members.length;}
  root.hidden=!isAtlas||focused;visibility.hidden=state?!state.available:!isAtlas;if(root.hidden)root.open=false;
  const planar=$('view-2d').getAttribute('aria-pressed')==='true',buttons=document.querySelector('.globe-buttons');
  if(planar&&$('map-creator')){if(visibility.parentElement!==planarActions)planarActions.append(visibility);}
  else{const anchor=isAtlas?root:buttons;if(visibility.parentElement!==anchor.parentElement||anchor.nextElementSibling!==visibility)anchor.after(visibility);}
 }
 const buttons=document.querySelector('.globe-buttons');if(isAtlas)buttons.after(root);(isAtlas?root:buttons).after(visibility);
 let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
 document.addEventListener('change',event=>{if(!applying&&event.target.matches('[data-family]'))hiddenSelection=null;schedule();});
 // Checkbox click default actions dispatch change after click listeners. A sync
 // queued by the proxy's click can undo its checked state before change runs.
 document.addEventListener('click',event=>{if(!root.contains(event.target)&&!visibility.contains(event.target))schedule();});
 // Visibility changes already emit change events; live counters need no resync.
 new MutationObserver(sync).observe($('advanced-model-options'),{attributes:true,attributeFilter:['data-following']});
 new MutationObserver(sync).observe($('view-2d'),{attributes:true,attributeFilter:['aria-pressed']});
 document.addEventListener('atlas:satellite-visibility-state',sync);
 document.addEventListener('pointerdown',event=>{if(root.open&&!root.contains(event.target)&&!visibility.contains(event.target))root.open=false;});
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.open){event.preventDefault();root.open=false;summary.focus({preventScroll:true});}});
 sync();
})();
