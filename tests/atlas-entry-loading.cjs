const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const guard=fs.readFileSync('static/desktop-viewport-guard.js','utf8'),loading=fs.readFileSync('static/loading.js','utf8'),html=fs.readFileSync('static/index.html','utf8');
function boot({url='https://example.org/atlas',asset='https://example.org/desktop-viewport-guard.js',small=false,mobile=false,storage=new Map()}={}){
 const {window}=parseHTML(html),document=window.document,frames=new Map(),timers=[];let clock=0,serial=0;
 const create=document.createElement.bind(document);
 document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.open=false;node.showModal=()=>node.open=true;node.close=()=>node.open=false;}return node;};
 Object.defineProperty(document,'currentScript',{value:{src:asset}});
 Object.defineProperty(document,'readyState',{value:'complete'});
 const browser={sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},location:{href:url},innerWidth:small?800:1400,innerHeight:small?700:1100,addEventListener(){}};
 const context={window:browser,document,URL,navigator:{userAgent:mobile?'iPhone Mobile':'Windows',maxTouchPoints:mobile?5:0},matchMedia:q=>({matches:q.includes('max-width')?(browser.innerWidth<1000||browser.innerHeight<650):q.includes('coarse')?mobile:q.includes('fine')?!mobile:true,addEventListener(){}}),performance:{now:()=>clock},requestAnimationFrame:fn=>(frames.set(++serial,fn),serial),cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>timers.push(fn),CustomEvent:window.CustomEvent};
 vm.createContext(context);vm.runInContext(guard,context);
 const entry=document.documentElement.dataset.atlasEntryLoading==='true';
 vm.runInContext(loading,context);
 const overlay=document.getElementById('catalog-loader'),view=document.querySelector('.view');
 return {document,entry,overlay,view,browser,get mask(){return document.getElementById('desktop-viewport-guard');},finish(){for(const p of ['config','catalog','scene','positions'])browser.AtlasLoading.done(p);clock+=200;for(const fn of [...frames.values()])fn();frames.clear();while(timers.length)timers.shift()();},fail(){browser.AtlasLoading.fail();},begin(){browser.AtlasLoading.begin('Date historique');}};
}
for(const [url,asset] of [
 ['https://example.org/atlas','https://example.org/desktop-viewport-guard.js'],
 ['https://example.org/','https://example.org/desktop-viewport-guard.js'],
 ['https://example.org/starlink-atlas/atlas/','https://example.org/starlink-atlas/desktop-viewport-guard.js'],
 ['https://example.org/starlink-atlas/','https://example.org/starlink-atlas/desktop-viewport-guard.js'],
])for(const small of [false,true]){
 const a=boot({url,asset,small});assert.equal(a.entry,true);assert.equal(a.document.documentElement.dataset.atlasResetPreferences,'true','First entry resets display preferences');assert.equal(a.mask,null,'Size guard must wait while data load');
 assert.equal(a.overlay.parentNode,a.document.body,'Splash covers the header and all menus');
 assert.ok(a.overlay.querySelector('.catalog-entry-logo'));
 a.finish();assert.equal(a.document.getElementById('catalog-percent').textContent,'100');assert.equal(a.overlay.hidden,true);
 assert.equal(a.document.documentElement.dataset.atlasEntryLoading,undefined);
 assert.equal(a.overlay.parentNode,a.view,'Restore the normal timeline loader inside its view');
 assert.equal(!!a.mask?.open,small,'After data load show either the map or the size guard');
 a.begin();assert.equal(a.overlay.hidden,false);assert.equal(a.document.documentElement.dataset.atlasEntryLoading,undefined,'Later timeline loads never reuse the splash');
}
for(const url of ['https://example.org/atlas?journey=1&at=123','https://example.org/starlink','https://example.org/moon.html']){
 const a=boot({url});assert.equal(a.entry,false,'Journeys and other pages keep their loader');assert.equal(a.overlay.parentNode,a.view);
}
const phone=boot({mobile:true,small:true});assert.equal(phone.entry,true);phone.finish();assert.equal(phone.mask,null,'Mobile gets the splash but never a size guard');
const failed=boot();failed.fail();assert.equal(failed.overlay.hidden,true);assert.equal(failed.document.documentElement.dataset.atlasEntryLoading,undefined,'Errors release the splash so the underlying error can be read');
assert.match(html,/<script src="\/desktop-viewport-guard.js/,'Entry bootstrap runs in the head before first paint');
console.log('Atlas entry card: local and GitHub Pages routes, real 100%, size guard deferred, Moon return and timeline excluded, mobile and failure release OK.');

const session=new Map();
const first=boot({storage:session});assert.equal(first.entry,true);first.finish();
for(const url of ['https://example.org/atlas','https://example.org/atlas?debris=1','https://example.org/atlas?journey=1&at=123','https://example.org/']){
 const back=boot({url,storage:session});assert.equal(back.entry,false,'All ordinary returns and refreshes skip the entry card');
}
const logo=first.document.getElementById('atlas-home');logo.dispatchEvent(new first.document.defaultView.Event('click',{bubbles:true}));
const requested=boot({storage:session});assert.equal(requested.entry,true,'Logo explicitly replays the card');requested.finish();
assert.equal(boot({storage:session}).entry,false,'The logo request is consumed once');
// The Moon logo shares the same capture handler and keeps its journey URL.
const moon=boot({url:'https://example.org/moon.html',storage:session});
const lunarLogo=moon.document.createElement('a');lunarLogo.id='earth-home';moon.document.body.append(lunarLogo);
lunarLogo.dispatchEvent(new moon.document.defaultView.Event('click',{bubbles:true}));
assert.equal(boot({url:'https://example.org/atlas?journey=1&at=123',storage:session}).entry,true,'Moon logo replays entry while retaining journey preferences');
assert.equal(boot({storage:session}).entry,false);
console.log('Per-tab session: first Atlas visit only, all ordinary returns excluded, Atlas and Moon logos replay exactly once OK.');

for(const mission of require('../static/pages.js').definitions.filter(row=>row.trajectory))for(const prefix of ['', '/starlink-atlas']){
 const a=boot({url:'https://example.org'+prefix+'/'+mission.id+'/',asset:'https://example.org'+prefix+'/desktop-viewport-guard.js',storage:new Map([['atlas-entry-seen-v1','1']])});
 assert.equal(a.entry,true,mission.id+' always uses the Atlas card, including return visits');assert.equal(a.document.documentElement.dataset.missionPage,'true');assert.equal(a.document.documentElement.dataset.atlasResetPreferences,undefined,'Mission splash preserves display preferences');assert.equal(a.overlay.parentNode,a.document.body);
 a.finish();assert.notEqual(a.overlay.hidden,true,'Data alone cannot dismiss a mission with visuals still pending');assert.equal(a.browser.AtlasLoading.missionFrameReady,true);assert.equal(a.document.getElementById('catalog-percent').textContent,'75','Progress waits for actual model and frame readiness before reaching 100 percent');
 a.browser.AtlasLoading.done('visuals');a.finish();assert.equal(a.overlay.hidden,true,'First complete rendered image dismisses the card');assert.equal(a.document.documentElement.dataset.atlasEntryLoading,undefined);
 a.browser.AtlasLoading.retry();assert.equal(a.overlay.hidden,true,'Background scans never reopen the splash');
 a.begin();assert.equal(a.overlay.hidden,false);assert.equal(a.document.documentElement.dataset.atlasEntryLoading,'true');a.finish();assert.equal(a.overlay.hidden,false,'Date transitions also wait for a new complete frame');a.browser.AtlasLoading.done('visuals');a.finish();assert.equal(a.overlay.hidden,true);
 a.begin();a.fail();assert.equal(a.overlay.hidden,true,'Failed resources release the splash to show the error or unavailable-data card');
}
assert.match(fs.readFileSync('static/desktop-viewport-guard.css','utf8'),/html\[data-mission-page=true\] :is\(\.loading-earth,#model-loader\)\{display:none!important\}/);
console.log('All distant missions: one logo card on local and GitHub paths, no old progress bars, real visual readiness, date reloads, background refresh and failure release OK.');
const earthPreferences=new Map([['atlas-display-preferences-v1',JSON.stringify({realistic:false,sky:true})]]);
const earthEntry=boot({url:'https://example.org/atlas?view=earth',storage:earthPreferences});assert.equal(earthEntry.entry,true);assert.equal(earthEntry.document.documentElement.dataset.atlasResetPreferences,undefined,'The solar Earth entry preserves the previous page sky preference');assert.equal(JSON.parse(earthPreferences.get('atlas-display-preferences-v1')).sky,true);
