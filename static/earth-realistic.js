'use strict';
/* NASA composites, loaded on demand. Sun direction comes from Cesium's simulation clock. */
(function(root){
 const base=typeof document!=='undefined'?new URL('./images/earth/',document.currentScript.src).href:'';
 const source=`czm_material czm_getMaterial(czm_materialInput inputData){
  czm_material material=czm_getDefaultMaterial(inputData);
  // Derive the WGS84 surface direction from position: ellipsoid terrain has no vertex normals.
  vec3 worldPosition=(czm_inverseView*vec4(-inputData.positionToEyeEC,1.0)).xyz;
  vec3 normalWorld=normalize(worldPosition*vec3(1.0,1.0,1.0067394967));
  vec3 eyeNormal=normalize(mat3(czm_view)*normalWorld);
  vec2 uv=vec2(atan(normalWorld.y,normalWorld.x)/czm_twoPi+0.5,asin(clamp(normalWorld.z,-1.0,1.0))/czm_pi+0.5);
  vec3 land=texture(dayMap,uv).rgb;
  vec3 cities=texture(nightMap,uv).rgb;
  float clouds=smoothstep(0.10,0.9,texture(cloudMap,uv).r)*0.86;
  float sunlight=dot(eyeNormal,normalize(czm_sunDirectionEC));
  float day=smoothstep(-0.12,0.14,sunlight);
  float diffuse=0.10+0.90*pow(max(sunlight,0.0),0.45);
  vec3 daylight=mix(land,vec3(0.94,0.96,1.0),clouds)*diffuse;
  vec3 night=cities*0.95*(1.0-clouds*0.65)+vec3(0.008,0.014,0.025)*clouds;
  material.diffuse=mix(night,daylight,day);
  material.alpha=1.0;
  return material;
 }`;
 function create({viewer,imagery,C,onChange=()=>{},loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Les textures de la Terre sont indisponibles.'));image.src=url;})}){
  let enabled=false,wanted=false,pending=null,material=null,atmosphere=null,revision=0,night=true,basemap=true,credited=false;
  const original={material:viewer.scene.globe.material,atmosphere:viewer.scene.skyAtmosphere};
  const credit=new C.Credit('Terre : NASA Blue Marble / Black Marble',true);
  function update(data){
   if(data){night=data.night;basemap=data.basemap;}
   imagery.show=enabled?false:basemap;
   viewer.scene.globe.material=enabled?material:original.material;
   // The material supplies its own day/night illumination, including city light emission.
   viewer.scene.globe.enableLighting=enabled?false:night;
   if(atmosphere)atmosphere.show=enabled;
   viewer.scene.skyAtmosphere=enabled?atmosphere:original.atmosphere;
   if(enabled!==credited){const credits=viewer.scene.frameState.creditDisplay;if(enabled)credits.addStaticCredit(credit);else credits.removeStaticCredit(credit);credited=enabled;}
  }
  function status(loading=false,error=''){onChange({enabled,loading,error});viewer.scene.requestRender();}
  return {
   get enabled(){return enabled;},update,
   async setEnabled(value){
    wanted=Boolean(value);const request=++revision;
    if(!wanted){enabled=false;update();status();return false;}
    status(true);
    try{
     if(!material){
      if(!pending)pending=Promise.all(['day-4k.webp','night-4k.webp','clouds-4k.webp'].map(file=>loadImage(base+file))).catch(error=>{pending=null;throw error;});
      const [dayMap,nightMap,cloudMap]=await pending;
      if(request!==revision)return enabled;
      material=new C.Material({fabric:{type:'AtlasRealisticEarth',uniforms:{dayMap,nightMap,cloudMap},source},translucent:false});
      atmosphere=new C.SkyAtmosphere();atmosphere.perFragmentAtmosphere=true;atmosphere.atmosphereLightIntensity=18;atmosphere.atmosphereRayleighScaleHeight=7500;atmosphere.brightnessShift=-0.12;
     }
     if(request!==revision)return enabled;
     enabled=wanted;update();status();return enabled;
    }catch(error){if(request===revision){wanted=false;enabled=false;update();status(false,error.message);}return false;}
   },
   recover(error){if(!enabled||!/shader|compile|texture|material/i.test(String(error?.message||error)))return false;revision++;wanted=false;enabled=false;update();status(false,'Ce rendu n’est pas disponible sur cette configuration.');return true;}
  };
 }
 const api={create,source};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasEarth=api;
})(typeof window!=='undefined'?window:globalThis);
