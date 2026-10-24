const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),pages=require('../static/pages.js');
class Element{
 constructor(){this.listeners={};this.children=[];this.attributes={};this.value='';this.hidden=true;}
 addEventListener(type,fn){this.listeners[type]=fn;}setAttribute(key,value){this.attributes[key]=value;}removeAttribute(key){delete this.attributes[key];}
 replaceChildren(){this.children=[];}append(...items){this.children.push(...items);}querySelectorAll(){return this.children.filter(x=>x.dataset?.mode);}contains(){return false;}
}
const testCatalog=[],input=new Element(),results=new Element(),navigations=[],document={createElement:()=>Object.assign(new Element(),{dataset:{}}),addEventListener(){}};
const source=fs.readFileSync('static/app.js','utf8').split('// Search navigates to complete documents, like the observation selector.')[1];
vm.runInNewContext(source,{$:id=>id==='object-search'?input:results,AtlasPages:pages,allCatalog:testCatalog,location:{assign:path=>navigations.push(path)},document,setTimeout});
function search(value){input.value=value;input.listeners.input();}
function key(value){let prevented=false;input.listeners.keydown({key:value,preventDefault(){prevented=true;}});return prevented;}
search('iss');assert.equal(results.hidden,false);assert.equal(results.children[0].children[0].textContent,'ISS');
assert.equal(key('Tab'),true);assert.equal(navigations.length,0,'Tab selects without opening');assert.equal(input.attributes['aria-activedescendant'],'object-result-0');
for(let i=0;i<pages.search('iss').length;i++)key('Tab');assert.equal(input.attributes['aria-activedescendant'],'object-result-0','Results loop');key('Enter');assert.equal(navigations.pop(),'/iss');
search('Starlink');key('Enter');assert.equal(navigations.pop(),'/starlink','Single proposal opens on the first Enter');
search('s');const count=results.children.length;assert.equal(count,pages.search('s').length);
for(let i=0;i<count+1;i++){key('Tab');assert.equal(input.attributes['aria-activedescendant'],'object-result-'+(i%count));}
assert.equal(navigations.length,0,'Tab loops without navigating');
key('ArrowUp');assert.equal(input.attributes['aria-activedescendant'],'object-result-'+(count-1));key('Enter');assert.equal(navigations.pop(),pages.url(pages.search('s').at(-1).mode));
search('s');key('Enter');assert.equal(navigations.length,0);key('ArrowDown');key('Enter');assert.equal(navigations.pop(),pages.url(pages.search('s')[1].mode));
search('s');results.children[0].onclick();assert.equal(navigations.pop(),pages.url(pages.search('s')[0].mode));
search('aucun objet');assert.equal(results.children[0].textContent,'Aucun résultat');key('Enter');assert.equal(navigations.length,0);assert.equal(key('Tab'),false,'No results does not trap keyboard focus');
key('Escape');assert.equal(results.hidden,true);assert.equal(input.attributes['aria-expanded'],'false');
search('');assert.equal(results.hidden,true);
for(const name of ['tous les satellites','atlas','gps','navstar','GLONASS','BeiDou','Iridium','Globalstar','Copernicus','COSMO-SkyMed','Pleiades Neo','ICEYE','Meteosat','GOES','OneWeb','debris']){
 search(name);const matches=pages.search(name);assert.equal(results.children.length,matches.length,name);key('Enter');if(matches.length>1){assert.equal(navigations.length,0);key('Enter');}assert.equal(navigations.pop(),pages.url(matches[0].mode));
}
search('s');key('Tab');search('galileo');assert.equal(input.attributes['aria-activedescendant'],undefined,'Typing resets selection');key('Enter');assert.equal(navigations.pop(),'/galileo','Single result opens immediately after typing resets selection');
console.log('Search: Tab cycles, arrows navigate, Enter highlights then opens, typing resets selection, empty results and clicks OK.');

console.log('Search group navigation remains compatible with prefix filtering.');

testCatalog.push({id:90002,name:'STARLINK-10',family:'starlink'},{id:90001,name:'STARLINK-2',family:'starlink'},{id:90003,name:'OTHER STAR',family:'starlink'});
search('star');const expected=pages.search('star',testCatalog);assert.equal(results.children.length,expected.length);assert.ok(results.children.every(button=>button.children[0].textContent.toLowerCase().includes('star')));
const satelliteIndex=expected.findIndex(item=>item.satellite?.id===90001);for(let i=0;i<=satelliteIndex;i++)key('Tab');key('Enter');assert.equal(navigations.pop(),'/starlink?satellite=90001&view=3d','Keyboard opens the specific satellite in close view');
search('STARLINK-10');results.children[0].onclick();assert.equal(navigations.pop(),'/starlink?satellite=90002&view=3d','Click opens the specific satellite');
console.log('Specific satellite proposals: prefix filtering and close-view navigation by keyboard/click OK.');

search('STARLINK-10');key('Enter');assert.equal(navigations.pop(),'/starlink?satellite=90002&view=3d','Single individual satellite opens exactly like its click');
