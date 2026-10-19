const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),pages=require('../static/pages.js');
class Element{
 constructor(){this.listeners={};this.children=[];this.attributes={};this.value='';this.hidden=true;}
 addEventListener(type,fn){this.listeners[type]=fn;}setAttribute(key,value){this.attributes[key]=value;}removeAttribute(key){delete this.attributes[key];}
 replaceChildren(){this.children=[];}append(...items){this.children.push(...items);}querySelectorAll(){return this.children.filter(x=>x.dataset?.mode);}contains(){return false;}
}
const input=new Element(),results=new Element(),navigations=[],document={createElement:()=>Object.assign(new Element(),{dataset:{}}),addEventListener(){}};
const source=fs.readFileSync('static/app.js','utf8').split('// Search navigates to complete documents, like the observation selector.')[1];
vm.runInNewContext(source,{$:id=>id==='object-search'?input:results,AtlasPages:pages,location:{assign:path=>navigations.push(path)},document,setTimeout});
function search(value){input.value=value;input.listeners.input();}
function key(value){let prevented=false;input.listeners.keydown({key:value,preventDefault(){prevented=true;}});return prevented;}
search('iss');assert.equal(results.hidden,false);assert.equal(results.children[0].children[0].textContent,'ISS');
assert.equal(key('Tab'),true);assert.equal(navigations.pop(),'/iss');
search('Starlink');key('Enter');assert.equal(navigations.pop(),'/starlink');
search('s');assert.equal(results.children.length,17);assert.equal(key('Enter'),false);assert.equal(navigations.length,0);
key('ArrowUp');key('Enter');assert.equal(navigations.pop(),'/starlink');
search('s');results.children[0].onclick();assert.equal(navigations.pop(),'/atlas');
search('galileo');key('Tab');assert.equal(navigations.pop(),'/galileo');
search('aucun objet');assert.equal(results.children[0].textContent,'Aucun objet trouvé');key('Enter');assert.equal(navigations.length,0);
key('Escape');assert.equal(results.hidden,true);assert.equal(input.attributes['aria-expanded'],'false');
search('');assert.equal(results.hidden,true);
console.log('Recherche objets : résultats cliquables, Entrée / Tab uniques, choix multiples, flèches et Échap OK');

for(const value of ['Enter','Tab']){search('tous les satellites');assert.equal(results.children.length,1);assert.equal(key(value),true);assert.equal(navigations.pop(),'/atlas');}
search('atlas');results.children[0].onclick();assert.equal(navigations.pop(),'/atlas');

search('gps');key('Enter');assert.equal(navigations.pop(),'/gps');
search('navstar');key('Tab');assert.equal(navigations.pop(),'/gps');

for(const name of ['GLONASS','BeiDou','Iridium','Globalstar','Copernicus','COSMO-SkyMed','Pleiades Neo','ICEYE','Meteosat','GOES','OneWeb']){search(name);assert.equal(results.children.length,1,name);key('Enter');assert.equal(navigations.pop(),pages.url(pages.search(name)[0].mode));}

search('debris');key('Tab');assert.equal(navigations.pop(),'/debris');
