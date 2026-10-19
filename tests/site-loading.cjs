const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
(async()=>{
 for(const [root,routes] of [['http://127.0.0.1:3002/', ['atlas',...require('../static/pages.js').definitions.map(row=>row.id)]],['http://127.0.0.1:3004/starlink-atlas/', ['atlas/',...require('../static/pages.js').definitions.map(row=>row.id+'/')]]]){
  for(const route of routes){
   const page=new URL(route,root),response=await fetch(page,{cache:'no-store'});assert.equal(response.status,200);
   if(page.port==='3002')assert.equal(response.headers.get('cache-control'),'no-store');
   const html=await response.text(),base=new URL(html.match(/<base href="([^"]+)"/)?.[1]||page.href,page);
   const src=html.match(/<script src="([^"]*loading.js[^\"]*)"/)[1],script=await fetch(new URL(src,base),{cache:'no-store'});assert.equal(script.status,200);
   if(page.port==='3002')assert.equal(script.headers.get('cache-control'),'no-store');
   const code=await script.text(),hash=crypto.createHash('sha256').update(code).digest('hex').slice(0,12);assert.ok(src.includes(hash));
   const context={module:{exports:{}},globalThis:{}};vm.runInNewContext(code,context);
   let time=1000,callback,values=[];const loading=context.module.exports.create({now:()=>time,render:v=>values.push(v),close(){},frame:fn=>{callback=fn;return 1;},cancelFrame(){},later(){}});
   for(const phase of ['catalog','scene','config','positions']){loading.done(phase);callback(time-300);time+=30;callback(time-400);}
   time+=200;callback(0);assert.equal(values.at(-1),100);assert.ok(values.every((v,i)=>v>=0&&v<=100&&(!i||v>=values[i-1])));
   assert.ok(!html.includes('Chargement du catalogue…'));console.log(page.pathname+' : version '+hash+', 0–100 sans valeurs négatives OK');
  }
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
