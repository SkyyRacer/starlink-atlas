const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('static/app.js','utf8');
const fragment=source.slice(source.indexOf('let initialSatellitePending=true;'),source.indexOf('async function loadPositions('));
function run(mode,catalog,ids,selected=null){const choices=[],ctx={collectionMode:mode,catalog,points:ids.map(id=>({id})),selected,Set,state:s=>s.state||'orbit',choose:id=>choices.push(id)};vm.createContext(ctx);vm.runInContext(fragment+'\nfocusInitialSatellite();focusInitialSatellite();',ctx);return choices;}
assert.deepEqual(run('hubble',[{id:1,ops:'+'}],[1]),[1]);
assert.deepEqual(run('starlink',[{id:1,ops:'-',state:'decayed'},{id:2,ops:'-'},{id:3,ops:'+'},{id:4,ops:'+'}],[1,2,3,4]),[3]);
assert.deepEqual(run('galileo',[{id:1,ops:'+'},{id:2,ops:'+'}],[2]),[2]);
assert.deepEqual(run('gps',[{id:1,ops:'B'},{id:2,ops:'?'},{id:3,ops:'+'}],[1,2,3]),[3]);
assert.deepEqual(run('iss',[{id:25544,ops:'?'}],[25544]),[25544]);
assert.deepEqual(run('all',[{id:1,ops:'+'}],[1]),[]);
assert.deepEqual(run('gps',[{id:1,ops:'-'}],[1]),[]);
assert.deepEqual(run('gps',[{id:1,ops:'+'}],[]),[]);
assert.deepEqual(run('gps',[{id:1,ops:'+'}],[1],7),[]);
console.log('Centrage initial : première position en service, repli sur statut inconnu, Atlas et sélection existante préservés, une seule activation.');
