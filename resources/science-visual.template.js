/* White line models. NASA adaptations and original schematics are identified separately. */
(function(root){
 const base=new URL('./',document.currentScript.src),definitions=__MANIFEST__;
 const fallback='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-52 -52 104 104"><path d="M-9-14H9V14H-9Z M-40-8H-14V8H-40Z M14-8H40V8H14Z M-14 0H14" fill="none" stroke="white" stroke-width="2"/></svg>';
 const genericIcon='data:image/svg+xml,'+encodeURIComponent(fallback),models=new Map();
 for(const info of definitions){
  let drawing=null,request=null,failedAt=0,icon=genericIcon;
  const visual={...info,get iconURI(){return icon;},
   prepare(){if(request)return request;if(failedAt&&Date.now()-failedAt<10000)return Promise.resolve(null);request=fetch(new URL(info.drawing,base)).then(response=>{if(!response.ok)throw Error('Dessin '+info.name+' indisponible');return response.json();}).then(data=>{
    drawing=data.segments;const d=drawing.map(([a,b])=>'M'+a[0]+' '+(-a[1])+'L'+b[0]+' '+(-b[1])).join('');icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-54 -54 108 108"><path d="'+d+'" fill="none" stroke="white" stroke-width="1.7" stroke-linejoin="round"/></svg>');
    root.dispatchEvent(new Event('atlas-science-ready'));return drawing;
   }).catch(error=>{request=null;failedAt=Date.now();console.warn(error.message);return null;});return request;},
   screenSize(width,height,cameraHeight,selected,collection){return root.AtlasISS.screenSize(width,height,cameraHeight,selected,collection);},
   draw2D(ctx,x,y,size,color='#fff'){
    this.prepare();ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);ctx.beginPath();
    if(drawing){for(const [a,b] of drawing){ctx.moveTo(a[0],-a[1]);ctx.lineTo(b[0],-b[1]);}}
    else{ctx.rect(-9,-14,18,28);ctx.rect(-40,-8,26,16);ctx.rect(14,-8,26,16);}
    ctx.lineJoin='round';ctx.strokeStyle='#07111b';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.stroke();ctx.restore();
   },
   async createModel(C,scene,id){
    const model=await C.Model.fromGltfAsync({url:new URL(info.glb,base).href,modelMatrix:C.Matrix4.IDENTITY,minimumPixelSize:32,maximumScale:10000000,color:C.Color.WHITE,colorBlendMode:C.ColorBlendMode.HIGHLIGHT,allowPicking:true,show:false});model.id=id;scene.primitives.add(model);return model;
   }
  };
  for(const id of info.ids)models.set(id,visual);
 }
 function createLayer(C,viewer,onReady,parent=viewer.scene.primitives){
  const records=new Map(),sprites=parent.add(new C.BillboardCollection());
  function size(record){
   const distance=record.collection==='all'&&record.sprite.position&&C.Cartesian3.distance&&viewer.camera.positionWC?C.Cartesian3.distance(viewer.camera.positionWC,record.sprite.position):viewer.camera.positionCartographic.height;
   const pixels=record.visual.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,distance,record.selected,record.collection),dot=record.collection==='all'&&pixels<=7;
   // A distant symbol needs neither the wire drawing nor the GLB.
   if(!dot&&record.visible&&!record.suppressed){
    if(!record.prepared){record.prepared=true;record.visual.prepare().then(()=>{viewer.scene.requestRender();});}
    if(!record.model&&!record.loading&&(!record.failedAt||Date.now()-record.failedAt>10000)){
     record.loading=true;const token=record.generation||0;record.visual.createModel(C,{primitives:parent},record.id).then(model=>{if(token!==(record.generation||0)){parent.remove(model);return;}record.model=model;record.loading=false;onReady();}).catch(error=>{if(token!==(record.generation||0))return;record.loading=false;record.failedAt=Date.now();console.warn(record.visual.name+' : '+error.message);});
    }
   }
   record.sprite.width=dot?pixels*1.5:pixels;record.sprite.height=record.sprite.width;record.sprite.image=dot?root.AtlasISS.pointIconURI:record.visual.iconURI;
   record.sprite.show=record.visible&&!record.suppressed&&(dot||!record.model);
   if(record.model){record.model.minimumPixelSize=pixels;record.model.show=record.visible&&!record.suppressed&&!dot;}
  }
  viewer.scene.preUpdate.addEventListener(()=>{if(parent.show!==false)for(const record of records.values())if(record.visible)size(record);});
  return {
   release(){for(const record of records.values()){record.generation=(record.generation||0)+1;record.loading=false;record.visible=false;record.sprite.show=false;if(record.model){parent.remove(record.model);record.model=null;}}},
   begin(){for(const record of records.values()){record.visible=false;record.suppressed=false;record.sprite.show=false;if(record.model)record.model.show=false;}},
   update(point,{selected,collection,color}){
    const visual=models.get(point.id);if(!visual)return false;
    let record=records.get(point.id);
    if(!record){
     record={id:point.id,visual,visible:false,selected:false,collection,model:null,sprite:sprites.add({id:point.id,image:visual.iconURI,width:26,height:26,show:false})};records.set(point.id,record);
    }
    record.visible=true;record.selected=point.id===selected;record.collection=collection;record.sprite.show=!record.model;record.sprite.color=color;
    if(record.model){record.model.show=true;record.model.color=color;}
    this.move(point);size(record);return true;
   },
   move(point){const record=records.get(point.id);if(!record?.visible)return;const xyz=C.Cartesian3.fromDegrees(point.lon,point.lat,point.altitude_km*1000);record.sprite.position=xyz;if(record.model)record.model.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(xyz);},
   getModel(id){const model=records.get(id)?.model;return model?.ready&&model.show?model:null;},
   suppress(id,value=true){const record=records.get(id);if(record){record.suppressed=!!value;if(value){record.sprite.show=false;if(record.model)record.model.show=false;}else size(record);}},
   *hits(){for(const [id,record] of records)if(record.visible)yield {id,position:record.sprite.position};},
   get count(){let n=0;for(const record of records.values())if(record.visible)n++;return n;}
  };
 }
 root.AtlasScience={models,has:id=>models.has(id),model:id=>models.get(id),definitions,createLayer};
})(window);
