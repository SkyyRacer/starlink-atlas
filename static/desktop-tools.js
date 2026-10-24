/* Desktop disclosure only. Existing controls and their state stay mounted. */
(()=>{
 const $=id=>document.getElementById(id),desktop=matchMedia('(min-width: 901px)'),timeline=document.querySelector('.timeline'),timeButton=$('timeline-toggle'),toolsButton=$('advanced-tools');
 let timeOpen=false,toolsOpen=false;
 function apply(){
  timeline.dataset.expanded=String(!desktop.matches||timeOpen);
  timeButton.setAttribute('aria-expanded',String(timeOpen));$('timeline-content').inert=desktop.matches&&!timeOpen;
  document.body.classList.toggle('advanced-tools-open',toolsOpen);
  if(toolsButton){toolsButton.setAttribute('aria-expanded',String(toolsOpen));toolsButton.querySelector('span').textContent=toolsOpen?'−':'+';}
  for(const id of ['advanced-filters','advanced-model-options']){const control=$(id);if(control)control.inert=false;}
  window.AtlasAdvanced?.setOpen(toolsOpen);
  // Reuse the scene's existing layout measurement after folding the chronology.
  window.dispatchEvent(new Event('resize'));
 }
 function updateTime(event){
  const state=event?.detail||window.AtlasTimeline;if(!state)return;
  const value=state.time??state.at;
  $('timeline-summary-label').textContent='Maintenant';
  $('timeline-summary-label').disabled=Boolean(state.live);$('now').disabled=Boolean(state.live);
  $('timeline-now').hidden=Boolean(state.live);
  timeButton.title=state.live?'Ouvrir la chronologie':`Date consultée · ${AtlasTime.environment().timeZone} · ouvrir la chronologie`;
 }
 timeButton.addEventListener('click',()=>{
  timeOpen=!timeOpen;if(!timeOpen)window.AtlasCollectionMenu?.reset($('timeline-content'));
  if(!timeOpen&&!$('date-popover')?.hidden){$('date-popover')?.querySelector('[data-close]')?.click();timeButton.focus({preventScroll:true});}
  apply();
 });
 window.addEventListener('pointerdown',event=>{
  if(!desktop.matches||!timeOpen||timeline.contains(event.target))return;
  const calendar=$('date-popover');if(calendar&&!calendar.hidden&&calendar.contains(event.target))return;
  if(calendar&&!calendar.hidden)calendar.querySelector('[data-close]')?.click();
  timeOpen=false;window.AtlasCollectionMenu?.reset($('timeline-content'));apply();
 });
 $('timeline-now').addEventListener('click',()=>$('now').click());
 $('timeline-summary-label').addEventListener('click',()=>$('now').click());
 toolsButton?.addEventListener('click',()=>{toolsOpen=!toolsOpen;apply();});
 window.addEventListener('atlas:time',updateTime);desktop.addEventListener('change',apply);updateTime();apply();
})();
