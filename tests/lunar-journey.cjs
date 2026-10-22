const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/lunar-journey.js','utf8');
for(const prefix of ['/','/starlink-atlas/']){
 const values=new Map(),destinations=[];const context={URL,Date,JSON,Number,document:{currentScript:{src:'https://atlas.invalid'+prefix+'lunar-journey.js'}},window:{sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},location:{href:'https://atlas.invalid'+prefix+'atlas/',assign:url=>destinations.push(url)}}};
 vm.createContext(context);vm.runInContext(source,context);const api=context.window.AtlasJourney;assert.equal(api.read(),null,'First Atlas opening has no restored view');
 const state={at:Date.parse('2024-04-01T12:30:00Z'),live:false,playing:true,speed:'5',realistic:true,sky:true};api.bind(()=>state);api.save();assert.equal(api.read(),null,'A direct Atlas opening ignores old saved sky and realistic settings');api.goMoon();assert.ok(destinations[0].startsWith('https://atlas.invalid'+prefix+'moon.html?'));
 context.window.location.href=destinations[0];assert.equal(api.read().at,state.at);assert.equal(api.read().speed,'5');assert.equal(api.read().realistic,true);assert.equal(api.read().sky,true);
 api.goEarth();assert.ok(destinations[1].startsWith('https://atlas.invalid'+prefix+(prefix==='/'?'atlas?':'atlas/?')));context.window.location.href=destinations[1];assert.equal(api.read().at,state.at);
 context.window.sessionStorage.getItem=()=>{throw Error('Storage unavailable');};assert.equal(api.read().at,state.at,'URL preserves preferences even when storage is unavailable');
}
const html=fs.readFileSync('static/moon.html','utf8');assert.doesNotMatch(html,/src="\/(app|globe|transport|iss-missions|browser-worker|collection-menu)\.js/);assert.ok(html.includes('id="lunar-recenter"'));
const page=fs.readFileSync('static/lunar-page.js','utf8');assert.doesNotMatch(page,/api\/(catalog|positions)|atlas_web_core|browser-worker/);
console.log('Terre/Lune : navigation réelle, préférences conservées, routes natives et GitHub, stockage indisponible, page lunaire sans catalogue/positions et recentrage OK.');
