/* Progress follows completed work. Time only animates the movement between real milestones. */
(function(root){
 function create({render,close,frame,cancelFrame,now,later,label=()=>{},reduced=false,phases={config:10,catalog:45,scene:25,positions:20}}){
  let weights=phases,completed=new Set();
  let value=0,target=0,from=0,began=now(),animation=null,active=true,generation=0;
  function animate(){if(!active)return;animation=null;
   // RAF timestamps can predate a phase completed during the same frame.
   // Use the same clock as advance(), and keep each run within its actual target.
   const t=reduced?1:Math.max(0,Math.min(1,(now()-began)/160));
   value=Math.max(value,Math.max(0,Math.min(target,from+(target-from)*(1-Math.pow(1-t,3)))));render(Math.round(Math.min(100,value)));
   if(t<1)animation=frame(animate);
   else if(target===100){const token=generation;later(()=>{if(active&&token===generation){active=false;close(false);}},reduced?0:70);}
  }
  function advance(){if(!active)return;target=[...completed].reduce((sum,key)=>sum+weights[key],0);from=value;began=now();if(animation!==null)cancelFrame(animation);animation=frame(animate);}
  function begin(title,phases={positions:100}){
   generation++;const token=generation;active=true;if(animation!==null)cancelFrame(animation);animation=null;
   weights=phases;completed.clear();value=target=from=0;began=now();label(title);render(0,true);
   return {get current(){return token===generation;},done(key){if(token===generation)api.done(key);},fail(){if(token===generation)api.fail();}};
  }
  const api={begin,done(key){if(!Object.prototype.hasOwnProperty.call(weights,key)||completed.has(key))return;completed.add(key);advance();},retry(){if(active)return;active=true;generation++;completed.delete('catalog');completed.delete('positions');value=0;render(0,true);advance();},fail(){if(!active)return;active=false;generation++;if(animation!==null)cancelFrame(animation);animation=null;close(true);}};return api;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={create};return;}
 const overlay=document.getElementById('catalog-loader'),view=overlay.closest('.view'),bar=document.getElementById('catalog-progress'),value=document.getElementById('catalog-percent'),fill=document.getElementById('catalog-progress-fill');
 // Only the first Atlas arrival uses the branded card. Journeys and later
 // timeline loads keep their usual loader; no extra data request or fake timer.
 const loaderParent=overlay.parentNode,loaderNext=overlay.nextSibling;
 const mission=document.documentElement.dataset.missionPage==='true';
 let missionSceneReady=false,missionPositionsReady=false;
 let entry=document.documentElement.dataset.atlasEntryLoading==='true';
 if(entry)document.body.append(overlay);
 function releaseEntry(){
  if(!entry)return;
  entry=false;loaderParent.insertBefore(overlay,loaderNext?.parentNode===loaderParent?loaderNext:null);
  delete document.documentElement.dataset.atlasEntryLoading;
  document.dispatchEvent(new CustomEvent('atlas:entry-ready'));
 }
 root.AtlasLoading=create({phases:mission?{config:10,catalog:20,scene:25,positions:20,visuals:25}:undefined,label:title=>{const node=overlay.querySelector('.catalog-loading-label')||overlay.querySelector('h2')||overlay.querySelector('p');if(node)node.textContent=title;overlay.setAttribute('aria-label',title);},now:()=>performance.now(),frame:requestAnimationFrame,cancelFrame:cancelAnimationFrame,later:setTimeout,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
  render(percent,reopen){percent=Number.isFinite(percent)?Math.max(0,Math.min(100,Math.round(percent))):0;if(reopen){overlay.hidden=false;overlay.dataset.state='';view.dataset.loading='true';view.setAttribute('aria-busy','true');}value.textContent=String(percent);bar.setAttribute('aria-valuenow',String(percent));fill.style.transform=`scaleX(${percent/100})`;},
  close(error){view.dataset.loading='false';view.setAttribute('aria-busy','false');overlay.dataset.state='closing';if(error||mission){overlay.hidden=true;releaseEntry();}else setTimeout(()=>{if(overlay.dataset.state==='closing'){overlay.hidden=true;releaseEntry();}},180);}
 });
 if(mission){
  const api=root.AtlasLoading,complete=api.done,start=api.begin;
  Object.defineProperty(api,'missionFrameReady',{get:()=>missionSceneReady&&missionPositionsReady});
  api.done=key=>{if(key==='scene')missionSceneReady=true;if(key==='positions')missionPositionsReady=true;complete(key);if(key==='scene'||key==='positions')root.dispatchEvent?.(new CustomEvent('atlas:mission-loading-check'));};
  api.retry=()=>{}; // Background catalogue refreshes never reopen a splash.
  api.begin=title=>{missionPositionsReady=false;entry=true;document.documentElement.dataset.atlasEntryLoading='true';document.body.append(overlay);return start(title,{positions:75,visuals:25});};
 }
})(typeof window==='undefined'?globalThis:window);
