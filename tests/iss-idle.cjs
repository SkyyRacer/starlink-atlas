const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('static/globe.js','utf8'),ctx);const globe=ctx.window.AtlasGlobe;
let time=0,allowed=true,started=0,stopped=0;
const idle=globe.idleController({now:()=>time,canStart:()=>allowed,start:()=>started++,stop:()=>stopped++});
time=9999;idle.tick();assert.equal(started,0);time=10000;idle.tick();assert.equal(started,1);assert.equal(idle.active,true);
time=12000;idle.activity();idle.tick();assert.equal(started,1);assert.equal(idle.active,true,'mouse movement does not release the idle follow');
assert.equal(idle.cancel(),true);assert.equal(stopped,1);assert.equal(idle.active,false);
time=21999;idle.tick();assert.equal(started,1);time=22000;idle.tick();assert.equal(started,2,'follow restarts only after another ten idle seconds');
idle.cancel();allowed=false;time=50000;idle.tick();assert.equal(started,2,'no follow on another collection, hidden page, dialog, held pointer or inactive view');
allowed=true;idle.activity();time+=9999;idle.tick();assert.equal(started,2);time++;idle.tick();assert.equal(started,3);
const close=globe.lighting(1000000,7378137,10000000,20000000),far=globe.lighting(30000000,36378137,10000000,20000000);
assert.equal(close.shadow,.3);assert.equal(close.fadeIn,20000000);assert.ok(far.shadow>.3&&far.shadow<=.42);assert.ok(far.fadeIn>20000000);
let previous=.3;for(let height=5000000;height<=30000000;height+=500000){const next=globe.lighting(height,height+6378137,10000000,20000000).shadow;assert.ok(next>=previous);previous=next;}
console.log('ISS : délai de dix secondes, activité, clic pour libérer, réarmement, vues exclues ; éclairage nocturne progressif sans changement à proximité OK');
