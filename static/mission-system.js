/* One timeline and one persistent overview for each distant mission. */
(()=>{
 const key=document.body.dataset.collection,definition=window.AtlasPages?.definition(key);if(!definition?.trajectory)return;
 const base=new URL('./',document.currentScript.src),isolated=document.getElementById('view-3d'),system=document.getElementById('view-2d'),view=document.querySelector('.view');let frame=null,active=false,layoutQueued=false,frameReady=false,pendingFilm=null;
 document.body.classList.add('has-system-view');isolated.textContent='Vue isolée';system.textContent='Vue système solaire';system.disabled=false;
 function post(data){frame?.contentWindow?.postMessage(data,location.origin);}
 function sync(){if(!active||pendingFilm)return;post({type:'atlas:system-time',at:window.AtlasTimeline?.time||Date.now(),live:window.AtlasTimeline?.live===true,playing:document.getElementById('play').textContent==='Pause'});}
 function refreshLayout(){if(layoutQueued)return;layoutQueued=true;requestAnimationFrame(()=>{layoutQueued=false;post({type:'atlas:system-visibility',visible:active});sync();});}
 function show(value){active=value;document.body.dataset.missionSystem=String(value);
  if(value&&!frame){frame=document.createElement('iframe');frame.className='mission-system-frame';frame.title='Système solaire · '+definition.label;const url=new URL('soleil/',base);url.search=new URLSearchParams({system:'1',embedded:'1',mission:key,...(pendingFilm?{film:'1'}:{}),at:new Date(pendingFilm?.payload?.start||window.AtlasTimeline?.time||Date.now()).toISOString()});frame.src=url;frame.onload=refreshLayout;view.append(frame);}
  // CSS keeps the hidden iframe laid out at full size. Only its rendering stops.
  if(frame){frame.hidden=!value;frame.setAttribute('aria-hidden',String(!value));frame.inert=!value;}
  post({type:'atlas:system-visibility',visible:value});system.setAttribute('aria-pressed',String(value));isolated.setAttribute('aria-pressed',String(!value));window.dispatchEvent(new CustomEvent('atlas:mission-system-view',{detail:{enabled:value}}));refreshLayout();
 }
 system.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();show(true);},true);
 isolated.addEventListener('click',()=>show(false),true);
 new MutationObserver(()=>{if(system.disabled)system.disabled=false;}).observe(system,{attributes:true,attributeFilter:['disabled']});
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  if(event.data?.type==='atlas:system-ready'){frameReady=true;refreshLayout();if(pendingFilm)post({type:'atlas:system-film-prepare',...pendingFilm});}
  if(event.data?.type==='atlas:system-film-ready')window.dispatchEvent(new CustomEvent('atlas:film-ready',{detail:event.data}));
  if(event.data?.type==='atlas:system-film-progress')window.dispatchEvent(new CustomEvent('atlas:film-progress',{detail:event.data}));
  if(event.data?.type==='atlas:system-events-toggle')window.dispatchEvent(new Event('atlas:mission-events-toggle'));
  if(event.data?.type==='atlas:system-isolate')isolated.click();
  if(event.data?.type==='atlas:system-earth')location.assign(new URL('atlas?view=earth',base).href);
  if(event.data?.type==='atlas:system-pause'){window.AtlasTimeline?.setPlaying(false);window.dispatchEvent(new Event('atlas:film-paused'));}
  if(event.data?.type==='atlas:system-toggle-play')document.getElementById('play').click();
 });
 window.addEventListener('atlas:mission-isolated-recovery',()=>show(false));
 window.addEventListener('atlas:film-prepare',event=>{pendingFilm=event.detail;show(true);if(frameReady)post({type:'atlas:system-film-prepare',...pendingFilm});});
 window.addEventListener('atlas:film-state',event=>post({type:'atlas:system-film-state',...event.detail}));
 window.addEventListener('atlas:film-frame',event=>post({type:'atlas:system-film-frame',...event.detail}));
 window.addEventListener('atlas:film-clear',()=>{pendingFilm=null;post({type:'atlas:system-film-clear'});});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(refreshLayout).observe(view);
 window.addEventListener('resize',refreshLayout);window.addEventListener('atlas:time',sync);setInterval(sync,250);
})();
