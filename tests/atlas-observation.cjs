const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('static/app.js','utf8');
const start=source.indexOf('function atlasObservationTargets('),end=source.indexOf('function updateObservationButtons',start);
const ctx={points:[{id:1},{id:2},{id:3},{id:5}],catalog:[{id:1,ops:'-',state:'orbit',collections:['hubble']},{id:2,ops:'+',state:'orbit',collections:['hubble']},{id:3,ops:'+',state:'decayed',collections:['hubble']},{id:4,ops:'+',state:'orbit',collections:['ixpe']},{id:5,ops:'-',state:'orbit',collections:['galileo']}],AtlasPages:{memberships:s=>s.collections},state:s=>s.state};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
assert.equal(ctx.atlasObservationTarget('hubble').id,2,'Prefer an operational orbiting member with a position');
assert.equal(ctx.atlasObservationTarget('galileo').id,5,'An available in-orbit member can be observed when no operational status is known');
assert.equal(ctx.atlasObservationTarget('ixpe'),null,'Never centre on an object without a position');
const html=fs.readFileSync('static/index.html','utf8'),families=[...html.matchAll(/data-family="([^"]+)"/g)].map(m=>m[1]);
for(const family of families){assert.ok(html.includes('data-page="'+family+'"'),'Dedicated details page');assert.ok(html.includes('data-observe="'+family+'"'),'Separate observation action');}
assert.ok(!html.includes('Voir la page</a>'));assert.match(source,/choose\(target.id,true\);document.dispatchEvent\(new Event\('atlas:observe'\)\)/);
console.log('Atlas : chaque carte possède détails et observation ; priorité aux objets opérationnels, position obligatoire et fermeture du panneau mobile.');
