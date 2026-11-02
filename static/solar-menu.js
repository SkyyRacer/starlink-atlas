/* Shared solar navigation: mounted after the existing mission control. */
(()=>{
 const base=new URL('./',document.currentScript.src),header=document.querySelector('body>header');if(!header)return;
 // Return context belongs to this planet URL, never to a global saved preference.
 const query=new URL(window.location?.href||base.href).searchParams;
 const returnMission=window.AtlasCollections?.definitions.find(row=>row.trajectory&&row.id===query.get('returnMission'));
 const planetReturn=document.getElementById('solar-return');
 if(returnMission&&planetReturn&&document.body.dataset.solar&&query.get('system')!=='1'){
  const back=document.createElement('button');back.id='solar-mission-return';back.type='button';back.textContent='Retourner vers '+returnMission.label;
  back.onclick=()=>{const url=new URL(returnMission.id+'/',base);url.searchParams.set('system','1');const at=window.AtlasTimeline?.time;if(Number.isFinite(at))url.searchParams.set('at',String(at));url.searchParams.set('journey','1');url.searchParams.set('live','0');url.searchParams.set('playing','0');url.searchParams.set('speed','1');url.searchParams.set('realistic','1');url.searchParams.set('sky',document.getElementById('sky-toggle')?.getAttribute('aria-checked')==='true'?'1':'0');window.location.assign(url.href);};
  planetReturn.before(back);
  const dock=()=>{const instrument=document.querySelector('.deep-earth-instrument');if(instrument)instrument.append(back);};
  dock();window.addEventListener('atlas:earth-direction-ready',dock,{once:true});
 }
 const rows=[['soleil','Soleil'],['mercure','Mercure'],['venus','Vénus'],['terre','Terre'],['moon.html','Lune'],['mars','Mars'],['jupiter','Jupiter'],['saturne','Saturne'],['uranus','Uranus'],['neptune','Neptune']];
 if(!document.getElementById('workspace-deep-control')&&window.AtlasCollections){
  const definitions=window.AtlasCollections.definitions,companionClosers=[];
  for(const [id,title,rows] of [['station','Stations spatiales',definitions.filter(r=>r.category==='stations'&&r.station_menu!==false)],['deep','Missions lointaines',definitions.filter(r=>r.trajectory)]]){
   const control=document.createElement('div');control.id='workspace-'+id+'-control';control.className='solar-companion';
   const trigger=document.createElement('button');trigger.className='workspace-dropdown';trigger.textContent=title;trigger.setAttribute('aria-expanded','false');
   const nav=document.createElement('nav');nav.hidden=true;nav.setAttribute('aria-label',title);
   for(const row of (id==='deep'?[]:rows).sort((a,b)=>a.label.localeCompare(b.label,'fr'))){const a=document.createElement('a');a.href=new URL(row.id,base);a.textContent=row.label;nav.append(a);}
   control.append(trigger,nav);header.append(control);
   let missionMenu=null;
   function closeCompanion(){nav.hidden=true;nav.scrollTop=0;trigger.setAttribute('aria-expanded','false');missionMenu?.reset();}
   companionClosers.push(closeCompanion);
   if(id==='deep'){nav.id='workspace-deep-space';trigger.id='workspace-deep-button';trigger.setAttribute('aria-controls',nav.id);missionMenu=window.AtlasMissionMenu.mount({panel:nav,definitions,url:mode=>new URL(mode,base).href,current:document.body.dataset.collection,close:closeCompanion});control.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&e.target===trigger){e.preventDefault();if(nav.hidden)trigger.click();missionMenu.search.focus();}});}

   trigger.onclick=()=>{const open=nav.hidden;for(const close of companionClosers)close();if(!open)missionMenu?.reset();nav.hidden=!open;missionMenu?.search.setAttribute('aria-expanded',String(open));trigger.setAttribute('aria-expanded',String(open));if(open){const r=trigger.getBoundingClientRect();const width=id==='deep'?350:230,scale=window.AtlasUI?.scale||1;nav.style.width=width+'px';nav.style.top=(r.bottom+8)/scale+'px';nav.style.left=Math.max(8,Math.min(innerWidth-width*scale-8,r.right-width*scale))/scale+'px';}};
   document.addEventListener('pointerdown',e=>{if(!control.contains(e.target)){closeCompanion();}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!nav.hidden){closeCompanion();trigger.focus();}});
  }
 }
 const host=document.createElement('div');host.id='solar-navigation';
 const button=document.createElement('button');button.className='workspace-dropdown';button.type='button';button.textContent='Système solaire';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','solar-navigation-list');
 const list=document.createElement('nav');list.id='solar-navigation-list';list.setAttribute('aria-label','Système solaire');list.hidden=true;
 function appendLink(parent,key,name){const a=document.createElement('a');a.href=new URL(key==='terre'?'atlas?view=earth':key==='moon.html'?key:(key==='ceres'?'ceres-naine':key)+'/',base);a.textContent=name;if(document.body.dataset.solar===key||(key==='moon.html'&&document.body.classList.contains('lunar-page')&&!document.body.classList.contains('solar-page')))a.setAttribute('aria-current','page');a.addEventListener('click',()=>{try{sessionStorage.setItem('atlas-solar-time',String(window.AtlasTimeline?.time||Date.now()));}catch{}});parent.append(a);}
 for(const [key,name] of rows)appendLink(list,key,name);
 const dwarfs=document.createElement('details');dwarfs.id='solar-dwarf-planets';const dwarfTitle=document.createElement('summary');dwarfTitle.textContent='Planètes naines';dwarfs.append(dwarfTitle);
 for(const [key,name] of [['pluton','Pluton'],['ceres','Cérès'],['eris','Éris'],['haumea','Hauméa'],['makemake','Makémaké']])appendLink(dwarfs,key,name);list.append(dwarfs);
 host.append(button,list);const missions=document.getElementById('workspace-deep-control');if(missions)missions.after(host);else header.append(host);const newsButton=document.getElementById('orbital-news-button');if(newsButton&&document.body.classList.contains('lunar-page'))header.append(newsButton);
 function close(focus=false){list.hidden=true;button.setAttribute('aria-expanded','false');list.scrollTop=0;dwarfs.open=false;if(focus)button.focus();}
 function position(){if(list.hidden)return;const r=button.getBoundingClientRect();const scale=window.AtlasUI?.scale||1;list.style.top=(r.bottom+8)/scale+'px';list.style.left=Math.max(8,Math.min(innerWidth-208*scale,r.right-200*scale))/scale+'px';}
 button.onclick=()=>{const open=list.hidden;close();if(open){document.dispatchEvent(new CustomEvent('atlas:solar-menu-open'));list.hidden=false;button.setAttribute('aria-expanded','true');position();}};
 document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!list.hidden)close(true);});
 host.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(list.hidden)button.click();const links=[...list.querySelectorAll('a,summary')].filter(link=>!dwarfs.contains(link)||link===dwarfTitle||dwarfs.open),i=links.indexOf(document.activeElement);links[e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowUp'?-1:1)+links.length)%links.length].focus();}});window.addEventListener('resize',position);
})();
