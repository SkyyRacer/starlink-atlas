const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
let loads=0,textures=0,credits=new Set(),renders=0;
const viewer={canvas:{clientWidth:1600,clientHeight:900},scene:{context:{},requestRender(){renders++;}},creditDisplay:{addStaticCredit:c=>credits.add(c),removeStaticCredit:c=>credits.delete(c)}};
const instance=class{constructor(options){Object.assign(this,options);}destroy(){}};
const C={Credit:instance,Resource:{fetchImage:async()=>{loads++;return {};}},Texture:class extends instance{constructor(o){super(o);textures++;}},Sampler:instance,TextureMinificationFilter:{LINEAR:1},TextureMagnificationFilter:{LINEAR:1},SceneMode:{SCENE3D:3},Geometry:instance,GeometryAttribute:instance,ComponentDatatype:{FLOAT:1},PrimitiveType:{TRIANGLES:1},VertexArray:{fromGeometry:()=>new instance()},BufferUsage:{STATIC_DRAW:1},ShaderProgram:{fromCache:o=>new instance(o)},DrawCommand:instance,RenderState:{fromCache:o=>o},Pass:{ENVIRONMENT:0}};
const context={window:{},console};vm.runInNewContext(fs.readFileSync('static/sky.js','utf8'),context);
(async()=>{
 const sky=context.window.AtlasSky.create(viewer,C);assert.equal(loads,0);
 assert.equal(viewer.scene.skyBox.update({mode:3}),undefined);
 await sky.setEnabled(true);assert.equal(loads,1);assert.equal(credits.size,1);
 const cmd=viewer.scene.skyBox.update({mode:3,context:{}});
 assert.equal(cmd.pass,0);assert.equal(cmd.uniformMap.u_aspect(),1600/900);
 assert.equal(viewer.scene.skyBox.update({mode:2}),undefined);
 await sky.setEnabled(false);assert.equal(viewer.scene.skyBox.update({mode:3}),undefined);assert.equal(credits.size,0);
 await sky.setEnabled(true);assert.equal(loads,1);assert.equal(textures,1);
 assert.equal(viewer.scene.skyBox.update({mode:3,context:{}}),cmd);
 assert.ok(fs.existsSync('static/images/sky/reference-starmap-8k.jpg'));
 console.log('Independent sky: lazy texture, retained GPU resources, 3D-only, environment command, toggle and credits OK.');
})().catch(e=>{console.error(e);process.exitCode=1;});
