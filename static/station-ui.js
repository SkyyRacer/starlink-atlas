/* Crew and mission interfaces belong only to station documents. */
(()=>{
 if(!AtlasPages.isStation(AtlasPages.mode(location.pathname)))return;
 const base=new URL('./',document.currentScript.src);
 const scripts=['iss-search.js?v=497eb1438081', 'iss-evas.js?v=706cf292963a', 'station-history.js?v=1adaa5bf05c2', 'iss-missions.js?v=b2d931abe925'];
 async function load(){for(const path of scripts)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(path,base).href;script.onload=resolve;script.onerror=()=>reject(Error('Interface des missions indisponible'));document.head.append(script);});}
 load().catch(error=>{const status=document.getElementById('iss-data-status');if(status)status.textContent=error.message+' : rechargez la page pour réessayer.';});
})();
