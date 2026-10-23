'use strict';
const $=id=>document.getElementById(id);
let showOrbit=true;
let displayMode='2d',globeController=null,cartoConfig=null,track3d=[],future3d=[];
const worldBounds=L.latLngBounds([[-85.05112878,-180],[85.05112878,180]]);
const map=L.map('map',{zoomControl:false,doubleClickZoom:false,minZoom:0,maxZoom:18,zoomSnap:.25,zoomDelta:.5,wheelPxPerZoomLevel:360,wheelDebounceTime:90,maxBounds:worldBounds,maxBoundsViscosity:.9,zoomAnimation:false,inertia:true,inertiaMaxSpeed:600,inertiaDeceleration:2200}).setView([0,0],1);
function constrainWorld(initial=false){const wasOverview=initial||map.getZoom()<=map.getMinZoom()+.01;map.setMinZoom(0);const minimum=Math.max(0,map.getBoundsZoom(worldBounds,false,L.point(24,24)));map.setMinZoom(minimum);if(wasOverview)map.setView([0,0],minimum,{animate:false});else map.panInsideBounds(worldBounds,{animate:false});}
constrainWorld(true);map.on('resize',()=>constrainWorld());
map.getContainer().addEventListener('wheel',()=>{map.options.wheelPxPerZoomLevel=180+Math.min(12,Math.max(0,map.getZoom()-map.getMinZoom()))*30;},{capture:true,passive:true});
const timelineElement=document.querySelector('.timeline');
function sizeMap(){const bottom=timelineElement.offsetHeight+parseFloat(getComputedStyle(timelineElement).bottom)+12;const element=map.getContainer();element.closest('.view').style.setProperty('--timeline-space',bottom+'px');const sceneBottom=document.body.classList.contains('earth-workspace')?0:bottom;if(element.style.bottom!==sceneBottom+'px'){element.style.bottom=sceneBottom+'px';map.invalidateSize({pan:false});}if($('globe'))$('globe').style.bottom=sceneBottom+'px';if(globeController)globeController.resize();}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(sizeMap).observe(timelineElement);window.addEventListener('resize',sizeMap);
sizeMap();
window.addEventListener('atlas-science-ready',scheduleDraw);
document.addEventListener('visibilitychange',()=>globeController?.setRendering(!document.hidden&&displayMode==='3d'));
window.addEventListener('atlas-ephemeris-ready',()=>{if(collectionMode==='all'&&!document.hidden)loadPositions(true);});
L.control.zoom({position:'topright'}).addTo(map);
let tiles=null,overviewAttached=false,planisphereRequested=false;
// The planisphere is optional: no tile downloads or image reprojection in 3D.
function attachPlanisphere(){if(!tiles)return;if(!map.hasLayer(tiles))tiles.addTo(map);if(!overviewAttached){overviewAttached=true;AtlasOverview.attach(map,tiles,worldBounds);}}
let constellationCoverage='',issOverviewPending=false,initialOverviewTarget=null;
let collectionMode=AtlasPages.mode(location.pathname),allCatalog=[],atlasGroups=new Set(AtlasPages.definitions.filter(row=>row.id!=='debris').map(row=>row.id));
const atlasDefaultColor=family=>family==='debris'?'#d9a15f':'#c8efff';
const atlasColors=Object.fromEntries(AtlasPages.definitions.map(row=>[row.id,atlasDefaultColor(row.id)]));
let catalog=[],byId=new Map(),points=[],selected=null,focusSelected=false,track=[],futureTrack=[],at=Date.now(),live=true,playing=true,busy=false,pendingPosition=false,positionRevision=0,suggestedAt=null,lastTick=performance.now(),failures=0;
let planarFocusMode='overview';let dataSnapshot=null;let selectionRequest=0;
let pendingSatelliteLink=AtlasPages.satelliteLink(location.search);
if(pendingSatelliteLink&&pendingSatelliteLink.at!==null){at=pendingSatelliteLink.at;live=false;playing=false;}
const restoredEarthView=collectionMode==='all'?globalThis.AtlasJourney?.read():null;
if(restoredEarthView){at=restoredEarthView.live?Date.now():restoredEarthView.at;live=restoredEarthView.live;playing=restoredEarthView.playing;$('speed').value=restoredEarthView.speed;}
if(collectionMode==='all')globalThis.AtlasJourney?.bind(()=>({at,live,playing,speed:$('speed').value,realistic:$('earth-realistic-toggle').getAttribute('aria-checked')==='true',sky:$('sky-toggle').getAttribute('aria-checked')==='true',tile_url:cartoConfig?.tile_url,tile_attribution:cartoConfig?.tile_attribution}));
const planarMotion=new SatelliteMotion();let planarMotionAt=null,motionFrame=null,planarVisible=[],nightAt=null,nightCoordinates=[];
const canvas=L.DomUtil.create('canvas','satellites',map.getPanes().overlayPane),ctx=canvas.getContext('2d');let hit=[],moving=false,drawQueued=false;const overscan=160;
function scheduleDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;draw();});}
const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function state(s){if(s.launch&&Date.parse(s.launch)>at)return 'not-launched';if(s.decay&&Date.parse(s.decay)<=at)return 'decayed';return s.launch?'orbit':'unknown';}
const chosenYears=new Set(),chosenLaunches=new Set();
function matches(s){if(collectionMode!=='all'&&!AtlasPages.belongs(s,collectionMode))return false;if(collectionMode==='all')return AtlasPages.memberships(s).some(key=>atlasGroups.has(key));if(AtlasPages.isStation(collectionMode))return true;if(collectionMode==='debris'&&(($('debris-type').value&&s.object_type!==$('debris-type').value)||($('debris-owner').value&&s.owner!==$('debris-owner').value)))return false;if(revealedSearchId!==null&&$('search').value===byId.get(revealedSearchId)?.name&&s.id!==revealedSearchId)return false;return (!chosenYears.size||chosenYears.has((s.designator||'').slice(0,4)))&&(!chosenLaunches.size||chosenLaunches.has((s.designator||'').slice(0,8)))&&(!$('status').value||($('status').value==='inactive'?s.ops==='-'&&state(s)==='orbit':state(s)===$('status').value))&&(! $('search').value||`${s.name} ${s.id}`.toLowerCase().includes($('search').value.toLowerCase()));}
function searchCandidates(){const query=$('search').value.trim().toLowerCase();if(!query)return [];return catalog.filter(s=>`${s.name} ${s.id}`.toLowerCase().includes(query));}
function searchCompletion(){
 const value=$('search').value,query=value.toUpperCase();
 if(!query)return '';
 if(AtlasPages.hasLocalHistory(collectionMode)){const prefix=collectionMode==='gps'?'NAVSTAR':collectionMode==='galileo'?'GSAT':null;if(prefix&&prefix.startsWith(query))return prefix;const names=catalog.map(s=>s.name.toUpperCase());return names.includes(query)?'':names.filter(name=>name.startsWith(query)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))[0]||'';}
 if('STARLINK'.startsWith(query))return 'STARLINK-';
 if(!/^STARLINK-\d*$/.test(query))return '';
 const names=[...new Set(catalog.map(s=>s.name.toUpperCase()).filter(name=>/^STARLINK-\d+$/.test(name)))];
 if(names.includes(query))return '';
 return names.filter(name=>name.startsWith(query)).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}))[0]||'';
}
function updateSearchSuggestion(){revealedSearchId=null;const value=$('search').value,completion=searchCompletion();$('search-ghost').textContent=completion?value+completion.slice(value.length):'';}
function describeFilters(){const filters=[];if(chosenYears.size)filters.push('années '+[...chosenYears].sort().reverse().join(', '));if(chosenLaunches.size)filters.push('lancements '+[...chosenLaunches].sort().reverse().join(', '));if($('status').value)filters.push('état '+({orbit:'en orbite',decayed:'désorbité',inactive:'hors service (statut actuel)'}[$('status').value]));if(collectionMode==='debris'){if($('debris-type').value)filters.push('type '+($('debris-type').value==='R/B'?'étage de fusée':'fragment'));if($('debris-owner').value)filters.push('origine '+$('debris-owner').value);}return filters.join(' ; ');}
let searchPromptKey=null;let revealedSearchId=null;
function showSearchAlternative(rows){const panel=$('search-alternative'),candidates=searchCandidates(),key=$('search').value+'|'+describeFilters();if(key!==searchPromptKey){searchPromptKey=key;panel.dataset.dismissed='';}if(rows.length||!candidates.length||!describeFilters()||panel.dataset.dismissed===key){panel.hidden=true;return;}panel.hidden=false;panel.innerHTML=`<p>Aucun satellite disponible avec les filtres : ${esc(describeFilters())}.</p><p>${candidates.length} satellite${candidates.length>1?'s':''} trouvé${candidates.length>1?'s':''} dans le catalogue :</p>`+candidates.slice(0,5).map(s=>`<div><strong>${esc(s.name)}</strong><p>Année ${esc((s.designator||'').slice(0,4)||'non renseignée')} · vol ${esc((s.designator||'').slice(0,8)||'non renseigné')}</p><button data-reveal="${s.id}">Oui, afficher</button></div>`).join('')+`<button data-search-no>Non</button>`;}
function submitSearch(){
 const first=$('results').querySelector('[data-id]');
 if(first){choose(Number(first.dataset.id));return;}
 const panel=$('search-alternative');panel.dataset.dismissed='';
 showSearchAlternative([]);
 if(panel.hidden){panel.hidden=false;panel.innerHTML=`<p>Aucun satellite trouvé pour « ${esc($('search').value||'la recherche actuelle')} »${describeFilters()?' avec les filtres : '+esc(describeFilters()):''}.</p>`;}
}
function sun(t){const d=t/86400000+2440587.5-2451545;const rad=Math.PI/180;const g=(357.529+.98560028*d)*rad;const l=(280.459+.98564736*d+1.915*Math.sin(g)+.020*Math.sin(2*g))*rad;const e=(23.439-.00000036*d)*rad;const dec=Math.asin(Math.sin(e)*Math.sin(l));const ra=Math.atan2(Math.cos(e)*Math.sin(l),Math.cos(l));const gmst=(280.46061837+360.98564736629*d)*rad;return {dec,lon:ra-gmst};}
function screen(p){return map.latLngToContainerPoint([p.lat,p.lon]);}
function updateAtlasCounts(visibleIds){
 if(collectionMode!=='all')return;
 const shown=visibleIds||new Set(points.filter(p=>{const s=byId.get(p.id);return s&&matches(s);}).map(p=>p.id));
 const root=document.querySelector('.atlas-category[data-category]'),previous=updateAtlasCounts.cache;
 if(previous&&previous.catalog===byId&&previous.root===root&&previous.ids.length===points.length&&points.every((p,i)=>p.id===previous.ids[i]&&shown.has(p.id)===previous.shown.has(p.id)))return;
 updateAtlasCounts.cache={catalog:byId,root,ids:points.map(p=>p.id),shown};
 const counts=Object.fromEntries(AtlasPages.definitions.map(row=>[row.id,{visible:0,total:0}]));
 const categories=[...document.querySelectorAll('.atlas-category[data-category]')].map(node=>({label:node.querySelector('.atlas-category-total'),families:new Set([...node.querySelectorAll('[data-family]')].map(box=>box.dataset.family)),visible:0,total:0}));
 for(const p of points){
  const satellite=byId.get(p.id);if(!satellite)continue;
  const families=AtlasPages.memberships(satellite),visible=shown.has(p.id);
  for(const family of families){if(!counts[family])continue;counts[family].total++;if(visible)counts[family].visible++;}
  for(const category of categories)if(families.some(family=>category.families.has(family))){category.total++;if(visible)category.visible++;}
 }
 const format=({visible,total})=>visible.toLocaleString('fr')+(visible<=1?' visible / ':' visibles / ')+total.toLocaleString('fr');
 for(const [family,count] of Object.entries(counts)){
  const node=$('atlas-count-'+family),text=format(count);if(node.textContent!==text)node.textContent=text;
  const observe=document.querySelector('.atlas-category [data-observe="'+family+'"]');if(observe)observe.hidden=count.total>1;
 }
 for(const category of categories)if(category.label){const text=format(category);if(category.label.textContent!==text)category.label.textContent=text;category.label.title='Objets visibles / positions disponibles à la date consultée';}
}

