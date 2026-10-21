/* A ground track is split only at the geographic date line, never by viewport size. */
(function(root){
  function splitTrack(track){
    if(!track.length)return [];
    const segments=[[track[0]]];
    for(let i=1;i<track.length;i++){
      const [lat0,lon0]=track[i-1], [lat1,lon1]=track[i];
      const delta=lon1-lon0;
      if(Math.abs(delta)>180){
        const unwrapped=lon1+(delta>180?-360:360);
        const edge=unwrapped>lon0?180:-180;
        const fraction=(edge-lon0)/(unwrapped-lon0);
        const latitude=lat0+(lat1-lat0)*fraction;
        segments[segments.length-1].push([latitude,edge]);
        segments.push([[latitude,-edge],[lat1,lon1]]);
      }else segments[segments.length-1].push([lat1,lon1]);
    }
    return segments;
  }
  function shouldRender(id,selected,passesFilters){return id===selected||passesFilters;}
  function nightPolygon(declination,solarLongitude){
    const limit=85.05112878,sin=Math.sin(declination),cos=Math.cos(declination);
    const denominator=Math.abs(sin)<1e-12?(sin<0?-1e-12:1e-12):sin;
    const pole=denominator>0?-limit:limit;
    const path=[];
    for(let lon=-180;lon<=180;lon+=.5){const latitude=Math.atan(-cos*Math.cos(lon*Math.PI/180-solarLongitude)/denominator)*180/Math.PI;path.push([Math.max(-limit,Math.min(limit,latitude)),lon]);}
    path.push([pole,180],[pole,-180]);return path;
  }
  // Distances are CSS pixels, independent of canvas resolution and device pixel ratio.
  function pickRadius({mode,zoom=0,minZoom=0,height=0,touch=false,collection}){
    const far=mode==='2d'?Math.pow(2,-Math.max(0,zoom-minZoom)/3):Math.max(0,Math.min(1,Math.log2(1+Math.max(0,height)/500000)/7));
    return 6+8*far+(collection==='all'?2+2*far:0)+(touch?3:0);
  }
  function markerScale(collection,width=1440,height=900){const screen=Math.max(.65,Math.min(1.35,Math.sqrt(Math.max(1,width)*Math.max(1,height)/(1440*900))));return (collection==='all'?.75:1)*screen;}
  function nearestHit(hits,point,radius){
    let best=null,distance=Infinity;
    for(const hit of hits){if(hit.visible===false)continue;const d=Math.hypot(hit.x-point.x,hit.y-point.y),limit=hit.radius??radius;
      if(Number.isFinite(d)&&d<=limit&&d<distance){best=hit.id;distance=d;}
    }
    return best;
  }
  function labelPlacement({anchor,bounds,width,height,textWidth,textHeight=24,gap=12}){
    const pad=10,w=Math.min(textWidth,Math.max(1,width-2*pad)),h=textHeight;
    const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
    const y=clamp(anchor.y-h/2,pad,height-h-pad),x=clamp(anchor.x-w/2,pad,width-w-pad);
    if(bounds.right+gap>=pad&&bounds.right+gap+w<=width-pad)return {x:bounds.right+gap,y};
    if(bounds.left-gap-w>=pad&&bounds.left-gap<=width-pad)return {x:bounds.left-gap-w,y};
    if(bounds.top-gap-h>=pad&&bounds.top-gap<=height-pad)return {x,y:bounds.top-gap-h};
    if(bounds.bottom+gap>=pad&&bounds.bottom+gap+h<=height-pad)return {x,y:bounds.bottom+gap};
    // At extreme close-up no free margin may remain: keep the caption legible in a dark panel.
    return {x:pad,y:Math.max(pad,height-h-pad)};
  }
  const api={splitTrack,shouldRender,nightPolygon,pickRadius,markerScale,nearestHit,labelPlacement};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.AtlasGeometry=api;
})(typeof window!=='undefined'?window:this);
