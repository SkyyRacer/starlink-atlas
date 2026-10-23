'use strict';
/* Desktop only: keep a small window from presenting overlapping map controls. */
(()=>{
 // Run in the head so Atlas never paints its globe loader before the entry card.
 // The document base also resolves the /starlink-atlas/ prefix on GitHub Pages.
 const visitKey='atlas-entry-seen-v1',logoKey='atlas-entry-logo-v1';
 if(document.currentScript?.src){
  const base=new URL('./',document.currentScript.src),page=new URL(window.location.href);
  const route=page.pathname.startsWith(base.pathname)?page.pathname.slice(base.pathname.length).replace(/\/$/,''):null;
  if(['','index.html','atlas'].includes(route)){
   let seen=false,logo=false;
   try{seen=window.sessionStorage.getItem(visitKey)==='1';logo=window.sessionStorage.getItem(logoKey)==='1';window.sessionStorage.removeItem(logoKey);window.sessionStorage.setItem(visitKey,'1');}catch{/* Storage may be disabled; navigation still works. */}
   if(logo||(!seen&&page.searchParams.get('journey')!=='1'))document.documentElement.dataset.atlasEntryLoading='true';
  }
 }
 // Capture before each page's navigation handler (including the lunar journey),
 // so a logo click explicitly asks for the card without losing view preferences.
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
  if(!event.target.closest?.('#atlas-home, #earth-home'))return;
  try{window.sessionStorage.setItem(logoKey,'1');}catch{}
 },true);
 const minimum=1000,coarse=matchMedia('(pointer: coarse)'),mouse=matchMedia('(any-pointer: fine)');
 const agent=navigator.userAgent||'';
 // iPadOS can advertise a desktop UA. A touch-first device stays exempt even
 // when a mouse is attached; this mask is exclusively for desktop computers.
 const handheld=!!navigator.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(agent)||(/Macintosh/i.test(agent)&&navigator.maxTouchPoints>1);
 const isDesktop=()=>!handheld&&!coarse.matches&&mouse.matches;
 // Keep the requested square when possible, with room for a normal desktop
 // window: reserve 15% of the work area, then subtract browser chrome.
 // Requiring almost 100% of the screen effectively forced macOS full screen.
 function requiredSize(axis,current){
  const screen=window.screen,available=Number(screen?.[axis==='Width'?'availWidth':'availHeight']);
  const outer=Number(window['outer'+axis]);
  if(!(available>0&&outer>0))return minimum;
  const chrome=Math.max(0,outer-current);
  return Math.min(minimum,Math.max(1,available*.85-chrome));
 }
 let mask=null,queued=false;
 function update(){
  queued=false;
  if(document.documentElement.dataset.atlasEntryLoading==='true')return;
  const width=Math.round(window.innerWidth),height=Math.round(window.innerHeight);
  const blocked=isDesktop()&&(width<requiredSize('Width',width)||height<requiredSize('Height',height));
  if(!blocked){if(mask?.open)mask.close();return;}
  if(!mask){
   mask=document.createElement('dialog');mask.id='desktop-viewport-guard';mask.setAttribute('aria-labelledby','desktop-viewport-title');mask.setAttribute('tabindex','-1');
   mask.innerHTML='<div class="viewport-guard-card"><img class="viewport-guard-logo" alt="Atlas" width="700" height="275"><svg class="viewport-guard-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" stroke-width="1.5"/><path d="M23 41l18-18M30 23h11v11M23 30v11h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h1 id="desktop-viewport-title">Agrandissez votre fenêtre</h1></div>';
   mask.querySelector('.viewport-guard-logo').src='/images/atlas-logo.png';
   mask.addEventListener('cancel',event=>event.preventDefault());
   for(const type of ['pointerdown','click','keydown'])mask.addEventListener(type,event=>event.stopPropagation());
   document.body.append(mask);
  }
  if(!mask.open)mask.showModal();
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
 document.addEventListener('atlas:entry-ready',update);
 window.addEventListener('resize',schedule);
 window.addEventListener('pageshow',schedule);
 window.addEventListener('focus',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 for(const media of [coarse,mouse]){if(media.addEventListener)media.addEventListener('change',schedule);else media.addListener(schedule);}
})();
