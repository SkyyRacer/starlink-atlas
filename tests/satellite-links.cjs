const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),pages=require('../static/pages.js');
const now=Date.parse('2026-10-20T12:00:00Z');
for(const search of ['', '?satellite=-1&view=3d','?satellite=0&view=3d','?satellite=1.5&view=3d','?satellite=x&view=3d','?satellite=25544&view=2d'])assert.equal(pages.satelliteLink(search,now),null);
assert.deepEqual(pages.satelliteLink('?satellite=25544&view=3d',now),{id:25544,at:null});
assert.equal(pages.satelliteLink('?satellite=25544&view=3d&at=2099-01-01',now).at,null);
const s={id:25544,name:'ISS (ZARYA)'},historical=Date.parse('2024-02-10T12:00:00Z');
const target=pages.satelliteUrl(s,historical);assert.ok(target.startsWith('/iss?'));assert.deepEqual(pages.satelliteLink(target.slice(target.indexOf('?')),now),{id:25544,at:historical});
assert.ok(!pages.satelliteUrl(s).includes('at='));
// Real startup handler must consume the exact object once, before overview orientation.
const app=fs.readFileSync('static/app.js','utf8');const fragment=app.slice(app.indexOf('let initialSatellitePending=true;'),app.indexOf('async function loadPositions('));
const chosen=[],context={pendingSatelliteLink:{id:25544,at:null},collectionMode:'iss',catalog:[s],points:[{id:25544}],selected:null,AtlasPages:pages,initialOverviewTarget:null,globeController:null,state:()=> 'orbit',choose:(...args)=>chosen.push(args)};
vm.createContext(context);vm.runInContext(fragment+'\nfocusInitialSatellite();focusInitialSatellite();',context);assert.deepEqual(chosen,[[25544,true,'close']]);assert.equal(context.pendingSatelliteLink,null);
// Exact object selected in Atlas remains exact when several objects belong to its page.
const starlink={id:44235,name:'STARLINK-31'};assert.ok(pages.satelliteUrl(starlink).includes('satellite=44235'));
console.log('Dedicated 3D links: exact NORAD target, historical date, invalid inputs and startup consumption OK.');
