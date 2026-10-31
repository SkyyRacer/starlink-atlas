/* Shared mission categories and accessible search on every Atlas document. */
(function(root){root.AtlasMissionMenu={mount({panel:deepLinks,definitions,url,current,close:closeDeep}){
 const deepSearchBox=document.createElement('div');deepSearchBox.className='deep-menu-search object-search integrated-object-search';
 const deepSearchLabel=document.createElement('label');deepSearchLabel.htmlFor='deep-mission-search';deepSearchLabel.textContent='Rechercher une mission';
 const deepSearch=document.createElement('input');deepSearch.id='deep-mission-search';deepSearch.type='search';deepSearch.autocomplete='off';deepSearch.placeholder='JWST, Cassini, Voyager…';deepSearch.setAttribute('role','combobox');deepSearch.setAttribute('aria-autocomplete','list');deepSearch.setAttribute('aria-expanded','false');deepSearch.setAttribute('aria-controls','workspace-deep-space');deepSearchBox.append(deepSearchLabel,deepSearch);deepLinks.append(deepSearchBox);
 const distantCategories=new Map();
 for(const row of definitions.filter(row=>row.trajectory)){const name=row.deep_category||'Autres missions';if(!distantCategories.has(name))distantCategories.set(name,[]);distantCategories.get(name).push(row);}
 const alphabetical=(a,b)=>a.localeCompare(b,'fr',{sensitivity:'base',numeric:true});
 for(const [name,rows] of [...distantCategories].sort(([a],[b])=>alphabetical(a,b))){
  const section=document.createElement('details');section.className='deep-menu-category atlas-category collection-menu-theme';const title=document.createElement('summary');title.textContent=name;section.append(title);section.setAttribute('aria-label',name);
  const list=document.createElement('div');list.className='deep-menu-items';list.setAttribute('role','group');list.setAttribute('aria-label',name);
  for(const row of rows.sort((a,b)=>alphabetical(a.label,b.label))){const link=document.createElement('a');link.href=url(row.id);link.className='collection-menu-option';link.id='deep-mission-option-'+row.id;link.textContent=row.label;link.dataset.search=row.label+' '+row.description;if(row.id===current)link.setAttribute('aria-current','page');list.append(link);}
  section.append(list);deepLinks.append(section);
 }
 const deepEmpty=document.createElement('p');deepEmpty.className='deep-menu-empty';deepEmpty.textContent='Aucun résultat';deepEmpty.hidden=true;deepEmpty.setAttribute('role','status');deepLinks.append(deepEmpty);
 const normalizeMission=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
 let activeMission=null;
 function clearMissionChoice(){activeMission=null;deepSearch.removeAttribute('aria-activedescendant');for(const link of deepLinks.querySelectorAll('a'))link.classList.remove('is-active');}
 function selectMission(link){
  clearMissionChoice();activeMission=link;link.classList.add('is-active');link.closest('details').open=true;deepSearch.setAttribute('aria-activedescendant',link.id);
  const box=link.getBoundingClientRect(),viewport=deepLinks.getBoundingClientRect(),sticky=deepSearchBox.getBoundingClientRect();
  const top=Math.max(viewport.top,sticky.bottom);
  if(box.top<top)deepLinks.scrollTop-=top-box.top;else if(box.bottom>viewport.bottom)deepLinks.scrollTop+=box.bottom-viewport.bottom;
 }
 deepSearch.addEventListener('keydown',event=>{
  if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!deepSearch.value.trim()||!['Tab','ArrowDown','ArrowUp','Enter'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();const found=[...deepLinks.querySelectorAll('a')].filter(link=>!link.hidden);
  if(!found.length)return;
  if(event.key==='Enter'){if(activeMission||found.length===1){(activeMission||found[0]).click();closeDeep();}else selectMission(found[0]);return;}
  const backwards=event.key==='ArrowUp'||(event.key==='Tab'&&event.shiftKey),index=found.indexOf(activeMission);
  selectMission(found[index<0?(backwards?found.length-1:0):(index+(backwards?-1:1)+found.length)%found.length]);
 });
 deepSearch.addEventListener('input',()=>{clearMissionChoice();deepSearch.setAttribute('aria-expanded',String(!deepLinks.hidden));const query=normalizeMission(deepSearch.value);let total=0;for(const category of deepLinks.querySelectorAll('details')){let matches=0;for(const link of category.querySelectorAll('a')){link.hidden=!!query&&!normalizeMission(link.dataset.search).includes(query);if(!link.hidden)matches++;}category.hidden=matches===0;if(query)category.open=matches>0;else category.open=!!category.querySelector('[aria-current="page"]');total+=matches;}deepEmpty.hidden=total>0;});

 return {search:deepSearch,clear:clearMissionChoice,reset(){deepSearch.value='';deepSearch.dispatchEvent(new Event('input'));for(const section of deepLinks.querySelectorAll('details'))section.open=false;deepLinks.scrollTop=0;}};
}};})(typeof window==='undefined'?globalThis:window);
