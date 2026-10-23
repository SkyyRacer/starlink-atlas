const assert=require('node:assert/strict'),{create}=require('../static/render-budget');
const applied=[],budget=create({width:1920,height:1080,devicePixelRatio:2,apply:q=>applied.push(q)});
assert.equal(applied[0].pixelRatio,1);assert.equal(applied[0].resolutionScale,.5,'Retina starts at one rendered pixel per CSS pixel');
let time=0;function frames(count,dt,active=true){for(let i=0;i<count;i++){time+=dt;budget.sample(time,active);}}
frames(150,1000/30);assert.ok(budget.stats.pixelRatio<=.6,'Sustained slow rendering reduces pixel work');assert.ok(budget.stats.pixelRatio>=.55);
const low=budget.stats.pixelRatio;frames(1200,1000/60);assert.ok(budget.stats.pixelRatio>low,'Sustained headroom gradually restores detail');assert.ok(budget.stats.pixelRatio<=1.5);
const stable=budget.stats.pixelRatio;frames(50,1000,false);assert.equal(budget.stats.pixelRatio,stable,'Paused views and background tabs are not mistaken for low FPS');
budget.resize(3840,2160,2);assert.ok(budget.stats.pixelRatio<.6,'Large displays get a bounded initial pixel workload');assert.ok(applied.every(q=>q.resolutionScale>0&&Number.isFinite(q.resolutionScale)));
const phone=create({width:390,height:700,devicePixelRatio:3,apply(){}});assert.equal(phone.stats.pixelRatio,1);
console.log('Adaptive render budget: Retina workload, slow and fast devices, recovery, paused views, resizing and resolution bounds OK.');
