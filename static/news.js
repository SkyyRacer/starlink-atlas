/* Orbital changes only; no position notifications or software-release announcements. */
(()=>{
 const base=new URL('./',document.currentScript.src),button=document.getElementById('orbital-news-button'),dialog=document.getElementById('orbital-news-dialog'),list=document.getElementById('orbital-news-list');let request;
 const element=(tag,text,className)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
 const date=value=>{const day=/^\d{4}-\d{2}-\d{2}$/.test(value||'');const parsed=new Date(day?value+'T12:00:00Z':value);return Number.isFinite(+parsed)?new Intl.DateTimeFormat('fr-FR',{timeZone:day?'UTC':'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',...(!day?{hour:'2-digit',minute:'2-digit'}:{})}).format(parsed):'Date non précisée';};
 function render(data){list.replaceChildren();const items=(data.items||[]).slice(0,60);if(!items.length){list.append(element('p','Aucun changement orbital récent détecté.','news-empty'));return;}
  for(const item of items){
   const objects=item.objects||[],count=objects.length,label=item.label||'Satellites',plural=count>1;
   const text=item.kind==='launch'?`${count} satellite${plural?'s':''} ${label} ajouté${plural?'s':''}`:item.kind==='decay'?`${count} objet${plural?'s':''} ${label} désorbité${plural?'s':''}`:item.kind==='status'?`${objects[0]?.name||label} · ${item.status}`:`${count} objet${plural?'s':''} ${label} ajouté${plural?'s':''} au catalogue`;
   const card=element('li',null,'news-item');card.append(element('span',({launch:'LANCEMENT',decay:'DÉSORBITATION',status:'CHANGEMENT D’ÉTAT',addition:'CATALOGUE'})[item.kind]||'CATALOGUE','news-kind'));card.append(element('h3',text));
   const time=element('time',date(item.at));time.dateTime=item.at;card.append(time);
   if(item.kind==='launch')card.append(element('p',/^\d{4}-\d{2}-\d{2}$/.test(item.at)?'Date du lancement · heure non fournie':'Lancement · heure de Paris','news-meta'));
   if(item.kind==='status')card.append(element('p',`État précédent : ${item.previous_status||'inconnu'} · changement constaté à cette collecte`,'news-meta'));
   const details=element('details'),summary=element('summary',plural?'Voir les objets concernés':'Voir l’objet concerné');details.append(summary);const names=element('ul');for(const object of objects.slice(0,100))names.append(element('li',`${object.name} · NORAD ${object.id}`));if(objects.length>100)names.append(element('li',`Et ${objects.length-100} autres objets`));details.append(names);card.append(details);
   if(/^[a-z0-9-]+$/.test(item.family||'')){const link=element('a',`Voir ${label}`);link.href=new URL(item.family==='all'?'atlas':item.family,base).href;card.append(link);}list.append(card);
  }
 }
 button.addEventListener('click',async()=>{dialog.showModal();button.setAttribute('aria-expanded','true');if(!request){list.replaceChildren(element('p','Consultation des actualités…','news-empty'));request=fetch(new URL(window.AtlasStatic?'news.json':'api/news',base),{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('Actualités indisponibles');return response.json();});}try{render(await request);}catch{list.replaceChildren(element('p','Les actualités sont momentanément indisponibles. Réessayez dans un instant.','news-empty'));request=null;}});
 document.getElementById('orbital-news-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>button.setAttribute('aria-expanded','false'));dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
})();
