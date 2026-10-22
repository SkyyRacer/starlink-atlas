const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8');
const start=source.indexOf('async function loadPositions('),end=source.indexOf('\nfunction choose',start);
const requests=[],elements=new Map();
const context={selectionRequest:0,collectionMode:'all',dataSnapshot:'test-edition',busy:false,pendingPosition:false,positionRevision:0,at:Date.now()-60000,selected:null,displayMode:'2d',planarFocusMode:'overview',map:{getZoom:()=>4,getMinZoom:()=>1,setView(point,zoom){context.mapTarget=point;context.mapZoom=zoom;}},track3d:[],future3d:[],focusSelected:false,points:[],track:[],futureTrack:[],failures:0,suggestedAt:null,Date,Math,performance,planarMotion:{set(){}},encodeURIComponent,draw:()=>{},focusInitialSatellite(){},orientAtlasGroups(){},updateObservationButtons(){},clock(){},list(){},focusPlanisphere(point){context.focusedPoint=point;},AtlasTime:require('../static/time.js'),$:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},get:url=>new Promise(resolve=>requests.push({url,resolve}))};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
(async()=>{
 const first=context.loadPositions();
 context.at-=86400000;const expected=new Date(context.at).toISOString();
 await context.loadPositions(true);
 assert.equal(requests.length,1);assert.ok(requests[0].url.includes('collection=all'));
 requests[0].resolve({points:[{id:1}],track:[],future_track:[],missing:0});await first;
 assert.equal(context.points.length,0,'obsolete response must not be displayed');
 assert.equal(requests.length,2,'new request must run even while paused');
 assert.ok(requests[1].url.includes(encodeURIComponent(expected)));
 requests[1].resolve({points:[{id:2}],track:[],future_track:[],missing:0});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(context.points[0].id,2);assert.equal(context.busy,false);
 const handler=source.split('\n').find(line=>line.startsWith("$('date').onchange="));vm.runInContext(handler,context);
 for(const mode of ['all','starlink','iss','tiangong','galileo','gps','hubble']){
  context.collectionMode=mode;context.live=true;context.playing=true;context.$('date').value='2024-02-29T12:30';
  context.$('date').onchange();assert.equal(context.at,context.AtlasTime.parseInput('2024-02-29T12:30').time);assert.equal(context.live,false);assert.equal(context.playing,false);
  assert.ok(context.selectionRequest>0,'Changing date reactivates selected tracking');const request=requests.at(-1);assert.ok(request.url.includes('collection='+mode));assert.ok(request.url.includes(encodeURIComponent(new Date(context.at).toISOString())));
  request.resolve({points:[{id:3}],track:[],future_track:[],missing:0});await new Promise(resolve=>setImmediate(resolve));assert.equal(context.points[0].id,3);
 }
 context.selected=25544;context.displayMode='2d';context.$('date').value='2024-11-01T12:00';context.$('date').onchange();
 assert.equal(context.selected,25544);assert.equal(context.focusSelected,true);
 const moved={id:25544,lon:95,lat:-30,altitude_km:420};requests.at(-1).resolve({points:[moved],track:[],future_track:[],missing:0});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual([...context.mapTarget],[-30,95],'Planisphere follows the selected satellite at its new historical position');assert.equal(context.mapZoom,4,'Keep the previous map zoom');assert.equal(context.focusSelected,false);assert.equal(context.selected,25544);
 context.selected=null;context.focusSelected=false;const unchanged=context.at;
 const recovery=context.loadPositions(true);requests.at(-1).resolve({points:[{id:1}],track:[],future_track:[],missing:999,recovery_at:'2026-10-19T12:00:00Z'});await recovery;
 assert.equal(context.at,unchanged,'Recovery is offered without changing the requested date');assert.equal(context.$('available').hidden,false);assert.match(context.$('available').textContent,/archivées/);
 const recovered=Date.parse(context.suggestedAt);vm.runInContext(source.split('\n').find(line=>line.startsWith("$('available').onclick=")),context);context.$('available').onclick();assert.equal(context.at,recovered);assert.equal(context.live,false);assert.equal(context.playing,false);
 requests.at(-1).resolve({points:[{id:1}],track:[],future_track:[],missing:0});await new Promise(resolve=>setImmediate(resolve));
 const beforeMoon=requests.length;let lunarTime=null;context.AtlasCelestial={active:true};context.globeController={updateTime(value){lunarTime=value;}};
 await context.loadPositions(true);assert.equal(requests.length,beforeMoon,'Lunar view never requests satellite positions');assert.equal(lunarTime,context.at);
 context.AtlasCelestial.active=false;const returning=context.loadPositions(true);assert.equal(requests.length,beforeMoon+1,'Earth return reloads satellites even when paused');requests.at(-1).resolve({points:[{id:4}],track:[],future_track:[],missing:0});await returning;assert.equal(context.points[0].id,4);
 console.log('Changement de date : réponse obsolète écartée, nouvelle requête même en pause ; application et recalcul vérifiés sur Atlas, Starlink, ISS, Tiangong, Galileo, GPS et Hubble.');
})().catch(e=>{console.error(e);process.exitCode=1;});
