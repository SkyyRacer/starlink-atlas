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
   if(logo||(!seen&&page.searchParams.get('journey')!=='1')){document.documentElement.dataset.atlasEntryLoading='true';document.documentElement.dataset.atlasResetPreferences='true';try{window.sessionStorage.removeItem('atlas-display-preferences-v1');}catch{}}
  }
 }
 // Capture before each page's navigation handler (including the lunar journey),
 // so a logo click explicitly asks for the card and default display preferences.
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||(event.button!==undefined&&event.button!==0))return;
  if(!event.target.closest?.('#atlas-home, #earth-home'))return;
  try{window.sessionStorage.setItem(logoKey,'1');}catch{}
 },true);
 // CSS pixels, not physical display pixels. Leave room for ordinary browser
 // windows on smaller screens; outerWidth/outerHeight and browser chrome are
 // deliberately excluded because their meaning varies with OS and page zoom.
 const area=window.screen;
 const limit=(value,maximum)=>Number.isFinite(Number(value))&&Number(value)>0?Math.min(maximum,Math.floor(Number(value)*.8)):maximum;
 const minimumWidth=limit(area?.availWidth,1000),minimumHeight=limit(area?.availHeight,650);
 const small=matchMedia(`(max-width: ${minimumWidth-.02}px), (max-height: ${minimumHeight-.02}px)`);
 const coarse=matchMedia('(pointer: coarse)'),mouse=matchMedia('(any-pointer: fine)');
 const agent=navigator.userAgent||'';
 // iPadOS can advertise a desktop UA. A touch-first device stays exempt even
 // when a mouse is attached; this mask is exclusively for desktop computers.
 const handheld=!!navigator.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(agent)||(/Macintosh/i.test(agent)&&navigator.maxTouchPoints>1);
 const isDesktop=()=>!handheld&&!coarse.matches&&mouse.matches;
 let mask=null;
 function update(){
  if(document.documentElement.dataset.atlasEntryLoading==='true')return;
  const blocked=isDesktop()&&small.matches;
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
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
 document.addEventListener('atlas:entry-ready',update);
 window.addEventListener('resize',update);
 window.addEventListener('pageshow',update);
 window.addEventListener('focus',update);
 window.visualViewport?.addEventListener('resize',update);
 for(const media of [small,coarse,mouse]){if(media.addEventListener)media.addEventListener('change',update);else media.addListener(update);}
})();
