/* Pages export only: decode losslessly compressed scientific archives.
 * Keep API requests, live data, external backups and local development unchanged.
 */
(function(root){
 'use strict';
 root.AtlasPublished=true;
 const remoteArchives={};
 const source=typeof document==='undefined'?root.location.href:document.currentScript.src;
 const base=new URL('./',source),nativeFetch=root.fetch.bind(root);
 root.fetch=async function(input,init){
  const url=new URL(typeof Request!=='undefined'&&input instanceof Request?input.url:input,typeof document==='undefined'?base:document.baseURI);
  const path=url.origin===base.origin&&url.pathname.startsWith(base.pathname)?url.pathname.slice(base.pathname.length):'';
  const method=String(init?.method||(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')).toUpperCase();
  if(method!=='GET'||! /^(ephemerides\/|solar\/history\/|mission-events\/|physical-facts\/|retired-observations\/).*\.json$/.test(path))return nativeFetch(input,init);
  const remote=remoteArchives[path];
  if(remote){const target=new URL(remote);target.search=url.search;return nativeFetch(typeof Request!=='undefined'&&input instanceof Request?new Request(target,input):target,init);}
  url.pathname+='.gz';
  const request=typeof Request!=='undefined'&&input instanceof Request?new Request(url,input):url;
  const response=await nativeFetch(request,init);
  if(!response.ok)return response;
  const headers=new Headers(response.headers);
  headers.delete('content-length');headers.delete('content-encoding');
  headers.set('content-type','application/json; charset=utf-8');
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip')),{status:response.status,statusText:response.statusText,headers});
 };
})(typeof window==='undefined'?self:window);
