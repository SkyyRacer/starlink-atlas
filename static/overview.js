/* Local Natural Earth II imagery, reprojected once from geographic to Web Mercator. */
window.AtlasOverview={async attach(map,detail,bounds){
 try{
  const source=document.createElement('canvas');source.width=2048;source.height=1024;const sc=source.getContext('2d');
  await Promise.all(Array.from({length:32},(_,i)=>new Promise((resolve,reject)=>{const x=i%8,y=Math.floor(i/8),image=new Image();image.onload=()=>{sc.drawImage(image,x*256,(3-y)*256,256,256);resolve();};image.onerror=reject;image.src=`/vendor/cesium/Assets/Textures/NaturalEarthII/2/${x}/${y}.jpg`;})));
  const projected=document.createElement('canvas');projected.width=2048;projected.height=2048;const ctx=projected.getContext('2d');
  for(let y=0;y<2048;y++){const latitude=Math.atan(Math.sinh(Math.PI*(1-2*(y+.5)/2048)));const sy=(.5-latitude/Math.PI)*1024;ctx.drawImage(source,0,sy,2048,1,0,y,2048,1);}
  // Bake the monochrome treatment once, avoiding a huge GPU-filtered layer at high zoom.
  const pixels=ctx.getImageData(0,0,2048,2048);for(let i=0;i<pixels.data.length;i+=4){const gray=(.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2])*.68;const tone=Math.max(0,Math.min(255,(gray-128)*1.08+128));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=tone;}ctx.putImageData(pixels,0,0);
  if(!map.getPane('overviewPane')){const pane=map.createPane('overviewPane');pane.style.zIndex=190;pane.style.pointerEvents='none';}
  const overlay=L.imageOverlay(projected.toDataURL('image/png'),bounds,{pane:'overviewPane',className:'earth-overview',interactive:false,attribution:'<a href="https://www.naturalearthdata.com/">Natural Earth</a> · domaine public'});
  overlay.addTo(map);
  // Keep the world beneath detailed tiles, including while tiles load or fail.
  function update(){detail.setOpacity(map.getZoom()<3?0:1);}
  map.on('zoomend',update);update();
 }catch(error){console.warn('Fond Natural Earth indisponible : fond OSM conservé.',error);}
}};
