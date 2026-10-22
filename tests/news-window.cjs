const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
(async()=>{
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document;
 const dialog=document.getElementById('orbital-news-dialog');dialog.showModal=()=>{dialog.open=true;};dialog.show=dialog.showModal;dialog.close=()=>{dialog.open=false;};
 const now=Date.parse('2026-10-22T20:00:00Z'),items=Array.from({length:125},(_,id)=>({id:String(id),family:'starlink',label:'Starlink',kind:'addition',at:'2026-10-22T12:00:00Z',objects:[{id:id+1,name:'Satellite '+id}]}));
 items.push({id:'eva',kind:'eva',category:'stations',family:'iss',title:'EVA confirmée',at:'2026-10-20T10:00:00Z',crew:[{name:'Astronaute test'}],objects:[]});items.push({id:'old',kind:'addition',at:'2026-10-10T00:00:00Z',objects:[]});
 const script=document.createElement('script');script.src='https://atlas.invalid/news.js';Object.defineProperty(document,'currentScript',{value:script});
 const context={document,window:{AtlasStatic:null},AtlasPages:require('../static/pages.js'),URL,Intl,Number,Date:class extends Date{static now(){return now;}},fetch:async()=>({ok:true,json:async()=>({items})})};
 vm.runInNewContext(fs.readFileSync('static/news.js','utf8'),context);document.getElementById('orbital-news-button').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(document.querySelector('.news-intro').textContent,'Changements signalés depuis le 15/10/2026');
 assert.equal(document.querySelectorAll('.news-item').length,126,'All recent events are shown beyond 60, old records excluded');assert.equal(document.querySelectorAll('.news-theme').length,2);assert.ok(document.querySelector('[data-theme="stations"]').textContent.includes('EVA confirmée'));
 assert.equal(document.querySelectorAll('.news-objects li').length,0,'Object lists are deferred until opened');const objects=document.querySelector('.news-objects');objects.open=true;objects.dispatchEvent(new window.Event('toggle'));assert.equal(objects.querySelectorAll('li').length,1);assert.ok(objects.querySelector('a').getAttribute('href').includes('satellite='));
 console.log('Actualités : 126 événements sans plafond, fenêtre de sept jours, groupes thématiques, EVA et listes d’objets différées OK.');
})().catch(error=>{console.error(error);process.exitCode=1;});
