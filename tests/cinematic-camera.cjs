const assert=require('node:assert/strict'),math=require('../static/solar-math.js');
const radius=6378.137,body={position:[0,0,0],radius},dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
for(let i=0;i<720;i++){
 const angle=i*Math.PI/180,position=[(radius+500)*Math.cos(angle),(radius+500)*Math.sin(angle),50],original=position.slice(),radial=position.map(v=>v/Math.hypot(...position));
 const view=math.safeFollowView(position,radial.map(v=>-v),radius*3,[body]);assert.deepEqual(position,original);assert.ok(view.range>=radius*3);assert.ok(dot(view.direction,radial)>=.119,'The camera stays in the spacecraft-facing hemisphere');
 const camera=position.map((v,j)=>v+view.direction[j]*view.range),delta=position.map((v,j)=>camera[j]-v),u=Math.max(0,Math.min(1,-dot(position,delta)/dot(delta,delta))),closest=Math.hypot(...position.map((v,j)=>v+u*delta[j]));assert.ok(closest>radius,'Earth cannot occult the followed spacecraft');assert.ok(Math.hypot(...camera)>radius*1.06,'The camera cannot enter the planetary surface');
}
const back=math.safeFollowView([100000,0,0],[-1,0,0],300000,[body]);const projection=-dot([100000,0,0],back.direction),closest=Math.hypot(...[100000,0,0].map((v,i)=>v+back.direction[i]*projection));assert.ok(closest>radius,'Distant occultations are also avoided');
console.log('Cinematic camera: 720 planetary approach angles, no occultation or surface entry, wider limb framing and unchanged ephemerides OK');

const before=math.safeFollowView([radius*1.06*15.1,0,0],[-1,0,0],radius*100,[body]),after=math.safeFollowView([radius*1.06*14.9,0,0],[-1,0,0],radius*100,[body]);assert.ok(dot(before.direction,after.direction)>.999,'Entering the planetary camera zone does not trigger a sudden 90-degree rotation');
