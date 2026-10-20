/* Separate documents for each observation page; no preferences survive navigation. */
(function(root){
 const registry=typeof module!=='undefined'&&module.exports?require('./constellations.js'):root.AtlasCollections;
 const definitions=registry.definitions;
 const routeRoot='/';
 const route=id=>routeRoot+id+(routeRoot==='/'?'':'/');
 const paths=Object.fromEntries([['all',route('atlas')],...definitions.map(row=>[row.id,route(row.id)])]);
 function mode(path){const key=String(path||'').replace(/\/$/,'').split('/').pop();return registry.byId.has(key)?key:'all';}
 function url(value){const target=paths[value]||paths.all;return typeof document==='undefined'?target:new URL(target,document.baseURI).href;}
 const objects=[{mode:'all',name:'Tous les satellites',description:'Vue globale Atlas',keywords:'atlas ensemble tous toutes objets'},...definitions.map(row=>({mode:row.id,name:row.label,description:row.description,keywords:row.keywords}))];
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function search(value){const exact=objects.filter(item=>normalize(item.name)===normalize(value));if(exact.length)return exact;const terms=normalize(value).split(/\s+/).filter(Boolean);return terms.length?objects.filter(item=>terms.every(term=>normalize(item.name+' '+item.description+' '+item.keywords).includes(term))):[];}
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
 const api={satelliteUrl,satelliteLink,mode,url,search,searchAction,family,memberships:registry.memberships,belongs:registry.belongs,displayFamily:registry.displayFamily,definitions,definition:id=>registry.byId.get(id),isStation:id=>Boolean(registry.byId.get(id)?.station_id),station:id=>registry.byId.get(id)?.station_id,isConstellation:id=>registry.byId.has(id)&&!registry.byId.get(id).station_id,hasLocalHistory:id=>id!=='iss'&&id!=='starlink'&&registry.byId.has(id)};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasPages=api;
})(globalThis);
