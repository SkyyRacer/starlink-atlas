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
  float cloudDensity=texture(cloudMap,uv).r;
  float clouds=smoothstep(0.055,0.94,cloudDensity)*0.93;
  float sunlight=dot(eyeNormal,normalize(czm_sunDirectionEC));
  float day=smoothstep(-0.12,0.16,sunlight);
  float diffuse=0.14+0.86*pow(max(sunlight,0.0),0.40);
  // Neutral daylight keeps oceans blue, deserts sandy and clouds white.
  vec3 cloudLight=mix(vec3(0.78,0.83,0.90),vec3(0.98,0.99,1.0),sqrt(clouds));
  float landLuma=dot(land,vec3(0.2126,0.7152,0.0722));
  land=mix(vec3(landLuma),land,0.76)*vec3(0.92,0.98,1.05);
  vec3 daylight=mix(land*(1.0-clouds*0.04),cloudLight,clouds)*diffuse;
  daylight=mix(daylight,vec3(0.13,0.22,0.34)*diffuse,0.055);
  float cityBrightness=max(cities.r,max(cities.g,cities.b));
  float cityMask=smoothstep(0.025,0.20,cityBrightness);
  vec3 cityLights=cities*cityMask*1.30;
  // A very faint blue surface and cloud layer remain visible behind city lights.
  vec3 nightGround=land*vec3(0.045,0.055,0.09);
  vec3 nightClouds=vec3(0.035,0.043,0.065)*clouds;
  vec3 night=nightGround*(1.0-clouds)+nightClouds+cityLights*(1.0-clouds*0.62);
  vec3 surface=mix(night,daylight,day);
  float viewCos=clamp(dot(eyeNormal,normalize(inputData.positionToEyeEC)),0.0,1.0);
  float grazing=1.0-viewCos;
  float twilight=smoothstep(-0.24,0.18,sunlight);
  float opticalDepth=0.075*(1.0/(viewCos+0.16)-1.0/1.16);
  float haze=(1.0-exp(-opticalDepth))*twilight;
  surface=mix(surface,vec3(0.16,0.26,0.42),haze);
  // Blue-white limb on the lit side, a faint outline on the dark side.
  surface+=pow(grazing,5.0)*vec3(0.095,0.19,0.33)*(0.20+0.80*twilight);
  surface+=lunarView*pow(grazing,4.0)*vec3(0.07,0.19,0.38)*smoothstep(0.0,0.2,sunlight);
  surface*=mix(1.0,0.35+0.65*smoothstep(0.0,0.025,sunlight),lunarView);
  material.diffuse=surface/(vec3(1.0)+surface*0.035);
  material.alpha=1.0;
  return material;
 }`;
 // Preserve cartographic imagery on the lit hemisphere; replace every unlit pixel with black.
 const lunarMapSource=`czm_material czm_getMaterial(czm_materialInput inputData){
  czm_material material=czm_getDefaultMaterial(inputData);
  vec3 worldPosition=(czm_inverseView*vec4(-inputData.positionToEyeEC,1.0)).xyz;
  vec3 worldDirection=normalize(worldPosition*vec3(1.0,1.0,1.0067394967));
  float sunlight=dot(normalize(mat3(czm_view)*worldDirection),normalize(czm_sunDirectionEC));
  material.diffuse=vec3(0.0);
  material.alpha=1.0-smoothstep(0.0,0.025,sunlight);
  return material;
 }`;
 function create({viewer,imagery,C,onChange=()=>{},loadImage=url=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Les textures de la Terre sont indisponibles.'));image.src=url;})}){
  let enabled=false,wanted=false,pending=null,material=null,atmosphere=null,revision=0,night=true,basemap=true,credited=false,lunarView=false,lunarMap=null;
  const original={material:viewer.scene.globe.material,atmosphere:viewer.scene.skyAtmosphere};
  const credit=new C.Credit('Terre : NASA Blue Marble / Black Marble',true);
  function update(data){
   if(data){night=data.night;basemap=data.basemap;}
   if(material)material.uniforms.lunarView=lunarView?1:0;
   viewer.scene.globe.vertexShadowDarkness=lunarView?0:.35;
   imagery.show=enabled?false:basemap;
   if(lunarView&&!enabled&&!lunarMap)lunarMap=new C.Material({fabric:{type:'AtlasLunarMapNight',source:lunarMapSource},translucent:false});
   viewer.scene.globe.material=enabled?material:lunarView?lunarMap:original.material;
   // The material supplies its own day/night illumination, including city light emission.
   viewer.scene.globe.enableLighting=enabled?false:(lunarView||night);
   // In lunar view the photographic surface supplies the sunlit blue limb.
   // Disable the separate sky shell, which otherwise outlines the dark hemisphere.
   if(atmosphere){atmosphere.show=enabled&&!lunarView;atmosphere.setDynamicLighting?.(0);atmosphere.atmosphereLightIntensity=22;}
   viewer.scene.skyAtmosphere=lunarView?undefined:enabled?atmosphere:original.atmosphere;
   if(enabled!==credited){const credits=viewer.scene.frameState.creditDisplay;if(enabled)credits.addStaticCredit(credit);else credits.removeStaticCredit(credit);credited=enabled;}
  }
  function status(loading=false,error=''){onChange({enabled,loading,error});viewer.scene.requestRender();}
  return {
   get enabled(){return enabled;},update,setLunarView(value){lunarView=!!value;update();viewer.scene.requestRender();},
   async setEnabled(value){
    wanted=Boolean(value);const request=++revision;
    if(!wanted){enabled=false;update();status();return false;}
    status(true);
    try{
     if(!material){
      if(!pending)pending=Promise.all(['day-4k.webp','night-4k.webp','clouds-4k.webp'].map(file=>loadImage(base+file))).catch(error=>{pending=null;throw error;});
      const [dayMap,nightMap,cloudMap]=await pending;
      if(request!==revision)return enabled;
      material=new C.Material({fabric:{type:'AtlasRealisticEarth',uniforms:{dayMap,nightMap,cloudMap,lunarView:lunarView?1:0},source},translucent:false});
      atmosphere=new C.SkyAtmosphere();atmosphere.perFragmentAtmosphere=true;atmosphere.atmosphereLightIntensity=22;atmosphere.atmosphereRayleighScaleHeight=8500;atmosphere.brightnessShift=-0.13;
     }
     if(request!==revision)return enabled;
     enabled=wanted;update();status();return enabled;
    }catch(error){if(request===revision){wanted=false;enabled=false;update();status(false,error.message);}return false;}
   },
   recover(error){if(!enabled||!/shader|compile|texture|material/i.test(String(error?.message||error)))return false;revision++;wanted=false;enabled=false;update();status(false,'Ce rendu n’est pas disponible sur cette configuration.');return true;}
  };
 }
 const api={create,source,lunarMapSource};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasEarth=api;
})(typeof window!=='undefined'?window:globalThis);
