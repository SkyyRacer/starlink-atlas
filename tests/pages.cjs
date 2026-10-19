const assert=require('node:assert/strict'),pages=require('../static/pages.js');
for(const [path,mode] of [['/atlas','all'],['/galileo','galileo'],['/gps','gps'],['/iss','iss'],['/starlink','starlink']]){assert.equal(pages.mode(path),mode);assert.equal(pages.mode(path+'/'),mode);assert.equal(pages.url(mode),path);}
assert.equal(pages.mode('/'),'all');assert.equal(pages.url('invalid'),'/atlas');
const fs=require('node:fs'),source=fs.readFileSync('static/app.js','utf8');assert.match(source,/location\.assign\(AtlasPages\.url\(e\.target\.value\)\)/);assert.match(source,/colors:atlasColors/);
console.log('Pages distinctes : URLs, sélection initiale et navigation complète OK');

assert.deepEqual(pages.search('station spatiale').map(x=>x.mode),['iss']);
assert.deepEqual(pages.search('STARLiNK ').map(x=>x.mode),['starlink']);
assert.deepEqual(pages.search('internét').map(x=>x.mode),['starlink']);
assert.equal(pages.search('satellites').length,4);
assert.equal(pages.search('s').length,5);
assert.equal(pages.search(' ').length,0);
assert.equal(pages.search('inconnu').length,0);
for(const key of ['Enter','Tab']){assert.equal(pages.searchAction(key,pages.search('iss')),'iss');assert.equal(pages.searchAction(key,pages.search('s')),null);assert.equal(pages.searchAction(key,[]),null);}
console.log('Recherche des pages : synonymes, accents, plusieurs résultats, Entrée / Tab OK');

assert.deepEqual(pages.search('Galileo').map(x=>x.mode),['galileo']);assert.deepEqual(pages.search('navigation europe').map(x=>x.mode),['galileo']);

for(const query of ['Tous les satellites','atlas','tous']){assert.deepEqual(pages.search(query).map(x=>x.mode),['all']);for(const key of ['Enter','Tab'])assert.equal(pages.searchAction(key,pages.search(query)),'all');}
assert.match(fs.readFileSync('static/index.html','utf8'),/<a class="brand" id="atlas-home" href="\/atlas"/);assert.match(source,/\$\('atlas-home'\)\.href=AtlasPages\.url\('all'\)/);

for(const query of ['GPS','NAVSTAR','Global Positioning System'])assert.deepEqual(pages.search(query).map(x=>x.mode),['gps']);
