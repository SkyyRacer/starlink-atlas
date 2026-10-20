'use strict';
/* A compact overview selector sharing the original Atlas visibility controls. */
(()=>{
 const $=id=>document.getElementById(id);
 if(document.body.dataset.collection!=='all'&&$('atlas-controls').hidden)return;
 const sources=[...document.querySelectorAll('.atlas-category[data-category]')];
 const root=document.createElement('details');root.id='overview-selection';
 const summary=document.createElement('summary');summary.textContent='Satellites sélectionnés';root.append(summary);
 const panel=document.createElement('div');panel.className='overview-selection-panel';root.append(panel);
 const rows=[],groups=[];
 function commit(items,value){for(const row of items)row.source.checked=value;items[0]?.source.dispatchEvent(new Event('change',{bubbles:true}));sync();}
 const actions=document.createElement('div');actions.className='overview-selection-actions';
 for(const [text,value] of [['Tout sélectionner',true],['Tout désélectionner',false]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',()=>commit(rows,value));actions.append(button);}panel.append(actions);
 for(const category of sources){
  const group=document.createElement('details'),title=document.createElement('summary');title.textContent=category.querySelector('summary').firstChild.textContent.trim();group.append(title);panel.append(group);
  const label=document.createElement('label'),bulk=document.createElement('input');bulk.type='checkbox';label.append(bulk,document.createTextNode('Toute la catégorie'));group.append(label);
  const members=[];
  for(const source of category.querySelectorAll('[data-family]')){
   const card=source.closest('.atlas-family-card'),label=document.createElement('label'),target=document.createElement('input'),text=document.createElement('span');target.type='checkbox';target.dataset.selectionFamily=source.dataset.family;text.textContent=card.querySelector('strong').textContent;label.append(target,text);group.append(label);
   const row={source,target};members.push(row);rows.push(row);
   target.addEventListener('change',()=>{source.checked=target.checked;source.dispatchEvent(new Event('change',{bubbles:true}));sync();});
  }
  bulk.addEventListener('change',()=>commit(members,bulk.checked));groups.push({bulk,members});
 }
 function sync(){
  for(const row of rows)row.target.checked=row.source.checked;
  for(const {bulk,members} of groups){const n=members.filter(row=>row.source.checked).length;bulk.checked=n===members.length;bulk.indeterminate=n>0&&n<members.length;}
  const hidden=$('advanced-model-options').dataset.following==='true';root.hidden=hidden;if(hidden)root.open=false;
 }
 document.querySelector('.globe-buttons').after(root);
 let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
 document.addEventListener('change',schedule);document.addEventListener('click',schedule);
 new MutationObserver(schedule).observe($('atlas-controls'),{subtree:true,childList:true,characterData:true});
 new MutationObserver(sync).observe($('advanced-model-options'),{attributes:true,attributeFilter:['data-following']});
 document.addEventListener('pointerdown',event=>{if(root.open&&!root.contains(event.target))root.open=false;});
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.open){event.preventDefault();root.open=false;summary.focus({preventScroll:true});}});
 sync();
})();
