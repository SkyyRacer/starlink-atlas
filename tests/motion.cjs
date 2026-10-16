const assert=require('node:assert/strict');require('../static/motion.js');
const motion=new SatelliteMotion();const point=(id,lat,lon,altitude_km)=>({id,lat,lon,altitude_km});
motion.set([point(1,10,179,500)],0,false);
motion.set([point(1,12,-179,510),point(2,0,0,400)],1000,true);
const half=motion.sample(1500);assert.equal(half[0].lat,11);assert.equal(half[0].lon,-180);assert.equal(half[0].altitude_km,505);assert.equal(half[1].altitude_km,400);
assert.equal(motion.sample(2000)[0].lon,-179);assert.equal(motion.active,false);
motion.set([point(1,14,-175,510)],3000,true);const before=motion.sample(3250)[0].lon;
motion.set([point(1,15,-173,510)],3250,true);assert.equal(motion.sample(3250)[0].lon,before,'new samples must continue from displayed position');
motion.set([point(1,50,80,500)],3300,false);assert.equal(motion.sample(3300)[0].lat,50,'date changes and pause snap immediately');assert.equal(motion.active,false);
motion.set([],3400,false);assert.equal(motion.sample(3400).length,0,'no invented positions when archives are missing');
const sweep=new SatelliteMotion();sweep.set([point(3,0,0,500)],0,false);sweep.set([point(3,1,1,500)],1000,true);let last=-1;for(let t=1000;t<=2000;t+=20){const value=sweep.sample(t)[0].lat;assert.ok(value>last);if(last>=0)assert.ok(value-last<.021,'movement must advance in small frame steps');last=value;}
console.log('Interpolation continue, changement de date et passage ±180° : OK');
