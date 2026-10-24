/* Retired pages load only two small indexes; the full orbital archive stays lazy. */
(function(root){
 const stationIds=new Set((root.AtlasPages?.definitions||[]).filter(row=>row.category==='stations').flatMap(row=>[...(row.ids||[]),row.station_id].filter(Number.isSafeInteger)));
 const base=typeof document!=='undefined'?new URL('.',document.currentScript.src):null;
 function allDecayed(rows,at,collection){return collection!=='all'&&collection!=='debris'&&rows.length>0&&rows.every(s=>Number.isFinite(Date.parse(s.decay))&&Date.parse(s.decay)<=at);}
 function endOfMission(facts){const value=facts?.TOp;if(!value||value==='-'||value==='*')return null;const months={Jan:'janv.',Feb:'févr.',Mar:'mars',Apr:'avr.',May:'mai',Jun:'juin',Jul:'juil.',Aug:'août',Sep:'sept.',Oct:'oct.',Nov:'nov.',Dec:'déc.'};return value.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g,m=>months[m])+(facts.TF==='X'?' (estimation incertaine)':'');}
 function create(parent,onVisit){
  let panel=null,request=null,key='',revision=0;
  function node(tag,text){const n=document.createElement(tag);if(text)n.textContent=text;return n;}
  async function indexes(){if(!request)request=Promise.all(['retired-positions.json','mission-lifecycles.json'].map(file=>fetch(new URL(file,base),{cache:'no-store',...(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(10000)}:{})}).then(r=>{if(!r.ok)throw Error('Index indisponible');return r.json();}))).catch(()=>{request=null;return null;});return request;}
  function hide(){revision++;key='';if(panel)panel.hidden=true;}
  function dismiss(){revision++;if(panel)panel.hidden=true;}
  document.addEventListener('click',event=>{if(event.button===0&&panel&&!panel.hidden&&!panel.contains(event.target))dismiss();},true);
  async function update(rows,at,collection,selectedId=null,availability=null){
   const missing=availability&&availability.collection===collection&&availability.selected===selectedId&&Math.abs(availability.at-at)<150000&&!availability.hasPosition;
   const relevant=selectedId===null?rows:rows.filter(s=>s.id===selectedId);
   const distant=Boolean(root.AtlasPages?.definition(collection)?.trajectory);
   if(missing&&(!allDecayed(relevant,at,selectedId===null?collection:'selected')||distant)){
    const next='missing:'+collection+':'+selectedId+':'+availability.suggestedAt;if(key===next)return;key=next;revision++;
    if(!panel){panel=node('section');panel.className='retired-satellites';panel.setAttribute('aria-labelledby','retired-title');parent.append(panel);}
    panel.hidden=false;panel.replaceChildren();const header=node('header');header.className='retired-header';
    const title=node('h2','Position indisponible à cette date');title.id='retired-title';const close=node('button');close.type='button';close.className='retired-close';close.setAttribute('aria-label','Fermer la fenêtre');close.title='Fermer';close.addEventListener('click',dismiss);header.append(title,close);panel.append(header);
    const name=selectedId===null?root.AtlasPages?.definition(collection)?.label:relevant[0]?.name;if(name)panel.append(node('h3',name));
    const beforeLaunch=relevant.length>0&&relevant.every(s=>Number.isFinite(Date.parse(s.launch))&&Date.parse(s.launch)>at);
    const time=Date.parse(availability.suggestedAt);
    panel.append(node('p',beforeLaunch?'La date consultée précède le lancement. Cet objet ne peut pas encore être affiché en orbite.':Number.isFinite(time)?'Aucune observation exploitable ne permet d’afficher la position à la date consultée. Une autre date est disponible dans la chronologie.':'Les données orbitales disponibles dans ATLAS ne permettent pas de reconstituer la position à cette date. La fiche reste consultable, mais aucune position ne peut être affichée.'));
    if(Number.isFinite(time)){const button=node('button',distant?'Voir la dernière position disponible':'Voir une date disponible');button.type='button';button.addEventListener('click',()=>{hide();onVisit(selectedId??relevant[0]?.id??null,time,distant);});panel.append(button);}
    return;
   }
   const target=rows.find(s=>s.id===selectedId),focused=target&&allDecayed([target],at,'selected');
   if(focused)rows=[target];
   if(!allDecayed(rows,at,focused?'selected':collection)){if(key)hide();return;}
   const next=rows.map(s=>[s.id,s.decay]).join('|');if(key===next)return;key=next;const token=++revision;
   if(!panel){panel=node('section');panel.className='retired-satellites';panel.setAttribute('aria-labelledby','retired-title');parent.append(panel);}
   panel.hidden=false;panel.replaceChildren();const name=rows.length===1?rows[0].name:root.AtlasPages?.definition(collection)?.label;const stations=rows.every(s=>stationIds.has(s.id));const title=node('h2',rows.length===1?(stations?'Station spatiale désorbitée':'Satellite désorbité'):(stations?'Groupe de stations spatiales désorbitées':'Groupe entièrement désorbité'));title.id='retired-title';const header=node('header');header.className='retired-header';const close=node('button');close.type='button';close.className='retired-close';close.setAttribute('aria-label','Fermer la fenêtre');close.title='Fermer';close.addEventListener('click',dismiss);header.append(title,close);panel.append(header);if(rows.length>1)panel.append(node('p',(stations?'Toutes les stations spatiales du groupe « ':'Tous les satellites du groupe « ')+(name||rows.map(s=>s.name).join(' · '))+(stations?' » sont désorbitées à la date consultée.':' » sont désorbités à la date consultée.')));
   const container=node('div');container.className='retired-list';panel.append(container);container.append(node('p','Recherche des dernières observations…'));
   const data=await indexes();if(token!==revision)return;container.replaceChildren();
   for(const satellite of [...rows].sort((a,b)=>String(b.decay).localeCompare(String(a.decay))||a.name.localeCompare(b.name))){
    const row=node('article');row.append(node('h3',satellite.name));const facts=data?.[1]?.objects?.[satellite.id],ended=endOfMission(facts);
    row.append(node('p',ended?'Fin des opérations : '+ended:'Fin des opérations : date non renseignée'));
    row.append(node('p','Rentrée / retour sur Terre : '+root.AtlasTime.event(satellite.decay)));
    const entry=data?.[0]?.objects?.[satellite.id],time=Date.parse(entry?.at);
    if(Number.isFinite(time)&&time<Date.parse(satellite.decay)&&(!satellite.launch||time>=Date.parse(satellite.launch))){
     row.append(node('p','Dernière observation exploitable : '+root.AtlasTime.instant(entry.at)));
     const button=node('button','Voir la dernière position archivée');button.type='button';button.addEventListener('click',()=>{hide();onVisit(satellite.id,time);});row.append(button);
    }else row.append(node('p',data?'Position archivée indisponible pour cet objet.':'Index indisponible. Réessayez en rechargeant cette page.'));
    container.append(row);
   }
  }
  return {update,hide};
 }
 const api={allDecayed,endOfMission,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasRetired=api;
})(typeof window==='undefined'?globalThis:window);
