const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 const row=JSON.parse(fs.readFileSync('resources/iss-example.json'))[0],time=row.EPOCH.replace(/Z?$/,'Z'),calls=[],requests=[];
 const ctx={AtlasCollections:require('../static/constellations'),Map,Set,Date,Promise,TextEncoder,TextDecoder,self:{},Number,Error};vm.createContext(ctx);vm.runInContext(fs.readFileSync('browser/browser-worker.js','utf8'),ctx);
 ctx.jsonFile=async file=>{requests.push(file);return row;};ctx.compute=message=>{calls.push(message);return {points:[]};};
 await ctx.dispatch({op:'positions',archived:true,idValue:25544,at:time,now:time});assert.deepEqual(requests,['retired-observations/25544.json']);assert.ok(calls.some(c=>c.op==='orbits-add'&&c.target==='history'&&c.rows[0]===row));assert.ok(calls.some(c=>c.op==='positions'&&c.use_history));
 await assert.rejects(()=>ctx.dispatch({op:'positions',archived:true,idValue:8820,at:time,now:time}),/correspond/,'Reject the wrong object');await assert.rejects(()=>ctx.dispatch({op:'positions',archived:true,idValue:25544,at:'2000-01-01T00:00:00Z',now:time}),/correspond/,'Reject the wrong epoch');
 vm.runInContext("collection='kepler'",ctx);const count=requests.length;const result=await ctx.dispatch({op:'positions',at:time,now:time});assert.equal(result.points.length,0);assert.equal(requests.length,count,'Deep-space pages must not download Earth TLE archives');
 console.log('Last-observation worker: one small resource, checked identity/epoch, WASM history target and no full archive request OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
