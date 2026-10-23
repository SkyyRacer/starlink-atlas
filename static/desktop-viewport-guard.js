'use strict';
/* Desktop only: keep a small window from presenting overlapping map controls. */
(()=>{
 const minimum=1000,coarse=matchMedia('(pointer: coarse)'),mouse=matchMedia('(any-pointer: fine)');
 const agent=navigator.userAgent||'';
 // iPadOS can advertise a desktop UA. A touch-first device stays exempt even
 // when a mouse is attached; this mask is exclusively for desktop computers.
 const handheld=!!navigator.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(agent)||(/Macintosh/i.test(agent)&&navigator.maxTouchPoints>1);
 const isDesktop=()=>!handheld&&!coarse.matches&&mouse.matches;
 // The requested square must remain achievable on a desktop screen. Subtract
 // browser chrome from the work area; never require more than a maximized tab.
 function requiredSize(axis,current){
  const screen=window.screen,available=Number(screen?.[axis==='Width'?'availWidth':'availHeight']);
  const outer=Number(window['outer'+axis]);
  if(!(available>0&&outer>0))return minimum;
  const chrome=Math.max(0,outer-current);
  return Math.min(minimum,Math.max(1,available-chrome-16));
 }
 let mask=null,queued=false;
 function update(){
  queued=false;
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
 window.addEventListener('resize',schedule);
 window.addEventListener('pageshow',schedule);
 window.addEventListener('focus',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 for(const media of [coarse,mouse]){if(media.addEventListener)media.addEventListener('change',schedule);else media.addListener(schedule);}
})();
