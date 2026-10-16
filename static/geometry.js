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
  const api={splitTrack,shouldRender,nightPolygon};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.AtlasGeometry=api;
})(typeof window!=='undefined'?window:this);
