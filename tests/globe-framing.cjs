const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('static/globe.js','utf8');
const fragment=source.slice(source.indexOf('const homeView=station=>'),source.indexOf('    const resetButton='))+'globalThis.homeView=homeView;';
const ctx={overviewAnchor:null,AtlasPages:require('../static/pages.js'),C:{Cartesian3:{fromDegrees:(lon,lat,height)=>({lon,lat,height})}},document:{body:{dataset:{collection:'all'}}},lastData:null,viewer:{canvas:{clientWidth:1800,clientHeight:745},camera:{frustum:{fovy:Math.PI/3}}}};
vm.createContext(ctx);vm.runInContext(fragment,ctx);
const initial=ctx.homeView().destination;assert.equal(initial.lon,0);assert.equal(initial.lat,20);
ctx.lastData={collection:'all',catalog:new Map([[1,{}]]),points:[{id:1,altitude_km:23222}],visible:()=>true};assert.deepEqual(ctx.homeView().destination,initial,'Atlas must retain the requested opening zoom after high orbits load');
const distance=initial.height+6378137,fraction=6378137/(Math.sqrt(distance*distance-6378137**2)*Math.tan(Math.PI/6));assert.ok(fraction>.45&&fraction<.50,'Earth should occupy about 47% of the map height');
ctx.lastData.collection='gps';assert.ok(ctx.homeView().destination.height>initial.height,'GPS overview must include its real high orbits');
ctx.lastData.collection='galileo';assert.ok(ctx.homeView().destination.height>initial.height);
ctx.lastData.collection='starlink';ctx.lastData.points[0].altitude_km=550;assert.ok(ctx.homeView().destination.height<initial.height);
ctx.lastData.collection='all';ctx.viewer.canvas.clientWidth=390;assert.ok(ctx.homeView().destination.height>initial.height,'Narrow screens keep the globe inside the viewport');
console.log('Cadrage Atlas : centre 0° / 20°, Terre ≈47%, stable après chargement, GPS / Galileo et écrans étroits adaptés OK');

for(const family of ['beidou','goes','meteosat']){ctx.lastData=null;ctx.document.body.dataset.collection=family;ctx.viewer.canvas.clientWidth=1800;assert.ok(ctx.homeView().destination.height>100000000,family+' must include geostationary orbits');}

ctx.document.body.dataset.collection='starlink';ctx.lastData={collection:'starlink',points:[{id:1,altitude_km:550}],catalog:new Map([[1,{}]]),visible:()=>true};
const farHeight=ctx.homeView().destination.height;ctx.overviewAnchor={lon:123,lat:-25};const oriented=ctx.homeView();assert.equal(oriented.destination.lon,123);assert.equal(oriented.destination.lat,-25);assert.equal(oriented.destination.height,farHeight,'Orienting toward a satellite must preserve overview distance');assert.equal(oriented.orientation.pitch,-Math.PI/2);

// An isolated high-orbit family in Atlas must use its actual distance from Earth.
ctx.viewer.canvas.clientWidth=1800;ctx.lastData.collection='all';ctx.lastData.groups=new Set(['tess']);ctx.lastData.points=[{id:43435,lon:80,lat:15,altitude_km:350000}];ctx.lastData.catalog=new Map([[43435,{}]]);ctx.overviewAnchor={id:43435,lon:80,lat:15,altitude_km:350000};
const tess=ctx.homeView().destination;assert.equal(tess.lon,80);assert.ok(tess.height>800000000);
ctx.lastData.collection='tess';assert.equal(ctx.homeView().destination.height,tess.height,'Dedicated page and isolated Atlas object use the same distance');
ctx.viewer.canvas.clientWidth=390;assert.ok(ctx.homeView().destination.height>tess.height,'Portrait display requires more room for the same high orbit');
const globals={window:{}};vm.createContext(globals);vm.runInContext(source,globals);const range=globals.window.AtlasGlobe.satelliteRange;
assert.equal(range(550,1800,745),3500000);assert.ok(range(350000,390,745)>range(350000,1800,745));
for(const altitude of [20200,35786,200000,400000])for(const [w,h] of [[1800,745],[390,745]]){
 const half=Math.atan(.74*Math.tan(Math.PI/6)*Math.min(1,w/h)),distance=range(altitude,w,h);
 assert.ok(Math.asin((altitude*1000+2*6378137)/distance)<=half+1e-10,'Whole Earth and satellite enclosed in the view cone');
}
console.log('Objets lointains : Atlas filtré, page dédiée, TESS jusqu’à 400 000 km, suivi et écran étroit cadrés selon la distance réelle.');
