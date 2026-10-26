/* Separate documents for each observation page; no preferences survive navigation. */
(function(root){
 const registry=typeof module!=='undefined'&&module.exports?require('./constellations.js'):root.AtlasCollections;
 const definitions=registry.definitions;
 const routeRoot='/';
 const route=id=>routeRoot+id+(routeRoot==='/'?'':'/');
 const paths=Object.fromEntries([['all',route('atlas')],...definitions.map(row=>[row.id,route(row.id)])]);
 function mode(path){const key=String(path||'').replace(/\/$/,'').split('/').pop();return registry.byId.has(key)?key:'all';}
 function url(value){const target=paths[value]||paths.all;return typeof document==='undefined'?target:new URL(target,document.baseURI).href;}
 const objects=[{mode:'all',name:'Tous les objets',description:'Vue globale Atlas',keywords:'atlas ensemble tous toutes objets'},...definitions.map(row=>({mode:row.id,name:row.label,description:row.description,keywords:row.keywords}))];
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const order=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
 const groupNames=objects.map(item=>({item,names:[item.name,...item.name.split(' / '),...(item.mode==='all'?['Atlas','Tous les satellites']:item.mode==='gps'?['NAVSTAR','Global Positioning System']:[])].map(normalize)})).sort((a,b)=>order.compare(a.item.name,b.item.name));
 const satelliteIndexes=new WeakMap();
 function search(value,satellites=[]){
  const query=normalize(value);if(!query)return [];
  const groupsFirst=groupNames.filter(row=>row.names.some(name=>name.startsWith(query))).map(row=>row.item);
  const groupsLater=groupNames.filter(row=>!row.names.some(name=>name.startsWith(query))&&normalize(row.item.name).includes(query)).map(row=>row.item);
  const cached=satelliteIndexes.get(satellites);let index=cached?.length===satellites.length?cached.index:null;
  if(!index){const ids=new Set();index=satellites.filter(s=>s.name&&Number.isSafeInteger(s.id)&&!ids.has(s.id)&&ids.add(s.id)).map(s=>({satellite:s,name:normalize(s.name)})).sort((a,b)=>order.compare(a.satellite.name,b.satellite.name)||a.satellite.id-b.satellite.id);satelliteIndexes.set(satellites,{length:satellites.length,index});}
  const first=[],later=[];
  for(const row of index){
   if(!row.name.includes(query))continue;
   const matches=row.name.startsWith(query)?first:later;if(matches.length>=100)continue;
   const s=row.satellite,mode=family(s);if(!mode)continue;matches.push({mode,name:s.name,description:'Satellite · NORAD '+s.id,satellite:s});
   if(first.length>=100)break;
  }
  return [...groupsFirst,...first,...groupsLater,...later.slice(0,100-first.length)];
 }
 function searchAction(key,results){return results.length===1&&(key==='Enter'||key==='Tab')?results[0].mode:null;}
 function family(s){return registry.family(s)||'starlink';}
 function satelliteUrl(s,at=null){
  const query=new URLSearchParams({satellite:String(s.id),view:'3d'});
  if(Number.isFinite(at))query.set('at',new Date(at).toISOString());
  return url(family(s))+'?'+query;
 }
 function satelliteLink(search,now=Date.now()){
  const query=new URLSearchParams(search||''),id=Number(query.get('satellite'));
  if(!Number.isSafeInteger(id)||id<=0||query.get('view')!=='3d')return null;
  const value=query.get('at'),time=value?Date.parse(value):NaN;
  return {id,at:Number.isFinite(time)&&time<=now?time:null};
 }
 const api={satelliteUrl,satelliteLink,mode,url,search,searchAction,family,memberships:registry.memberships,belongs:registry.belongs,displayFamily:registry.displayFamily,definitions,definition:id=>registry.byId.get(id),isStation:id=>Boolean(registry.byId.get(id)?.station_id),hasCrew:id=>registry.byId.get(id)?.category==='stations',station:id=>registry.byId.get(id)?.station_id,isConstellation:id=>registry.byId.has(id)&&registry.byId.get(id).category!=='stations',hasLocalHistory:id=>id!=='iss'&&id!=='starlink'&&registry.byId.has(id)};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasPages=api;
})(globalThis);
