const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/lunar-journey.js','utf8');
for(const prefix of ['/','/starlink-atlas/']){
 const values=new Map(),destinations=[];const context={URL,Date,JSON,Number,document:{documentElement:{dataset:{}},currentScript:{src:'https://atlas.invalid'+prefix+'lunar-journey.js'}},window:{events:{},addEventListener(type,fn){this.events[type]=fn;},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},location:{href:'https://atlas.invalid'+prefix+'atlas/',assign:url=>destinations.push(url)}}};
 vm.createContext(context);vm.runInContext(source,context);const api=context.window.AtlasJourney;assert.equal(api.normalize({at:Date.parse('1959-05-07T21:04:36Z')}).at,Date.parse('1959-05-07T21:04:36Z'),'Pre-1970 history is preserved during Earth/Moon journeys');assert.equal(api.read(),null,'First Atlas opening has no restored view');
 const state={at:Date.parse('2024-04-01T12:30:00Z'),live:false,playing:true,speed:'5',realistic:true,sky:true};api.bind(()=>state);api.save();assert.equal(api.read(),null,'A direct Atlas opening ignores old saved sky and realistic settings');api.goMoon();assert.ok(destinations[0].startsWith('https://atlas.invalid'+prefix+'moon.html?'));
 context.window.location.href=destinations[0];assert.equal(api.read().at,state.at);assert.equal(api.read().speed,'5');assert.equal(api.read().realistic,true);assert.equal(api.read().sky,true);
 api.goEarth();assert.ok(destinations[1].startsWith('https://atlas.invalid'+prefix+(prefix==='/'?'atlas?':'atlas/?')));context.window.location.href=destinations[1];assert.equal(api.read().at,state.at);
 context.window.location.href='https://atlas.invalid'+prefix+'hubble';assert.equal(api.preferences().realistic,true,'Satellite navigation keeps realistic display');assert.equal(api.preferences().sky,true,'Satellite navigation keeps stars');
 context.document.documentElement.dataset.atlasResetPreferences='true';assert.equal(api.preferences().realistic,false,'Logo and first Atlas arrival reset realism');assert.equal(api.preferences().sky,false,'Logo and first Atlas arrival reset stars');delete context.document.documentElement.dataset.atlasResetPreferences;
 context.window.location.href=destinations[1];
 context.document.getElementById=id=>({getAttribute:()=>id==='sky-toggle'?'false':'true'});
 context.window.events.pagehide();assert.equal(api.preferences().sky,true,'Navigation before scene ready preserves prior preferences');
 context.window.AtlasDisplayReady=true;context.window.events.pagehide();assert.equal(api.preferences().realistic,true);assert.equal(api.preferences().sky,false,'Successful controls are saved on every page departure');
 let restored=null;context.window.AtlasRestoreDisplay=value=>{restored=value;return Promise.resolve();};context.document.documentElement.dataset.atlasResetPreferences='true';context.window.events.pageshow({persisted:true});assert.equal(restored.realistic,true,'Browser back restores current preferences instead of replaying initial reset');assert.equal(restored.sky,false);delete context.document.documentElement.dataset.atlasResetPreferences;
 context.window.sessionStorage.getItem=()=>{throw Error('Storage unavailable');};assert.equal(api.read().at,state.at,'URL preserves preferences even when storage is unavailable');
}
const html=fs.readFileSync('static/moon.html','utf8');assert.doesNotMatch(html,/src="\/(app|globe|transport|iss-missions|browser-worker|collection-menu)\.js/);assert.ok(html.includes('id="lunar-recenter"'));
const page=fs.readFileSync('static/lunar-page.js','utf8');assert.doesNotMatch(page,/api\/(catalog|positions)|atlas_web_core|browser-worker/);
console.log('Terre/Lune : navigation réelle, préférences conservées, routes natives et GitHub, stockage indisponible, page lunaire sans catalogue/positions et recentrage OK.');
