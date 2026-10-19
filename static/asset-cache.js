/* Shared downloads across full page navigations; never cache the current data edition. */
(function(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 const base=new URL('./',document.currentScript.src);
 const warm=registration=>{
  const send=()=>{const urls=new Set([...document.querySelectorAll('script[src],link[rel="stylesheet"]')].map(el=>el.src||el.href));for(const item of performance.getEntriesByType('resource'))urls.add(item.name);(navigator.serviceWorker.controller||registration.active)?.postMessage({type:'warm-assets',urls:[...urls]});};
  if(document.readyState==='complete')send();else window.addEventListener('load',send,{once:true});
 };
 navigator.serviceWorker.register(new URL('asset-sw.js',base),{scope:base.pathname,updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(warm).catch(()=>{/* Normal browser HTTP caching remains available. */});
})();
