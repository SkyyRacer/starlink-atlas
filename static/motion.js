/* Render interpolation only: never extrapolate beyond the latest SGP4 sample. */
(function(root){
  class SatelliteMotion{
    constructor(){this.source=null;this.rows=[];this.index=new Map();this.started=0;this.duration=0;this.active=false;}
    set(points,now,smooth){
      this.sample(now);const previous=new Map(this.rows.map(p=>[p.id,p]));
      this.source=points;this.started=now;this.duration=smooth&&previous.size?1000:0;
      this.rows=points.map(p=>{const before=previous.get(p.id)||p;return {...p,_fromLat:before.lat,_fromLon:before.lon,_fromAlt:before.altitude_km,_toLat:p.lat,_toLon:p.lon,_toAlt:p.altitude_km};});
      this.index=new Map(this.rows.map(p=>[p.id,p]));this.active=this.duration>0;return this.sample(now);
    }
    get(id){return this.index.get(id);}
    sample(now){return this.sampleRows(now,this.rows,true);}
    sampleRows(now,rows,force=false){
      if(!this.active&&!force)return rows;
      const f=this.duration?Math.max(0,Math.min(1,(now-this.started)/this.duration)):1;
      for(const p of rows){p.lat=p._fromLat+(p._toLat-p._fromLat)*f;const delta=((p._toLon-p._fromLon+540)%360)-180;p.lon=((p._fromLon+delta*f+540)%360)-180;p.altitude_km=p._fromAlt+(p._toAlt-p._fromAlt)*f;}
      this.active=f<1;return rows;
    }
  }
  root.SatelliteMotion=SatelliteMotion;
})(typeof window==='undefined'?globalThis:window);
