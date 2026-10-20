const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={AtlasCollections:require('../static/constellations.js'),Map,Set,Date,Promise,TextEncoder,TextDecoder,self:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('browser/browser-worker.js','utf8'),ctx);
const rows=[];for(const id of [1,2])for(const source of ['CelesTrak GP / Space-Track','CelesTrak SupGP / SpaceX'])for(const offset of [-72,-48,-24,-.0001,0,.0001,4,8,12,16,20,23.9999,24,24.0001,48,72])rows.push({elements:{NORAD_CAT_ID:id,EPOCH:new Date(Date.parse('2026-10-18T00:00:00Z')+offset*3600000).toISOString().replace(/Z$/,'')},source});
// Current rows win exact ties, then historic rows. Repeated copies may be discarded.
const sourceRows=[rows.slice(0,22),rows.slice(22),rows.slice(0,5)],pruned=[];ctx.historyBatches(sourceRows,'2026-10-18T12:00:00Z',batch=>pruned.push(...batch));
assert.ok(pruned.length<rows.length);
function selected(input,id,at){return input.filter(r=>r.elements.NORAD_CAT_ID===id).filter(r=>{const age=(at-Date.parse(r.elements.EPOCH+'Z'))/1000;return r.source.includes('SupGP')?age>=0&&age<=86400:Math.abs(age)<=259200;}).reduce((best,r)=>{const age=Math.abs(Math.trunc((at-Date.parse(r.elements.EPOCH+'Z'))/1000));return !best||age<best.age?{row:r,age}:best;},null)?.row;}
for(let minute=0;minute<1440;minute+=3)for(const id of [1,2]){const at=Date.parse('2026-10-18T00:00:00Z')+minute*60000;assert.equal(selected(pruned,id,at),selected(sourceRows.flat(),id,at));}
console.log('Historique mobile : candidats exacts sur toute la journée UTC, sources, frontières et doublons conservés correctement.');

for(let hour=0;hour<24;hour++){const chosen=[],date=`2026-10-18T${String(hour).padStart(2,'0')}:00:00Z`;ctx.historyBatches(sourceRows,date,batch=>chosen.push(...batch),3600000);for(let minute=0;minute<60;minute+=3)for(const id of [1,2]){const at=Date.parse(date)+minute*60000;assert.equal(selected(chosen,id,at),selected(sourceRows.flat(),id,at));}}
console.log('Fenêtres horaires : résultats identiques sur les 24 h avec moins d’éléments en mémoire.');
const allocated=[];ctx.compute=message=>{if(message.op==='orbits-add')allocated.push(...message.rows);return {};};
const stale={elements:{NORAD_CAT_ID:1,EPOCH:'2010-01-01T00:00:00'},source:'CelesTrak GP / Space-Track'};
ctx.combinedHistory({orbits:[stale]},sourceRows,'2026-10-18T12:00:00Z');
assert.ok(!allocated.includes(stale),'Never allocate constants for observations outside the valid hour');
for(let minute=0;minute<60;minute++)for(const id of [1,2]){const at=Date.parse('2026-10-18T12:00:00Z')+minute*60000;assert.equal(selected(allocated,id,at),selected([stale,...sourceRows.flat()],id,at));}
console.log('Filtrage mémoire : éléments périmés exclus, sélection strictement identique dans l’heure consultée.');
