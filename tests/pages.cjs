const assert=require('node:assert/strict'),pages=require('../static/pages.js');
for(const [path,mode] of [['/atlas','all'],['/iss','iss'],['/starlink','starlink']]){assert.equal(pages.mode(path),mode);assert.equal(pages.mode(path+'/'),mode);assert.equal(pages.url(mode),path);}
assert.equal(pages.mode('/'),'all');assert.equal(pages.url('invalid'),'/atlas');
const fs=require('node:fs'),source=fs.readFileSync('static/app.js','utf8');assert.match(source,/location\.assign\(AtlasPages\.url\(e\.target\.value\)\)/);assert.match(source,/colors:atlasColors/);
console.log('Pages distinctes : URLs, sélection initiale et navigation complète OK');

assert.deepEqual(pages.search('station spatiale').map(x=>x.mode),['iss']);
assert.deepEqual(pages.search('STARLiNK ').map(x=>x.mode),['starlink']);
assert.deepEqual(pages.search('internét').map(x=>x.mode),['starlink']);
assert.equal(pages.search('satellites').length,1);
assert.equal(pages.search('s').length,2);
assert.equal(pages.search(' ').length,0);
assert.equal(pages.search('inconnu').length,0);
for(const key of ['Enter','Tab']){assert.equal(pages.searchAction(key,pages.search('iss')),'iss');assert.equal(pages.searchAction(key,pages.search('s')),null);assert.equal(pages.searchAction(key,[]),null);}
console.log('Recherche des pages : synonymes, accents, plusieurs résultats, Entrée / Tab OK');
