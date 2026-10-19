/* Progress follows completed work. Time only animates the movement between real milestones. */
(function(root){
 function create({render,close,frame,cancelFrame,now,later,reduced=false}){
  const weights={config:10,catalog:45,scene:25,positions:20},completed=new Set();
  let value=0,target=0,from=0,began=now(),animation=null,active=true,generation=0;
  function animate(time){animation=null;const t=reduced?1:Math.min(1,(time-began)/160);value=from+(target-from)*(1-Math.pow(1-t,3));render(Math.round(value));
   if(t<1)animation=frame(animate);
   else if(target===100){const token=generation;later(()=>{if(active&&token===generation){active=false;close(false);}},reduced?0:70);}
  }
  function advance(){if(!active)return;target=[...completed].reduce((sum,key)=>sum+weights[key],0);from=value;began=now();if(animation!==null)cancelFrame(animation);animation=frame(animate);}
  return {done(key){if(!(key in weights)||completed.has(key))return;completed.add(key);advance();},retry(){if(active)return;active=true;generation++;completed.delete('catalog');completed.delete('positions');value=0;render(0,true);advance();},fail(){if(!active)return;active=false;generation++;if(animation!==null)cancelFrame(animation);animation=null;close(true);}};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={create};return;}
 const overlay=document.getElementById('catalog-loader'),view=overlay.closest('.view'),bar=document.getElementById('catalog-progress'),value=document.getElementById('catalog-percent'),fill=document.getElementById('catalog-progress-fill');
 root.AtlasLoading=create({now:()=>performance.now(),frame:requestAnimationFrame,cancelFrame:cancelAnimationFrame,later:setTimeout,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
  render(percent,reopen){if(reopen){overlay.hidden=false;overlay.dataset.state='';view.dataset.loading='true';view.setAttribute('aria-busy','true');}value.textContent=String(percent);bar.setAttribute('aria-valuenow',String(percent));fill.style.transform=`scaleX(${percent/100})`;},
  close(error){view.dataset.loading='false';view.setAttribute('aria-busy','false');overlay.dataset.state='closing';if(error)overlay.hidden=true;else setTimeout(()=>{if(overlay.dataset.state==='closing')overlay.hidden=true;},180);}
 });
})(typeof window==='undefined'?globalThis:window);
