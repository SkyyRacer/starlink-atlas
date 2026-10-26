const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
for(const file of ['index.html','moon.html']){
 const {window}=parseHTML(fs.readFileSync('static/'+file,'utf8')),document=window.document;let toggles=0;document.getElementById('play').onclick=()=>toggles++;
 vm.runInNewContext(fs.readFileSync('static/timeline-shortcuts.js','utf8'),{document});
 function key(target,options={}){const e=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key:' ',code:'Space'},options);target.dispatchEvent(e);return e;}
 assert.equal(key(document.body).defaultPrevented,true);assert.equal(toggles,1);key(document.body,{repeat:true});assert.equal(toggles,1);key(document.body);assert.equal(toggles,2);
 for(const tag of ['input','textarea','select','button','a','summary']){const e=document.createElement(tag);document.body.append(e);assert.equal(key(e).defaultPrevented,false);}
 const edit=document.createElement('div');edit.setAttribute('contenteditable','true');document.body.append(edit);key(edit);assert.equal(toggles,2);
 key(document.body,{ctrlKey:true});assert.equal(toggles,2);const modal=document.createElement('dialog');modal.setAttribute('open','');document.body.append(modal);key(document.body);assert.equal(toggles,2);
 assert.match(fs.readFileSync('static/'+file,'utf8'),/timeline-shortcuts\.js/);
}
console.log('Space: play/pause on Earth and Moon; no repeat, input, editing, button or modal interference OK.');
