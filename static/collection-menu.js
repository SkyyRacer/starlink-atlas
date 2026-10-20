/* Shared observation menu, rendered identically on every platform. */
(function(root){
 const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 function entries(options){return [...options].map(o=>({value:o.value,label:o.textContent})).sort((a,b)=>a.value==='all'?-1:b.value==='all'?1:a.label.localeCompare(b.label,'fr',{sensitivity:'base',numeric:true}));}
 function match(items,query,active){for(let offset=1;offset<=items.length;offset++){const index=(Math.max(-1,active)+offset)%items.length;if(normalize(items[index].label).startsWith(normalize(query)))return index;}return -1;}
 function mount(select){
  let items=entries(select.options);const originalItems=items.slice(),nav=select.parentElement;let themed=false;
  const button=document.createElement('button');button.id='collection-menu-button';button.type='button';button.className='collection-menu-button';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls','collection-menu-list');button.setAttribute('aria-expanded','false');
  const label=nav.querySelector('label');label.htmlFor=button.id;label.id='collection-menu-label';button.setAttribute('aria-labelledby',label.id+' '+button.id);
  const panel=document.createElement('div');panel.className='collection-menu-panel';panel.hidden=true;
  const help=document.createElement('p');help.className='collection-menu-help';help.id='collection-menu-help';help.textContent='Tapez une lettre pour accéder aux objets correspondants.';button.setAttribute('aria-describedby',help.id);
  const list=document.createElement('div');list.id='collection-menu-list';list.className='collection-menu-list';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',label.id);
  let active=Math.max(0,items.findIndex(item=>item.value===select.value)),query='',group=null,letter='';const options=[],headings=new Map();
  function activate(index,scroll=true,showLetter=false){active=Math.max(0,Math.min(items.length-1,index));options.forEach((option,i)=>{option.classList.toggle('is-active',i===active);});button.setAttribute('aria-activedescendant',options[active].id);const enclosing=options[active].closest?.('details');if(enclosing)enclosing.open=true;if(scroll){const heading=showLetter&&headings.get(normalize(items[active].label).charAt(0));const target=heading||options[active],box=target.getBoundingClientRect(),viewport=list.getBoundingClientRect(),top=box.top-viewport.top+list.scrollTop-list.clientTop;
    if(heading||top<list.scrollTop)list.scrollTop=top;else if(top+box.height>list.scrollTop+list.clientHeight)list.scrollTop=top+box.height-list.clientHeight;}}
  function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');query='';}
  function open(){panel.hidden=false;button.setAttribute('aria-expanded','true');const index=items.findIndex(item=>item.value===select.value);if(themed&&index<0){active=-1;options.forEach(option=>option.classList.toggle('is-active',false));button.removeAttribute('aria-activedescendant');}else activate(index);query='';}
  function choose(index){if(index<0||!items[index])return;select.value=items[index].value;button.textContent=themed?'Types de satellites':items[index].label;options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));close();select.dispatchEvent(new Event('change',{bubbles:true}));}
  function option(item,index,parent){
   const node=document.createElement('div');node.id='collection-option-'+item.value;node.className='collection-menu-option';node.setAttribute('role','option');node.setAttribute('aria-selected',String(item.value===select.value));node.textContent=item.label;node.addEventListener('click',()=>{choose(index);button.focus({preventScroll:true});});parent.append(node);options.push(node);
  }
  function render(){
   options.length=0;headings.clear();list.replaceChildren?.();group=null;letter='';
   if(themed){
    const labels={science:'Satellites scientifiques',navigation:'Navigation',telecommunications:'Télécommunications',observation:'Observation de la Terre',weather:'Météorologie et climat',experimental:'Expérimentaux'};
    const definitions=root.AtlasCollections?.definitions||[];const lookup=new Map(definitions.map(row=>[row.id,row]));
    items=Object.keys(labels).flatMap(category=>originalItems.filter(item=>lookup.get(item.value)?.category===category));
    let category='';
    items.forEach((item,index)=>{const next=lookup.get(item.value).category;if(next!==category){category=next;const details=document.createElement('details');details.className='collection-menu-theme';const title=document.createElement('summary');title.textContent=labels[category];details.append(title);group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label',labels[category]);details.append(group);list.append(details);}option(item,index,group);});
   }else{
    items=originalItems.slice();
    items.forEach((item,index)=>{if(item.value==='all'){group=list;}else{const next=normalize(item.label).charAt(0).toUpperCase();if(next!==letter){letter=next;group=document.createElement('div');group.className='collection-menu-group';group.setAttribute('role','group');group.setAttribute('aria-label',letter);const heading=document.createElement('div');heading.className='collection-menu-letter';heading.textContent=letter;heading.setAttribute('aria-hidden','true');group.append(heading);headings.set(next.toLowerCase(),heading);list.append(group);}}option(item,index,group);});
   }
   active=Math.max(0,items.findIndex(item=>item.value===select.value));
  }
  render();
  button.setThematic=value=>{if(themed===value)return;close();themed=value;render();help.textContent=themed?'Recherchez un objet ou dépliez un thème.':'Tapez une lettre pour accéder aux objets correspondants.';button.textContent=themed?'Types de satellites':(items.find(item=>item.value===select.value)?.label||'Tous les satellites');};
  button.textContent=items[active].label;panel.append(help,list);select.hidden=true;select.tabIndex=-1;nav.append(button,panel);
  button.addEventListener('click',()=>panel.hidden?open():close());
  document.addEventListener('keydown',event=>{
   if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
   if(panel.hidden&&event.target!==button)return;
   if(event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
   const key=event.key;
   if(themed&&event.target?.closest?.('.collection-menu-theme>summary')&&['Enter',' '].includes(key))return;
   if(key==='Tab'){close();return;}
   if(key==='Escape'){if(!panel.hidden){event.preventDefault();close();}return;}
   if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp'].includes(key)){
    event.preventDefault();const wasClosed=panel.hidden;if(wasClosed)open();
    if(key==='Home')activate(0);else if(key==='End')activate(items.length-1);else if(!wasClosed)activate(active+({ArrowDown:1,ArrowUp:-1,PageDown:8,PageUp:-8}[key]));return;
   }
   if(key==='Enter'||key===' '){event.preventDefault();if(panel.hidden)open();else choose(active);return;}
   if(key.length===1&&/[\p{L}\p{N}]/u.test(key)){
    event.preventDefault();event.stopPropagation();if(panel.hidden)open();
    const repeated=normalize(query)===normalize(key);query=key;
    const index=match(items,key,repeated?active:-1);if(index>=0)activate(index,true,!repeated);
   }
  });
  document.addEventListener('pointerdown',event=>{if(!nav.contains(event.target))close();});
  nav.addEventListener('focusout',event=>{if(event.relatedTarget&&!nav.contains(event.relatedTarget))close();});
 }
 const api={entries,match,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasCollectionMenu=api;
})(globalThis);
