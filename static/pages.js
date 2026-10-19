/* Separate documents for each observation page; no preferences survive navigation. */
(function(root){
 const paths={all:'/atlas',iss:'/iss',starlink:'/starlink'};
 function mode(path){return ({'/atlas':'all','/iss':'iss','/starlink':'starlink'})['/'+String(path||'').replace(/\/$/,'').split('/').pop()]||'all';}
 function url(value){const target=paths[value]||paths.all;return typeof document==='undefined'?target:new URL(target,document.baseURI).href;}
 const objects=[{mode:'iss',name:'ISS',description:'Station spatiale internationale',keywords:'station spatiale internationale international space station astronautes'}, {mode:'starlink',name:'Starlink',description:'Constellation de satellites Internet',keywords:'spacex internet constellation satellites'}];
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function search(value){const terms=normalize(value).split(/\s+/).filter(Boolean);return terms.length?objects.filter(item=>terms.every(term=>normalize(item.name+' '+item.description+' '+item.keywords).includes(term))):[];}
 function searchAction(key,results){return results.length===1&&(key==='Enter'||key==='Tab')?results[0].mode:null;}
 const api={mode,url,search,searchAction};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasPages=api;
})(typeof window!=='undefined'?window:globalThis);
