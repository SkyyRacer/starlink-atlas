const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const bodies={10:{'2026':{first_epoch:100,last_epoch:200,file:'solar/history/10/2026.json'}}};
 const data={id:10,origin:399,frame:'ICRF',time_scale:'UTC',samples:[[100,1,2,3,0,0,0],[200,2,3,4,0,0,0]]};
 const calls=[],window={fetch:async input=>{const url=new URL(String(input));calls.push(url.href);if(url.pathname.endsWith('solar/vectors/index.json'))return Response.json({bodies:{}});if(url.pathname.endsWith('solar/history/index.json'))return Response.json({bodies});if(url.pathname.endsWith('2026.json'))return Response.json(data);return new Response('other');}};
 vm.runInNewContext(fs.readFileSync('browser/solar-vectors.js','utf8'),{window,document:{currentScript:{src:'https://example.test/starlink-atlas/solar-vectors.js'},baseURI:'https://example.test/starlink-atlas/'},URL,Request,Response,DecompressionStream,Map});
 const response=await window.fetch('https://example.test/starlink-atlas/api/solar-vectors?id=10&at=150');assert.equal(response.status,200);assert.deepEqual(await response.json(),data);
 const n=calls.length;await window.fetch('https://example.test/starlink-atlas/api/solar-vectors?id=10&at=160');assert.equal(calls.length,n,'reuse immutable published samples');
 assert.equal((await window.fetch('https://example.test/starlink-atlas/api/solar-vectors?id=10&at=201')).status,404,'never extrapolate');
 assert.equal((await window.fetch('https://example.test/starlink-atlas/api/solar-vectors?id=10')).status,400);
 assert.equal(await (await window.fetch('https://elsewhere.test/api/solar-vectors?id=10&at=150')).text(),'other');
 console.log('Published planets: static JPL fallback, bounded dates, caching and API isolation OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
