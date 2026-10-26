/* Keep Cesium's native, persistent cartographic layer. Rebuilding regional
   SingleTile layers on camera movement caused seams, blank terrain and flicker.
   Native imagery preserves geographic UVs, the antimeridian and parent tiles. */
(function(root){
 function create({viewer,imagery,isEnabled,baseVisible=()=>true}){
  const globe=viewer.scene.globe;
  const original={maximumScreenSpaceError:globe.maximumScreenSpaceError,loadingDescendantLimit:globe.loadingDescendantLimit,tileCacheSize:globe.tileCacheSize};
  let enabled=false;
  function refresh(){
   const wanted=!!isEnabled();
   // The realistic-Earth controller owns visibility outside the close map view.
   // Never disable/re-enable the imagery every frame or replace its provider.
   if(wanted!==enabled){
    enabled=wanted;
    if(enabled){
     globe.maximumScreenSpaceError=1;
     globe.loadingDescendantLimit=8;
     globe.tileCacheSize=Math.max(256,original.tileCacheSize||100);
     imagery.show=baseVisible();
    }else{
     globe.maximumScreenSpaceError=original.maximumScreenSpaceError;
     globe.loadingDescendantLimit=original.loadingDescendantLimit;
     globe.tileCacheSize=original.tileCacheSize;
    }
   }
   viewer.container.dataset.cartographicSurface=enabled?(globe.tilesLoaded?'ready':'loading'):'off';
  }
  viewer.scene.preRender.addEventListener(refresh);
  return {refresh,get enabled(){return enabled;}};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasCartographicSurface=api;
})(typeof window==='undefined'?globalThis:window);
