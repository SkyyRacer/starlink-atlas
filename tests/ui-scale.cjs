const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('static/ui-scale.js','utf8');
function boot(width,height,{mobile=false,supported=true}={}){
 const vars=new Map(),events={},root={dataset:{},style:{getPropertyValue:k=>vars.get(k),setProperty:(k,v)=>vars.set(k,v)}};
 const window={innerWidth:width,innerHeight:height,addEventListener:(name,fn)=>events[name]=fn};
 const desktop={get matches(){return window.innerWidth>=901;},addEventListener(){}};
 vm.runInNewContext(source,{window,document:{documentElement:root},navigator:{userAgent:mobile?'iPad':'Windows',maxTouchPoints:mobile?5:0},CSS:{supports:()=>supported},matchMedia:()=>desktop});
 return {window,root,resize(w,h){window.innerWidth=w;window.innerHeight=h;events.resize();}};
}
const a=boot(2048,1060);assert.equal(a.window.AtlasUI.scale,1,'Reference Mac proportions remain unchanged');
a.resize(1280,720);assert.equal(a.window.AtlasUI.scale,.82);
const panel={style:{}};a.window.AtlasUI.place(panel,{left:410,top:82,width:287,maxHeight:410});
for(const [key,physical] of Object.entries({left:410,top:82,width:287,maxHeight:410}))assert.ok(Math.abs(parseFloat(panel.style[key])*.82-physical)<.001,'Menu '+key+' remains in viewport coordinates');
a.resize(2560,1440);assert.equal(a.window.AtlasUI.scale,1.2);
a.resize(900,700);assert.equal(a.window.AtlasUI.scale,1);assert.equal(a.root.dataset.desktopUi,'false');
assert.equal(boot(1200,800,{mobile:true}).root.dataset.desktopUi,'false','Tablet keeps its existing layout');
assert.equal(boot(1200,800,{supported:false}).window.AtlasUI.scale,1,'Older browser retains normal geometry');
for(const name of ['index','moon'])assert.match(fs.readFileSync('static/'+name+'.html','utf8'),/ui-scale.js\?v=/);
const css=fs.readFileSync('static/ui-scale.css','utf8');assert.doesNotMatch(css,/\b(?:body|canvas|#globe-canvas)\s*\{[^}]*zoom/,'Scale UI containers, never the scene or the body');
console.log('Shared UI scale: Mac reference unchanged, small and large desktops, one scale per panel, attached popup coordinates, tablet and older browser fallback OK.');
