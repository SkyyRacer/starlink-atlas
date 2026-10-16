const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const tiles=[],rows=[];let canvases=0,zoom=1,opacity=1,present=false,zoomHandler;
const sourceCtx={drawImage:(image,x,y)=>tiles.push({url:image.url,x,y})};
const projectedCtx={drawImage:(...args)=>rows.push(args),getImageData:()=>({data:new Uint8ClampedArray([100,150,200,255])}),putImageData:pixels=>{assert.equal(pixels.data[0],pixels.data[1]);assert.equal(pixels.data[1],pixels.data[2]);}};
const context={window:{},console,Math,Promise,Image:class{set src(url){this.url=url;this.onload();}},document:{createElement(){const n=canvases++;return {getContext:()=>n===0?sourceCtx:projectedCtx,toDataURL:()=> 'data:image/png;base64,test'};}},L:{imageOverlay:(url,bounds,options)=>({addTo(){present=true;},options})}};
vm.createContext(context);vm.runInContext(fs.readFileSync('static/overview.js','utf8'),context);
(async()=>{
 await context.window.AtlasOverview.attach({getPane:()=>({}),getZoom:()=>zoom,hasLayer:()=>present,on:(event,handler)=>zoomHandler=handler,removeLayer:()=>present=false},{setOpacity:value=>opacity=value},{});
 assert.equal(tiles.length,32);assert.equal(rows.length,2048);
 assert.equal(tiles.find(t=>t.url.endsWith('/0/0.jpg')).y,768,'TMS southern row must be at the bottom of the geographic mosaic');
 assert.equal(tiles.find(t=>t.url.endsWith('/0/3.jpg')).y,0,'TMS northern row must be at the top');
 assert.ok(rows[0][2]<30,'Mercator top samples northern latitudes');assert.ok(Math.abs(rows[1024][2]-512)<1);assert.ok(rows.at(-1)[2]>990);
 assert.equal(opacity,0);assert.equal(present,true);
 zoom=4;zoomHandler();assert.equal(opacity,1);assert.equal(present,true,'world fallback remains under detailed tiles');
 zoom=1;zoomHandler();assert.equal(opacity,0);assert.equal(present,true);
 console.log('Natural Earth : orientation TMS, reprojection Mercator et alternance avec OSM : OK');
})();
