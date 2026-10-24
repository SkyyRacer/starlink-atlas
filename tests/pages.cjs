const assert=require('node:assert/strict'),pages=require('../static/pages.js');
for(const [path,mode] of [['/atlas','all'],['/galileo','galileo'],['/gps','gps'],['/iss','iss'],['/starlink','starlink']]){assert.equal(pages.mode(path),mode);assert.equal(pages.mode(path+'/'),mode);assert.equal(pages.url(mode),path);}
assert.equal(pages.mode('/'),'all');assert.equal(pages.url('invalid'),'/atlas');
const fs=require('node:fs'),source=fs.readFileSync('static/app.js','utf8');assert.match(source,/location\.assign\(AtlasPages\.url\(e\.target\.value\)\)/);assert.match(source,/colors:atlasColors/);
console.log('Pages distinctes : URLs, sélection initiale et navigation complète OK');

assert.deepEqual(pages.search('station spatiale'),[],'Descriptions do not produce unrelated name suggestions');
assert.deepEqual(pages.search('STARLiNK ').map(x=>x.mode),['starlink']);
assert.deepEqual(pages.search('internét'),[]);
assert.ok(pages.search('star').every(item=>item.name.toLowerCase().includes('star')));
const prefix=pages.search('s').filter(item=>item.name.toLowerCase().startsWith('s'));for(let i=1;i<prefix.length;i++)assert.ok(prefix[i-1].name.localeCompare(prefix[i].name,'fr',{sensitivity:'base',numeric:true})<=0);
assert.ok(pages.search('s').length>1);
assert.equal(pages.search(' ').length,0);
assert.equal(pages.search('inconnu').length,0);
for(const key of ['Enter','Tab']){assert.equal(pages.searchAction(key,pages.search('iss')),null);assert.equal(pages.searchAction(key,pages.search('s')),null);assert.equal(pages.searchAction(key,[]),null);}
console.log('Recherche des pages : synonymes, accents, plusieurs résultats, Entrée / Tab OK');

assert.deepEqual(pages.search('Galileo').map(x=>x.mode),['galileo']);assert.deepEqual(pages.search('navigation europe'),[]);

for(const query of ['Tous les satellites','atlas','tous']){assert.deepEqual(pages.search(query).map(x=>x.mode),['all']);for(const key of ['Enter','Tab'])assert.equal(pages.searchAction(key,pages.search(query)),'all');}
assert.match(fs.readFileSync('static/index.html','utf8'),/<a class="brand" id="atlas-home" href="\/atlas"/);assert.match(source,/\$\('atlas-home'\)\.href=AtlasPages\.url\('all'\)/);

for(const query of ['GPS','NAVSTAR','Global Positioning System'])assert.deepEqual(pages.search(query).map(x=>x.mode),['gps']);

for(const row of pages.definitions){assert.equal(pages.mode('/'+row.id),row.id);assert.equal(pages.mode('/'+row.id+'/'),row.id);assert.equal(pages.url(row.id),'/'+row.id);assert.ok(pages.search(row.label).some(r=>r.mode===row.id),row.label);}
assert.ok(pages.search('pleiades neo').some(x=>x.mode==='pleiades-neo'));assert.ok(pages.search('copernicus').some(item=>item.mode==='sentinel'));
assert.deepEqual(pages.definitions,JSON.parse(fs.readFileSync('resources/constellations.json')));
console.log('97 familles : documents, labels, synonymes et registre commun cohérents OK');

assert.deepEqual(pages.search('débris').map(x=>x.mode),['debris','remove-debris']);

const satellites=[{id:90002,name:'STARLINK-10',family:'starlink'},{id:90001,name:'STARLINK-2',family:'starlink'},{id:90003,name:'OTHER STAR',family:'starlink'},{id:90004,name:'GPS TEST',family:'gps'}];
const suggestions=pages.search('STAR',satellites);assert.ok(suggestions.findIndex(item=>item.mode==='starlink')<suggestions.findIndex(item=>item.satellite));assert.deepEqual(suggestions.filter(item=>item.satellite).map(item=>item.name),['STARLINK-2','STARLINK-10','OTHER STAR']);assert.ok(suggestions.every(item=>item.name.toLowerCase().includes('star')));
assert.equal(pages.search('STARLINK-10',satellites)[0].satellite.id,90002);
assert.equal(pages.search('é',satellites).some(item=>item.mode==='echo'),true);
const many=Array.from({length:10000},(_,i)=>({id:100000+i,name:'STARLINK-'+i,family:'starlink'}));assert.equal(pages.search('star',many).filter(item=>item.satellite).length,100,'Suggestions keep the DOM bounded for large constellations');
console.log('Name prefixes: groups first, alphabetic/numeric order, exact satellites, accents and bounded suggestions OK.');

const tin=[{id:99001,name:'TEST TIN-2',family:'starlink'},{id:99002,name:'TIN-10',family:'starlink'},{id:99003,name:'TIN-2',family:'starlink'},{id:99004,name:'A THIRD TIN',family:'starlink'},{id:99005,name:'UNRELATED',family:'starlink'}];
assert.deepEqual(pages.search('tin',tin).filter(item=>item.satellite).map(item=>item.name),['TIN-2','TIN-10','A THIRD TIN','TEST TIN-2']);
console.log('Prefix matches precede matches inside later words, with alphabetic order in each tier.');
