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
 const api={mode,url,search,searchAction,family,memberships:registry.memberships,belongs:registry.belongs,displayFamily:registry.displayFamily,definitions,definition:id=>registry.byId.get(id),isConstellation:id=>id!=='iss'&&registry.byId.has(id),hasLocalHistory:id=>id!=='iss'&&id!=='starlink'&&registry.byId.has(id)};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasPages=api;
})(globalThis);
