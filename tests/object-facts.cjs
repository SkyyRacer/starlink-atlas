const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),api=require('../static/object-facts.js'),{facts,load,profile,weight}=api,registry=require('../static/constellations.js');
const read=async file=>JSON.parse(fs.readFileSync(path.join('static',file)));
const compact=value=>value.replace(/[\s\u202f\u00a0]/g,'');
(async()=>{
 for(const definition of registry.definitions){const s={id:definition.ids[0]||99999999,name:definition.label,family:definition.id};assert.ok(facts(s).type,definition.id+' has a known category');}
 assert.equal(weight(999),'999 kg');assert.equal(weight(1000),'1 t');assert.equal(weight(1500),'1,5 t');assert.equal(weight(null),null);assert.equal(weight(0),null);assert.equal(weight(NaN),null);assert.equal(weight(575,true),'≈ 575 kg');
 const iss={id:25544,launch:'1998-11-20'};let rows=profile(iss,{altitude_km:420,speed_km_s:7.66},{orbit:'LEO',launch:'20 novembre 1998'});
 assert.deepEqual(rows.map(r=>r[0]),['NORAD','Type de satellite','Type d’orbite','Envergure','Longueur','Poids','Date et lieu de lancement','Altitude','Vitesse']);
 assert.equal(compact(rows.at(-1)[1]),'27576km/h');assert.match(rows.find(r=>r[0]==='Date et lieu de lancement')[1],/Baïkonour/);assert.match(facts(iss).mass,/ t$/);
 const unknown={id:99999999,name:'UNKNOWN'};assert.deepEqual(profile(unknown,null,{orbit:'Non déterminé'}).map(r=>r[0]),['NORAD'],'Unknown facts are absent, not placeholder lines');
 const samples=[
  [44235,'STARLINK-31','2019-029A','2019-05-24','V0.9','227kg'],
  [44714,'STARLINK-1008','2019-074B','2019-11-11','V1.0','260kg'],
  [49131,'STARLINK-3096','2021-082A','2021-09-14','V1.5','297kg'],
  [58480,'STARLINK-30984','2023-186H','2023-12-03','V2 Mini','730kg'],
  [62758,'STARLINK-33596','2025-018A','2025-01-21','V2 Mini optimisé','575kg'],
  [58705,'STARLINK-11072','2024-002A','2024-01-03','V2 Mini · Direct to Cell','960kg']
 ];
 for(const [id,name,designator,launch,generation,mass] of samples){const s={id,name,designator,launch};await load(s,read);const f=facts(s);assert.equal(f.generation,generation);assert.equal(compact(f.mass),mass);assert.ok(f.span);assert.ok(f.length);assert.ok(f.type.includes(generation));}
 const v15={id:49131,name:'STARLINK-3096',launch:'2023-12-03'};assert.equal(facts(v15).generation,'V1.5','Timeline/date cannot change the generation assigned to a physical object');
 assert.equal(facts({id:99999999,name:'STARLINK-NEW',launch:'2026-10-26'}).generation,null,'Do not invent a generation from date alone for an unclassified new object');
 const noPoint=profile({id:58480,name:'STARLINK-30984'},null,{orbit:'LEO'});assert.ok(!noPoint.some(r=>['Altitude','Vitesse'].includes(r[0])));
 const distant=profile({id:10321,family:'voyager-1'},{icrf_km:[300000000,400000000,0],speed_km_s:17},{distant:true,orbit:'Orbite héliocentrique'});assert.equal(compact(distant.find(r=>r[0]==='Distance de la Terre')[1]),'500000000km');
 assert.match(facts({id:2}).length,/0,58/);assert.equal(facts({id:1}).length,null,'Sputnik 1 is NORAD 2, never the associated launch stage');
 assert.equal(facts({id:33500,object_type:'R/B'}).type,'Étage / corps de fusée');assert.equal(compact(facts({id:33500}).mass),'≈3t');assert.match(facts({id:33500}).massNote,/jaxa/);
 assert.equal(facts({id:39162,object_type:'DEB'}).type,'Débris spatial');assert.equal(facts({id:39162}).mass,'112 kg');
 assert.equal(facts({id:9999999,object_type:'DEB',rcs:12}).mass,null,'Radar cross section cannot supply a fragment mass');assert.equal(facts({id:9999999,object_type:'DEB',rcs:12}).length,null);
 assert.equal(facts({id:16609}).mass,'130–140 t');assert.equal(facts({id:4}).mass,'13,9 kg');
 await load(iss,read);const detailed=profile(iss,null,{launch:'20 novembre 1998'});assert.match(detailed.find(r=>r[0]==='Lanceur')[1],/Proton/);const dateIndex=detailed.findIndex(r=>r[0]==='Date et lieu de lancement');assert.equal(detailed[dateIndex+1][0],'Lanceur');
 for(const [id,pattern] of [[50463,/Ariane/],[36577,/H-IIA|H-2A/],[10321,/Titan/],[1,/Sputnik/]]){await load({id},read);assert.match(facts({id}).launchVehicle,pattern);}
 assert.ok(!profile({id:99999999},null).some(r=>r[0]==='Lanceur'),'Unknown launcher remains absent');
 let attempts=0;await assert.rejects(()=>load({id:2001},async()=>{attempts++;throw Error('offline');}));await load({id:2001},async()=>{attempts++;return {};});assert.equal(attempts,2,'Failed metadata requests may recover');
 console.log('Object profiles: exact ordering, absent facts omitted, km/h, kg/tonne boundary, GCAT identity/generations, launch sites, missing positions and lazy-load recovery OK.');
})().catch(error=>{console.error(error);process.exitCode=1;});