function updateDebrisCoverage(){
 if(collectionMode!=='debris')return;const confirmed=catalog.filter(s=>s.object_type==='DEB'||s.object_type==='R/B'),orbit=confirmed.filter(s=>state(s)==='orbit'),visible=new Set(points.map(p=>p.id)),located=orbit.filter(s=>visible.has(s.id)).length,unknown=catalog.filter(s=>s.object_type==='UNK');
 $('debris-coverage').textContent=`${confirmed.length.toLocaleString('fr')} fragments et étages répertoriés · ${orbit.length.toLocaleString('fr')} encore signalés en orbite à la date affichée. ${located.toLocaleString('fr')} disposent d’une position calculable ; ${(orbit.length-located).toLocaleString('fr')} n’ont pas d’orbite publique adaptée. ${unknown.length.toLocaleString('fr')} objets non identifiés sont aussi inclus, sans les qualifier de débris confirmés.`;
}
function updatePositionNotice(visible,visibleIds){updateAtlasCounts(visibleIds);updateDebrisCoverage();if(AtlasPages.isStation(collectionMode)){$('notice').textContent=points.some(p=>p.id===AtlasPages.station(collectionMode))?AtlasPages.definition(collectionMode).label:AtlasPages.definition(collectionMode).label+' : aucune donnée orbitale adaptée à cette date.';$('available').hidden=points.some(p=>p.id===AtlasPages.station(collectionMode))||!suggestedAt;return;}if(selected!==null&&!points.some(p=>p.id===selected)){const satellite=byId.get(selected),status=satellite?state(satellite):'unknown';$('notice').textContent=(satellite?.name||'Cet objet')+' : '+(status==='not-launched'?'pas encore lancé à cette date.':status==='decayed'?'déjà désorbité à cette date.':'aucune observation orbitale publique adaptée à cette date.');return;}if(!points.length)return;const available=points.filter(p=>collectionMode==='all'||AtlasPages.belongs(byId.get(p.id)||p,collectionMode)).length;$('notice').textContent=collectionMode==='all'&&atlasGroups.size===0?'Aucun satellite sélectionné · choisissez des satellites dans le menu ou cliquez sur Afficher les satellites.':visible===0?'Des positions sont disponibles, mais les filtres masquent tous les satellites. Effacez la recherche ou choisissez Tous les états / Toutes les années.':`${available.toLocaleString('fr')} positions disponibles · ${visible.toLocaleString('fr')} affichées`; }
function draw(animation=false){if(displayMode==='3d'){const visible=points.filter(p=>{const s=byId.get(p.id);return s&&AtlasGeometry.shouldRender(p.id,selected,matches(s));});const visibleIds=new Set(visible.map(p=>p.id));$('count').textContent=visible.length.toLocaleString('fr');if(!animation)updatePositionNotice(visible.length,visibleIds);if(globeController){globeController.update({collection:collectionMode,colors:atlasColors,groups:atlasGroups,points,catalog:byId,selected,selectionRequest,closeFocus:focusSelected&&planarFocusMode==='close',at,playing,track:track3d,future:future3d,night:true,basemap:true,orbits:showOrbit,groundLink:showOrbit,names:false,focus:focusSelected,visible:(s,id)=>visibleIds.has(id)});if(issOverviewPending&&points.some(p=>p.id===AtlasPages.station(collectionMode))){issOverviewPending=false;if(selected===null)globeController.home();}if(points.some(p=>p.id===selected))focusSelected=false;}if(!animation)updateDetail();return;}if(moving)return;
 if(planarMotion.source!==points){planarMotion.set(points,performance.now(),playing&&!focusSelected&&planarMotionAt!==null&&Math.abs(at-planarMotionAt)<150000);planarMotionAt=at;}
 if(!animation)planarVisible=planarMotion.rows.filter(p=>{const s=byId.get(p.id);return s&&AtlasGeometry.shouldRender(p.id,selected,matches(s));});
 const displayedPoints=planarMotion.sampleRows(performance.now(),planarVisible);const renderedSelected=displayedPoints.find(p=>p.id===selected);const renderedTrack=track.slice(),renderedFuture=futureTrack.slice();if(renderedSelected){if(renderedTrack.length)renderedTrack[renderedTrack.length-1]=[renderedSelected.lat,renderedSelected.lon];if(renderedFuture.length)renderedFuture[0]=[renderedSelected.lat,renderedSelected.lon];}const size=map.getSize(),dpr=Math.min(2,devicePixelRatio||1),width=Math.round((size.x+2*overscan)*dpr),height=Math.round((size.y+2*overscan)*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;canvas.style.width=(size.x+2*overscan)+'px';canvas.style.height=(size.y+2*overscan)+'px';}L.DomUtil.setPosition(canvas,map.containerPointToLayerPoint([-overscan,-overscan]));ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.setTransform(dpr,0,0,dpr,overscan*dpr,overscan*dpr);hit=[];const nw=screen({lat:85.05112878,lon:-180}),se=screen({lat:-85.05112878,lon:180});ctx.save();ctx.beginPath();ctx.rect(nw.x,nw.y,se.x-nw.x,se.y-nw.y);ctx.clip();
 if(true){if(nightAt===null||Math.abs(at-nightAt)>=1000){const solar=sun(at);nightCoordinates=AtlasGeometry.nightPolygon(solar.dec,solar.lon);nightAt=at;}ctx.fillStyle='rgba(8,18,32,.25)';ctx.beginPath();nightCoordinates.forEach(([lat,lon],i)=>{const p=screen({lat,lon});if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();ctx.fill();}
 if(showOrbit&&track.length){ctx.strokeStyle='#e0e0e0';ctx.lineWidth=1.4;ctx.beginPath();for(const segment of AtlasGeometry.splitTrack(renderedTrack)){segment.forEach(([lat,lon],i)=>{const p=screen({lat,lon});if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});}ctx.stroke();const start=screen({lat:track[0][0],lon:track[0][1]});ctx.beginPath();ctx.arc(start.x,start.y,4,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e0e0e0';ctx.font='11px system-ui';ctx.fillText('Passé · ≤1 tour',start.x+8,start.y-5);}
 if(showOrbit&&futureTrack.length){ctx.strokeStyle='#a9c5df';ctx.lineWidth=1.8;ctx.setLineDash([6,4]);ctx.beginPath();for(const segment of AtlasGeometry.splitTrack(renderedFuture)){segment.forEach(([lat,lon],i)=>{const p=screen({lat,lon});if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});}ctx.stroke();ctx.setLineDash([]);const end=screen({lat:futureTrack.at(-1)[0],lon:futureTrack.at(-1)[1]});ctx.fillStyle='#a9c5df';ctx.font='11px system-ui';ctx.fillText('Futur estimé · ≤1 tour',end.x+8,end.y-5);}
 const markerRadius=1.5*AtlasGeometry.markerScale(collectionMode,size.x,size.y)*Math.max(.85,Math.min(2.1,.7+map.getZoom()*.3));let n=0;for(const p of displayedPoints){const s=byId.get(p.id);if(!s)continue;n++;const xy=screen(p);if(xy.x< -overscan||xy.y< -overscan||xy.x>size.x+overscan||xy.y>size.y+overscan)continue;if(AtlasScience.has(p.id)){const visual=AtlasScience.model(p.id),pixels=visual.screenSize(size.x,size.y,28000000/Math.pow(2,Math.max(0,map.getZoom()-map.getMinZoom())),p.id===selected,collectionMode);if(collectionMode==='all'&&pixels<=7){ctx.fillStyle=atlasColors[AtlasPages.displayFamily(s,atlasColors,atlasGroups)];ctx.beginPath();ctx.arc(xy.x,xy.y,2.25*AtlasGeometry.markerScale(collectionMode,size.x,size.y),0,Math.PI*2);ctx.fill();}else visual.draw2D(ctx,xy.x,xy.y,pixels,collectionMode==='all'?atlasColors[AtlasPages.displayFamily(s,atlasColors,atlasGroups)]:'#fff');hit.push({x:xy.x,y:xy.y,id:p.id,radius:Math.max(pixels/2+3,AtlasGeometry.pickRadius({mode:'2d',collection:collectionMode,zoom:map.getZoom(),minZoom:map.getMinZoom(),touch:matchMedia('(pointer: coarse)').matches}))});continue;}if(AtlasStations.has(p.id)){AtlasStations.model(p.id).draw2D(ctx,xy.x,xy.y,AtlasStations.model(p.id).screenSize(size.x,size.y,28000000/Math.pow(2,Math.max(0,map.getZoom()-map.getMinZoom())),p.id===selected,collectionMode),collectionMode==='all'?atlasColors[AtlasPages.family(s)]:'#fff');hit.push({x:xy.x,y:xy.y,id:p.id,radius:collectionMode==='all'?AtlasGeometry.pickRadius({mode:'2d',collection:collectionMode,zoom:map.getZoom(),minZoom:map.getMinZoom(),touch:matchMedia('(pointer: coarse)').matches}):28});continue;}ctx.fillStyle=p.id===selected?'#fff':collectionMode==='all'?atlasColors[AtlasPages.displayFamily(s,atlasColors,atlasGroups)]:atlasDefaultColor(AtlasPages.family(s));ctx.beginPath();ctx.arc(xy.x,xy.y,p.id===selected?5:markerRadius,0,Math.PI*2);ctx.strokeStyle='rgba(10,24,38,.85)';ctx.lineWidth=p.id===selected?2:collectionMode==='all'?.5:1;ctx.stroke();ctx.fill();hit.push({x:xy.x,y:xy.y,id:p.id});}
 const chosen=displayedPoints.find(p=>p.id===selected);if(chosen&&!AtlasStations.has(chosen.id)&&!AtlasScience.has(chosen.id)){const xy=screen(chosen);ctx.beginPath();ctx.arc(xy.x,xy.y,9,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(xy.x,xy.y,5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.font='12px system-ui';ctx.fillText(byId.get(selected)?.name||String(selected),xy.x+13,xy.y-9);}
 ctx.restore();$('count').textContent=n.toLocaleString('fr');if(!animation)updatePositionNotice(n);if(!animation)updateDetail();if(planarMotion.active&&motionFrame===null)motionFrame=requestAnimationFrame(()=>{motionFrame=null;draw(true);});}
let resultsPage=0;const resultsPageSize=100;
function list(){const previousScroll=$('results').scrollTop;const rows=catalog.filter(matches);const pages=Math.max(1,Math.ceil(rows.length/resultsPageSize));resultsPage=Math.min(resultsPage,pages-1);const start=resultsPage*resultsPageSize;$('results-prev').disabled=resultsPage===0;$('results-next').disabled=resultsPage>=pages-1;$('results-page').textContent=`Page ${resultsPage+1} / ${pages}`;$('results-count').textContent=`${rows.length.toLocaleString('fr')} résultat${rows.length===1?'':'s'}${rows.length?` · ${start+1}–${Math.min(start+resultsPageSize,rows.length)}`:''}`;$('results').innerHTML=rows.length?rows.slice(start,start+resultsPageSize).map(s=>`<button data-id="${s.id}" class="satellite-result ${state(s)==='decayed'?'is-decayed':''}" aria-pressed="${s.id===selected}"><strong>${esc(s.name)}</strong><span>NORAD ${s.id}<em class="${collectionMode!=='debris'&&AtlasPages.hasLocalHistory(collectionMode)&&s.ops==='-'&&state(s)==='orbit'?'is-inactive':''}">${{orbit:collectionMode!=='debris'&&AtlasPages.hasLocalHistory(collectionMode)&&s.ops==='-'?'En orbite · hors service actuellement':'En orbite',decayed:'Désorbité',unknown:'État inconnu','not-launched':'Pas encore lancé'}[state(s)]}</em></span></button>`).join(''):'<p class="hint">Aucun satellite ne correspond aux filtres.</p>';$('results').scrollTop=previousScroll;showSearchAlternative(rows);}

function updateDetail(){
 const more=$('follow-details');if(more){more.hidden=true;more.removeAttribute('href');}
 if(selected===null){$('detail').hidden=true;return;}const s=byId.get(selected);if(!s)return;
 const p=points.find(p=>p.id===selected),label={orbit:AtlasPages.family(s)==='debris'?'En orbite':'En orbite · opérationnel inconnu',decayed:'Désorbité',unknown:'Inconnu','not-launched':'Pas encore lancé'}[state(s)];
 const ops={'+':'Opérationnel','-':'Non opérationnel',P:'Partiellement opérationnel',B:'En réserve',S:'En attente d’activation',X:'Mission prolongée',D:'Désorbité','?':'Inconnu'};
 let fields=[
 ['Type d’orbite',AtlasOrbits.describe(s.orbit,AtlasPages.definition(AtlasPages.family(s))),"Type déterminé à partir des derniers éléments orbitaux disponibles. À défaut, l’orbite nominale du programme est précisée. Une orbite elliptique ne se classe pas d’après sa seule altitude instantanée ; la classification récente ne décrit pas nécessairement l’orbite à une date passée."],
 ['NORAD',s.id,'Identifiant unique du satellite dans le catalogue spatial. Il est différent du numéro utilisé dans son nom courant.'],
 ['État à cette date',label,'État déduit des dates de lancement et de désorbitation à l’heure affichée sur la carte. Le fonctionnement opérationnel historique n’est pas connu.'],
 ['Code opérationnel actuel',s.ops||'Inconnu','Statut du catalogue actuel : '+(ops[s.ops]||'inconnu')+'. Il ne décrit pas forcément le fonctionnement à une date passée.'],
 ['Lancement',AtlasTime.event(s.launch),s.verification?'Heure du lancement issue de GCAT (Jonathan McDowell), recoupée avec l’identité et le jour de lancement SATCAT. Précision publiée : '+s.verification.precision+'.':'Date du lancement fournie par le catalogue. Lorsqu’il fournit seulement le jour UTC, aucune heure de décollage n’est inventée.'],
 ['Groupe de lancement',(s.designator||'').slice(0,8),'Identifiant international du lancement : année puis numéro de lancement dans cette année. Les satellites du même lancement partagent ce préfixe.'],
 ['Désorbitation',AtlasTime.event(s.decay),'Date de rentrée atmosphérique indiquée par la source. « Non renseignée » signifie qu’aucune date n’est présente dans les données chargées.'],
 ['Altitude estimée',p?`${p.altitude_km.toFixed(1)} km`:'Indisponible','Hauteur calculée à la date de la carte au-dessus du modèle de surface terrestre. C’est une estimation, pas une mesure transmise en direct par le satellite.'],
 ['Vitesse inertielle',p?`${p.speed_km_s.toFixed(3)} km/s`:'Indisponible','Vitesse orbitale calculée en repère TEME. Elle diffère de la vitesse du point sur la carte, car la Terre tourne aussi. 1 km/s correspond à 3 600 km/h.'],
 ['Source de la position',p?.source||'Aucune donnée orbitale adaptée','Origine des éléments utilisés pour cette position. SupGP provient des éphémérides SpaceX ajustées par CelesTrak ; GP et l’archive publique dérivent de Space-Track. Plusieurs copies d’une même origine ne constituent pas des mesures indépendantes.'],
 ['Nom du lancement',s.verification?.launch_name||'Non renseigné','Désignation du lancement recoupée avec GCAT de Jonathan McDowell par identifiant international et nom du satellite.'],
 ['Date de référence des données orbitales',p?AtlasTime.instant(p.epoch):'Indisponible','Instant auquel les données décrivent l’orbite. L’application part de cette référence pour calculer la position à l’heure de la carte. Ce n’est pas l’heure de réception ou de téléchargement.']];
 if(AtlasPages.family(s)==='debris'){fields=fields.filter(([key])=>!['Code opérationnel actuel','Nom du lancement'].includes(key));fields.splice(1,0,['Type d’objet',s.object_type==='R/B'?'Étage / corps de fusée':s.object_type==='UNK'?'Objet non identifié · identifiant provisoire':'Fragment / débris','Classification publiée dans le catalogue SATCAT. Un satellite hors service reste une charge utile et n’est pas classé ici comme fragment.'],['Pays / organisation',s.owner||'Non renseigné','Code d’origine fourni par SATCAT ; il ne constitue pas une attribution de responsabilité.']);}
 if(AtlasStations.has(s.id)||collectionMode==='all')fields=fields.filter(([key])=>!['Code opérationnel actuel','Groupe de lancement','Nom du lancement'].includes(key));
 if(AtlasStations.has(s.id)){fields=fields.map(row=>row[0]==='Lancement'?['Premier module',row[1],s.id===48274?'Date de lancement de Tianhe, premier module de Tiangong.':'Date de lancement du premier module de l’ISS. La station a ensuite été assemblée progressivement.']:row);fields.push(['Représentation','Modèle schématique','Dessin 3D illustratif. Taille amplifiée pour la lisibilité ; orientation et configuration des modules non mesurées.']);}
 if(AtlasScience.has(s.id)){const visual=AtlasScience.model(s.id);fields.push(['Représentation',visual.kind==='nasa-adaptation'?'Modèle NASA adapté':'Modèle schématique',visual.credit+'. Taille amplifiée pour la lisibilité ; attitude et orientation illustratives.']);}
 if(displayMode==='3d'&&globeController?.detailedActive?.(s.id))fields=fields.map(row=>row[0]==='Représentation'?['Représentation','Modèle 3D couleur · '+(globeController?.detailedCredit?.(s.id)||AtlasDetailed.definitions.find(info=>info.ids.includes(s.id))?.credit||''),'Géométrie, couleurs et matériaux du modèle source. Taille amplifiée pour la lisibilité ; orientation illustrative.']:row);
 const check=s.orbit_check;fields.push(['Recoupement actuel',!check?'Non recoupé':check.state==='divergence'?'Écart important entre sources':check.distance_km!=null?check.distance_km.toFixed(1)+' km entre les sources':'Une seule source récente',check?(check.sources||[]).join(' · ')+'. '+(check.note||''):'Aucune comparaison entre deux sources récentes n’est disponible pour cet objet.']);
 const description=collectionMode==='all'?AtlasPages.definition(AtlasPages.family(s))?.description||'':'';
 if(more&&collectionMode==='all'&&p){more.href=AtlasPages.satelliteUrl(s,live?null:at);more.hidden=false;}
 const detail=$('detail');detail.hidden=false;
 if(detail.dataset.satellite!==collectionMode+':'+String(selected)){
  detail.dataset.satellite=collectionMode+':'+String(selected);detail.dataset.expanded='false';detail.dataset.collapsed='false';
  detail.innerHTML=`<button class="close atlas-close-button" id="close" aria-label="Réduire la fiche satellite"><svg class="close-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17"/></svg></button><button id="detail-reopen" type="button" aria-label="Afficher la fiche de ${esc(s.name)}" aria-expanded="false" hidden><span>${esc(s.name)}</span><span class="detail-reopen-chevron" aria-hidden="true"></span></button><div class="eyebrow">${AtlasPages.family(s)==='debris'?(s.object_type==='UNK'?'OBJET NON IDENTIFIÉ':'FICHE DÉBRIS'):'FICHE SATELLITE'}</div><h2>${AtlasStations.has(s.id)?(s.id===48274?'Tiangong · Station spatiale chinoise':'ISS · Station spatiale internationale'):esc(s.name)}</h2>${description?`<p class="detail-description">${esc(description)}</p>`:''}<button id="detail-toggle" class="mobile-only" aria-expanded="false">Afficher les informations</button><dl>${fields.map(([k,v,help],i)=>`<div class="detail-field" tabindex="0" aria-describedby="field-help-${i}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd><span class="field-help" role="tooltip" id="field-help-${i}">${esc(help)}</span></div>`).join('')}</dl><p class="hint position-hint"></p><button id="show-launch-train">Voir le train de ce lancement</button><p class="hint">${AtlasStations.has(s.id)?'Position estimée · modèle schématique sans attitude réelle.':AtlasScience.has(s.id)?'Représentation illustrative · taille amplifiée, sans attitude réelle.':AtlasPages.family(s)==='debris'?'Positions estimées à partir des éléments orbitaux publics.':'Historique des pannes et fin d’activité : non disponibles.'}</p>`;
  $('detail-toggle').onclick=()=>{const expanded=detail.dataset.expanded!=='true';detail.dataset.expanded=String(expanded);$('detail-toggle').setAttribute('aria-expanded',String(expanded));$('detail-toggle').textContent=expanded?'Réduire la fiche':'Afficher les informations';};
  $('show-launch-train').onclick=()=>{
   const launch=(s.designator||'').slice(0,8);if(!launch)return;
   const removing=chosenLaunches.has(launch);
   if(removing){
    chosenLaunches.delete(launch);selectedLaunchYears.delete(launch.slice(0,4));
   }else{
    chosenYears.clear();chosenLaunches.clear();chosenLaunches.add(launch);selectedLaunchYears.clear();
    $('search').value='';$('status').value='';if(collectionMode==='debris'){$('debris-type').value='';$('debris-owner').value='';}updateSearchSuggestion();
   }
   if(removing&&displayMode==='3d')focusSelected=false;
   changeMultiFilter();
   if(removing&&displayMode==='3d')globeController?.home();
  };
  $('show-launch-train').textContent=AtlasPages.family(s)==='debris'?'Voir les objets du même lancement':'Voir le train de ce lancement';
  $('show-launch-train').disabled=!(s.designator||'').slice(0,8);$('show-launch-train').hidden=!AtlasPages.isConstellation(collectionMode)||AtlasStations.has(s.id);
  $('close').onclick=()=>{
   if(displayMode!=='3d'){closeSatellite();return;}
   detail.dataset.collapsed='true';$('detail-reopen').hidden=false;$('detail-reopen').focus({preventScroll:true});
  };
  $('detail-reopen').onclick=()=>{detail.dataset.collapsed='false';$('detail-reopen').hidden=true;$('close').focus({preventScroll:true});};
 }
 const launch=(s.designator||'').slice(0,8),launchButton=$('show-launch-train');
 launchButton.textContent=launch?'Voir tous les satellites du vol '+launch:'Vol non renseigné';
 launchButton.disabled=!launch;launchButton.setAttribute('aria-pressed',String(!!launch&&chosenLaunches.has(launch)));
 detail.querySelectorAll('.detail-field').forEach((row,i)=>{row.querySelector('dd').textContent=fields[i][1];row.querySelector('.field-help').textContent=fields[i][2];});
 detail.querySelector('.position-hint').textContent=!p?(state(s)==='decayed'?'Objet désorbité : aucun point à cette date. Reviens avant sa désorbitation pour voir sa position historique.':'Aucun élément orbital adapté à cette date. La date de lancement ne suffit pas à reconstruire sa position ; les archives publiques peuvent manquer, notamment pour les satellites récents.'):'';
}

async function get(url){return AtlasEphemeris.apply(url,await getRaw(url));}
async function getRaw(url){const r=await fetch(url,{signal:(typeof AbortSignal.timeout==='function'?AbortSignal.timeout(20000):undefined)});if(!r.ok)throw new Error(r.status===410?'Les données de cette visite ont expiré. Rechargez la page pour récupérer les dernières données.':`Serveur HTTP ${r.status}`);return r.json();}
const selectedLaunchYears=new Set();
function launchGroups(values){const groups=new Map();for(const value of values){const year=value.slice(0,4);if(!groups.has(year))groups.set(year,[]);groups.get(year).push(value);}return [...groups].sort((a,b)=>b[0].localeCompare(a[0])).map(([year,flights])=>[year,flights.sort().reverse()]);}
function renderMultiFilters(){
 for(const [id,set,length,allText] of [['year',chosenYears,4,'Toutes les années'],['launch',chosenLaunches,8,'Tous les lancements']]){
  const scroll=$(id+'-options').scrollTop,values=[...new Set(catalog.map(s=>(s.designator||'').slice(0,length)).filter(Boolean))].sort().reverse();
  if(id==='launch')for(const value of values)if(selectedLaunchYears.has(value.slice(0,4)))set.add(value);
  for(const value of set)if(!values.includes(value))set.delete(value);
  $(id+'-summary').textContent=set.size?(id==='launch'&&set.size>3?`${set.size} lancements sélectionnés`:[...set].sort().reverse().join(', ')):allText;
  $(id).querySelectorAll('[data-all],[data-clear]').forEach(button=>button.disabled=!set.size);
  const option=value=>`<label class="${id==='launch'?'launch-option':''}"><input type="checkbox" data-filter="${id}" data-value="${esc(value)}" ${set.has(value)?'checked':''}>${esc(value)}</label>`;
  const options=id==='launch'?launchGroups(values).map(([year,flights])=>{const count=flights.filter(value=>set.has(value)).length;return `<section class="launch-year-group"><label class="launch-year-heading"><input type="checkbox" data-filter="launch" data-year="${esc(year)}" ${count===flights.length?'checked':''} data-partial="${count>0&&count<flights.length}"><strong>${esc(year)}</strong><small>${flights.length} lancements</small></label>${flights.map(option).join('')}</section>`;}).join(''):values.map(option).join('');
  $(id+'-options').innerHTML=`<label><input type="checkbox" data-filter="${id}" data-value="" ${set.size?'':'checked'}>${allText}</label>`+options;
  $(id+'-options').querySelectorAll('[data-partial]').forEach(input=>input.indeterminate=input.dataset.partial==='true');
  $(id+'-options').scrollTop=scroll;
 }
}
function changeMultiFilter(){renderMultiFilters();resultsPage=0;list();$('results').scrollTop=0;draw();}
for(const id of ['year','launch']){
 $(id).addEventListener('change',event=>{
  const input=event.target.closest('[data-filter]');if(!input)return;const set=id==='year'?chosenYears:chosenLaunches;
  if(input.dataset.year){const year=input.dataset.year;if(input.checked){selectedLaunchYears.add(year);for(const satellite of catalog){const value=(satellite.designator||'').slice(0,8);if(value.slice(0,4)===year)set.add(value);}}else{selectedLaunchYears.delete(year);for(const value of set)if(value.slice(0,4)===year)set.delete(value);}}
  else if(!input.dataset.value){set.clear();if(id==='launch')selectedLaunchYears.clear();}
  else if(input.checked)set.add(input.dataset.value);
  else{set.delete(input.dataset.value);if(id==='launch')selectedLaunchYears.delete(input.dataset.value.slice(0,4));}
  const selector=input.dataset.year?'[data-year="'+input.dataset.year+'"]':'[data-value="'+input.dataset.value+'"]';changeMultiFilter();$(id+'-options').querySelector(selector)?.focus({preventScroll:true});
 });
 $(id).addEventListener('click',event=>{const button=event.target.closest('[data-all],[data-clear]');if(button&&!button.disabled){(id==='year'?chosenYears:chosenLaunches).clear();if(id==='launch')selectedLaunchYears.clear();changeMultiFilter();}});
}

async function loadSourceStatus(){
 try{const data=await get('/api/sources');$('source-status').textContent=data.additional_sources.map(s=>s.key.toUpperCase()+': '+(s.configured===false?'clé API non configurée':s.error?'source indisponible, cache conservé':s.cache?s.cache.matched.toLocaleString('fr')+(s.cache.fresh!=null?' objets reçus · '+s.cache.fresh.toLocaleString('fr')+' récents':' entrées recoupées')+' · reçu '+AtlasTime.instant(s.cache.fetched):'collecte en attente')).join(' · ');}
 catch{$('source-status').textContent='État des sources supplémentaires indisponible.';}
}
async function loadCatalog(){globalThis.AtlasLoading?.retry();loadSourceStatus();try{const data=await get('/api/catalog?collection='+collectionMode);allCatalog=data.satellites.map(s=>AtlasStations.has(s.id)?{...s,name:AtlasStations.name(s.id)}:s);catalog=allCatalog.filter(s=>collectionMode==='all'||AtlasPages.belongs(s,collectionMode));if(collectionMode==='debris')$('debris-owner').innerHTML='<option value="">Toutes les origines</option>'+[...new Set(catalog.map(s=>s.owner).filter(Boolean))].sort().map(owner=>`<option value="${esc(owner)}">${esc(owner)}</option>`).join('');if(dataSnapshot!==data.snapshot)loadedDetails.clear();dataSnapshot=data.snapshot||null;byId=new Map(allCatalog.map(s=>[s.id,s]));$('total').textContent=catalog.length.toLocaleString('fr');renderMultiFilters();updateSearchSuggestion();
 $('health').textContent=`${data.message} · dernière collecte : ${data.fetched?AtlasTime.instant(data.fetched):'aucune'}`;$('coverage').textContent=data.history?`Historique importé : ${AtlasTime.instant(data.history.first_epoch)} → ${AtlasTime.instant(data.history.last_epoch)} · ${data.history.observations.toLocaleString('fr')} observations quotidiennes · source ${data.history.source_label||'Julien Simon / Space-Track (CC BY 4.0)'}, précision réduite de certains champs.`:data.first_epoch?`Éléments archivés : ${AtlasTime.instant(data.first_epoch)} → ${AtlasTime.instant(data.last_epoch)} · couverture partielle, seuil ±72 h.`:'Aucune archive : aucune position ne sera inventée.';constellationCoverage=$('coverage').textContent;updateCollectionCoverage();list();draw();if(selected!==null)loadSatelliteDetails(selected);globalThis.AtlasLoading?.done('catalog');}catch(e){globalThis.AtlasLoading?.fail();$('health').textContent='Catalogue indisponible : '+e.message;if(!dataSnapshot)setTimeout(async()=>{await loadCatalog();if(dataSnapshot)loadPositions(true);},3000);}}
let initialSatellitePending=true;
function focusInitialSatellite(){
 if(!initialSatellitePending||!points.length)return;
 initialSatellitePending=false;
 if(typeof pendingSatelliteLink!=='undefined'&&pendingSatelliteLink){
  const target=pendingSatelliteLink;pendingSatelliteLink=null;
  if(points.some(p=>p.id===target.id)&&catalog.some(s=>s.id===target.id&&AtlasPages.belongs(s,collectionMode))){choose(target.id,true,'close');return;}
 }
 if(collectionMode==='all'||selected!==null)return;
 const available=new Set(points.map(p=>p.id));
 const candidates=catalog.filter(s=>available.has(s.id)&&state(s)==='orbit');
 const satellite=candidates.find(s=>['+','P','X'].includes(s.ops))||candidates.find(s=>!['-','D','B','S'].includes(s.ops));
 if(satellite){
  initialOverviewTarget=points.find(p=>p.id===satellite.id);
  if(displayMode==='2d')map.panTo([initialOverviewTarget.lat,initialOverviewTarget.lon],{animate:false});
  applyInitialOrientation();
 }
}
function applyInitialOrientation(){
 if(!initialOverviewTarget||!globeController||displayMode!=='3d')return;
 if(selected===null)globeController.orientOverview(initialOverviewTarget);
 initialOverviewTarget=null;
}
async function loadPositions(force=false){if(!dataSnapshot)return;if(globalThis.AtlasCelestial?.active){if(force)positionRevision++;globeController?.updateTime(at);globalThis.AtlasLoading?.done('positions');return;}if(force)positionRevision++;if(busy){if(force)pendingPosition=true;return;}busy=true;const revision=positionRevision;const requested=at;const id=selected;try{const d=await get(`/api/positions?collection=${collectionMode}&at=${encodeURIComponent(new Date(Math.min(requested,Date.now()-1000)).toISOString())}${id!==null?'&id='+id:''}${dataSnapshot?'&snapshot='+encodeURIComponent(dataSnapshot):''}`);if(revision!==positionRevision||id!==selected||Math.abs(requested-at)>150000||globalThis.AtlasCelestial?.active)return;points=d.points;updateObservationButtons();if(focusSelected&&displayMode==='2d'){const p=points.find(p=>p.id===selected);if(p){focusSelected=false;focusPlanisphere(p);}}track=d.track;futureTrack=d.future_track||[];track3d=d.track_3d||[];future3d=d.future_track_3d||[];failures=0;suggestedAt=d.recovery_at||d.suggested_at;$('available').hidden=!suggestedAt||(!d.recovery_at&&!!d.points.length);$('available').textContent=d.recovery_at?'Afficher les dernières positions archivées · '+AtlasTime.instant(d.recovery_at):'Voir une date disponible';$('notice').textContent=d.points.length===0?'Aucune position disponible à cette date. Les archives orbitales nécessaires ne sont pas présentes. Utilisez une date disponible ou importez des archives historiques.':`${d.points.length.toLocaleString('fr')} positions disponibles · ${d.missing.toLocaleString('fr')} sans position exploitable à cette date`;if(collectionMode==='xposat'&&!points.length&&suggestedAt){$('notice').textContent='XPoSat : données récentes indisponibles. Dernière époque disponible : '+AtlasTime.instant(suggestedAt)+'.';$('available').textContent='Voir XPoSat à cette date';}draw();focusInitialSatellite();orientAtlasGroups();globalThis.AtlasLoading?.done('positions');}catch(e){if(revision!==positionRevision)return;globalThis.AtlasLoading?.fail();failures++;points=[];updateObservationButtons();track=[];futureTrack=[];track3d=[];future3d=[];$('notice').textContent='Positions indisponibles : '+e.message;draw();}finally{busy=false;if(pendingPosition){pendingPosition=false;loadPositions();}}}
function closeSatellite(){
 if(selected===null)return;
 selected=null;focusSelected=false;positionRevision++;
 track=[];futureTrack=[];track3d=[];future3d=[];
 list();draw();
 if(displayMode==='3d')globeController?.home();
 else{constrainWorld(true);updateMapReset();scheduleDraw();}
}
function focusPlanisphere(p){const zoom=planarFocusMode==='close'?Math.max(map.getZoom(),5):Math.max(map.getZoom(),map.getMinZoom()+1);map.setView([p.lat,p.lon],zoom,{animate:false});}
const loadedDetails=new Set(),pendingDetails=new Set();
async function loadSatelliteDetails(id){
 if(loadedDetails.has(id)||pendingDetails.has(id)||!dataSnapshot)return;
 const edition=dataSnapshot;pendingDetails.add(id);
 try{const data=await get('/api/satellite?id='+id+'&snapshot='+encodeURIComponent(edition));if(edition!==dataSnapshot)return;const satellite=byId.get(id);if(satellite){Object.assign(satellite,data);loadedDetails.add(id);if(selected===id)updateDetail();}}catch{/* The map and base profile stay usable if additional facts are unavailable. */}finally{pendingDetails.delete(id);}
}
function choose(id,focus=true,mode='overview'){if($('satellite-hover'))$('satellite-hover').hidden=true;$('detail').dataset.collapsed='false';if($('detail-reopen'))$('detail-reopen').hidden=true;pendingAtlasOverview=null;initialOverviewTarget=null;selectionRequest++;selected=id;focusSelected=focus;planarFocusMode=mode;list();if(focus&&displayMode==='2d'){const p=points.find(p=>p.id===id);if(p){planarMotion.set(points,performance.now(),false);focusPlanisphere(p);}}track=[];futureTrack=[];track3d=[];future3d=[];draw();loadPositions(true);loadSatelliteDetails(id);}
function satelliteAtMapClick(e){
 const radius=AtlasGeometry.pickRadius({mode:'2d',collection:collectionMode,zoom:map.getZoom(),minZoom:map.getMinZoom(),touch:matchMedia('(pointer: coarse)').matches});
 return AtlasGeometry.nearestHit(hit,e.containerPoint,radius);
}
map.on('click',e=>{if(moving)return;const id=satelliteAtMapClick(e);if(id!==null)choose(id,false);else if(!worldBounds.contains(e.latlng))closeSatellite();});
map.on('dblclick',e=>{if(moving)return;const id=satelliteAtMapClick(e);if(id!==null)choose(id,true,'close');});map.on('movestart zoomstart',()=>{moving=true;});map.on('moveend zoomend',()=>{moving=false;scheduleDraw();});map.on('resize',scheduleDraw);
const satelliteHover=document.createElement('div');satelliteHover.id='satellite-hover';satelliteHover.hidden=true;satelliteHover.setAttribute('role','tooltip');document.querySelector('.view').append(satelliteHover);
map.on('mousemove',e=>{if(displayMode!=='2d'||moving){satelliteHover.hidden=true;return;}const id=satelliteAtMapClick(e);if(id===null||id===selected){satelliteHover.hidden=true;return;}satelliteHover.textContent=byId.get(id)?.name||String(id);const box=$('map').getBoundingClientRect(),view=document.querySelector('.view').getBoundingClientRect();satelliteHover.style.left=Math.max(8,Math.min(view.width-220,box.left-view.left+e.containerPoint.x+14))+'px';satelliteHover.style.top=Math.max(8,box.top-view.top+e.containerPoint.y-32)+'px';satelliteHover.hidden=false;});
$('map').addEventListener('pointerleave',()=>{satelliteHover.hidden=true;});
map.on('movestart zoomstart',()=>{satelliteHover.hidden=true;});
function updateMapReset(){const centre=map.getCenter();$('map-reset').disabled=Math.abs(map.getZoom()-map.getMinZoom())<.01&&Math.abs(centre.lat)<.001&&Math.abs(centre.lng)<.001;}
map.on('moveend zoomend resize',updateMapReset);
$('results-prev').onclick=()=>{if(resultsPage>0){resultsPage--;list();$('results').scrollTop=0;}};
$('results-next').onclick=()=>{const count=catalog.filter(matches).length;if((resultsPage+1)*resultsPageSize<count){resultsPage++;list();$('results').scrollTop=0;}};
function navigateSatellite(event){
 if(event.isComposing||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||event.target?.closest('dialog,#advanced-panel,.collection-navigation,#workspace-navigation,#scene-left-stack'))return;
 const direction=event.key==='ArrowUp'||event.code==='Numpad8'?-1:event.key==='ArrowDown'||event.code==='Numpad2'?1:0;
 if(!direction||selected===null||event.target?.closest('input,textarea,select,#date-popover,[contenteditable]:not([contenteditable="false"])'))return;
 const rows=catalog.filter(matches),index=rows.findIndex(s=>s.id===selected);
 if(index<0)return;
 event.preventDefault();event.stopPropagation();
 const next=Math.max(0,Math.min(rows.length-1,index+direction));
 if(next===index)return;
 resultsPage=Math.floor(next/resultsPageSize);choose(rows[next].id);
 const button=$('results').querySelector('[data-id="'+rows[next].id+'"]');
 if(button){button.focus({preventScroll:true});button.scrollIntoView({block:'nearest',inline:'nearest'});}
}
document.addEventListener('keydown',navigateSatellite,true);
$('results').onclick=e=>{const b=e.target.closest('[data-id]');if(b)choose(Number(b.dataset.id));};
$('search').addEventListener('input',updateSearchSuggestion);
$('search').addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Enter'){event.preventDefault();submitSearch();$('search').blur();return;}const completion=searchCompletion();if((event.key===' '||(event.key==='Tab'&&!event.shiftKey))&&!event.isComposing&&completion){event.preventDefault();$('search').value=completion;updateSearchSuggestion();resultsPage=0;list();draw();}});
$('search-alternative').onclick=event=>{const yes=event.target.closest('[data-reveal]');if(yes){const satellite=byId.get(Number(yes.dataset.reveal));if(!satellite)return;chosenYears.clear();chosenLaunches.clear();selectedLaunchYears.clear();$('status').value='';if(collectionMode==='debris'){$('debris-type').value='';$('debris-owner').value='';}$('search').value=satellite.name;updateSearchSuggestion();revealedSearchId=satellite.id;renderMultiFilters();resultsPage=0;choose(satellite.id);}else if(event.target.closest('[data-search-no]')){$('search-alternative').dataset.dismissed=searchPromptKey;$('search-alternative').hidden=true;}};
for(const id of ['search','status','debris-type','debris-owner'])$(id).addEventListener('input',()=>{resultsPage=0;list();$('results').scrollTop=0;draw();});

window.AtlasTimeline={get time(){return at;},get live(){return live;}};
let publishedTimeline=null;
let timeZoneKey=null,lastZoneCheck=0;
function clock(){
 const timelineKey=Math.floor(at/60000)+'|'+live;if(timelineKey!==publishedTimeline){publishedTimeline=timelineKey;window.dispatchEvent(new CustomEvent('atlas:time',{detail:{at,live}}));}
 const tick=performance.now();if(!lastZoneCheck||tick-lastZoneCheck>30000){lastZoneCheck=tick;const env=AtlasTime.environment(),key=env.locale+'|'+env.timeZone;if(timeZoneKey!==key){const changed=timeZoneKey!==null;timeZoneKey=key;if(changed){list();draw();}}}
 const env=AtlasTime.environment();$('time-zone').textContent=env.timeZone+' · '+AtlasTime.zoneLabel(at);$('clock').textContent=AtlasTime.instant(at);$('clock').dateTime=new Date(at).toISOString();
 if(document.activeElement!==$('date'))$('date').value=AtlasTime.input(at);$('date').max=AtlasTime.input(Date.now());$('date').setAttribute('aria-label','Date et heure locales · '+env.timeZone);
 $('play').textContent=playing?'Pause':'▶ Lecture';}

$('date').onchange=()=>{const parsed=AtlasTime.parseInput($('date').value),t=parsed.time;if(!Number.isFinite(t)||t>Date.now()){ $('notice').textContent='Choisissez une date locale valide jusqu’au présent (certaines heures n’existent pas au passage à l’heure d’été).';clock();return;}globalThis.AtlasLoading?.begin('Chargement des satellites à la date consultée…');at=t;selectionRequest++;focusSelected=selected!==null;live=false;playing=false;points=[];track=[];futureTrack=[];track3d=[];future3d=[];clock();list();draw();loadPositions(true);if(parsed.ambiguous)$('notice').textContent='Heure locale répétée au changement d’heure : première occurrence retenue ('+AtlasTime.zoneLabel(t)+').';};
$('now').onclick=()=>{globalThis.AtlasLoading?.begin('Chargement des positions actuelles…');at=Date.now();live=true;playing=true;$('speed').value='1';clock();list();loadPositions(true);};
$('play').onclick=()=>{if(playing){live=false;playing=false;}else{playing=true;}lastTick=performance.now();clock();loadPositions(true);};$('speed').onchange=()=>{if(live&&$('speed').value!=='1'){$('speed').value='1';$('notice').textContent='L’accélération est disponible dans le passé.';}};

$('available').onclick=()=>{if(!suggestedAt)return;globalThis.AtlasLoading?.begin('Chargement des positions archivées…');at=Date.parse(suggestedAt);selectionRequest++;focusSelected=selected!==null;live=false;playing=false;points=[];track=[];futureTrack=[];track3d=[];future3d=[];clock();list();draw();loadPositions(true);};
setInterval(()=>{if(document.hidden)return;const tick=performance.now(),dt=tick-lastTick;lastTick=tick;if(live)at=Date.now();else if(playing){at+=dt*Number($('speed').value);if(at>=Date.now()){at=Date.now();playing=false;live=false;$('speed').value='1';}}clock();},250);
setInterval(()=>{if(playing&&!document.hidden)loadPositions();},1000);
setInterval(async()=>{if(document.hidden||busy||globalThis.AtlasCelestial?.active)return;positionRevision++;await loadCatalog();loadPositions(true);},300000);
// Data and rendering start independently; a slow 3D engine never blocks the catalogue.
(async()=>{clock();const engine=AtlasGlobe.load().catch(()=>{});const config=(async()=>{try{const c=await get('/api/config');cartoConfig=c;tiles=L.tileLayer(c.tile_url,{attribution:c.tile_attribution,maxZoom:19,noWrap:true,bounds:worldBounds});if(planisphereRequested)attachPlanisphere();globalThis.AtlasLoading?.done('config');}catch(e){$('health').textContent='Configuration de carte indisponible : '+e.message;globalThis.AtlasLoading?.done('config');}})();await Promise.all([Promise.all([engine,config]).then(()=>showGlobe()).then(()=>{globalThis.AtlasLoading?.done('scene');}),loadCatalog().then(()=>loadPositions())]);})();

document.querySelectorAll('[data-orbit-toggle]').forEach(control=>control.addEventListener('change',()=>{showOrbit=control.checked;document.querySelectorAll('[data-orbit-toggle]').forEach(other=>other.checked=showOrbit);draw();}));
function showPlanisphere(){satelliteHover.hidden=true;displayMode='2d';planisphereRequested=true;attachPlanisphere();$('globe').hidden=true;$('map-creator').hidden=false;$('map').hidden=false;$('map').style.visibility='';$('map-reset').hidden=false;if(globeController)globeController.setActive(false);$('view-2d').setAttribute('aria-pressed','true');$('view-3d').setAttribute('aria-pressed','false');moving=false;map.invalidateSize({pan:false});updateMapReset();scheduleDraw();draw();}
$('view-2d').onclick=showPlanisphere;
async function showGlobe(){
 $('view-3d').disabled=true;$('view-2d').disabled=true;
 try{
  await AtlasGlobe.load();if(!cartoConfig)cartoConfig=await get('/api/config');
  $('globe').hidden=false;$('map-creator').hidden=true;$('map').hidden=true;$('map-reset').hidden=true;displayMode='3d';
  if(!globeController){globeController=await AtlasGlobe.create($('globe-canvas'),cartoConfig,choose,closeSatellite);if(restoredEarthView){await globeController.setRealistic(restoredEarthView.realistic);if(restoredEarthView.sky&&$('sky-toggle').getAttribute('aria-checked')!=='true')await $('sky-toggle').onclick();}}
  globeController.setActive(true);$('globe').closest('.view').dataset.earthReady='true';if(AtlasPages.isStation(collectionMode)&&selected===null)issOverviewPending=true;$('view-2d').setAttribute('aria-pressed','false');$('view-3d').setAttribute('aria-pressed','true');focusSelected=selected!==null;draw();applyInitialOrientation();
 }catch(e){showPlanisphere();$('notice').textContent='La vue 3D est indisponible : '+e.message;}
 finally{$('view-3d').disabled=false;$('view-2d').disabled=false;}
}
$('view-3d').onclick=showGlobe;
$('earth-realistic-toggle').addEventListener('click',()=>{if(!globeController||displayMode!=='3d')return;const button=$('earth-realistic-toggle');const wanted=button.getAttribute('aria-busy')==='true'?false:button.getAttribute('aria-checked')!=='true';globeController.setRealistic(wanted);});
$('map-reset').onclick=()=>{focusSelected=false;constrainWorld(true);draw();};

function updateCollectionCoverage(){$('coverage').textContent=collectionMode==='debris'?'Débris · Catalogue public SATCAT de tous les programmes : fragments et étages de fusée, complété par les objets Analyst non identifiés. Positions SGP4 uniquement si des éléments orbitaux adaptés existent (±72 h). Les petits fragments estimés statistiquement n’ont pas de coordonnées individuelles publiques et ne sont pas représentés.':AtlasPages.isStation(collectionMode)?AtlasPages.definition(collectionMode).label+' · Éléments publics CelesTrak, calcul SGP4. Archives orbitales publiques et collectes locales ; positions calculées uniquement lorsqu’une observation valable existe à la date affichée. Modèle schématique, taille amplifiée et orientation illustrative.':AtlasPages.definition(collectionMode)?.category==='experimental'?`${AtlasPages.definition(collectionMode).label} · Éléments orbitaux publics CelesTrak, SatNOGS ou N2YO / Space-Track. Calcul SGP4, altitude réelle. Collecte toutes les 2 h ; aucun point inventé si les données sont absentes ou dépassent ±72 h.`:AtlasPages.hasLocalHistory(collectionMode)?`${AtlasPages.definition(collectionMode).label} · Éléments publics CelesTrak, calcul SGP4 à altitude réelle. Collecte toutes les 2 h ; les éléments dépassant ±72 h ne sont pas utilisés. Les dates anciennes nécessitent des observations orbitales disponibles.`:constellationCoverage;}
$('atlas-home').href=AtlasPages.url('all');
$('collection-select').value=collectionMode;
$('collection-title').textContent=collectionMode==='all'?'Atlas':AtlasPages.definition(collectionMode).label;
$('collection-orbit').hidden=collectionMode==='all';
$('collection-orbit').textContent=collectionMode==='all'?'':'Type d’orbite : '+AtlasOrbits.nominal(AtlasPages.definition(collectionMode));
$('collection-description').textContent=collectionMode==='all'?'Visualisez les objets suivis en orbite autour de la Terre. Choisissez un objet à observer pour explorer sa page et ses informations détaillées.':AtlasPages.definition(collectionMode).description;
document.body.dataset.collection=collectionMode;
document.body.dataset.science=String(AtlasPages.definition(collectionMode)?.category==='science');
document.body.dataset.constellation=String(AtlasPages.hasLocalHistory(collectionMode)&&!AtlasPages.isStation(collectionMode));
$('debris-filters').hidden=collectionMode!=='debris';
if(collectionMode==='debris'){document.querySelector('.satellite-results h2').textContent='Objets';document.querySelector('label[for="search"]').textContent='Rechercher un débris, un étage ou un objet';}
if(collectionMode!=='debris'&&AtlasPages.hasLocalHistory(collectionMode))$('status').insertAdjacentHTML('beforeend','<option value="inactive">Hors service (statut actuel)</option>');
$('starlink-controls').hidden=!AtlasPages.isConstellation(collectionMode);$('atlas-controls').hidden=collectionMode!=='all';$('iss-controls').hidden=!AtlasPages.isStation(collectionMode);issOverviewPending=AtlasPages.isStation(collectionMode);updateCollectionCoverage();
$('collection-select').addEventListener('change',e=>{if(e.target.value!==collectionMode)location.assign(AtlasPages.url(e.target.value));});
AtlasCollectionMenu.mount($('collection-select'));
for(const family of Object.keys(atlasColors)){
 $('atlas-color-'+family).addEventListener('input',e=>{atlasColors[family]=e.target.value;draw();});
}
let pendingAtlasOverview=null;
function orientAtlasGroups(){
 if(selected!==null){pendingAtlasOverview=null;return;}
 if(pendingAtlasOverview===null)return;
 const preferred=pendingAtlasOverview;const available=new Set(points.map(p=>p.id));
 const candidates=catalog.filter(s=>available.has(s.id)&&state(s)==='orbit'&&AtlasPages.memberships(s).some(key=>atlasGroups.has(key)));
 const operational=s=>!['-','D','B','S'].includes(s.ops);
 const target=candidates.find(s=>operational(s)&&AtlasPages.memberships(s).some(key=>preferred.has(key)))||candidates.find(operational)||candidates[0];
 if(!target)return;
 pendingAtlasOverview=null;initialOverviewTarget=points.find(p=>p.id===target.id);
 if(displayMode==='2d'){constrainWorld(true);map.panTo([initialOverviewTarget.lat,initialOverviewTarget.lon],{animate:false});}
 applyInitialOrientation();
}
function updateAtlasGroups(){
 const previous=atlasGroups;
 const checks=[...document.querySelectorAll('[data-family]')];atlasGroups=new Set(checks.filter(el=>el.checked).map(el=>el.dataset.family));$('atlas-clear').disabled=atlasGroups.size===0;
 const debrisVisible=atlasGroups.has('debris');$('atlas-debris-toggle').setAttribute('aria-pressed',String(debrisVisible));$('atlas-debris-toggle').textContent=debrisVisible?'Masquer les débris':'Afficher les débris';
 if(selected!==null&&!AtlasPages.memberships(byId.get(selected)||{id:selected}).some(key=>atlasGroups.has(key))){selected=null;focusSelected=false;selectionRequest++;positionRevision++;track=[];futureTrack=[];track3d=[];future3d=[];loadPositions(true);}list();draw();
 if(selected===null){
  initialOverviewTarget=null;
  if(!atlasGroups.size){pendingAtlasOverview=null;if(displayMode==='3d')globeController?.orientOverview(null);else constrainWorld(true);}
  else{pendingAtlasOverview=new Set([...atlasGroups].filter(key=>!previous.has(key)));orientAtlasGroups();}
 }
}
document.querySelectorAll('[data-family]').forEach(el=>el.addEventListener('change',updateAtlasGroups));
$('atlas-debris-toggle').addEventListener('click',()=>{const box=document.querySelector('[data-family="debris"]');box.checked=!box.checked;updateAtlasGroups();});

document.querySelectorAll('[data-page]').forEach(link=>{link.href=AtlasPages.url(link.dataset.page);});
// Observe a live member in the current map; keep navigation to its dedicated page separate.
function atlasObservationTargets(){
 const available=new Set(points.map(point=>point.id)),targets=new Map();
 for(const satellite of catalog){
  if(!available.has(satellite.id)||state(satellite)!=='orbit')continue;
  const operational=!['-','D','B','S'].includes(satellite.ops);
  for(const family of AtlasPages.memberships(satellite)){
   const previous=targets.get(family);
   if(!previous||(operational&&['-','D','B','S'].includes(previous.ops)))targets.set(family,satellite);
  }
 }
 return targets;
}
function atlasObservationTarget(family){return atlasObservationTargets().get(family)||null;}
function updateObservationButtons(){
 const targets=atlasObservationTargets();
 document.querySelectorAll('[data-observe]').forEach(button=>{
  const target=targets.get(button.dataset.observe);button.disabled=!target;
  button.title=target?'Centrer la vue sur '+target.name:'Aucune position disponible à la date affichée';
 });
}
document.querySelectorAll('[data-observe]').forEach(button=>button.addEventListener('click',()=>{
 const target=atlasObservationTarget(button.dataset.observe);if(!target)return;
 const box=document.querySelector('[data-family="'+button.dataset.observe+'"]');
 if(box&&!box.checked){box.checked=true;updateAtlasGroups();}
 choose(target.id,true);document.dispatchEvent(new Event('atlas:observe'));
}));

document.querySelectorAll('[data-theme-select]').forEach(button=>button.addEventListener('click',()=>{
 const group=button.closest('.atlas-category');group.querySelectorAll('[data-family]').forEach(box=>box.checked=button.dataset.themeSelect==='all');updateAtlasGroups();
}));
document.querySelectorAll('[data-theme-color]').forEach(input=>input.addEventListener('input',()=>{
 input.closest('.atlas-category').querySelectorAll('[data-family]').forEach(box=>{const key=box.dataset.family;atlasColors[key]=input.value;$('atlas-color-'+key).value=input.value;});draw();
}));
$('atlas-clear').addEventListener('click',()=>{
 document.querySelectorAll('[data-family]').forEach(el=>el.checked=false);updateAtlasGroups();
});
$('atlas-reset').addEventListener('click',()=>{
 document.querySelectorAll('[data-theme-color]').forEach(el=>el.value='#ffffff');document.querySelectorAll('[data-family]').forEach(el=>{el.checked=el.dataset.family!=='debris';atlasColors[el.dataset.family]=atlasDefaultColor(el.dataset.family);$('atlas-color-'+el.dataset.family).value=atlasDefaultColor(el.dataset.family);});updateAtlasGroups();
});

// Search navigates to complete documents, like the observation selector.
{
 const input=$('object-search'),results=$('object-search-results');let found=[],active=-1;
 const hide=()=>{results.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
 const navigate=mode=>location.assign(AtlasPages.url(mode));
 const activate=index=>{active=index;[...results.querySelectorAll('[data-mode]')].forEach((button,i)=>button.setAttribute('aria-selected',String(i===active)));if(active>=0)input.setAttribute('aria-activedescendant','object-result-'+active);else input.removeAttribute('aria-activedescendant');};
 input.addEventListener('input',()=>{found=AtlasPages.search(input.value);active=-1;results.replaceChildren();input.removeAttribute('aria-activedescendant');if(!input.value.trim()){hide();return;}
  if(!found.length){const empty=document.createElement('p');empty.className='object-search-empty';empty.textContent='Aucun objet trouvé';results.append(empty);}
  found.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.id='object-result-'+i;button.dataset.mode=item.mode;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;const name=document.createElement('strong'),description=document.createElement('small');name.textContent=item.name;description.textContent=item.description;button.append(name,description);button.onclick=()=>navigate(item.mode);results.append(button);});
  results.hidden=false;input.setAttribute('aria-expanded','true');
 });
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){hide();return;}if(results.hidden)return;const direct=AtlasPages.searchAction(event.key,found);if(direct){event.preventDefault();navigate(direct);return;}if((event.key==='ArrowDown'||event.key==='ArrowUp')&&found.length){event.preventDefault();activate(active<0?(event.key==='ArrowDown'?0:found.length-1):(active+(event.key==='ArrowDown'?1:found.length-1)+found.length)%found.length);}else if(event.key==='Enter'&&active>=0){event.preventDefault();navigate(found[active].mode);}});
 input.addEventListener('focus',()=>{if(input.value.trim())input.dispatchEvent(new Event('input'));});
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('.object-search'))hide();});
 input.addEventListener('blur',()=>setTimeout(()=>{if(!results.contains(document.activeElement))hide();},150));
}

// Lunar travel suspends the satellite layer and its position requests.
document.addEventListener('atlas:lunar-view',event=>{
 positionRevision++;pendingPosition=false;
 if(event.detail.active){$('count').textContent='0';$('notice').textContent='Vue lunaire · affichage des satellites suspendu';points=[];track=[];futureTrack=[];track3d=[];future3d=[];planarMotion.set([],performance.now(),false);}
 else loadPositions(true);
});
