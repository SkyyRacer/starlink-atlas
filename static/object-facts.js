/* Physical dimensions are curated measurements, never inferred from display models. */
(function(root){
 const registry=typeof module==='object'&&module.exports?require('./constellations.js'):root.AtlasCollections;
 const categories={science:'Scientifique',defense:'Défense et surveillance',weather:'Météorologique',observation:'Observation de la Terre',navigation:'Navigation',telecommunications:'Télécommunications',experimental:'Expérimental / démonstration technologique',stations:'Station spatiale',vehicles:'Vaisseau / capsule',history:'Satellite historique',heritage:'Patrimoine orbital',debris:'Débris spatial'};
 const measurements=[
  {ids:[25544],text:'109 m d’envergure · 73 m avec les panneaux déployés',note:'Dimensions de l’ensemble déployé ; la configuration évolue avec l’assemblage et les véhicules amarrés.',source:'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/'},
  {ids:[20580],text:'Longueur : 13,2 m · diamètre : 4,3 m',note:'Dimensions du corps du télescope, hors envergure des panneaux solaires.',source:'https://science.nasa.gov/mission/hubble/overview/about-hubble/'},
  {ids:[25867],text:'13,8 × 19,5 m',note:'Observatoire avec les panneaux solaires déployés.',source:'https://chandra.harvard.edu/about/specs.html'},
  {ids:[50463],text:'21,2 × 14,2 m · hauteur : environ 8 m',note:'Pare-soleil déployé et hauteur totale de l’observatoire.',source:'https://science.nasa.gov/mission/webb/science-overview/science-explainers/telescope-overview/'},
  {ids:[34380],text:'Hauteur : 4,7 m · diamètre : 2,7 m',note:'Dimensions générales de Kepler publiées dans le dossier de mission.',source:'https://www.jpl.nasa.gov/news/press_kits/Kepler-presskit-2-19-smfile.pdf'},
  {ids:[10321,10271],text:'Hauteur : 3,8 m · antenne : Ø 3,7 m · mât : 13 m',note:'Le mât de magnétomètre mesure 13 m ; ces mesures décrivent des éléments distincts, pas un parallélépipède englobant.',source:'https://science.nasa.gov/mission/voyager/frequently-asked-questions/'},
  {ids:[39479],text:'Pare-soleil déployé : environ 10 m de diamètre',note:'Mesure du pare-soleil de Gaia, pas du seul corps central.',source:'https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Gaia_spreads_its_wings'},
  {ids:[57209],text:'Hauteur : environ 4,7 m · diamètre : 3,7 m',note:'Dimensions générales de l’observatoire Euclid.',source:'https://www.esa.int/Science_Exploration/Space_Science/Euclid_overview'},
  {ids:[8820,22195],text:'Diamètre : 0,60 m',note:'Diamètre de la sphère LAGEOS ; identique pour LAGEOS 1 et 2.',source:'https://earth.gsfc.nasa.gov/geo/missions/lageos'},
  {ids:[33500],text:'Longueur : environ 11 m · diamètre : environ 4 m',note:'Étage H-IIA du lancement GOSAT, NORAD 33500. Ordres de grandeur publiés par JAXA pour la cible CRD2 ; masse résiduelle approximative.',source:'https://www.ard.jaxa.jp/eng/crd2/project/'},
  {ids:[39162],text:'Diamètre : 2 m · hauteur : 1,6 m',note:'Partie supérieure VESPA, NORAD 39162 ; dimensions et masse de la cible dans l’étude ESA/ClearSpace de janvier 2020. Ces valeurs décrivent l’adaptateur entier, pas ses éventuels fragments.',source:'https://nebula.esa.int/sites/default/files/neb_study/2508/C4000128786ExS.pdf'},
  {ids:[4],text:'Longueur : 2,05 m',note:'Satellite Explorer 1 complet, et non les seuls instruments.',source:'https://science.nasa.gov/mission/explorer-1/about/'},
  {ids:[5],text:'Diamètre : 0,1625 m',note:'Corps sphérique de Vanguard 1, hors antennes.',source:'https://ntrs.nasa.gov/api/citations/19800019885/downloads/19800019885.pdf'},
  {ids:[16609],text:'33 × 31 × 27,5 m',note:'Complexe Mir assemblé avec véhicules amarrés, configuration de référence ESA 2001 ; dimensions variables pendant son assemblage.',source:'https://www.esa.int/About_Us/Corporate_news/Mir_FAQs_-_Facts_and_history'},
  {ids:[36577],text:'Voile : 14 × 14 m, diagonale de 20 m ; corps haut de 0,8 m',note:'Dimensions déployées et hauteur du corps selon JAXA ; environ 310 kg au lancement.',source:'https://www.isas.jaxa.jp/missions/spacecraft/past/ikaros.html'},
  {ids:[48274],text:'Station modulaire assemblée',note:'Masse approximative du complexe assemblé de référence en juin 2026, configuration variable ; pas la masse du seul module Tianhe ni une reconstitution à chaque date.',source:'https://english.scio.gov.cn/chinavoices/2026-06/24/content_118564178.html'},
  {ids:[2],text:'Corps sphérique : Ø 0,58 m',note:'Diamètre du corps de Spoutnik 1, hors antennes.',source:'https://www.nasa.gov/wp-content/uploads/static/history/sputnik.html'}
 ];
 // GCAT_MANIFEST_BEGIN
 const physicalManifest={"source":"https://planet4589.org/space/gcat/tsv/cat/satcat.tsv","updated":"2026 Oct 26 0022:04","sha256":"ea7191b85786baf4af1f17979e691d7015adc541cc0dbcb960447e2a86e1d4e8","catalogues":[{"file":"satcat.tsv","source":"https://planet4589.org/space/gcat/tsv/cat/satcat.tsv","updated":"2026 Oct 26 0022:04","sha256":"ea7191b85786baf4af1f17979e691d7015adc541cc0dbcb960447e2a86e1d4e8"},{"file":"satcat100k.tsv","source":"https://planet4589.org/space/gcat/tsv/cat/satcat100k.tsv","updated":"2026 Oct 26 0022:11","sha256":"7f2f3dcfc2f06a78aa383bb4f0f17f959b15fcaccf152f7a31e2e655486ffcfc"},{"file":"launchlog.tsv","source":"https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv","sha256":"42ce9d93d1c7bdee206c64a97179a5c88aab2dd913b1a08f9fdeb24a9be03ddb","updated":"2026 Oct 26 0019:48"},{"file":"psatcat.tsv","source":"https://planet4589.org/space/gcat/tsv/cat/psatcat.tsv","sha256":"5af402056893dd666ad3ef2e573fbd59933306efee11d196e25581135cefd3a3","updated":"2026 Oct 26 0022:11"}],"fields":["span_m","length_m","mass_kg","approximate_flags","starlink_generation","launch_site","launch_vehicle","mission_category"],"counts":{"objects":62900,"span":30533,"length":30327,"mass":30500,"starlink_generations":12900,"physical_objects":30571,"launch_vehicles":62866},"files":{"0":"0-97dc6d6e6aca.json","1":"1-da4743f714e3.json","2":"2-e83428ad3f87.json","3":"3-3c0ef5fc3149.json","4":"4-b48e2d28e7a8.json","5":"5-f8c23a2a7cfb.json","6":"6-b074803f572d.json","7":"7-0d17bdf96db3.json","8":"8-d20e2663d8c3.json","9":"9-a26c3479de16.json","10":"10-4a3813b00ce3.json","11":"11-eb459e9fddd6.json","12":"12-09fbe59ba1a9.json","13":"13-547107551ef3.json","14":"14-b2319286a206.json","15":"15-675ab74cea61.json","16":"16-705d5dfec2a6.json","17":"17-9c6d37319f13.json","18":"18-55efd49357bb.json","19":"19-fc8574fdc9a3.json","20":"20-7c67dcfb1b86.json","21":"21-157f27881a22.json","22":"22-e5c9162eec17.json","23":"23-8edcf9fd08e5.json","24":"24-ad617adfdd84.json","25":"25-502e7417e0ed.json","26":"26-ffbf694bcbf7.json","27":"27-35e445326107.json","28":"28-6642d2aaed7d.json","29":"29-436de8e9b822.json","30":"30-16bde2f7e264.json","31":"31-98b496fd3bd4.json","32":"32-2c350513d411.json","33":"33-d266fae54d8b.json","34":"34-2055192b4b19.json","35":"35-587e696792d6.json","36":"36-fa02d692def8.json","37":"37-5d1547a0d405.json","38":"38-331a3f41fb1a.json","39":"39-157fd8c48311.json","40":"40-02c8e2a08fd0.json","41":"41-7a6a547154c2.json","42":"42-0ec9b70747cf.json","43":"43-97d9cf758d0a.json","44":"44-c9eb86038e00.json","45":"45-8b5d2621aed7.json","46":"46-8f10628389c5.json","47":"47-4532d1ab178e.json","48":"48-cb9f7efcebdc.json","49":"49-699efbf0ff2d.json","50":"50-26add5c90114.json","51":"51-8c16f7e42eca.json","52":"52-cb265a07cae2.json","53":"53-d8f1ab374a19.json","54":"54-1974eed18c94.json","55":"55-19ce446665dc.json","56":"56-e0f7294fc19c.json","57":"57-02c8b9fb04ee.json","58":"58-f97e9276a68a.json","59":"59-be4f87dac9d3.json","60":"60-2d81abbae1cd.json","61":"61-719c5ccee81b.json","62":"62-ecf51ddf96de.json","63":"63-8f523b7f32c9.json","64":"64-22c501a903bb.json","65":"65-7c287862d516.json","66":"66-203333eabf69.json","67":"67-ce5b185acab0.json","68":"68-c9e98ae4388b.json","69":"69-5c47ac07f32f.json","100":"100-cd3acf291c17.json","101":"101-28ebff24c866.json"}};
 // GCAT_MANIFEST_END
 const physicalBase=typeof document!=='undefined'?new URL('./physical-facts/',document.currentScript.src).href:'physical-facts/';
 const loaded=new Map(),requests=new Map();
 const curated={
  25544:{launchSite:'TYMSC',span:109,length:73,mass:419725,massNote:'Masse de référence de la station assemblée, variable selon la configuration ; pas une pesée à la date affichée.'},
  48274:{launchSite:'WSC',mass:90000,approximate:'m',massNote:'Complexe assemblé, masse de référence approximative publiée en juin 2026 ; variable avec les modules et véhicules amarrés.'},36577:{span:20,length:.8,mass:310,approximate:'m'},16609:{launchSite:'TYMSC',span:31,length:33,massRange:[130000,140000],massNote:'Fourchette ESA pour le complexe assemblé, avec véhicules amarrés. Configuration de référence 2001 ; pas une pesée à la date consultée.'},
  33500:{length:11,mass:3000,approximate:'lm',massNote:'Masse résiduelle approximative de la cible CRD2 publiée par JAXA.'},
  39162:{span:2,length:1.6,mass:112},4:{length:2.05,mass:13.9},5:{length:.1625,mass:1.47},
  20580:{length:13.2,mass:10800,massNote:'Masse au lancement.'},
  25867:{span:19.5,length:13.8,mass:4800},
  50463:{span:14.2,length:21.2},
  34380:{length:4.7,mass:1052.4},
  10321:{mass:815},10271:{mass:815},39479:{span:10,mass:2030},57209:{length:4.7},
  8820:{span:.6,length:.6},22195:{span:.6,length:.6},2:{length:.58,mass:83.6}
 };
 const missionTypes={COM:'Télécommunications',NAV:'Navigation',SCI:'Scientifique',AST:'Astronomie',PLAN:'Exploration planétaire',EOSCI:'Sciences de la Terre',MET:'Météorologique','MET-RO':'Météorologie par radio-occultation',IMG:'Observation de la Terre','IMG-R':'Reconnaissance',SIG:'Renseignement électromagnétique',CAL:'Étalonnage',SS:'Vol spatial habité',TECH:'Expérimental / démonstration technologique',MGRAV:'Microgravité',BIO:'Biologie spatiale',GEOD:'Géodésie',EDU:'Éducatif',RV:'Véhicule de rentrée',EW:'Alerte avancée',TARG:'Cible orbitale',WEAPON:'Système militaire'};
 const byId=new Map(measurements.flatMap(row=>row.ids.map(id=>[id,row])));
 const sites={AFETR:'Cap Canaveral / Kennedy, Floride, États-Unis',AFWTR:'Vandenberg, Californie, États-Unis',TYMSC:'Baïkonour, Kazakhstan',PLMSC:'Plessetsk, Russie',FRGUI:'Kourou, Guyane française',SRILR:'Centre spatial Satish-Dhawan, Inde',JSC:'Jiuquan, Chine',XICLF:'Xichang, Chine',TAISC:'Taiyuan, Chine',WSC:'Wenchang, Chine',TANSC:'Tanegashima, Japon',KSCUT:'Uchinoura, Japon',VOSTO:'Vostotchny, Russie',RLLB:'Péninsule de Mahia, Nouvelle-Zélande',WLPIS:'Wallops Island, Virginie, États-Unis',KYMSC:'Kapoustine Iar, Russie',SEAL:'Plateforme Sea Launch',YSLA:'Zone de lancement en mer Jaune, Chine',DLS:'Dombarovski, Russie',HGSTR:'Hammaguir, Algérie',KODAK:'Kodiak, Alaska, États-Unis',NSC:'Naro, Corée du Sud',SEMLS:'Semnan, Iran',SMTS:'Shahrud, Iran',YAVNE:'Palmachim, Israël',WOMRA:'Woomera, Australie',SNMLP:'Plateforme San Marco, Kenya',ERAS:'Espace aérien du champ de tir de l’Est, États-Unis',WRAS:'Espace aérien du champ de tir de l’Ouest, États-Unis',SCSLA:'Zone de lancement en mer de Chine méridionale',STARB:'Starbase, Texas, États-Unis'};
 async function load(s,read=async path=>{const response=await fetch(path);if(!response.ok)throw Error('Caractéristiques physiques indisponibles');return response.json();}){
  const group=String(Math.floor((s.id??s.NORAD_CAT_ID)/1000)),file=physicalManifest.files[group];if(!file)return;
  if(!requests.has(group))requests.set(group,read(physicalBase+file).then(rows=>{for(const [id,row] of Object.entries(rows))loaded.set(Number(id),row);}).catch(error=>{requests.delete(group);throw error;}));
  await requests.get(group);
 }
 const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
 const weight=(value,approx=false)=>positive(value)?(approx?'≈ ':'')+(value<1000?value.toLocaleString('fr-FR',{maximumFractionDigits:value<1?6:2})+' kg':(value/1000).toLocaleString('fr-FR',{maximumFractionDigits:3})+' t'):null;
 const format=(value,unit,approx=false)=>positive(value)?(approx?'≈ ':'')+value.toLocaleString('fr-FR',{maximumFractionDigits:value<1?6:2})+' '+unit:null;
 function facts(s){
  const id=s.id??s.NORAD_CAT_ID,family=registry.family(s),definition=registry.byId.get(family),physical=byId.get(id),record=loaded.get(id),override=curated[id]||{};
  const mission=(record?.[7]||'').replace(/[?*]/g,'').split('/').map(v=>missionTypes[v]).filter(Boolean);
  const type=s.object_type==='R/B'?'Étage / corps de fusée':s.object_type==='UNK'?'Objet non identifié':s.object_type==='DEB'?'Débris spatial':definition?.category==='stations'?categories.stations:mission.length?[...new Set(mission)].join(' / '):categories[definition?.category]||null;
  const generation=record?.[4]||null,flags=record?.[3]||'',span=override.span??record?.[0],length=override.length??record?.[1],mass=override.mass??record?.[2];
  const source=physical?.source||physicalManifest.source;
  return {type:type&&generation?type+' · Starlink '+generation:type,generation,launchVehicle:s.launch_vehicle||record?.[6]||null,
   dimensions:physical?.text||null,
   span:format(span,'m',override.span==null?flags.includes('s'):override.approximate?.includes('s')),length:format(length,'m',override.length==null?flags.includes('l'):override.approximate?.includes('l')),mass:override.massRange?override.massRange.map(v=>(v/1000).toLocaleString('fr-FR')).join('–')+' t':weight(mass,override.mass==null?flags.includes('m'):override.approximate?.includes('m')),
   note:'Caractéristiques du catalogue GCAT, recoupées par NORAD et identifiant de lancement. ≈ indique une estimation du catalogue. Source : '+physicalManifest.source,
   spanNote:override.span!=null?physical?.note+' Source : '+physical?.source:'Envergure publiée dans GCAT ; ≈ indique une estimation. Source : '+physicalManifest.source,
   lengthNote:override.length!=null?physical?.note+' Source : '+physical?.source:'Longueur du corps publiée dans GCAT (grand côté du plateau pour Starlink) ; ≈ indique une estimation. Source : '+physicalManifest.source,
   massNote:(override.massNote||'Masse de référence publiée, généralement au lancement ; pas une mesure de la masse restante à la date affichée.')+' Source : '+(override.mass!=null||override.massRange?physical?.source:physicalManifest.source),
   source:source||null};
 }
 function profile(s,p,{orbit,launch,distant=false}={}){
  const data=facts(s),site=s.launch_site||s.LAUNCH_SITE||loaded.get(s.id)?.[5]||curated[s.id]?.launchSite,place=site&&site!=='UNK'?(sites[site]||site):null;
  const date=typeof s.launch==='string'&&Number.isFinite(Date.parse(s.launch))?launch:null;
  const speed=Number.isFinite(p?.speed_km_s)&&p.speed_km_s>=0?Math.round(p.speed_km_s*3600).toLocaleString('fr-FR')+' km/h':null;
  const altitude=Number.isFinite(p?.altitude_km)&&!distant?p.altitude_km.toLocaleString('fr-FR',{maximumFractionDigits:1})+' km':null;
  const distance=distant&&p?.icrf_km?.length===3&&p.icrf_km.every(Number.isFinite)?Math.hypot(...p.icrf_km).toLocaleString('fr-FR',{maximumFractionDigits:1})+' km':null;
  return [
   ['NORAD',Number.isSafeInteger(s.id)?s.id:null,'Identifiant NORAD du catalogue.'],
   ['Type de satellite',data.type,'Catégorie de mission du registre Atlas, enrichie par GCAT psatcat lorsque disponible ; variante du satellite selon GCAT. Source : https://planet4589.org/space/gcat/tsv/cat/psatcat.tsv'],
   ['Type d’orbite',orbit&&!/^(Non |Régime orbital non)/.test(orbit)?orbit:null,'Régime calculé à partir des éléments orbitaux ou régime nominal de la mission.'],
   ['Envergure',data.span,data.spanNote],['Longueur',data.length,data.lengthNote],['Poids',data.mass,data.massNote],
   ['Date et lieu de lancement',[date,place].filter(Boolean).join(' · ')||null,'Date publiée et site de lancement SATCAT. Une date fournie au jour ne reçoit aucune heure inventée. Pour une station assemblée, date et lieu du premier module. Sites : https://celestrak.org/satcat/launchsites.php'],
   ['Lanceur',data.launchVehicle,'Lanceur du lancement d’origine, recoupé par identifiant de lancement GCAT. Pour les fragments, lanceur de l’objet parent ; pour une station assemblée, celui du premier module. Source : https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv'],
   [distant?'Distance de la Terre':'Altitude',distant?distance:altitude,distant?'Distance au centre de la Terre ; une mission lointaine n’a pas d’altitude orbitale terrestre.':'Hauteur estimée au-dessus de la surface terrestre, à la date affichée.'],
   ['Vitesse',speed,'Vitesse inertielle calculée, convertie en km/h (1 km/s = 3 600 km/h).']
  ].filter(([,value])=>value!==null&&value!==undefined&&value!=='');
 }
 const api={facts,load,profile,weight,measurements,categories,physicalManifest};if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasObjectFacts=api;
})(globalThis);
