/* Orbit families use mission metadata; individual regimes use complete orbital elements. */
(function(root){
 const labels={LEO:'LEO · Orbite basse',MEO:'MEO · Orbite moyenne',GEO:'GEO · Géostationnaire',HEO:'HEO · Orbite très elliptique',IGSO:'IGSO · Géosynchrone inclinée',QZO:'QZO · Quasi zénithale',VARIED:'Orbites variées · basses, moyennes, hautes et elliptiques'};
 function nominal(def){const types=def?.orbit_types||[];if(types.includes('LEO')&&types.includes('SSO'))return 'LEO · Orbite basse, héliosynchrone (SSO)';return types.map(code=>labels[code]||code).join(' / ')||'Non renseigné';}
 const number=value=>value===null||value===undefined||value===''?NaN:Number(value);
 function describe(orbit,def){
  if(orbit){
   const motion=number(orbit.mean_motion),e=number(orbit.eccentricity),inc=number(orbit.inclination);
   const axis=motion>0?Math.cbrt(398600.4418/Math.pow(motion*2*Math.PI/86400,2)):NaN;
   const perigee=Number.isFinite(axis)&&e>=0&&e<1?axis*(1-e)-6378.137:number(orbit.perigee_km),apogee=Number.isFinite(axis)&&e>=0&&e<1?axis*(1+e)-6378.137:number(orbit.apogee_km);
   const period=motion>0?1440/motion:number(orbit.period_minutes),ecc=Number.isFinite(e)?e:(apogee-perigee)/(apogee+perigee+2*6378.137);
   if(Number.isFinite(perigee)&&Number.isFinite(apogee)&&apogee>=perigee){
    if(apogee<=2000)return def?.orbit_types?.includes('SSO')&&inc>95&&inc<105?'LEO · Héliosynchrone (SSO)':labels.LEO;
    if(Math.abs(period-1436.068)<15&&ecc<.15){
     if(Math.abs(period-1436.068)>2)return 'GSO · Quasi géosynchrone';
     if(ecc<.02&&inc<=2)return labels.GEO;
     return ecc>=.02?'GSO · Géosynchrone elliptique':Number.isFinite(inc)?'GSO · Géosynchrone inclinée':'GSO · Géosynchrone';
    }
    if(ecc>=.25)return labels.HEO;
    if(perigee>2000&&apogee<35786)return labels.MEO;
    if(perigee>=35786)return 'Orbite haute · Au-delà de GEO';
    return 'Orbite elliptique intermédiaire';
   }
  }
  const label=nominal(def);return label==='Non renseigné'||def?.orbit_types?.includes('VARIED')?'Non déterminé':label+' (nominale)';
 }
 const api={nominal,describe};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasOrbits=api;
})(globalThis);
