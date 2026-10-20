const assert=require('node:assert/strict'),fs=require('node:fs'),g=require('../static/geometry');
const overlap=(p,w,h,b)=>p.x<b.right&&p.x+w>b.left&&p.y<b.bottom&&p.y+h>b.top;
for(const [width,height] of [[1600,900],[390,700],[320,500]])for(const radius of [3,20,45,90]){
 const anchor={x:width/2,y:height/2},bounds={left:anchor.x-radius,right:anchor.x+radius,top:anchor.y-radius,bottom:anchor.y+radius},textWidth=Math.min(240,width-30),textHeight=26,p=g.labelPlacement({anchor,bounds,width,height,textWidth,textHeight});
 assert.ok(p.x>=0&&p.y>=0&&p.x+textWidth<=width&&p.y+textHeight<=height);assert.equal(overlap(p,textWidth,textHeight,bounds),false,'Label must clear both white and coloured model bounds');
}
for(const anchor of [{x:10,y:10},{x:350,y:400},{x:-200,y:-300},{x:700,y:800}]){
 const p=g.labelPlacement({anchor,bounds:{left:anchor.x-40,right:anchor.x+40,top:anchor.y-40,bottom:anchor.y+40},width:390,height:700,textWidth:180});assert.ok(p.x>=0&&p.x+180<=390&&p.y>=0&&p.y+24<=700);
}
const huge=g.labelPlacement({anchor:{x:195,y:350},bounds:{left:-100,right:700,top:-200,bottom:900},width:390,height:700,textWidth:250,textHeight:44});assert.ok(huge.x>=0&&huge.y+44<=700,'Keep readable panel inside viewport when no free margin remains');
const source=fs.readFileSync('static/globe.js','utf8');assert.match(source,/model.computedScale/);assert.match(source,/disableDepthTestDistance:Infinity/);assert.match(source,/showBackground:true/);assert.match(source,/preRender.addEventListener\(placeSatelliteLabel\)/);assert.match(source,/detailedLayer.getModel\(id\)\|\|scienceLayer.getModel\(id\)/);
console.log('Étiquettes : extérieur du modèle blanc/couleur, taille projetée réelle, zoom, mobile, bords, retour lisible en très gros plan OK.');
