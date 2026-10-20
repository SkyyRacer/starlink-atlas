const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},URL,document:{currentScript:{src:'http://localhost/iss-visual.js'}}};
vm.runInNewContext(fs.readFileSync('static/iss-visual.js','utf8'),context);
const size=context.window.AtlasISS.screenSize;
for(const [width,height] of [[320,500],[390,650],[1400,900]]){
 const far=size(width,height,28000000,false,'iss'),near=size(width,height,3500000,true,'iss');
 assert.ok(far>=24&&far<=40);assert.ok(near>far&&near<=58);
 assert.ok(size(width,height,28000000,false,'all')<=far);
 let previous=Infinity;for(const altitude of [3500000,7000000,14000000,28000000,80000000]){const current=size(width,height,altitude,true,'iss');assert.ok(current<=previous);previous=current;}
}
assert.ok(size(320,500,28000000,false,'iss')<size(1400,900,28000000,false,'iss'));
console.log('ISS : taille progressive selon zoom et écran, suivi lisible, Atlas discret OK');
for(const selected of [false,true]){
 assert.equal(size(390,745,30000000,selected,'all'),3);
 assert.equal(size(1800,745,300000000,selected,'all'),3);
 assert.ok(size(390,745,200000,selected,'all')>=38);
 let previous=Infinity;for(const distance of [200000,500000,1000000,3500000,12000000,30000000]){const value=size(390,745,distance,selected,'all');assert.ok(value<=previous);previous=value;}
}
console.log('Atlas : modèles réduits à 3 px de loin, grossissement continu vers la cible, pages dédiées inchangées.');
