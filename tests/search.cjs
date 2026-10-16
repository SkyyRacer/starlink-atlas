const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const source=fs.readFileSync('static/app.js','utf8');
const fields={search:{value:'11482'},status:{value:''},'search-alternative':{dataset:{}}};
const catalog=[{id:1,name:'STARLINK-11482',designator:'2026-225A'},{id:2,name:'STARLINK-114',designator:'2024-001A'}];
const ctx={Set,Map,catalog,byId:new Map(catalog.map(s=>[s.id,s])),esc:String,state:()=> 'orbit',$:id=>fields[id]};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const chosenYears='),source.indexOf('\nfunction sun')),ctx);
vm.runInContext("chosenYears.add('2024')",ctx);assert.equal(ctx.matches(catalog[0]),false);assert.equal(ctx.searchCandidates().length,1);ctx.showSearchAlternative([]);assert.equal(fields['search-alternative'].hidden,false);assert.ok(fields['search-alternative'].innerHTML.includes('2026-225'));
fields['search-alternative'].dataset.dismissed=vm.runInContext('searchPromptKey',ctx);ctx.showSearchAlternative([]);assert.equal(fields['search-alternative'].hidden,true);
fields.search.value='S';fields['search-ghost']={};ctx.updateSearchSuggestion();assert.equal(fields['search-ghost'].textContent,'STARLINK-');fields.search.value='11482';ctx.updateSearchSuggestion();assert.equal(fields['search-ghost'].textContent,'');
vm.runInContext("chosenYears.clear();revealedSearchId=1",ctx);fields.search.value='STARLINK-11482';assert.equal(ctx.matches(catalog[0]),true);assert.equal(ctx.matches(catalog[1]),false);
console.log('Suggestion et recherche hors filtres avec confirmation : OK');

fields.search.value='STARLINK-';ctx.updateSearchSuggestion();assert.equal(fields['search-ghost'].textContent,'STARLINK-114');
fields.search.value='starlink-11';ctx.updateSearchSuggestion();assert.equal(fields['search-ghost'].textContent,'starlink-114');
fields.search.value='STARLINK-1148';assert.equal(ctx.searchCompletion(),'STARLINK-11482');
fields.search.value='STARLINK-11482';assert.equal(ctx.searchCompletion(),'');
fields.search.value='STARLINK-999';assert.equal(ctx.searchCompletion(),'');
console.log('Complétion numérique progressive, correspondance exacte et absence de résultat : OK');

let chosen=null;ctx.choose=id=>chosen=id;fields.results={querySelector:()=>({dataset:{id:'2'}})};ctx.submitSearch();assert.equal(chosen,2);
fields.results.querySelector=()=>null;fields.search.value='11482';vm.runInContext("chosenYears.add('2024')",ctx);ctx.submitSearch();assert.equal(fields['search-alternative'].hidden,false);assert.ok(fields['search-alternative'].innerHTML.includes('data-reveal'));
fields.search.value='inexistant';ctx.submitSearch();assert.ok(fields['search-alternative'].innerHTML.includes('Aucun satellite trouvé'));assert.ok(!fields['search-alternative'].innerHTML.includes('data-reveal'));
console.log('Entrée : premier résultat affiché, filtres bloquants et zéro résultat : OK');

assert.ok(source.includes("submitSearch();$('search').blur();return;"));
