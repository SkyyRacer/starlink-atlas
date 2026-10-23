/* One desktop UI scale, relative to the reference Mac view. Never scale the map. */
(()=>{
 const root=document.documentElement,agent=navigator.userAgent||'';
 const handheld=!!navigator.userAgentData?.mobile||/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(agent)||(/Macintosh/i.test(agent)&&navigator.maxTouchPoints>1);
 const desktop=matchMedia('(min-width: 901px) and (any-pointer: fine)');
 let value=1;
 function update(){
  const enabled=!handheld&&desktop.matches&&CSS.supports('zoom','1');
  const next=enabled?Math.round(Math.max(.82,Math.min(1.2,window.innerWidth/2048,window.innerHeight/1060))*1000)/1000:1;
  root.dataset.desktopUi=String(enabled);
  if(next!==value||!root.style.getPropertyValue('--atlas-ui-scale'))root.style.setProperty('--atlas-ui-scale',String(next));
  value=next;
 }
 window.AtlasUI={get scale(){return value;},place(element,bounds){for(const [key,length] of Object.entries(bounds))element.style[key]=length/value+'px';}};
 // Register before scene and menu listeners so their measurements see the new scale.
 window.addEventListener('resize',update);
 if(desktop.addEventListener)desktop.addEventListener('change',update);else desktop.addListener(update);
 update();
})();
