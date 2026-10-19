const assert=require('node:assert/strict'),pages=require('../static/pages.js');
for(const [path,mode] of [['/atlas','all'],['/iss','iss'],['/starlink','starlink']]){assert.equal(pages.mode(path),mode);assert.equal(pages.mode(path+'/'),mode);assert.equal(pages.url(mode),path);}
assert.equal(pages.mode('/'),'all');assert.equal(pages.url('invalid'),'/atlas');
const fs=require('node:fs'),source=fs.readFileSync('static/app.js','utf8');assert.match(source,/location\.assign\(AtlasPages\.url\(e\.target\.value\)\)/);assert.match(source,/colors:atlasColors/);
console.log('Pages distinctes : URLs, sélection initiale et navigation complète OK');
