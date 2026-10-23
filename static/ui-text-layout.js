/* Reserve actual text height instead of guessing it from a fixed top offset. */
(()=>{
 const controls=document.querySelector('.earth-view-controls');if(!controls)return;
 let queued=false,last='';
 function measure(){
  queued=false;
  const scale=window.AtlasUI?.scale||1;
  const space=Math.max(60,(window.innerHeight-controls.getBoundingClientRect().bottom)/scale-90);
  const next=Math.floor(space)+'px';
  if(next!==last){last=next;document.documentElement.style.setProperty('--atlas-left-tools-max-height',next);}
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe(controls);
 window.addEventListener('resize',schedule);measure();
})();
