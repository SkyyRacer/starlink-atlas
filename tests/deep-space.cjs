const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const C=require('../static/vendor/cesium/index.cjs'),frame=require('../static/celestial-frame.js'),pages=require('../static/pages.js');
// Supply the shipped IAU tables directly, without network or GPU dependencies.
for(const file of fs.readdirSync('static/vendor/cesium/Assets/IAU2006_XYS')){
 const match=file.match(/_(\d+)\.json$/);if(!match)continue;const values=JSON.parse(fs.readFileSync('static/vendor/cesium/Assets/IAU2006_XYS/'+file)).samples;
 for(let i=0;i<values.length;i++)C.Transforms.iau2006XysData._samples[Number(match[1])*3000+i]=values[i];
}
const time=C.JulianDate.fromIso8601('2026-10-24T12:00:00Z'),xyz=[25000000,-110000000,12000000],fixed=frame.position(C,time,xyz),back=C.Matrix3.multiplyByVector(frame.fixedToIcrf(C,time),fixed,new C.Cartesian3());
assert.ok(C.Cartesian3.distance(back,C.Cartesian3.fromElements(...xyz.map(v=>v*1000)))<.0001,'J2000 and fixed positions preserve the physical vector');
const firstMarker=frame.position(C,time,xyz,null);assert.ok(C.Cartesian3.distance(firstMarker,fixed)<.0001,'A first GPU marker with a null target receives a valid output vector');
const reused=new C.Cartesian3();assert.equal(frame.position(C,time,xyz,reused),reused,'Existing GPU target vectors are reused');
const cloudContext={window:{},performance};vm.createContext(cloudContext);vm.runInContext(fs.readFileSync('static/point-cloud.js','utf8'),cloudContext);
const cloud=cloudContext.window.AtlasPointCloud.create(C,{}),earthPoint=cloud.add({id:25544,color:C.Color.WHITE});earthPoint.position=C.Cartesian3.fromDegrees(10,20,420000);
for(const id of [50463,34380,10321]){const marker=cloud.add({id,color:C.Color.WHITE});assert.equal(marker.target,null);marker.position=frame.position(C,time,xyz,marker.target);}
cloud.commit();assert.equal(cloud.count,4,'Initial distant markers do not prevent the Earth satellites from being committed to the same GPU batch');

