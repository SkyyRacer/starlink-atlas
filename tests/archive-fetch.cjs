const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),path=require('node:path');
(async()=>{
 const calls=[],source=Buffer.from('{"id":-32,"samples":[[1,1.2345678901234567,2,3]]}');
 const window={fetch:async(input,init)=>{
  const url=String(input instanceof Request?input.url:input);calls.push({url,input,init});
  if(url.includes('missing'))return new Response('missing',{status:404});
  return new Response(url.includes('.json.gz')?zlib.gzipSync(source):source,{headers:{'content-type':'application/octet-stream','content-length':'99'}});
 }};
 const document={currentScript:{src:'https://example.test/starlink-atlas/archive-fetch.js?v=edition'},baseURI:'https://example.test/starlink-atlas/'};
 vm.runInNewContext(fs.readFileSync('browser/archive-fetch.js','utf8'),{window,document,URL,Request,Response,Headers,DecompressionStream});
 for(const path of ['ephemerides/voyager-2/1977.json?v=123','solar/history/399/1977.json','mission-events/catalog.json','physical-facts/starlink.json','retired-observations/1.json']){
  const controller=new AbortController(),response=await window.fetch(path,{signal:controller.signal,cache:'reload'});
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),source,'all precision and samples preserved');
  assert.match(calls.at(-1).url,/\.json\.gz(?:\?v=123)?$/);assert.equal(calls.at(-1).init.signal,controller.signal);
  assert.equal(response.headers.get('content-length'),null);assert.match(response.headers.get('content-type'),/application\/json/);
 }
 const req=new Request('https://example.test/starlink-atlas/ephemerides/ace-index.json',{cache:'no-cache',headers:{'x-test':'retained'}});
 assert.equal((await (await window.fetch(req)).json()).id,-32);assert.equal(calls.at(-1).input.headers.get('x-test'),'retained');assert.equal(calls.at(-1).input.cache,'no-cache');
 for(const path of ['api/solar-vectors?id=399','edition.json','data/archive.json.gz','https://backup.test/ephemerides/ace.json','https://example.test/other/ephemerides/ace.json']){
  await window.fetch(path);assert.equal(calls.at(-1).input,path,'unrelated requests pass through unchanged');
 }
 assert.equal((await window.fetch('ephemerides/missing.json')).status,404);
 await window.fetch('ephemerides/ace.json',{method:'POST'});assert.equal(calls.at(-1).url,'ephemerides/ace.json');
 if(process.argv[2]){
  const root=process.argv[2];let count=0;
  for(const folder of ['ephemerides','solar/history','mission-events','physical-facts','retired-observations']){
   for(const name of fs.readdirSync(path.join('static',folder),{recursive:true})){
    if(!name.endsWith('.json'))continue;
    const relative=path.join(folder,name),original=fs.readFileSync(path.join('static',relative));
    assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(root,relative+'.gz'))),original,relative);
    assert.ok(!fs.existsSync(path.join(root,relative)),'no duplicate uncompressed export');count++;
   }
  }
  for(const name of ['index.html','atlas/index.html','mir/index.html','moon.html']){
   const html=fs.readFileSync(path.join(root,name),'utf8');assert.match(html,/<head>(?:<base[^>]*>)?<script src="\.\/archive-fetch\.js\?v=/,'decoder precedes consumers: '+name);
  }
  console.log(count+' exported archives byte-for-byte identical after decompression');
 }
 console.log('Compressed publication archives: lossless decode, Pages subpaths, queries, request options and backup isolation OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
