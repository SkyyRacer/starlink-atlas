const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8'),initial=source.slice(source.indexOf('let collectionMode='),source.indexOf('const planarMotion='));
for(const [path,query,sky,expected] of [['/atlas','?view=earth',false,true],['/atlas','?view=earth',true,true],['/atlas','',false,false],['/hubble','?view=earth',false,false]]){
 const c={location:{pathname:path,search:query},URLSearchParams,AtlasPages:require('../static/pages.js'),AtlasJourney:{read:()=>null,preferences:()=>({realistic:false,sky}),bind(){}},Date,Map,Set,performance,$:()=>({getAttribute:()=>false})};vm.createContext(c);vm.runInContext(initial+';globalThis.result={realistic:restoredDisplay.realistic,sky:restoredDisplay.sky,groups:atlasGroups.size,earth:solarEarthEntry};',c);
 assert.equal(c.result.earth,expected);assert.equal(c.result.realistic,expected);assert.equal(c.result.sky,path==='/atlas'?expected:sky);if(expected)assert.equal(c.result.groups,0,'Earth entry excludes satellites and debris before any first frame');else assert.ok(c.result.groups>0,'Other entries preserve their default selection');
}
console.log('Earth menu entry: Atlas, realistic Earth on, no satellite/debris layers, stars on for Earth, off for base Atlas');
