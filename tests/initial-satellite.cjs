const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('static/app.js','utf8');
const fragment=source.slice(source.indexOf('let initialSatellitePending=true;'),source.indexOf('async function loadPositions('));
function run(mode,catalog,ids,selected=null){const choices=[],ctx={collectionMode:mode,catalog,points:ids.map(id=>({id,lat:10,lon:20})),selected,initialOverviewTarget:null,displayMode:'3d',globeController:{orientOverview:p=>choices.push(p.id)},Set,state:s=>s.state||'orbit',choose(){throw Error('La vue initiale ne sélectionne pas de satellite');}};vm.createContext(ctx);vm.runInContext(fragment+'\nfocusInitialSatellite();focusInitialSatellite();',ctx);assert.equal(ctx.selected,selected);return choices;}
assert.deepEqual(run('hubble',[{id:1,ops:'+'}],[1]),[1]);
assert.deepEqual(run('starlink',[{id:1,ops:'-',state:'decayed'},{id:2,ops:'-'},{id:3,ops:'+'},{id:4,ops:'+'}],[1,2,3,4]),[3]);
assert.deepEqual(run('galileo',[{id:1,ops:'+'},{id:2,ops:'+'}],[2]),[2]);
assert.deepEqual(run('gps',[{id:1,ops:'B'},{id:2,ops:'?'},{id:3,ops:'+'}],[1,2,3]),[3]);
assert.deepEqual(run('iss',[{id:25544,ops:'?'}],[25544]),[25544]);
assert.deepEqual(run('all',[{id:1,ops:'+'}],[1]),[]);
assert.deepEqual(run('gps',[{id:1,ops:'-'}],[1]),[]);
assert.deepEqual(run('gps',[{id:1,ops:'+'}],[]),[]);
assert.deepEqual(run('gps',[{id:1,ops:'+'}],[1],7),[]);
const delayed={collectionMode:'hubble',catalog:[{id:1,ops:'+'}],points:[{id:1,lat:15,lon:25}],selected:null,initialOverviewTarget:null,displayMode:'2d',globeController:null,Set,state:()=> 'orbit',map:{panTo(position){assert.deepEqual([...position],[15,25]);}}};
vm.createContext(delayed);vm.runInContext(fragment+'\nfocusInitialSatellite();',delayed);assert.equal(delayed.initialOverviewTarget.id,1);let oriented=0;delayed.displayMode='3d';delayed.globeController={orientOverview:p=>{oriented++;assert.equal(p.id,1);}};vm.runInContext('applyInitialOrientation();applyInitialOrientation();',delayed);assert.equal(oriented,1);assert.equal(delayed.selected,null);
console.log('Vue initiale éloignée : orientation sans sélection, sans suivi ni fiche, moteur différé et Atlas préservés.');
// Previous selection rules still apply to the overview target.
console.log('Centrage initial : première position en service, repli sur statut inconnu, Atlas et sélection existante préservés, une seule activation.');
