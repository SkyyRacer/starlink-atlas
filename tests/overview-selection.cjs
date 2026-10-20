const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
async function check(){
 const {window}=parseHTML(fs.readFileSync('static/index.html','utf8')),document=window.document,$=id=>document.getElementById(id);document.body.dataset.collection='all';$('atlas-controls').hidden=false;for(const box of document.querySelectorAll('[data-family]'))box.checked=box.hasAttribute('checked');
 const context={document,Event:window.Event,MutationObserver:window.MutationObserver,queueMicrotask};vm.runInNewContext(fs.readFileSync('static/overview-selection.js','utf8'),context);
 const root=$('overview-selection'),source=document.querySelector('[data-family=iss]'),proxy=root.querySelector('[data-selection-family=iss]');assert.ok(root);assert.equal(proxy.checked,source.checked);assert.equal(root.querySelector('[data-selection-family=debris]'),null);
 let changes=0;source.addEventListener('change',()=>changes++);proxy.checked=false;proxy.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(source.checked,false);assert.equal(changes,1);
 const stations=root.querySelector('.overview-selection-panel details'),bulk=stations.querySelector('input');assert.equal(bulk.indeterminate,true);bulk.checked=true;bulk.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(source.checked,true);assert.equal(proxy.checked,true);
 root.querySelectorAll('.overview-selection-actions button')[1].click();assert.ok([...root.querySelectorAll('[data-selection-family]')].every(box=>box.checked===false));
 root.querySelector('.overview-selection-actions button').click();assert.ok([...root.querySelectorAll('[data-selection-family]')].every(box=>box.checked===true));
 source.checked=false;source.dispatchEvent(new window.Event('change',{bubbles:true}));await new Promise(r=>setImmediate(r));assert.equal(proxy.checked,false,'Top category controls synchronize');
 $('advanced-model-options').dataset.following='true';await new Promise(r=>setImmediate(r));assert.equal(root.hidden,true);$('advanced-model-options').dataset.following='false';await new Promise(r=>setImmediate(r));assert.equal(root.hidden,false);
 root.open=true;document.dispatchEvent(new window.Event('pointerdown',{bubbles:true}));assert.equal(root.open,false);
 const {document:other}=parseHTML(fs.readFileSync('static/index.html','utf8'));other.body.dataset.collection='iss';other.getElementById('atlas-controls').hidden=true;vm.runInNewContext(fs.readFileSync('static/overview-selection.js','utf8'),{...context,document:other});assert.equal(other.getElementById('overview-selection'),null);
 assert.equal($('earth-realistic-toggle').closest('.earth-view-controls'),$('view-3d').closest('.earth-view-controls'));
 console.log('Atlas overview selection: per-family, bulk category, all/none, source synchronization, following visibility, outside click and dedicated pages OK.');
}
check().catch(e=>{console.error(e.message,e.stack?.split('\n')[1]);process.exitCode=1;});
