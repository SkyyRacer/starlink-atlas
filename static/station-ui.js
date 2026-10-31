/* Crew and mission interfaces belong only to station documents. */
(()=>{
 if(!AtlasPages.hasCrew(AtlasPages.mode(location.pathname)))return;
 const base=new URL('./',document.currentScript.src);
 const scripts=['crew-archive.js?v=893488086004', 'iss-search.js?v=5bfbd6672026', 'iss-evas.js?v=706cf292963a', 'station-history.js?v=2ea3d5d4b125', 'iss-missions.js?v=d968e5a1424a'];
 async function load(){for(const path of scripts)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(path,base).href;script.onload=resolve;script.onerror=()=>reject(Error('Interface des missions indisponible'));document.head.append(script);});}
 load().catch(error=>{const status=document.getElementById('iss-data-status');if(status)status.textContent=error.message+' : rechargez la page pour réessayer.';});
})();
