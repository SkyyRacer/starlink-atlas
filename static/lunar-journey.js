/* Per-tab display preferences shared by satellite, Atlas and lunar pages. */
(function(root){
 const base=typeof document!=='undefined'?new URL('./',document.currentScript.src):null,key='atlas-earth-moon-view-v1';let provider=null;
 function normalize(value){if(!value||typeof value!=='object')return null;const at=Number(value.at);if(!Number.isFinite(at)||at<Date.UTC(1957,0,1)||at>Date.now()+60000)return null;return {at,live:value.live===true,playing:value.playing===true,speed:['1','2','5','10','100'].includes(String(value.speed))?String(value.speed):'1',realistic:value.realistic===true,sky:value.sky===true,tile_url:typeof value.tile_url==='string'?value.tile_url:null,tile_attribution:typeof value.tile_attribution==='string'?value.tile_attribution:null};}
 function read(){try{return normalize(JSON.parse(root.sessionStorage.getItem(key)));}catch{return null;}}
 function preferences(restoring=false){
  if(!restoring&&typeof document!=='undefined'&&document.documentElement?.dataset.atlasResetPreferences==='true')return {realistic:false,sky:false};
  let value;try{value=JSON.parse(root.sessionStorage.getItem('atlas-display-preferences-v1'));}catch{}
  value=value||incoming();return {realistic:value?.realistic===true,sky:value?.sky===true};
 }
 function savePreferences(value){try{root.sessionStorage.setItem('atlas-display-preferences-v1',JSON.stringify({realistic:value.realistic===true,sky:value.sky===true}));}catch{}}
 function bind(fn){provider=fn;}
 function save(){const state=normalize(provider?.());if(state)savePreferences(state);if(state)try{root.sessionStorage.setItem(key,JSON.stringify(state));}catch{}return state;}
 function navigate(file){const state=save(),url=new URL(file,base);if(state){url.searchParams.set('journey','1');url.searchParams.set('at',String(state.at));url.searchParams.set('live',state.live?'1':'0');url.searchParams.set('playing',state.playing?'1':'0');url.searchParams.set('speed',state.speed);url.searchParams.set('realistic',state.realistic?'1':'0');url.searchParams.set('sky',state.sky?'1':'0');}root.location.assign(url.href);}
 function incoming(){let query;try{query=new URL(root.location.href).searchParams;}catch{return null;}if(query.get('journey')!=='1'||!query.has('at'))return null;const stored=read();return normalize({...stored,at:Number(query.get('at')),live:query.get('live')==='1',playing:query.get('playing')==='1',speed:query.get('speed'),realistic:query.get('realistic')==='1',sky:query.get('sky')==='1'});}
 root.addEventListener?.('pageshow',event=>{if(event.persisted)root.AtlasRestoreDisplay?.(preferences(true))?.catch(()=>{});});
 root.addEventListener?.('pagehide',()=>{
  if(!root.AtlasDisplayReady||typeof document==='undefined')return;
  savePreferences({realistic:document.getElementById('earth-realistic-toggle')?.getAttribute('aria-checked')==='true',sky:document.getElementById('sky-toggle')?.getAttribute('aria-checked')==='true'});
 });
 const api={normalize,read:incoming,preferences,bind,save,goMoon:()=>navigate('moon.html'),goEarth:()=>navigate(base.pathname==='/'?'atlas':'atlas/')};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasJourney=api;
})(typeof window==='undefined'?globalThis:window);
