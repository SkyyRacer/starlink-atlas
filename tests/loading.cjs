const assert=require('node:assert/strict'),{create}=require('../static/loading.js');
let time=0,frames=new Map(),later=[],serial=0,values=[],closed=[];
const loader=create({now:()=>time,render:value=>values.push(value),close:error=>closed.push(error),frame:fn=>{frames.set(++serial,fn);return serial;},cancelFrame:id=>frames.delete(id),later:fn=>later.push(fn)});
function advance(ms){time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));}
loader.done('config');advance(160);assert.equal(values.at(-1),10);assert.equal(closed.length,0);
loader.done('catalog');advance(160);assert.equal(values.at(-1),55);
loader.done('catalog');advance(160);assert.equal(values.at(-1),55,'duplicate completions must not inflate progress');
loader.done('scene');advance(160);assert.equal(values.at(-1),80);assert.equal(later.length,0,'no 100% while positions are unavailable');
loader.done('positions');advance(160);assert.equal(values.at(-1),100);later.shift()();assert.deepEqual(closed,[false]);
loader.retry();advance(160);assert.equal(values.at(-1),35,'reuse the already completed rendering and configuration');
loader.fail();assert.deepEqual(closed,[false,true]);loader.retry();loader.done('catalog');loader.done('positions');advance(160);later.shift()();assert.equal(closed.at(-1),false);
assert.ok(values.every(value=>value>=0&&value<=100));
console.log('Progression : étapes réellement terminées, 100% après positions + scène, erreur libératrice et nouvelle tentative OK');

// A RAF timestamp describes the start of the frame. A phase can finish later
// in that same frame, so its start time may be newer than this timestamp.
let clock=1000,callback,reported=[];
const skewed=create({now:()=>clock,render:value=>reported.push(value),close(){},frame:fn=>{callback=fn;return 1;},cancelFrame(){},later(){}});
skewed.done('catalog');callback(700);
assert.equal(reported.at(-1),0,'an older frame timestamp must never produce a negative percentage');
clock+=80;callback(700);const midway=reported.at(-1);assert.ok(midway>0&&midway<45);
clock+=10;skewed.done('scene');callback(500);assert.ok(reported.at(-1)>=midway,'a new phase must not make progress move backwards');
clock+=200;callback(600);assert.equal(reported.at(-1),70);
assert.ok(reported.every(value=>Number.isFinite(value)&&value>=0&&value<=100));
console.log('Horodatage RAF ancien : progression bornée à 0–100 et toujours croissante OK');
