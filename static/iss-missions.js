/* ISS flight facts are loaded once per visit; only elapsed times change locally. */
(function(){
 const $=id=>document.getElementById(id), root=$('iss-controls'), dialog=$('iss-mission-dialog');
 const station=AtlasPages.mode(location.pathname),stationName=station==='tiangong'?'Tiangong':'ISS';
 // Routes change documents; non-station pages need no crew listeners or timer.
 if(!AtlasPages.isStation(station))return;
 const stationText=value=>typeof value==='string'&&station==='tiangong'?value.replaceAll('de l’ISS','de Tiangong').replaceAll('à l’ISS','à Tiangong').replaceAll('vers l’ISS','vers Tiangong').replaceAll('ISS','Tiangong'):value;
 if(AtlasPages.isStation(station)){root.setAttribute('aria-label','Missions et équipage '+stationName);$('iss-search-results').setAttribute('aria-label','Résultats de recherche '+stationName);}
 let data=null, pending=null, searchIndex=[], searchItems=[],activeItem=null,refreshing=false;
 const viewedAt=()=>window.AtlasTimeline?.time??Date.now();
 const liveView=()=>window.AtlasTimeline?.live??true;
 const crewView=()=>AtlasStationHistory.crewAt(data,viewedAt(),liveView());
 const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=stationText(value??'Non renseigné');if(cls)e.className=cls;return e;};
 const date=v=>v?AtlasTime.instant(v):'Non renseignée';
 const roles={'Commander':'Commandant','Spacecraft Commander':'Commandant du vaisseau','Flight Engineer':'Ingénieur de vol','Pilot':'Pilote','Mission Specialist':'Spécialiste de mission','Spaceflight Participant':'Participant au vol','Payload Specialist':'Spécialiste de charge utile'};
 function launchDate(f){
  if(!f.launch)return 'Non renseignée';
  const precision=f.precision||'Unknown',d=new Date(f.launch),year=d.getUTCFullYear();
  if(!f.precision)return new Intl.DateTimeFormat(navigator.language,{dateStyle:'medium',timeZone:'UTC'}).format(d)+' · UTC, précision non renseignée';
  if(/^Quarter [1-4]$/.test(precision))return 'T'+precision.slice(-1)+' '+year;
  if(/^Year Half [12]$/.test(precision))return (precision.endsWith('1')?'1er':'2e')+' semestre '+year;
  if(precision==='Year')return String(year);
  if(precision==='Second')return date(f.launch);
  if(['Minute','Hour'].includes(precision))return new Intl.DateTimeFormat(navigator.language,{dateStyle:'medium',timeStyle:precision==='Minute'?'short':undefined,timeZone:'UTC'}).format(d)+' UTC · précision : '+(precision==='Minute'?'minute':'heure');
  if(precision==='Day')return new Intl.DateTimeFormat(navigator.language,{dateStyle:'medium',timeZone:'UTC'}).format(d)+' · jour UTC';
  if(precision==='Month')return new Intl.DateTimeFormat(navigator.language,{month:'long',year:'numeric',timeZone:'UTC'}).format(d);
  if(precision==='Quarter')return 'T'+(Math.floor(d.getUTCMonth()/3)+1)+' '+year;
  if(precision==='Half Year')return (d.getUTCMonth()<6?'1er':'2e')+' semestre '+year;
  return year+' · précision source : '+precision;
 }

 function flag(n){
  const image=document.createElement('img'),code=/^[A-Z]{2}$/.test(n.code||'')?n.code.toLowerCase():'xx';
  image.src='/images/flags/'+code+'.svg';image.className='iss-flag';image.width=20;image.height=15;image.alt=n.name?'Drapeau : '+n.name:'Nationalité non renseignée';image.decoding='async';
  image.onerror=()=>{image.onerror=null;image.src='/images/flags/xx.svg';};return image;
 }
 function nationalitiesFact(list){
  const fact=row('Nationalité','');const dd=fact.querySelector('dd');
  if(!list?.length)dd.textContent='Non renseignée';
  for(const n of list||[]){const item=text('span','', 'iss-nationality');item.append(flag(n),document.createTextNode(n.name||'Non renseignée'));dd.append(item);}return fact;
 }
 function aboard(current){
  const badge=$('iss-aboard-status');badge.hidden=!current;if(!current)return;
  const stale=Date.now()-Date.parse(data.fetched_at)>86400000;
  badge.classList.toggle('is-stale',stale&&liveView());badge.textContent=!liveView()?stationText('À bord de l’ISS à cette date'):stale?'À bord selon la dernière collecte':stationText('Actuellement à bord de l’ISS');badge.title='Données reçues le '+date(data.fetched_at);
 }
 function elapsed(start,end){const a=Date.parse(start),b=end?Math.min(Date.parse(end),viewedAt()):viewedAt();if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return 'Non renseignée';const hours=Math.floor((b-a)/3600000);return `${Math.floor(hours/24)} j ${hours%24} h`;}
 function sortCurrentCrew(crew){
  const collator=new Intl.Collator('fr',{sensitivity:'base'});
  const surname=person=>person.family_name||person.last_name||String(person.name||'').trim().split(/\s+/).at(-1)||'';
  return [...crew].sort((a,b)=>collator.compare(surname(a),surname(b))||collator.compare(a.name||'',b.name||''));
 }
 function people(list,target){
  target.replaceChildren();
  if(!list?.length){target.append(text('p','Aucun équipage renseigné pour ce vol.','hint'));return;}
  for(const a of list){
   const clickable=searchIndex.some(i=>i.kind==='person'&&i.id===a.id);
   const row=text(clickable?'button':'div','', 'iss-person'+(clickable?' iss-person-button':''));
   if(clickable){row.type='button';row.setAttribute('aria-label','Afficher la fiche de '+a.name);const open=()=>{const item=searchIndex.find(i=>i.kind==='person'&&i.id===a.id);if(item)showPerson(item,row);};row.addEventListener('click',open);row.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();}});row.addEventListener('keyup',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();open();}});}
   const name=text('strong','');for(const n of a.nationalities||[])name.append(flag(n));name.append(document.createTextNode(a.name));name.title=(a.nationalities||[]).map(n=>n.name).join(', ');row.append(name);
   const agency=a.agency_abbrev||a.agency||'Affiliation non renseignée';
   row.append(text('small',`${agency}${a.affiliation_type==='Private'?' · Privé':a.affiliation_type==='Commercial'?' · Privé / commercial':a.affiliation_type==='Non-Astronaut Passenger'?' · Passager':''}${a.role?' · '+(roles[a.role]||a.role):''}`));
   if(a.agency)row.title=a.agency;
   if(a.mission!==undefined){row.append(text('small',a.mission||'Mission non renseignée'));const days=text('span',a.arrival?`${elapsed(a.arrival)} à bord de l’ISS`:'Arrivée à bord non renseignée','iss-stay');days.dataset.arrival=a.arrival||'';row.append(days);}
   target.append(row);
  }
 }
 function row(label,value){const d=text('div','', 'iss-fact');d.append(text('dt',label),text('dd',value));return d;}
 function show(f,opener){
  activeItem={kind:'flight',value:f};
  aboard(null);$('iss-detail-kind').textContent='MISSION '+stationName;
  $('iss-mission-name').textContent=f.name;
  const body=$('iss-mission-body');body.replaceChildren();
  const past=Date.parse(f.launch)<=viewedAt(), success=f.status_id===3;
  body.append(text('p',past?(success?'Vol réalisé':f.status||'Statut non renseigné'):'Vol prévu · dates susceptibles de changer','iss-mission-state'));
  const facts=document.createElement('dl');
  facts.append(row('Décollage',launchDate(f)),row('Lieu de décollage',[f.pad,f.launch_site].filter(Boolean).join(' · ')||'Non renseigné'),row('Lanceur',f.rocket),row('Vaisseau',f.spacecraft),row('Opérateur du lancement',f.provider));
  const ended=Date.parse(f.end)<=viewedAt();
  facts.append(row('Arrivée à l’ISS',date(f.arrival)),row('Départ de l’ISS',date(f.departure)),row('Fin du vol',f.end?date(f.end)+(ended?'':' · prévue'):'Non renseignée'),row('Lieu d’atterrissage / amerrissage',f.landing_site?f.landing_site+(f.landed===true?'':' · prévu / non confirmé'):'Non renseigné'));
  const duration=past&&success?elapsed(f.launch,ended?f.end:null):'Non calculée avant confirmation du vol';
  facts.append(row('Durée du vol',duration+(past&&success&&!ended?' · en cours':'')),row('Séjour à l’ISS',f.arrival?elapsed(f.arrival,f.departure):'Non renseigné'));
  body.append(facts,text('h3','Équipage au lancement'));const crew=text('div','');people(f.crew,crew);body.append(crew);
  if(f.landing_crew?.length&&JSON.stringify(f.crew.map(a=>a.id))!==JSON.stringify(f.landing_crew.map(a=>a.id))){body.append(text('h3','Équipage au retour'));const ret=text('div','');people(f.landing_crew,ret);body.append(ret);}
  const a=text('a','Consulter la fiche source · Launch Library 2');a.href=f.url;a.target='_blank';a.rel='noopener';body.append(a,text('p','Les vols de ravitaillement sont également inclus. Les dates prévues et les lieux de retour non confirmés ne constituent pas des événements réalisés.','hint'));
  if(!dialog.open)dialog.showModal();else if(!refreshing)$('iss-mission-close').focus({preventScroll:true});if(!refreshing){dialog.scrollTop=0;dialog.dataset.opener=opener?.id||'';}
 }
 async function renderEVAs(id,section){
  section.append(text('h3','Sorties extravéhiculaires'),text('p','Chargement de l’historique…','hint'));
  try{
   const doc=await AtlasEVA.load();if(!section.isConnected)return;
   const stats=AtlasEVA.stats(doc,id,viewedAt());section.replaceChildren(text('h3','Sorties extravéhiculaires'));
   const summary=document.createElement('dl');summary.append(row('Sorties terminées documentées',String(stats.completed)),row('Durée cumulée documentée',stats.total===null?(stats.completed?'Non renseignée':'Aucune durée documentée'):AtlasEVA.format(stats.total)));
   if(stats.ongoing)summary.append(row('Sortie en cours',String(stats.ongoing)));
   section.append(summary);
   if(!doc.complete)section.append(text('p','Historique partiel : les sorties anciennes ne sont pas encore toutes chargées. Le nombre et le cumul ci-dessus peuvent être inférieurs au total de carrière.','iss-eva-notice'));
   if(stats.known<stats.completed)section.append(text('p',`${stats.completed-stats.known} sortie(s) sans durée connue, exclue(s) du cumul.`,'hint'));
   if(!stats.rows.length)section.append(text('p','Aucune sortie répertoriée pour cet astronaute dans les données chargées.','hint'));
   const events=text('div','', 'iss-eva-list');
   for(const e of stats.rows){
    const event=text('article','', 'iss-eva-event');event.append(text('h4',e.name||'Sortie extravéhiculaire'));
    const facts=document.createElement('dl'),done=e.end&&Date.parse(e.end)<=viewedAt();
    facts.append(row('Début',date(e.start)),row('Fin',done?date(e.end):'En cours à cette date / non renseignée'),row('Durée de la sortie',done?AtlasEVA.format(AtlasEVA.duration(e)):'Non finalisée'),row('Lieu',e.location),row('Participants',`${e.crew.length} · ${e.crew.map(a=>a.name).join(', ')}`));event.append(facts);
    events.append(event);
   }
   section.append(events,text('p','La durée indiquée est celle de la sortie, commune aux participants. Elle n’est pas multipliée par le nombre d’astronautes et ne constitue pas un chronométrage individuel à l’extérieur. Les conventions de début et de fin peuvent varier selon les agences.','hint'),text('p',`Source : The Space Devs · Launch Library 2 · données reçues le ${date(doc.fetched_at)}. L’historique public peut être incomplet.`,'hint'));
  }catch(e){if(section.isConnected)section.replaceChildren(text('h3','Sorties extravéhiculaires'),text('p','Historique temporairement indisponible. Aucun nombre ni durée n’est déduit de données manquantes.','hint'));}
 }
 function showPerson(item,opener){
  activeItem=item;const a=item.value,current=crewView().crew.find(c=>c.id===a.id);
  aboard(current);$('iss-detail-kind').textContent='ASTRONAUTE';$('iss-mission-name').textContent=a.name;
  const body=$('iss-mission-body');body.replaceChildren();
  const facts=document.createElement('dl');facts.append(nationalitiesFact(a.nationalities),row('Agence / affiliation',a.agency||a.agency_abbrev),row('Type d’affiliation',({'Government':'Agence publique','Private':'Privé','Commercial':'Privé / commercial','Non-Astronaut Passenger':'Passager'})[a.affiliation_type]||a.affiliation_type||'Non renseigné'));
  if(current)facts.append(row(liveView()?'Mission actuelle':'Mission à cette date',current.mission),row('Arrivée à l’ISS',date(current.arrival)),row('Temps à bord de l’ISS',current.arrival?elapsed(current.arrival):'Non renseigné'));
  body.append(facts);const evas=text('section','', 'iss-evas');body.append(evas);renderEVAs(a.id,evas);body.append(text('h3','Missions et vols documentés vers l’ISS'));
  if(!item.flights.length)body.append(text('p','Aucun vol associé renseigné dans ce catalogue.','hint'));
  for(const f of item.flights){const button=text('button','', 'iss-flight');button.type='button';button.append(text('span',f.name),text('small',launchDate(f)));button.addEventListener('click',()=>show(f,button));body.append(button);}
  body.append(text('p','Fiche établie à partir des équipages des vols ISS documentés. Elle ne décrit pas toute la carrière de l’astronaute. Les affiliations historiques peuvent différer de leur situation actuelle.','hint'));
  if(!dialog.open)dialog.showModal();else if(!refreshing)$('iss-mission-close').focus({preventScroll:true});if(!refreshing){dialog.scrollTop=0;dialog.dataset.opener=opener?.id||'';}
 }
 function openResult(item,opener){if(item.kind==='person')showPerson(item,opener);else show(item.value,opener);}
 function search(){
  const query=$('iss-search').value.trim(),results=$('iss-search-results'),status=$('iss-search-status');results.replaceChildren();searchItems=[];
  if(!query){results.hidden=true;status.textContent='';return;}
  if(!data){results.hidden=true;status.textContent='Les données sont en cours de chargement.';return;}
  const found=AtlasISSSearch.find(searchIndex,query);searchItems=found.items;
  results.hidden=!found.total;status.textContent=found.total?`${found.total} résultat${found.total>1?'s':''}${found.total>found.items.length?' · '+found.items.length+' affichés, précise ta recherche':''}`:'Aucune mission, aucun vol ou astronaute trouvé.';
  found.items.forEach((item,i)=>{const button=text('button','', 'iss-search-result');button.type='button';button.dataset.searchIndex=i;button.append(text('span',item.name),text('small',(item.kind==='person'?'Astronaute':'Mission / vol')+' · '+item.detail));button.addEventListener('click',()=>openResult(item,button));results.append(button);});
 }
 $('iss-search').addEventListener('input',search);
 $('iss-search').addEventListener('keydown',e=>{
  if(e.isComposing)return;
  if(e.key==='Enter'){e.preventDefault();}
  if(e.key==='ArrowDown'&&searchItems.length){e.preventDefault();$('iss-search-results').querySelector('button')?.focus();}
  if(e.key==='Escape'){$('iss-search').value='';search();}
 });
 $('iss-search').addEventListener('keyup',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('iss-search').blur();if(searchItems[0])openResult(searchItems[0],$('iss-search'));else search();}});
 $('iss-search-results').addEventListener('keyup',e=>{if(e.key==='Enter'&&!e.isComposing){const i=Number(e.target?.dataset.searchIndex);if(Number.isInteger(i)&&searchItems[i]){e.preventDefault();e.stopPropagation();openResult(searchItems[i],e.target);}}});
 $('iss-search-results').addEventListener('keydown',e=>{
  if(e.isComposing)return;
  if(e.key==='Enter'){const i=Number(e.target?.dataset.searchIndex);if(Number.isInteger(i)&&searchItems[i]){e.preventDefault();e.stopPropagation();}return;}
  if(!['ArrowDown','ArrowUp','Escape'].includes(e.key))return;
  const buttons=[...$('iss-search-results').querySelectorAll('button')],i=buttons.indexOf(e.target);if(i<0)return;e.preventDefault();
  if(e.key==='Escape'){$('iss-search').focus();return;}
  const next=e.key==='ArrowDown'?Math.min(i+1,buttons.length-1):i-1;if(next<0)$('iss-search').focus();else buttons[next]?.focus();
 });
 function render(){
  const years=new Map();
  for(const f of data.flights){const year=(f.launch||'').slice(0,4)||'Date inconnue';if(!years.has(year))years.set(year,[]);years.get(year).push(f);}
  const list=$('iss-flight-years');list.replaceChildren();
  for(const [year,flights] of [...years].sort((a,b)=>b[0].localeCompare(a[0]))){
   const group=document.createElement('details');group.className='iss-flight-year';group.open=false;
   const title=text('summary',`${year} · ${flights.length} vol${flights.length>1?'s':''}`);group.append(title);
   for(const f of flights){const button=text('button','', 'iss-flight');button.type='button';button.id=`iss-flight-${f.id}`;
    button.append(text('span',f.name),text('small',Date.parse(f.launch)>viewedAt()?'Prévu':f.crew.length?'Vol habité':'Ravitaillement / autre vol'));
    button.addEventListener('click',()=>show(f,button));group.append(button);
   }list.append(group);
  }
  searchIndex=AtlasISSSearch.build(data);search();
  $('iss-flight-count').textContent=`${data.flights.length} vols documentés · habités et ravitaillement`;
  renderCrew();
 }
 function renderCrew(){
  const view=crewView(),stale=Date.now()-Date.parse(data.fetched_at)>86400000,crew=view.crew;
  $('iss-crew-title').textContent=view.current?(stale?'Équipage à la dernière collecte':'Équipage actuel'):'Équipage à la date affichée';
  const count=view.current&&Number.isInteger(data.reported_crew)?data.reported_crew:crew.length;
  $('iss-expedition').textContent=[view.current?data.expedition:date(new Date(viewedAt()).toISOString()),`${count} personne${count>1?'s':''} ${view.incomplete?'identifiée'+(count>1?'s':'')+' à bord':'à bord'}`].filter(Boolean).join(' · ');
  people(sortCurrentCrew(crew),$('iss-current-crew'));
  if(!crew.length)$('iss-current-crew').replaceChildren(text('p','Aucun équipage documenté à cette date dans les données chargées.','hint'));
  $('iss-data-status').textContent=`Données reçues le ${date(data.fetched_at)}. `+(view.current?(stale?'Collecte ancienne : présence actuelle à confirmer.':'Équipage selon la dernière collecte.'):'Présence calculée à partir des arrivées et départs documentés.'+(view.incomplete?' Historique partiel : des membres peuvent manquer.':''));
 }
 window.addEventListener('atlas:time',()=>{
  if(!data||root.hidden)return;renderCrew();
  if(dialog.open&&activeItem){const scroll=dialog.scrollTop;refreshing=true;try{openResult(activeItem,null);}finally{refreshing=false;dialog.scrollTop=scroll;}}
 });

 async function load(){if(data||pending)return pending;pending=(async()=>{try{const v=window.AtlasStatic?await window.AtlasStatic.handle('/api/'+station+'-missions'):await fetch('/api/'+station+'-missions').then(res=>{if(!res.ok)throw Error('Source indisponible');return res.json();});if(!Array.isArray(v.flights)||!Array.isArray(v.crew))throw Error('Réponse invalide');data=v;render();}catch(e){$('iss-flight-count').textContent='Les données de missions ne sont pas encore disponibles.';$('iss-data-status').textContent='Réessaie après la première collecte du serveur. La carte reste disponible.';}finally{pending=null;}})();return pending;}
 $('iss-mission-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.detail>0&&e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 
 window.addEventListener('atlas:collection',e=>{root.hidden=!AtlasPages.isStation(e.detail);if(!root.hidden)load();if(dialog.open)dialog.close();});
 if(AtlasPages.isStation(document.body.dataset.collection)){root.hidden=false;load();}
 setInterval(()=>{if(!root.hidden)for(const e of root.querySelectorAll('[data-arrival]'))if(e.dataset.arrival)e.textContent=stationText(`${elapsed(e.dataset.arrival)} à bord de l’ISS`);},60000);
})();
