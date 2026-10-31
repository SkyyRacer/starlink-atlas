/* Orbital changes only; no position notifications or software-release announcements. */
(()=>{
 const base=new URL('./',document.currentScript.src),button=document.getElementById('orbital-news-button'),dialog=document.getElementById('orbital-news-dialog'),list=document.getElementById('orbital-news-list');let request;
 const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
 const date=value=>{const day=/^\d{4}-\d{2}-\d{2}$/.test(value||'');const parsed=new Date(day?value+'T12:00:00Z':value);return Number.isFinite(+parsed)?new Intl.DateTimeFormat('fr-FR',{timeZone:day?'UTC':'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',...(!day?{hour:'2-digit',minute:'2-digit'}:{})}).format(parsed):'Date non précisée';};
 const eventTime=item=>{const time=Date.parse(item.at);return Number.isFinite(time)?time:Date.parse(item.observed_at)||0;};
 const themeNames={stations:'Stations, équipages et sorties EVA',science:'Sciences et astronomie',navigation:'Navigation',telecommunications:'Télécommunications',observation:'Observation de la Terre',weather:'Météo et climat',experimental:'Expérimental',debris:'Débris spatiaux',other:'Autres objets'};
 function category(item){return item.category||(item.family==='debris'?'debris':['iss','tiangong'].includes(item.family)?'stations':AtlasPages.definition?.(item.family)?.category)||'other';}
 function render(data){
  const expanded=new Set([...list.querySelectorAll?.('.news-theme[open]')||[]].map(group=>group.dataset.theme));list.replaceChildren();
  const now=Date.now(),cutoff=now-7*86400000;
  const items=(data.items||[]).filter(item=>{const value=item.observed_at||item.at,t=Date.parse(value);return Number.isFinite(t)&&t<=now&&(t>=cutoff||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=new Date(cutoff).toISOString().slice(0,10)));}).sort((a,b)=>eventTime(b)-eventTime(a));
  if(!items.length){list.append(element('p','Aucun changement confirmé au cours des sept derniers jours.','news-empty'));return;}
  const groups=new Map();
  for(const [theme,name] of Object.entries(themeNames)){
   const rows=items.filter(item=>category(item)===theme);if(!rows.length)continue;
   const wrapper=element('li',null,'news-theme-item'),group=element('details',null,'news-theme');group.dataset.theme=theme;group.open=expanded.has(theme);
   const summary=element('summary');summary.append(element('span',name),element('span',String(rows.length),'news-theme-count'));group.append(summary);const content=element('ul',null,'news-theme-events');group.append(content);wrapper.append(group);list.append(wrapper);groups.set(theme,content);
  }
  for(const item of items){
   const objects=item.objects||[],count=objects.length,label=item.label||'Satellites',plural=count>1;
   const text=item.title||(item.kind==='launch'?`${count} satellite${plural?'s':''} ${label} ajouté${plural?'s':''}`:item.kind==='decay'?`${count} objet${plural?'s':''} ${label} désorbité${plural?'s':''}`:item.kind==='status'?`${objects[0]?.name||label} · ${item.status}`:`${count} objet${plural?'s':''} ${label} ajouté${plural?'s':''} au catalogue`);
   const card=element('li',null,'news-item');card.append(element('span',({launch:'LANCEMENT',decay:'DÉSORBITATION',status:'CHANGEMENT D’ÉTAT',addition:'CATALOGUE',cargo:'RAVITAILLEMENT',mission:'MISSION VERS UNE STATION',crew:'ÉQUIPAGE',eva:'SORTIE EXTRAVÉHICULAIRE'})[item.kind]||'CATALOGUE','news-kind'));card.append(element('h3',text));
   const time=element('time',date(item.at));time.dateTime=item.at;card.append(time);
   if(item.kind==='launch')card.append(element('p',/^\d{4}-\d{2}-\d{2}$/.test(item.at)?'Date du lancement · heure non fournie':'Lancement · heure de Paris','news-meta'));
   if(item.kind==='status')card.append(element('p',`État précédent : ${item.previous_status||'inconnu'} · changement constaté à cette collecte`,'news-meta'));
   if(item.crew?.length)card.append(element('p',item.crew.map(person=>person.name).filter(Boolean).join(' · '),'news-meta'));
   if(item.duration)card.append(element('p','Durée : '+item.duration.replace(/^PT/,'').replace('H',' h ').replace('M',' min ').replace('S',' s'),'news-meta'));
   if(objects.length){
    const details=element('details',null,'news-objects'),summary=element('summary',plural?'Voir les objets concernés':'Détails de l’objet');details.append(summary);const names=element('ul');details.append(names);card.append(details);let populated=false;
    details.addEventListener('toggle',()=>{if(!details.open||populated)return;populated=true;for(const object of objects){const row=element('li',`${object.name} · NORAD ${object.id}`);if(Number.isSafeInteger(Number(object.id))&&Number(object.id)>0){const link=element('a','Voir l’objet en 3D');link.href=AtlasPages.satelliteUrl({...object,family:item.family},item.kind==='decay'?Date.parse(item.at)-60000:null);row.append(link);}names.append(row);}});
   }
   if(objects.length===1&&Number.isSafeInteger(Number(objects[0].id))&&Number(objects[0].id)>0){const link=element('a','Voir l’objet en 3D');link.href=AtlasPages.satelliteUrl({...objects[0],family:item.family},item.kind==='decay'?Date.parse(item.at)-60000:null);card.append(link);}
   else if(/^[a-z0-9-]+$/.test(item.family||'')){const link=element('a',`Voir ${label}`);link.href=new URL(item.family==='all'?'atlas':item.family,base).href;card.append(link);}
   if(item.source_url){try{const source=new URL(item.source_url);if(source.protocol==='https:'){const link=element('a','Source');link.href=source.href;link.target='_blank';link.rel='noopener';card.append(link);}}catch{}}
   (groups.get(category(item))||groups.get('other'))?.append(card);
  }
 }
 async function refresh(background=false){
  const intro=dialog.querySelector?.('.news-intro');if(intro)intro.textContent='Changements signalés depuis le '+new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(Date.now()-7*86400000));
  if(!request){if(!background)list.replaceChildren(element('p','Consultation des actualités…','news-empty'));request=fetch(new URL(window.AtlasStatic?'news.json':'api/news',base),{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('Actualités indisponibles');return response.json();}).finally(()=>{request=null;});}
  try{render(await request);}catch{if(!background)list.replaceChildren(element('p','Les actualités sont momentanément indisponibles. Réessayez dans un instant.','news-empty'));request=null;}
 }
 function standaloneDropdown(){return typeof matchMedia==='function'&&matchMedia('(min-width: 901px)').matches&&document.body.classList.contains('lunar-page');}
 function positionStandalone(){if(!dialog.open||!standaloneDropdown())return;const r=button.getBoundingClientRect(),width=Math.min(480,innerWidth-32),bounds={top:r.bottom+8,left:Math.max(16,Math.min(innerWidth-width-16,r.right-width)),width,maxHeight:Math.min(innerHeight*.5,innerHeight-r.bottom-24)};if(window.AtlasUI?.place)window.AtlasUI.place(dialog,bounds);else for(const [k,v] of Object.entries(bounds))dialog.style[k]=v+'px';}
 window.addEventListener?.('resize',positionStandalone);
 button.addEventListener('click',async()=>{if(dialog.open){dialog.close();return;}if(typeof matchMedia==='function'&&matchMedia('(min-width: 901px)').matches&&(document.body.classList.contains('earth-workspace')||standaloneDropdown()))dialog.show();else dialog.showModal();button.setAttribute('aria-expanded','true');positionStandalone();await refresh();positionStandalone();});
 if(typeof setInterval==='function')setInterval(()=>{if(dialog.open&&!document.hidden)refresh(true);},60000);

 document.addEventListener('pointerdown',event=>{if(dialog.open&&!dialog.matches(':modal')&&!dialog.contains(event.target)&&!button.contains(event.target))dialog.close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open&&!dialog.matches(':modal')){event.preventDefault();dialog.close();button.focus({preventScroll:true});}});
 document.getElementById('orbital-news-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{globalThis.AtlasCollectionMenu?.reset(dialog);button.setAttribute('aria-expanded','false');});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
})();
