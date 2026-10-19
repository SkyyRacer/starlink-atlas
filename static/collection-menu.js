/* Shared observation menu, rendered identically on every platform. */
(function(root){
 const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 function entries(options){return [...options].map(o=>({value:o.value,label:o.textContent})).sort((a,b)=>a.value==='all'?-1:b.value==='all'?1:a.label.localeCompare(b.label,'fr',{sensitivity:'base',numeric:true}));}
 function match(items,query,active){for(let offset=1;offset<=items.length;offset++){const index=(Math.max(-1,active)+offset)%items.length;if(normalize(items[index].label).startsWith(normalize(query)))return index;}return -1;}
 function mount(select){
  const items=entries(select.options),nav=select.parentElement;
  const button=document.createElement('button');button.id='collection-menu-button';button.type='button';button.className='collection-menu-button';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls','collection-menu-list');button.setAttribute('aria-expanded','false');
  const label=nav.querySelector('label');label.htmlFor=button.id;label.id='collection-menu-label';button.setAttribute('aria-labelledby',label.id+' '+button.id);
  const panel=document.createElement('div');panel.className='collection-menu-panel';panel.hidden=true;
  const help=document.createElement('p');help.className='collection-menu-help';help.id='collection-menu-help';help.textContent='Tapez une lettre pour accéder aux objets correspondants.';button.setAttribute('aria-describedby',help.id);
  const list=document.createElement('div');list.id='collection-menu-list';list.className='collection-menu-list';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',label.id);
  let active=Math.max(0,items.findIndex(item=>item.value===select.value)),query='',group=null,letter='';const options=[],headings=new Map();
  function activate(index,scroll=true,showLetter=false){active=Math.max(0,Math.min(items.length-1,index));options.forEach((option,i)=>{option.classList.toggle('is-active',i===active);});button.setAttribute('aria-activedescendant',options[active].id);if(scroll){const heading=showLetter&&headings.get(normalize(items[active].label).charAt(0));const target=heading||options[active],box=target.getBoundingClientRect(),viewport=list.getBoundingClientRect(),top=box.top-viewport.top+list.scrollTop-list.clientTop;
    if(heading||top<list.scrollTop)list.scrollTop=top;else if(top+box.height>list.scrollTop+list.clientHeight)list.scrollTop=top+box.height-list.clientHeight;}}
  function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');query='';}
  function open(){panel.hidden=false;button.setAttribute('aria-expanded','true');activate(items.findIndex(item=>item.value===select.value));query='';}
  function choose(index){select.value=items[index].value;button.textContent=items[index].label;options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));close();select.dispatchEvent(new Event('change',{bubbles:true}));}
  items.forEach((item,index)=>{
   if(item.value==='all'){group=list;}else{
    const next=normalize(item.label).charAt(0).toUpperCase();
    if(next!==letter){letter=next;group=document.createElement('div');group.className='collection-menu-group';group.setAttribute('role','group');group.setAttribute('aria-label',letter);const heading=document.createElement('div');heading.className='collection-menu-letter';heading.textContent=letter;heading.setAttribute('aria-hidden','true');group.append(heading);headings.set(next.toLowerCase(),heading);list.append(group);}
   }
   const option=document.createElement('div');option.id='collection-option-'+item.value;option.className='collection-menu-option';option.setAttribute('role','option');option.setAttribute('aria-selected',String(item.value===select.value));option.textContent=item.label;option.addEventListener('click',()=>{choose(index);button.focus({preventScroll:true});});group.append(option);options.push(option);
  });
  button.textContent=items[active].label;panel.append(help,list);select.hidden=true;select.tabIndex=-1;nav.append(button,panel);
  button.addEventListener('click',()=>panel.hidden?open():close());
  document.addEventListener('keydown',event=>{
   if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return;
   if(panel.hidden&&event.target!==button)return;
   if(event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
   const key=event.key;
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
