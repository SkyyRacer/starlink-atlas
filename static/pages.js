/* Separate documents for each observation page; no preferences survive navigation. */
(function(root){
 const paths={all:'/atlas',galileo:'/galileo',gps:'/gps',iss:'/iss',starlink:'/starlink'};
 function mode(path){return ({'/atlas':'all','/galileo':'galileo','/gps':'gps','/iss':'iss','/starlink':'starlink'})['/'+String(path||'').replace(/\/$/,'').split('/').pop()]||'all';}
 function url(value){const target=paths[value]||paths.all;return typeof document==='undefined'?target:new URL(target,document.baseURI).href;}
 const objects=[{mode:'all',name:'Tous les satellites',description:'Vue globale Atlas',keywords:'atlas ensemble tous toutes objets'},{mode:'galileo',name:'Galileo',description:'Constellation européenne de navigation',keywords:'gnss europe navigation positionnement gsat satellites'},{mode:'gps',name:'GPS',description:'Constellation américaine de navigation',keywords:'navstar global positioning system gnss americain etats unis satellites'},{mode:'iss',name:'ISS',description:'Station spatiale internationale',keywords:'station spatiale internationale international space station astronautes'}, {mode:'starlink',name:'Starlink',description:'Constellation de satellites Internet',keywords:'spacex internet constellation satellites'}];
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function search(value){const terms=normalize(value).split(/\s+/).filter(Boolean);return terms.length?objects.filter(item=>terms.every(term=>normalize(item.name+' '+item.description+' '+item.keywords).includes(term))):[];}
 function searchAction(key,results){return results.length===1&&(key==='Enter'||key==='Tab')?results[0].mode:null;}
 function family(s){if(s.id===25544)return 'iss';if(s.family)return s.family;if(/^(?:GPS (?:B|III)|NAVSTAR \d)/.test(s.name||s.OBJECT_NAME||''))return 'gps';return /^(?:GSAT\d{4}(?:\s|\(|$)|GIOVE-[AB]|GALILEO(?:[ -]|$))/.test(s.name||s.OBJECT_NAME||'')?'galileo':'starlink';}
 const api={mode,url,search,searchAction,family};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasPages=api;
})(typeof window!=='undefined'?window:globalThis);
