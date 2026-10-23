/* UTC instants are kept unchanged; only browser-facing formatting is local. */
(function(root){
  const locale=()=>typeof navigator!=='undefined'?(navigator.languages?.[0]||navigator.language):undefined;
  let resolved=null,resolvedAt=0,resolvedLocale=null,resolvedOffset=null;const formatters=new Map();
  function environment(){const now=Date.now(),lang=locale(),offset=new Date().getTimezoneOffset();if(!resolved||Math.abs(now-resolvedAt)>1000||lang!==resolvedLocale||offset!==resolvedOffset){resolved=new Intl.DateTimeFormat(lang).resolvedOptions();resolvedAt=now;resolvedLocale=lang;resolvedOffset=offset;}return resolved;}
  function formatter(options){const lang=locale(),zone=options.timeZone||environment().timeZone,key=lang+'|'+zone+'|'+JSON.stringify(options);let value=formatters.get(key);if(!value){if(formatters.size>=16)formatters.delete(formatters.keys().next().value);value=new Intl.DateTimeFormat(lang,{...options,timeZone:zone});formatters.set(key,value);}return value;}
  function zoneLabel(value){const minutes=-new Date(value).getTimezoneOffset();if(!minutes)return 'UTC';return `UTC${minutes<0?'−':'+'}${String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')}:${String(Math.abs(minutes)%60).padStart(2,'0')}`;}
  function instant(value){if(value===null||value===undefined||value==='')return 'Non renseignée';const normalized=typeof value==='string'&&value.includes('T')&&!/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)?value+'Z':value;const date=new Date(normalized);if(!Number.isFinite(date.getTime()))return 'Non renseignée';return formatter({dateStyle:'medium',timeStyle:'medium'}).format(date)+' · '+zoneLabel(date);}
  function event(value){if(!value)return 'Non renseignée';if(/^\d{4}-\d{2}-\d{2}$/.test(value))return formatter({dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'))+' · jour UTC, heure non fournie';return instant(value);}
  function input(value){const d=new Date(value),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  function parseInput(value){const time=new Date(value).getTime();if(!Number.isFinite(time)||input(time)!==value)return {time:NaN,ambiguous:false};const ambiguous=[-120,-90,-60,-30,30,60,90,120].some(m=>input(time+m*60000)===value);return {time,ambiguous};}
  const api={environment,zoneLabel,instant,event,input,parseInput};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasTime=api;
})(typeof window!=='undefined'?window:this);