const sun=frame.sun(C,time);assert.ok(C.Cartesian3.magnitude(sun)>1.4e11&&C.Cartesian3.magnitude(sun)<1.6e11,'Sun uses astronomical distances');
const config=JSON.parse(fs.readFileSync('resources/mission-ephemerides.json'));
(async()=>{
 const context={URL,Date,document:{currentScript:{src:'https://atlas.test/ephemeris.js'}},window:{Cesium:C,AtlasCelestialFrame:frame},fetch:async url=>{try{return {ok:true,json:async()=>JSON.parse(fs.readFileSync('static/'+new URL(url).pathname.slice(1)))}}catch{return {ok:false}}}};
 // File existence must be decided before returning the response.
 context.fetch=async url=>{const file='static/'+new URL(url).pathname.slice(1);return {ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file))};};
 vm.runInNewContext(fs.readFileSync('static/ephemeris.js','utf8'),context);const ephemeris=context.window.AtlasEphemeris;
 for(const mission of config.missions){
  const index=JSON.parse(fs.readFileSync('static/ephemerides/'+mission.key+'-index.json'));assert.equal(index.id,mission.id);assert.equal(pages.definition(mission.key).trajectory,'horizons');
  const years=Object.values(index.years),entry=years[Math.floor(years.length/2)],data=JSON.parse(fs.readFileSync('static/'+entry.file)),sample=data.samples[Math.floor(data.samples.length/2)],at=sample[0]*1000;
  const result=await ephemeris.apply('https://atlas.test/api/positions?collection='+mission.key+'&id='+mission.id+'&at='+new Date(at).toISOString(),{points:[],missing:1});assert.equal(result.points[0].id,mission.id);
  const p=result.points[0],actual=C.Cartesian3.fromDegrees(p.lon,p.lat,p.altitude_km*1000),expected=frame.position(C,C.JulianDate.fromDate(new Date(at)),sample.slice(1,4));
  assert.ok(C.Cartesian3.distance(actual,expected)<.1,mission.key+' model coordinates match the same ICRF frame as stars and Sun');
  assert.equal(ephemeris.vector(data,(data.samples[0][0]-1)*1000),null,'No extrapolation');
 }
 const cassini=await ephemeris.apply('https://atlas.test/api/positions?collection=cassini&at=2026-10-24T12:00:00Z',{points:[],missing:1});assert.equal(cassini.points.length,0);assert.ok(Date.parse(cassini.suggested_at)<Date.parse('2017-09-15T11:55:00Z'));
 // The orbit option disappears in both map modes and returns with its former setting.
 const {document}=parseHTML(fs.readFileSync('static/index.html','utf8')).window,app=fs.readFileSync('static/app.js','utf8');
 const orbitContext={document,AtlasPages:pages,collectionMode:'jwst',selected:null,byId:new Map(),showOrbit:true,orbitUnavailable:false,earthOrbitPreference:true};vm.createContext(orbitContext);vm.runInContext(app.slice(app.indexOf('function syncOrbitControls(){'),app.indexOf('syncOrbitControls();\ndocument.querySelectorAll')),orbitContext);
 orbitContext.syncOrbitControls();for(const input of document.querySelectorAll('[data-orbit-toggle]')){assert.ok(input.disabled);assert.equal(input.closest('label').style.display,'none');}assert.equal(orbitContext.showOrbit,false);
 orbitContext.collectionMode='all';orbitContext.syncOrbitControls();assert.equal(orbitContext.showOrbit,true);orbitContext.byId.set(50463,{id:50463,name:'JWST'});orbitContext.selected=50463;orbitContext.syncOrbitControls();assert.equal(orbitContext.showOrbit,false);orbitContext.selected=null;orbitContext.syncOrbitControls();assert.equal(orbitContext.showOrbit,true);
 console.log('17 official mission trajectories, ICRF/IAU frame roundtrip, Sun distance, bounds, Cassini recovery and context-sensitive orbit controls OK.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
// The compass replacement uses the satellite, not the camera, as its physical origin.
{
 const {window}=parseHTML('<main class="view"><div class="earth-view-controls"><button id="compass"></button></div><div class="globe-tools"></div></main>'),document=window.document,view=document.querySelector('main');
 let returned=0;const viewer={container:view,canvas:{clientWidth:1280,clientHeight:800},camera:{positionWC:new C.Cartesian3(1e12,0,0),directionWC:new C.Cartesian3(-1,0,0),rightWC:C.Cartesian3.UNIT_Y,upWC:C.Cartesian3.UNIT_Z},clock:{currentTime:time},scene:{preRender:new C.Event(),requestRender(){},light:new C.SunLight({intensity:1})}};
 const context={document,window:{AtlasCelestialFrame:frame,addEventListener(){}}};vm.createContext(context);vm.runInContext(fs.readFileSync('static/deep-space-view.js','utf8'),context);
 const destination=context.window.AtlasDeepSpaceView.create({viewer,C,onEarth(){returned++;}}),instrument=document.querySelector('.deep-earth-instrument');
 destination.setTarget({lon:0,lat:0,altitude_km:1e9});destination.setEnabled(true);
 assert.equal(instrument.hidden,false);assert.equal(document.querySelector('#compass').hidden,true);assert.equal(instrument.previousElementSibling.id,'compass','Instrument replaces the compass in its existing layout column');assert.equal(document.querySelector('.deep-earth-direction'),null,'No floating Earth badge');
 assert.match(instrument.getAttribute('aria-label'),/Face à la Terre/);assert.equal(document.querySelector('.spatial-grid').children.length,3);
 const earth=document.querySelector('.spatial-earth'),firstX=earth.getAttribute('cx');
 assert.equal(document.querySelector('.spatial-alignment-status').hidden,false);assert.equal(document.querySelector('.spatial-earth-texture').getAttribute('href'),'/images/earth/day.webp');assert.equal(document.querySelector('.spatial-earth-surface').getAttribute('visibility'),'visible');
 assert.equal(firstX,'90.00');assert.equal(earth.getAttribute('cy'),'77.00');assert.equal(instrument.dataset.facingEarth,'true','Earth lies in the centre when looking toward it');
 // Moving the camera across the spacecraft does not invert the Earth vector.
 viewer.camera.positionWC=new C.Cartesian3(-1e12,1e11,0);viewer.scene.preRender.raiseEvent();assert.equal(earth.getAttribute('cx'),firstX);assert.match(instrument.getAttribute('aria-label'),/Face à la Terre/);
 viewer.camera.directionWC=C.Cartesian3.UNIT_X;viewer.scene.preRender.raiseEvent();assert.match(instrument.getAttribute('aria-label'),/Derrière/);assert.equal(document.querySelector('.spatial-earth-line').getAttribute('stroke-dasharray'),'3 3');assert.equal(instrument.dataset.earthHemisphere,'behind');assert.equal(document.querySelector('.spatial-alignment-status').hidden,true);assert.equal(document.querySelector('.spatial-earth-surface').getAttribute('visibility'),'hidden');assert.equal(earth.getAttribute('fill'),'#080d12');assert.equal(earth.getAttribute('cy'),'23.00','Earth directly behind sits on the rim, never on the central reticle');
 assert.equal(instrument.querySelector('button,h3,text'),null,'Compass has no visible text or return button');assert.equal(document.querySelector('.spatial-centre').children.length,8,'Central marker has eight depth-sorted 3D faces');
 const back=document.querySelector('.deep-earth-return');assert.ok(back.closest('.globe-tools'),'Return button belongs to the bottom-left tools');back.click();assert.equal(returned,1);
 destination.setTarget(null);viewer.scene.preRender.raiseEvent();assert.match(instrument.getAttribute('aria-label'),/indisponible/);assert.ok(document.querySelector('svg').hasAttribute('hidden'),'Missing ephemerides never invent an Earth direction');
 destination.setEnabled(false);assert.equal(instrument.hidden,true);assert.equal(document.querySelector('.deep-earth-return-control').hidden,true);assert.ok(viewer.scene.light instanceof C.SunLight);
 console.log('Spatial Earth instrument: mission-centred direction, 3D grid, rear hemisphere, no fabricated position, layout and return OK.');
}
const appSource=fs.readFileSync('static/app.js','utf8'),defaults=appSource.slice(appSource.indexOf('const restoredDisplay='),appSource.indexOf('if(restoredEarthView)'));
for(const definition of pages.definitions.filter(row=>row.trajectory)){
 const context={AtlasPages:pages,collectionMode:definition.id,AtlasJourney:{preferences:()=>({realistic:false,sky:false})}};vm.createContext(context);vm.runInContext(defaults+';globalThis.display=restoredDisplay;',context);assert.equal(context.display.realistic,true,definition.id);assert.equal(context.display.sky,true,definition.id);
}

const planarSource=appSource.slice(appSource.indexOf('function showPlanisphere(){'),appSource.indexOf("$('view-2d').onclick=showPlanisphere;"));
for(const definition of pages.definitions.filter(row=>row.trajectory))vm.runInNewContext(planarSource+';showPlanisphere();',{AtlasPages:pages,collectionMode:definition.id});

const compassCSS=fs.readFileSync('static/workspace.css','utf8');
assert.match(compassCSS,/deep-earth-instrument\{[^}]*overflow:visible/);
assert.match(compassCSS,/spatial-alignment-status\{[^}]*white-space:normal/);
assert.match(fs.readFileSync('static/deep-space-view.js','utf8'),/spatial-alignment-halo[^>]*r="58"/);
assert.match(compassCSS,/data-facing-earth=true\] \.spatial-alignment-halo[^}]*animation:spatial-aligned-halo/);
