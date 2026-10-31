const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../static/solar-math.js'),catalog=require('../static/solar/catalog.json');
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),length=a=>Math.hypot(...a);
// One AU circular state reconstructs its physical orbit, without arbitrary scaling.
const earth=[M.AU,0,0],velocity=[0,Math.sqrt(M.MU/M.AU),0],orbit=M.conic(earth,velocity);assert.ok(orbit.eccentricity<1e-12);assert.ok(orbit.points.every(p=>Math.abs(length(p)-M.AU)<1e-6));
const escape=M.conic(earth,[0,50,0]);assert.ok(escape.eccentricity>1);assert.ok(escape.points.every(p=>p.every(Number.isFinite)&&length(p)<=300*M.AU*1.001));
assert.equal(M.nearBody([M.AU,0,0],earth,[0,0,0],399),true);assert.equal(M.nearBody([M.AU+1e7,0,0],earth,[0,0,0],399),false,'A far spacecraft cannot appear close simply because its marker projects onto Earth');assert.equal(M.nearBody([M.AU,0,0],[0,0,0],[0,0,0],10),false);
for(const body of catalog.bodies.filter(b=>b.kind==='planet')){const axes=M.axes(body,Date.parse('2026-10-27T12:00:00Z'));for(const axis of axes)assert.ok(Math.abs(length(axis)-1)<1e-12);const sunlight=M.sunDirection([4,5,6],[-3,-2,8]),local=axes.map(a=>dot(a,sunlight)),world=[0,1,2].map(i=>axes.reduce((s,a,j)=>s+a[i]*local[j],0));assert.ok(dot(world,sunlight)>1-1e-12,'Body rotation preserves the actual solar direction on '+body.name);assert.ok(dot(world.map(x=>-x),sunlight)<-1+1e-12);}
const input={samples:[[0,0,0,0,1,2,3],[10,10,20,30,1,2,3]],max_interval_seconds:10};assert.deepEqual(M.state(input,5000),{position:[5,10,15],velocity:[1,2,3]});assert.equal(M.state(input,-1),null);
const manifest=require('../static/solar/moon-surfaces.json');for(const [id,entry] of Object.entries(manifest.bodies)){assert.ok(catalog.bodies.some(b=>b.id===Number(id)&&b.radii_km));assert.ok(fs.existsSync('static/'+entry.path));assert.ok(entry.width>0&&entry.height>0);assert.equal(entry.longitude_offset,.5);}
assert.equal(M.occultation(1,2,0),1,'Total eclipse');assert.equal(M.occultation(1,.5,0),.25,'Annular eclipse blocks only the correct fraction');assert.equal(M.occultation(1,1,3),0,'No overlap');assert.ok(M.occultation(1,1,1)>0&&M.occultation(1,1,1)<1,'Partial eclipse');
console.log('Solar physics: reference-frame illumination, real neighbourhoods, bounded states, elliptic/hyperbolic orbits and sourced moon surfaces OK');
// Cursor anchoring preserves the projection of a world point at any depth.
for(const [width,height] of [[1200,800],[2560,1080],[900,1200]])for(const after of [500,1800]){
 const before=1000,fovy=Math.PI/3,tan=Math.tan(fovy/2),pan=[43,-27],x=width*.82,y=height*.24,depth=2500,delta=before-after;
 const anchor=[pan[0]+(2*x/width-1)*depth*tan*width/height,pan[1]+(1-2*y/height)*depth*tan],next=M.zoomPan(pan,before,after,x,y,width,height,fovy);
 const projected=[((anchor[0]-next[0])/((depth-delta)*tan*width/height)+1)*width/2,(1-(anchor[1]-next[1])/((depth-delta)*tan))*height/2];
 assert.ok(Math.abs(projected[0]-x)<1e-9&&Math.abs(projected[1]-y)<1e-9,'Zoom-in and zoom-out keep the pointer target fixed');
}
const label=(key,priority,distance,x=0)=>({key,priority,distance,left:x,right:x+90,top:0,bottom:24});
assert.deepEqual(M.visibleLabels([label('earth',1,10),label('neptune',1,100),label('probe',3,5)]),['probe'],'Observed spacecraft wins overlaps');
assert.deepEqual(M.visibleLabels([label('earth',1,10),label('neptune',1,100)]),['neptune'],'Farthest planet wins planetary overlaps');
assert.deepEqual(M.visibleLabels([label('earth',1,10),label('neptune',1,100,120),label('probe',3,5,240)]),['probe','neptune','earth'],'Zoom or rotation separates the labels and restores them all');
console.log('Pointer-anchored zoom and reversible name collision priorities OK');

for(const b of [[-1,0,0],[-.99999,.0001,0],[0,1,0]])for(let i=0;i<=100;i++){const v=require('../static/solar-math.js').blendDirection([1,0,0],b,i/100);require('node:assert/strict').ok(v.every(Number.isFinite)&&Math.abs(Math.hypot(...v)-1)<1e-9,'Camera turns remain finite and unit length even across opposite directions');}
