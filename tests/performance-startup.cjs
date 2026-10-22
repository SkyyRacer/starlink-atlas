const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
(async()=>{
 const loader=fs.readFileSync('static/station-ui.js','utf8');
 for(const mode of ['all','starlink','debris','iss','tiangong']){
  const requests=[],ctx={AtlasPages:{mode:()=>mode,isStation:s=>['iss','tiangong'].includes(s)},location:{pathname:'/'+mode},URL,document:{currentScript:{src:'https://example.test/starlink-atlas/station-ui.js'},createElement:()=>({}),head:{append(script){requests.push(script.src);queueMicrotask(()=>script.onload());}}}};
  vm.runInNewContext(loader,ctx);await new Promise(r=>setImmediate(r));assert.equal(requests.length,['iss','tiangong'].includes(mode)?4:0);
  if(requests.length)assert.deepEqual(requests.map(url=>new URL(url).pathname),['iss-search.js','iss-evas.js','station-history.js','iss-missions.js'].map(file=>'/starlink-atlas/'+file));
 }
 const html=fs.readFileSync('static/index.html','utf8'),{document}=parseHTML(html),early=document.body.querySelector('script');
 const classes=new Set();vm.runInNewContext(early.textContent,{matchMedia:()=>({matches:true}),document:{body:{classList:{add:c=>classes.add(c)}}}});assert.ok(classes.has('earth-workspace'),'The desktop layout applies before sidebar content is painted');
 assert.ok(!document.querySelector('script[src*="iss-missions.js"]'),'Station-only code is absent from the eager script list');
 const moon=parseHTML(fs.readFileSync('static/moon.html','utf8')).document;
 assert.equal(moon.querySelector('.catalog-percentage').outerHTML,document.querySelector('.catalog-percentage').outerHTML,'Earth and Moon share the percentage markup');
 assert.ok(!/\.lunar-page \.catalog-(?:percentage|progress|loader)[{\[]/.test(fs.readFileSync('static/lunar-page.css','utf8')),'Lunar progress inherits the common styles');
 const app=fs.readFileSync('static/app.js','utf8'),piece=app.slice(app.indexOf('const size=map.getSize(),dpr='),app.indexOf('hit=[];const nw=screen'));
 let allocations=0,clears=0,width=0,height=0,size={x:800,y:600};const canvas={style:{},get width(){return width;},set width(v){width=v;allocations++;},get height(){return height;},set height(v){height=v;allocations++;}};
 const context={canvas,overscan:160,devicePixelRatio:3,Math,map:{getSize:()=>size,containerPointToLayerPoint:()=>({})},L:{DomUtil:{setPosition(){}}},ctx:{setTransform(){},clearRect(){clears++;}}};
 const draw=()=>vm.runInNewContext('{'+piece+'}',context);draw();assert.equal(allocations,2);for(let i=0;i<60;i++)draw();assert.equal(allocations,2,'Animation keeps the same canvas backing store');assert.equal(clears,61);assert.equal(width,(800+320)*2,'High DPR is capped at two');size={x:900,y:600};draw();assert.equal(allocations,4,'Resizing still reallocates the backing store');
 console.log('Startup: no station scripts outside stations, desktop layout before paint, shared lunar loader, stable canvas memory and DPR cap OK.');
})().catch(error=>{console.error(error);process.exitCode=1;});
