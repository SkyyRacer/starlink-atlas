const assert=require('node:assert/strict');
const {splitTrack}=require('../static/geometry.js');
assert.deepEqual(splitTrack([]),[]);
assert.deepEqual(splitTrack([[0,0],[5,120]]),[[[0,0],[5,120]]]);
assert.deepEqual(splitTrack([[10,170],[20,-170]]),[[[10,170],[15,180]],[[15,-180],[20,-170]]]);
assert.deepEqual(splitTrack([[10,-170],[20,170]]),[[[10,-170],[15,-180]],[[15,180],[20,170]]]);
const track=[[0,179],[1,-179],[2,-150],[3,170]];
const segments=splitTrack(track);
assert.deepEqual(segments.at(-1).at(-1),track.at(-1));
for(const segment of segments)for(let i=1;i<segment.length;i++)assert.ok(Math.abs(segment[i][1]-segment[i-1][1])<=180);
console.log('Découpe géographique et extrémité de la trace : OK');

const {shouldRender}=require("../static/geometry.js");
assert.equal(shouldRender(42,42,false),true,"selected historical satellite remains visible despite the decayed filter");
assert.equal(shouldRender(43,42,false),false);
assert.equal(shouldRender(43,42,true),true);

const {nightPolygon}=require('../static/geometry.js');
for(const declination of [-.409,0,.409]){
 const polygon=nightPolygon(declination,0);
 assert.ok(polygon.flat().every(Number.isFinite));
 for(const [lat,lon] of polygon.slice(0,-2)){
  if(Math.abs(lat)<85)assert.ok(Math.abs(Math.sin(lat*Math.PI/180)*Math.sin(declination)+Math.cos(lat*Math.PI/180)*Math.cos(declination)*Math.cos(lon*Math.PI/180))<1e-9);
 }
 assert.equal(polygon.at(-1)[0],declination<0?85.05112878:-85.05112878);
}
console.log('Terminaison jour/nuit : OK');

const C=require('../static/vendor/cesium/index.cjs'),out=new C.Cartesian3();
for(const lat of [-90,-51.6,0,28.5,90])for(const lon of [-180,-30,0,179.99])for(const height of [0,420000,35786000,1e9]){const expected=C.Cartesian3.fromDegrees(lon,lat,height);const actual=require('../static/geometry').geodeticPosition(lon,lat,height,out);assert.equal(actual,out);assert.ok(C.Cartesian3.distance(actual,expected)<1e-5,'Fast conversion preserves WGS84 coordinates');}
