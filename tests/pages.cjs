const assert=require('node:assert/strict'),pages=require('../static/pages.js');
for(const [path,mode] of [['/atlas','all'],['/galileo','galileo'],['/gps','gps'],['/iss','iss'],['/starlink','starlink']]){assert.equal(pages.mode(path),mode);assert.equal(pages.mode(path+'/'),mode);assert.equal(pages.url(mode),path);}
assert.equal(pages.mode('/'),'all');assert.equal(pages.url('invalid'),'/atlas');
const fs=require('node:fs'),source=fs.readFileSync('static/app.js','utf8');assert.match(source,/location\.assign\(AtlasPages\.url\(e\.target\.value\)\)/);assert.match(source,/colors:atlasColors/);
console.log('Pages distinctes : URLs, sélection initiale et navigation complète OK');

assert.deepEqual(pages.search('station spatiale').map(x=>x.mode),['iss','tiangong']);
assert.deepEqual(pages.search('STARLiNK ').map(x=>x.mode),['starlink']);
assert.ok(pages.search('internét').some(x=>x.mode==='starlink'));assert.ok(pages.search('internét').some(x=>x.mode==='amazon-leo'));
assert.equal(pages.search('satellites').length,pages.definitions.length);
assert.equal(pages.search('s').length,pages.definitions.length+1);
assert.equal(pages.search(' ').length,0);
assert.equal(pages.search('inconnu').length,0);
for(const key of ['Enter','Tab']){assert.equal(pages.searchAction(key,pages.search('iss')),'iss');assert.equal(pages.searchAction(key,pages.search('s')),null);assert.equal(pages.searchAction(key,[]),null);}
console.log('Recherche des pages : synonymes, accents, plusieurs résultats, Entrée / Tab OK');

assert.deepEqual(pages.search('Galileo').map(x=>x.mode),['galileo']);assert.deepEqual(pages.search('navigation europe').map(x=>x.mode),['galileo']);

for(const query of ['Tous les satellites','atlas','tous']){assert.deepEqual(pages.search(query).map(x=>x.mode),['all']);for(const key of ['Enter','Tab'])assert.equal(pages.searchAction(key,pages.search(query)),'all');}
assert.match(fs.readFileSync('static/index.html','utf8'),/<a class="brand" id="atlas-home" href="\/atlas"/);assert.match(source,/\$\('atlas-home'\)\.href=AtlasPages\.url\('all'\)/);

for(const query of ['GPS','NAVSTAR','Global Positioning System'])assert.deepEqual(pages.search(query).map(x=>x.mode),['gps']);

for(const row of pages.definitions){assert.equal(pages.mode('/'+row.id),row.id);assert.equal(pages.mode('/'+row.id+'/'),row.id);assert.equal(pages.url(row.id),'/'+row.id);assert.ok(pages.search(row.label).some(r=>r.mode===row.id),row.label);}
assert.deepEqual(pages.search('pleiades neo').map(x=>x.mode),['pleiades-neo']);assert.deepEqual(pages.search('copernicus').map(x=>x.mode),['sentinel','sentinel-5p','sentinel-6']);
assert.deepEqual(pages.definitions,JSON.parse(fs.readFileSync('resources/constellations.json')));
console.log('97 familles : documents, labels, synonymes et registre commun cohérents OK');

assert.deepEqual(pages.search('débris').map(x=>x.mode),['debris']);
