/* Reproducible audit of the facts actually displayed, including debris.
 * No conversion of radar cross section to dimensions or mass. */
const fs=require('node:fs'),path=require('node:path'),facts=require('../static/object-facts.js');
const root=path.resolve(__dirname,'..');process.chdir(root);
const catalog=new Map();
for(const file of ['satcat.json',...fs.readdirSync('data-seed').filter(f=>f.endsWith('-catalog.json')).sort()]){
 for(const row of JSON.parse(fs.readFileSync(path.join('data-seed',file))))catalog.set(row.NORAD_CAT_ID,row);
}
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
(async()=>{
 const summaries={},lines=[['NORAD','Nom','Classe','Identifiant international','Envergure','Longueur','Poids','Lanceur','Type de satellite','Source envergure','Source longueur','Source poids'].map(quote).join(',')];
 for(const row of [...catalog.values()].sort((a,b)=>a.NORAD_CAT_ID-b.NORAD_CAT_ID)){
  const sat={id:row.NORAD_CAT_ID,name:row.OBJECT_NAME,object_type:row.OBJECT_TYPE,designator:row.OBJECT_ID,launch:row.LAUNCH_DATE};
  await facts.load(sat,async file=>JSON.parse(fs.readFileSync(path.join('static',file))));
  const f=facts.facts(sat),type=row.OBJECT_TYPE||'UNK';
  const totals=summaries[type]??=(Object.fromEntries(['objects','anyPhysicalFact','allThree','span','length','mass','launchVehicle','type','withEstimate'].map(k=>[k,0])));
  totals.objects++;totals.anyPhysicalFact+=!!(f.span||f.length||f.mass);totals.allThree+=!!(f.span&&f.length&&f.mass);
  for(const k of ['span','length','mass','launchVehicle','type'])totals[k]+=!!f[k];
  totals.withEstimate+=['span','length','mass'].some(k=>f[k]?.includes('≈'));
  lines.push([sat.id,sat.name,type,sat.designator,f.span,f.length,f.mass,f.launchVehicle,f.type,f.span?f.spanNote.split('Source : ').at(-1):null,f.length?f.lengthNote.split('Source : ').at(-1):null,f.mass?f.massNote.split('Source : ').at(-1):null].map(quote).join(','));
 }
 fs.writeFileSync('resources/object-physical-audit.csv','\ufeff'+lines.join('\n')+'\n');
 fs.writeFileSync('resources/object-physical-audit-summary.json',JSON.stringify({catalogue:'data-seed SATCAT et catalogues spécialisés ; identifiants NORAD uniques',physicalCatalogues:facts.physicalManifest.catalogues,counts:summaries},null,2)+'\n');
 console.log(JSON.stringify(summaries,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
