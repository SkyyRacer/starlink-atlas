const assert=require('node:assert/strict'),{create}=require('../static/render-budget');
const applied=[],budget=create({width:1920,height:1080,devicePixelRatio:2,apply:q=>applied.push(q)});
assert.equal(applied[0].pixelRatio,2);assert.equal(applied[0].resolutionScale,1);
let time=0;function frames(count,dt,active=true){for(let i=0;i<count;i++){time+=dt;budget.sample(time,active);}}
frames(600,1000/20);assert.equal(budget.stats.pixelRatio,2,'Slow frames must not silently blur a Retina display');
frames(1200,1000/60);frames(50,1000,false);assert.equal(applied.length,1,'Timing alone never resizes the drawing buffer');
budget.resize(3840,2160,2);assert.equal(budget.stats.pixelRatio,2,'Large monitors retain the same density');
budget.setDetailed(true);frames(200,1000/20);budget.setDetailed(false);assert.equal(budget.stats.pixelRatio,2,'Opening or closing models never changes sharpness');
budget.resize(1600,1000,1);assert.equal(budget.stats.pixelRatio,1);assert.equal(applied.at(-1).resolutionScale,1);
budget.resize(1920,1080,2);assert.equal(budget.stats.pixelRatio,2,'Moving between monitors updates actual screen density');
const high=create({devicePixelRatio:3,apply(){}});assert.equal(high.stats.pixelRatio,2,'Density above 2 is capped consistently');
assert.ok(applied.every(q=>q.resolutionScale>0&&Number.isFinite(q.resolutionScale)));
console.log('Stable rendering: slow GPUs, large screens, HD transitions and monitor density changes OK.');
