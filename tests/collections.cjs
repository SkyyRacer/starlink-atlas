const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/app.js','utf8');
const fields={status:{value:''},search:{value:''},'debris-type':{value:''},'debris-owner':{value:''}};
const ctx={document:{addEventListener(){}},AtlasPages:require('../static/pages.js'),collectionMode:'starlink',atlasGroups:new Set(['galileo','gps','iss','starlink']),revealedSearchId:null,byId:new Map(),Set,state:()=> 'orbit',$:id=>fields[id]};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const chosenYears='),source.indexOf('\nfunction sun')),ctx);
const station={id:25544,name:'ISS (ZARYA)',designator:'1998-067A'},starlink={id:56910,name:'STARLINK-1',designator:'2023-083A'};
assert.equal(ctx.matches(station),false);assert.equal(ctx.matches(starlink),true);
ctx.collectionMode='iss';fields.search.value='unrelated';assert.equal(ctx.matches(station),true);assert.equal(ctx.matches(starlink),false);
ctx.collectionMode='all';assert.equal(ctx.matches(station),true);assert.equal(ctx.matches(starlink),true);
ctx.atlasGroups.delete('iss');assert.equal(ctx.matches(station),false);assert.equal(ctx.matches(starlink),true);
ctx.atlasGroups.clear();assert.equal(ctx.matches(starlink),false);
console.log('Collections ISS / Starlink / Atlas : isolation et sélection multiple OK');

const galileo={id:37846,name:'GSAT0101 (GALILEO-PFM)',family:'galileo',designator:'2011-060A'};
ctx.collectionMode='galileo';fields.search.value='';assert.equal(ctx.matches(galileo),true);assert.equal(ctx.matches(starlink),false);assert.equal(ctx.matches(station),false);
ctx.collectionMode='starlink';assert.equal(ctx.matches(galileo),false);
ctx.collectionMode='all';ctx.atlasGroups.add('galileo');assert.equal(ctx.matches(galileo),true);ctx.atlasGroups.delete('galileo');assert.equal(ctx.matches(galileo),false);
console.log('Galileo : page isolée, présence et masquage indépendants dans Atlas OK');

ctx.collectionMode='galileo';fields.status.value='inactive';assert.equal(ctx.matches({...galileo,ops:'-'}),true);assert.equal(ctx.matches({...galileo,ops:'+'}),false);fields.status.value='decayed';assert.equal(ctx.matches({...galileo,ops:'-'}),false);fields.status.value='';
const current=JSON.parse(fs.readFileSync('data/galileo-catalog.json'));assert.ok(current.some(s=>s.OBJECT_NAME.includes('GIOVE-A')));assert.ok(current.some(s=>s.OBJECT_NAME.includes('GIOVE-B')));
assert.match(fs.readFileSync('static/theme.css','utf8'),/body\[data-constellation="true"\] #view-side\{display:none\}/);
console.log('Galileo : prototypes présents, filtre hors service distinct de désorbité, vue de côté masquée OK');

const gps={id:26407,name:'NAVSTAR 48 (USA 151)',family:'gps',designator:'2000-040A',ops:'+'};
ctx.collectionMode='gps';assert.equal(ctx.matches(gps),true);assert.equal(ctx.matches(galileo),false);assert.equal(ctx.matches(station),false);assert.equal(ctx.matches(starlink),false);
ctx.collectionMode='galileo';assert.equal(ctx.matches(gps),false);ctx.collectionMode='starlink';assert.equal(ctx.matches(gps),false);
ctx.collectionMode='all';ctx.atlasGroups.add('gps');assert.equal(ctx.matches(gps),true);ctx.atlasGroups.delete('gps');assert.equal(ctx.matches(gps),false);
ctx.collectionMode='gps';fields.status.value='inactive';assert.equal(ctx.matches({...gps,ops:'-'}),true);assert.equal(ctx.matches(gps),false);
console.log('GPS : famille NAVSTAR / GPS reconnue, filtres et masquage Atlas isolés OK');

const registry=require('../static/constellations.js'),samples=JSON.parse(fs.readFileSync('resources/constellation-examples.json'));
for(const [family,point] of Object.entries(samples)){
 const satellite={id:point.NORAD_CAT_ID,name:point.OBJECT_NAME,designator:point.OBJECT_ID};assert.equal(registry.family(satellite),family);
 ctx.collectionMode=family;fields.status.value='';assert.equal(ctx.matches(satellite),true);assert.equal(ctx.matches(starlink),false);ctx.collectionMode='starlink';assert.equal(ctx.matches(satellite),false);
 ctx.collectionMode='all';ctx.atlasGroups.add(family);assert.equal(ctx.matches(satellite),true);ctx.atlasGroups.delete(family);assert.equal(ctx.matches(satellite),false);
 ctx.collectionMode=family;fields.status.value='inactive';assert.equal(ctx.matches({...satellite,ops:'-'}),true);assert.equal(ctx.matches({...satellite,ops:'+'}),false);
}
for(const [id,name] of [[41798,'SENTINEL-1A DEB'],[11970,'GOES 4 AKM']])assert.equal(registry.family({id,name}),'debris');
for(const [id,name] of [[38012,'PLEIADES 1A'],[123,'COSMOS 9999']])assert.equal(registry.family({id,name}),null);
console.log('Onze nouvelles familles : alias, exclusion des débris, isolation, filtre hors service et visibilité Atlas OK');

const debris={id:41798,name:'SENTINEL-1A DEB',family:'debris',object_type:'DEB',owner:'ESA',designator:'2014-016B'};
ctx.collectionMode='debris';fields.status.value='';assert.equal(ctx.matches(debris),true);assert.equal(ctx.matches(starlink),false);
fields['debris-type'].value='R/B';assert.equal(ctx.matches(debris),false);assert.equal(ctx.matches({...debris,object_type:'R/B'}),true);fields['debris-type'].value='';
fields['debris-owner'].value='US';assert.equal(ctx.matches(debris),false);fields['debris-owner'].value='ESA';assert.equal(ctx.matches(debris),true);fields['debris-owner'].value='';
ctx.collectionMode='sentinel';assert.equal(ctx.matches(debris),false);ctx.collectionMode='all';ctx.atlasGroups.add('debris');assert.equal(ctx.matches(debris),true);ctx.atlasGroups.delete('debris');assert.equal(ctx.matches(debris),false);
console.log('Débris : tous programmes, fragments / étages, origine, séparation des charges utiles et visibilité Atlas OK');
