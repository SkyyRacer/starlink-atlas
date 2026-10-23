const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const source=fs.readFileSync('static/desktop-viewport-guard.js','utf8');
function app({width=1200,height=1100,coarse=false,mouse=true,agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/150',touch=0,mobile=false}={}){
 const {window}=parseHTML('<html><body><main><button id="menu">Menu</button></main></body></html>'),document=window.document,events=new Map(),media=[];
 const create=document.createElement.bind(document);let opens=0,closes=0;
 document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.open=false;node.showModal=()=>{node.open=true;opens++;};node.close=()=>{node.open=false;closes++;};}return node;};
 const screen={innerWidth:width,innerHeight:height,addEventListener(type,handler){events.set(type,handler);}};
 const context={window:screen,document,navigator:{userAgent:agent,maxTouchPoints:touch,userAgentData:{mobile}},matchMedia(query){const value={matches:query.includes('coarse')?coarse:mouse,addEventListener(type,handler){this.changed=handler;}};media.push(value);return value;},requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(source,context);
 return {document,get mask(){return document.getElementById('desktop-viewport-guard');},resize(w,h){screen.innerWidth=w;screen.innerHeight=h;events.get('resize')();},get opens(){return opens;},get closes(){return closes;},window,media};
}
for(const [w,h] of [[999,1000],[1000,999],[700,700],[1600,900]]){
 const a=app({width:w,height:h});assert.equal(a.mask.open,true);assert.equal(a.mask.textContent,'Agrandissez votre fenêtre');assert.ok(a.mask.querySelector('img[alt=Atlas]'));assert.equal(a.mask.querySelector('.viewport-guard-dimensions'),null);
 const cancel=new a.window.Event('cancel',{cancelable:true});a.mask.dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true,'Escape cannot dismiss the size mask');
 a.resize(1000,1000);assert.equal(a.mask.open,false,'Both dimensions meeting the minimum removes the mask');assert.equal(a.closes,1);
 a.resize(999,1000);assert.equal(a.mask.open,true);assert.equal(a.opens,2);assert.equal(a.document.querySelectorAll('#desktop-viewport-guard').length,1,'Resize reuses the mask');
}
for(const [w,h] of [[1000,1000],[1800,1000],[1000,1400]])assert.equal(app({width:w,height:h}).mask,null);
for(const options of [
 {agent:'Mozilla/5.0 (iPhone) Mobile',coarse:true,mouse:false},
 {agent:'Mozilla/5.0 (Linux; Android 15)',coarse:true,mouse:false},
 {agent:'Mozilla/5.0 (Linux; Android 15)',mouse:true},
 {agent:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605',touch:5,mouse:true},
 {agent:'Mozilla/5.0 (iPad)',mouse:true},
 {agent:'Mozilla/5.0',mobile:true,mouse:true},
 {agent:'Mozilla/5.0',coarse:true,mouse:true},
]){const a=app({...options,width:400,height:700});assert.equal(a.mask,null,'Phones and tablets, including attached mice, remain exempt');a.resize(300,500);assert.equal(a.mask,null);}
const desktopMac=app({width:900,height:900,agent:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605',touch:0});assert.equal(desktopMac.mask.open,true);
for(const name of ['index','moon'])assert.match(fs.readFileSync('static/'+name+'.html','utf8'),/desktop-viewport-guard.js\?v=/);
console.log('Desktop size mask: exact 1000×1000 boundary, automatic close/reopen, modal Escape protection, Mac/Windows, mobile/tablet and iPadOS exemptions OK.');
