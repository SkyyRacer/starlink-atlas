/* White line models. NASA adaptations and original schematics are identified separately. */
(function(root){
 const base=new URL('./',document.currentScript.src),definitions=[{"key":"astrosat","ids":[40930],"name":"AstroSat","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation ISRO","source":"https://www.isro.gov.in/Astrosat_Spacecraft.html","glb":"images/science/astrosat.glb?v=e60a3c9df3ed","drawing":"images/science/astrosat.json?v=3977cbb8d33b","radius":39.851,"segments":227,"line_segments":227,"bytes":13604},{"key":"chandra","ids":[25867],"name":"Chandra","kind":"nasa-adaptation","credit":"NASA 3D Resources · adaptation filaire Atlas","source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Chandra%20X-ray%20Observatory","glb":"images/science/chandra.glb?v=8aa7d925f329","drawing":"images/science/chandra.json?v=f981a8218fb7","radius":55.19,"segments":2200,"line_segments":2200,"bytes":128235},{"key":"cheops","ids":[44874],"name":"CHEOPS","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation ESA","source":"https://www.cosmos.esa.int/web/cheops/cheops-spacecraft","glb":"images/science/cheops.glb?v=6c2e9a0d5730","drawing":"images/science/cheops.json?v=3a178e3b4f46","radius":25.962,"segments":135,"line_segments":135,"bytes":8585},{"key":"fermi","ids":[33053],"name":"Fermi","kind":"nasa-adaptation","credit":"NASA 3D Resources · adaptation filaire Atlas","source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Fermi%20Gamma-ray%20Large%20Area%20Space%20Telescope","glb":"images/science/fermi.glb?v=9759f6d788a6","drawing":"images/science/fermi.json?v=098d1c123dda","radius":50.329,"segments":2200,"line_segments":2200,"bytes":125906},{"key":"hubble","ids":[20580],"name":"Hubble","kind":"nasa-adaptation","credit":"NASA 3D Resources · adaptation filaire Atlas","source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Hubble%20Space%20Telescope%20%28A%29","glb":"images/science/hubble.glb?v=928becd70683","drawing":"images/science/hubble.json?v=bf4553676289","radius":64.79,"segments":2200,"line_segments":2200,"bytes":127882},{"key":"ixpe","ids":[49954],"name":"IXPE","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation NASA / Caltech","source":"https://ixpe.msfc.nasa.gov/","glb":"images/science/ixpe.glb?v=c6b8dc99ab40","drawing":"images/science/ixpe.json?v=418d41004d05","radius":36.236,"segments":193,"line_segments":193,"bytes":11881},{"key":"lageos","ids":[8820,22195],"name":"LAGEOS-1 / LAGEOS-2","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation NASA / Caltech","source":"https://ilrs.gsfc.nasa.gov/missions/satellite_missions/current_missions/lag1_general.html","glb":"images/science/lageos.glb?v=edea8ea10c49","drawing":"images/science/lageos.json?v=f0fa456ece4f","radius":18.0,"segments":1709,"line_segments":3408,"bytes":225280},{"key":"nustar","ids":[38358],"name":"NuSTAR","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation NASA / Caltech","source":"https://nustar.caltech.edu/page/mast","glb":"images/science/nustar.glb?v=0353e84b3c62","drawing":"images/science/nustar.json?v=6c87a48f60cd","radius":40.312,"segments":279,"line_segments":279,"bytes":17325},{"key":"tess","ids":[43435],"name":"TESS","kind":"nasa-adaptation","credit":"NASA 3D Resources · adaptation filaire Atlas","source":"https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Transiting%20Exoplanet%20Survey%20Satellite%20%28TESS%29%20%28A%29","glb":"images/science/tess.glb?v=d0e995bf649d","drawing":"images/science/tess.json?v=8fda9c732faa","radius":51.603,"segments":2200,"line_segments":2200,"bytes":127481},{"key":"xmm-newton","ids":[25989],"name":"XMM-Newton","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation ESA","source":"https://www.esa.int/Science_Exploration/Space_Science/XMM-Newton","glb":"images/science/xmm-newton.glb?v=1e7559369c56","drawing":"images/science/xmm-newton.json?v=5be7730a0edf","radius":42.486,"segments":223,"line_segments":223,"bytes":13533},{"key":"xposat","ids":[58694],"name":"XPoSat","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation ISRO","source":"https://www.isro.gov.in/XPoSat.html","glb":"images/science/xposat.glb?v=3e3c5eac9707","drawing":"images/science/xposat.json?v=153f5adc95e5","radius":33.242,"segments":159,"line_segments":159,"bytes":9884},{"key":"xrism","ids":[57800],"name":"XRISM","kind":"original-schematic","credit":"Géométrie originale Atlas · documentation JAXA","source":"https://www.xrism.jaxa.jp/en/technology/","glb":"images/science/xrism.glb?v=31c6d4e5fce1","drawing":"images/science/xrism.json?v=28b1089baf86","radius":45.794,"segments":175,"line_segments":175,"bytes":10820}];
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
 function createLayer(C,viewer,onReady){
  const records=new Map(),sprites=viewer.scene.primitives.add(new C.BillboardCollection());
  function size(record){
   const distance=record.collection==='all'&&record.sprite.position&&C.Cartesian3.distance&&viewer.camera.positionWC?C.Cartesian3.distance(viewer.camera.positionWC,record.sprite.position):viewer.camera.positionCartographic.height;
   const pixels=record.visual.screenSize(viewer.canvas.clientWidth,viewer.canvas.clientHeight,distance,record.selected,record.collection),dot=record.collection==='all'&&pixels<=7;
   record.sprite.width=pixels;record.sprite.height=pixels;record.sprite.image=dot?root.AtlasISS.pointIconURI:record.visual.iconURI;
   record.sprite.show=record.visible&&!record.suppressed&&(dot||!record.model);
   if(record.model){record.model.minimumPixelSize=pixels;record.model.show=record.visible&&!record.suppressed&&!dot;}
  }
  viewer.scene.preUpdate.addEventListener(()=>{for(const record of records.values())if(record.visible)size(record);});
  return {
   begin(){for(const record of records.values()){record.visible=false;record.suppressed=false;record.sprite.show=false;if(record.model)record.model.show=false;}},
   update(point,{selected,collection,color}){
    const visual=models.get(point.id);if(!visual)return false;
    let record=records.get(point.id);
    if(!record){
     record={visual,visible:false,selected:false,collection,model:null,sprite:sprites.add({id:point.id,image:visual.iconURI,width:26,height:26,show:false})};records.set(point.id,record);
     visual.prepare().then(()=>{record.sprite.image=visual.iconURI;viewer.scene.requestRender();});
     visual.createModel(C,viewer.scene,point.id).then(model=>{record.model=model;onReady();}).catch(error=>{console.warn(visual.name+' : '+error.message);});
    }
    record.visible=true;record.selected=point.id===selected;record.collection=collection;record.sprite.show=!record.model;record.sprite.color=color;
    if(record.model){record.model.show=true;record.model.color=color;}
    this.move(point);size(record);return true;
   },
   move(point){const record=records.get(point.id);if(!record?.visible)return;const xyz=C.Cartesian3.fromDegrees(point.lon,point.lat,point.altitude_km*1000);record.sprite.position=xyz;if(record.model)record.model.modelMatrix=C.Transforms.eastNorthUpToFixedFrame(xyz);},
   getModel(id){const model=records.get(id)?.model;return model?.ready&&model.show?model:null;},
   suppress(id){const record=records.get(id);if(record){record.suppressed=true;record.sprite.show=false;if(record.model)record.model.show=false;}},
   *hits(){for(const [id,record] of records)if(record.visible)yield {id,position:record.sprite.position};},
   get count(){let n=0;for(const record of records.values())if(record.visible)n++;return n;}
  };
 }
 root.AtlasScience={models,has:id=>models.has(id),model:id=>models.get(id),definitions,createLayer};
})(window);
