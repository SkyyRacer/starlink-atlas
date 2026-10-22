const assert=require('node:assert/strict'),fs=require('node:fs');
const earth=require('../static/earth-realistic.js');
function setup(loadImage){
 let loads=0,renders=0;const states=[],credits=new Set(),imagery={show:true},original={key:'original'};
 const viewer={scene:{globe:{material:original,enableLighting:true},skyAtmosphere:undefined,requestRender(){renders++;},frameState:{creditDisplay:{addStaticCredit(c){credits.add(c);},removeStaticCredit(c){credits.delete(c);}}}}};
 let sky;Object.defineProperty(viewer.scene,'skyAtmosphere',{get:()=>sky,set:value=>{assert.ok(value===undefined||(value&&typeof value==='object'),'Scene.skyAtmosphere accepts an atmosphere object or undefined, never a boolean');sky=value;}});
 const C={Credit:class{constructor(text){this.text=text;}},Material:class{constructor(options){this.options=options;this.uniforms=options.fabric.uniforms;}},SkyAtmosphere:class{}};
 const controller=earth.create({viewer,imagery,C,onChange:s=>states.push(s),loadImage:async url=>{loads++;return loadImage?loadImage(url):{url};}});
 return {controller,viewer,imagery,original,credits,states,get loads(){return loads;}};
}
(async()=>{
 const a=setup();assert.equal(a.loads,0,'No texture requests until enabled');
 await a.controller.setEnabled(true);assert.equal(a.loads,3);assert.equal(a.controller.enabled,true);assert.equal(a.imagery.show,false);assert.equal(a.viewer.scene.globe.enableLighting,false,'Avoid double-darkening night lights');assert.equal(a.viewer.scene.skyAtmosphere.show,true);assert.equal(a.viewer.scene.skyAtmosphere.atmosphereRayleighScaleHeight,8500);assert.equal(a.viewer.scene.skyAtmosphere.atmosphereLightIntensity,22);assert.equal(a.credits.size,1);
 const material=a.viewer.scene.globe.material;a.controller.setLunarView(true);assert.equal(material.uniforms.lunarView,1);assert.equal(a.viewer.scene.skyAtmosphere,undefined,'No separate atmospheric shell on the night side from the Moon');assert.equal(a.viewer.scene.globe.vertexShadowDarkness,0);a.controller.setLunarView(false);assert.equal(material.uniforms.lunarView,0);assert.equal(material.options.translucent,false);assert.ok(material.options.fabric.uniforms.cloudMap);
 a.controller.update({night:true,basemap:true});assert.equal(a.imagery.show,false,'Position updates must not restore country labels');
 await a.controller.setEnabled(false);assert.equal(a.viewer.scene.globe.material,a.original);assert.equal(a.imagery.show,true);assert.equal(a.viewer.scene.globe.enableLighting,true);assert.equal(a.viewer.scene.skyAtmosphere,undefined);assert.equal(a.credits.size,0);
 a.controller.setLunarView(true);assert.equal(a.viewer.scene.skyAtmosphere,undefined);assert.equal(a.viewer.scene.globe.material.options.fabric.type,'AtlasLunarMapNight','Map mode uses an explicit opaque black night mask');assert.match(a.viewer.scene.globe.material.options.fabric.source,/material.diffuse=vec3\(0.0\)/);a.controller.setLunarView(false);assert.equal(a.viewer.scene.globe.material,a.original);
 await a.controller.setEnabled(true);assert.equal(a.loads,3,'Reuse textures and material');assert.equal(a.viewer.scene.globe.material,material);
 assert.equal(a.controller.recover(new Error('Fragment shader compile failed')),true);assert.equal(a.controller.enabled,false);assert.equal(a.viewer.scene.globe.material,a.original);assert.ok(a.states.at(-1).error);
 const b=setup(()=>{throw Error('Offline');});await b.controller.setEnabled(true);assert.equal(b.controller.enabled,false);assert.equal(b.imagery.show,true);assert.equal(b.viewer.scene.globe.material,b.original);assert.equal(b.states.at(-1).error,'Offline');
 let resolve;const waiting=new Promise(r=>resolve=r),c=setup(()=>waiting);const loading=c.controller.setEnabled(true);await c.controller.setEnabled(false);resolve({});await loading;assert.equal(c.controller.enabled,false,'Cancel in-flight load safely');
 assert.match(earth.source,/czm_sunDirectionEC/);assert.match(earth.source,/czm_inverseView\*vec4\(-inputData.positionToEyeEC/);assert.doesNotMatch(earth.source,/normalEC|slope/,'Ellipsoid terrain rejects materials requesting unavailable terrain normals');assert.doesNotMatch(earth.source,/v_texCoord/);
 const realCesium=require('../static/vendor/cesium/index.cjs');
 global.HTMLImageElement=class{};global.HTMLCanvasElement=class{};global.HTMLVideoElement=class{};global.ImageBitmap=class{};
 const image=new HTMLImageElement();image.width=2048;image.height=1024;
 const realMaterial=new realCesium.Material({fabric:{type:'AtlasRealisticEarthRegression',uniforms:{dayMap:image,nightMap:image,cloudMap:image,lunarView:0},source:earth.source},translucent:false});
 const mapMaterial=new realCesium.Material({fabric:{type:'AtlasLunarMapNightRegression',source:earth.lunarMapSource},translucent:false});assert.doesNotMatch(mapMaterial.shaderSource,/normalEC|slope/);
 const ellipsoidTerrain=new realCesium.EllipsoidTerrainProvider();
 const requiresTerrainNormals=/slope|normalEC/.test(realMaterial.shaderSource);
 assert.ok(!requiresTerrainNormals||ellipsoidTerrain.requestVertexNormals,'Cesium must apply the photographic material on the actual ellipsoid terrain');
 const html=fs.readFileSync('static/index.html','utf8');assert.match(html,/id="earth-realistic-toggle"[^>]*role="switch"[^>]*aria-checked="false"/);
 assert.ok(html.indexOf('/earth-realistic.js')<html.indexOf('/globe.js'));
 console.log('Realistic Earth: lazy loading, caching, city lights, atmosphere, disable/restore, position updates, failure and cancellation OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
