const assert=require('node:assert/strict'),{orbitConnector}=require('../static/geometry');
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const direction=(a,b)=>{const x=sub(a,b),n=Math.hypot(...x);return x.map(v=>v/n);};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
// Earth-scale coordinates and a close camera: the old straight joins had a
// visible direction discontinuity. Both new connectors share the same tangent.
const a=[6800000,-20000,-30],p=[6800000,0,0],b=[6800000,30000,-66];
const first=[0,1,.003],middle=[0,1,0],last=[0,1,-.0044];
const left=orbitConnector(a,p,first,middle),right=orbitConnector(p,b,middle,last);
assert.deepEqual(left[0],a);assert.deepEqual(left.at(-1),p);assert.deepEqual(right[0],p);assert.deepEqual(right.at(-1),b);
assert.ok(dot(direction(left[1],left[0]),direction(first,[0,0,0]))>.999999);
assert.ok(dot(direction(left.at(-1),left.at(-2)),direction(right[1],right[0]))>.999999,'No corner at the moving satellite');
assert.ok(dot(direction(right.at(-1),right.at(-2)),direction(last,[0,0,0]))>.999999);
for(const rows of [left,right])for(let i=1;i<rows.length;i++){assert.ok(rows[i].every(Number.isFinite));assert.ok(rows[i][1]>rows[i-1][1],'The connector never folds backwards');}
const still=orbitConnector(p,p,[0,0,0],[0,0,0]);assert.ok(still.flat().every(Number.isFinite));
console.log('Orbit joins: exact endpoints, Earth-scale precision, continuous tangents, no reverse fold and stationary positions OK.');
