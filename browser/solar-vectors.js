/* Static Pages replacement for the local /api/solar-vectors endpoint.
 * Only use published JPL samples inside their actual time bounds.
 */
(function(root){
 const base=new URL('./',document.currentScript.src),readFetch=root.fetch.bind(root),files=new Map();
 function json(path){if(!files.has(path))files.set(path,(async()=>{const response=await readFetch(new URL(path,base));if(!response.ok)throw Error('Archive indisponible');return path.endsWith('.gz')?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json():response.json();})().catch(error=>{files.delete(path);throw error;}));return files.get(path);}
 root.fetch=async function(input,init){
  const url=new URL(input instanceof Request?input.url:input,document.baseURI);
  if(init?.signal?.aborted)throw init.signal.reason;
  if((init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()!=='GET')return readFetch(input,init);
  if(url.origin!==base.origin||url.pathname!==base.pathname+'api/solar-vectors')return readFetch(input,init);
  const id=Number(url.searchParams.get('id')),at=Number(url.searchParams.get('at'));
  if(!Number.isSafeInteger(id)||!Number.isFinite(at)||!url.searchParams.has('at'))return Response.json({error:'Corps ou date invalide'},{status:400});
  for(const indexPath of ['solar/vectors/index.json','solar/history/index.json']){
   try{
    const index=await json(indexPath),entries=Object.values(index.bodies?.[id]||{});
    const entry=entries.find(row=>at>=row.first_epoch&&at<=row.last_epoch);
    if(!entry)continue;
    const data=await json(entry.file),rows=data.samples;
    if(data.id===id&&data.frame==='ICRF'&&data.origin===399&&data.time_scale==='UTC'&&rows?.length&&at>=rows[0][0]&&at<=rows.at(-1)[0])return Response.json(data);
   }catch{ /* Try the independent historical source without inventing positions. */ }
  }
  return Response.json({error:'Aucune éphéméride publiée ne couvre cette date.'},{status:404});
 };
})(window);
