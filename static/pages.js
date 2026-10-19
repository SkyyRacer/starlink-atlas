/* Separate documents for each observation page; no preferences survive navigation. */
(function(root){
 const paths={all:'/atlas',iss:'/iss',starlink:'/starlink'};
 function mode(path){return ({'/atlas':'all','/iss':'iss','/starlink':'starlink'})['/'+String(path||'').replace(/\/$/,'').split('/').pop()]||'all';}
 function url(value){const target=paths[value]||paths.all;return typeof document==='undefined'?target:new URL(target,document.baseURI).href;}
 const api={mode,url};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasPages=api;
})(typeof window!=='undefined'?window:globalThis);
