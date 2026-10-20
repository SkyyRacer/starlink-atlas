//! Official geocentric ICRF vectors for missions whose HEO is unsuitable for stale TLEs.
use super::*;
const ENDPOINT:&str="https://ssd.jpl.nasa.gov/api/horizons.api";
pub fn parse(value:&Value)->Result<Value,String>{
 let text=value["result"].as_str().ok_or("Réponse Horizons absente")?;
 if !text.contains("TESS (spacecraft) (-95)")||!text.contains("Earth (399)")||!text.contains("ICRF")||!text.contains("JDUT"){return Err("Référentiel Horizons incorrect".into());}
 // Require UTC explicitly: a TDB timestamp must never be interpreted as UTC.
 if !text.contains("UT")||!text.contains("KM-S"){return Err("Unités Horizons incorrectes".into());}
 let data=text.split("$$SOE").nth(1).and_then(|s|s.split("$$EOE").next()).ok_or("Vecteurs Horizons absents")?;
 let mut samples:Vec<Vec<f64>>=Vec::new();
 for line in data.lines().filter(|s|!s.trim().is_empty()){
  let fields:Vec<_>=line.split(',').map(str::trim).collect();if fields.len()<8{return Err("Vecteur Horizons incomplet".into());}
  let jd:f64=fields[0].parse().map_err(|_|"Date Horizons incorrecte")?;
  let mut row=vec![((jd-2440587.5)*86400.).round()];
  for field in &fields[2..8]{row.push(field.parse::<f64>().map_err(|_|"Coordonnée Horizons incorrecte")?);}
  if row.iter().any(|v|!v.is_finite())||samples.last().is_some_and(|last|row[0]<=last[0]||row[0]-last[0]>3601.){return Err("Échantillons Horizons invalides".into());}
  samples.push(row);
 }
 if samples.len()<48{return Err("Couverture Horizons insuffisante".into());}
 let tracking=text.lines().find_map(|s|s.split("Last tracking data used is ").nth(1)).and_then(|s|s.get(..11)).and_then(|s|chrono::NaiveDate::parse_from_str(s,"%Y-%b-%d").ok()).map(|d|d.to_string()+"T00:00:00Z");
 Ok(json!({"id":43435,"frame":"ICRF","time_scale":"UTC","source":"NASA/JPL Horizons · trajectoire prédite","url":"https://ssd.jpl.nasa.gov/horizons/","epoch":tracking,"fetched":Utc::now().to_rfc3339(),"period_seconds":13.7*86400.,"samples":samples}))
}
// Retain successful rolling vectors by year before replacing the current window.
fn archive(dir:&std::path::Path,doc:&Value)->Result<(),String>{
 let index_file=dir.join("tess-index.json");
 let mut index:Value=std::fs::read(&index_file).ok().and_then(|v|serde_json::from_slice(&v).ok()).unwrap_or_else(||json!({"source":"NASA/JPL Horizons","url":"https://ssd.jpl.nasa.gov/horizons/","years":{}}));
 let mut years:std::collections::BTreeMap<String,Vec<Value>>=std::collections::BTreeMap::new();
 for sample in doc["samples"].as_array().ok_or("Vecteurs absents")?{
  let seconds=sample[0].as_f64().filter(|v|v.is_finite()).ok_or("Date de vecteur incorrecte")?;
  let time=chrono::DateTime::from_timestamp(seconds as i64,0).ok_or("Date hors limites")?;
  years.entry(time.format("%Y").to_string()).or_default().push(sample.clone());
 }
 std::fs::create_dir_all(dir.join("tess")).map_err(|e|e.to_string())?;
 for (year,rows) in years{
  let mut samples:std::collections::BTreeMap<i64,Value>=std::collections::BTreeMap::new();
  if let Some(file)=index["years"][&year]["file"].as_str(){
   let relative=file.strip_prefix("ephemerides/").ok_or("Chemin d’archive incorrect")?;
   let old:Value=serde_json::from_slice(&std::fs::read(dir.join(relative)).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
   for row in old["samples"].as_array().ok_or("Archive de vecteurs incorrecte")?{if let Some(t)=row[0].as_f64(){samples.insert(t as i64,row.clone());}}
  }
  for row in rows{samples.insert(row[0].as_f64().unwrap() as i64,row);}
  let rows:Vec<_>=samples.into_values().collect();let first=rows.first().unwrap()[0].clone();let last=rows.last().unwrap()[0].clone();
  let mut saved=doc.clone();saved["samples"]=json!(rows);saved["source"]=json!("NASA/JPL Horizons · trajectoire archivée");
  let filename=format!("{year}-collected.json");sources::atomic(&dir.join("tess"),&filename,&serde_json::to_vec(&saved).unwrap())?;
  index["years"][&year]=json!({"file":format!("ephemerides/tess/{filename}"),"first_epoch":first,"last_epoch":last,"samples":saved["samples"].as_array().unwrap().len()});
 }
 sources::atomic(dir,"tess-index.json",&serde_json::to_vec(&index).unwrap())
}
pub async fn collect(once:bool){
 let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(60)).build().unwrap();
 loop{
  let dir=PathBuf::from("static/ephemerides");let file=dir.join("tess.json");
  let fresh=std::fs::metadata(&file).and_then(|m|m.modified()).ok().and_then(|t|t.elapsed().ok()).is_some_and(|age|age.as_secs()<86400);
  if !fresh{
   let start=(Utc::now()-chrono::Duration::days(20)).format("%Y-%m-%d").to_string();let stop=(Utc::now()+chrono::Duration::days(30)).format("%Y-%m-%d").to_string();
   let params=[("COMMAND","'-95'"),("EPHEM_TYPE","'VECTORS'"),("CENTER","'500@399'"),("START_TIME",&start),("STOP_TIME",&stop),("STEP_SIZE","'1 h'"),("VEC_TABLE","'2'"),("REF_PLANE","'FRAME'"),("OUT_UNITS","'KM-S'"),("TIME_TYPE","'UT'"),("CSV_FORMAT","'YES'")];
   let result:Result<(),String>=async{let response=client.get(ENDPOINT).query(&params).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;
    let raw:Value=response.json().await.map_err(|e|e.to_string())?;let parsed=parse(&raw)?;
    std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;archive(&dir,&parsed)?;sources::atomic(&dir,"tess.json",&serde_json::to_vec(&parsed).unwrap())?;Ok(())}.await;
   if let Err(e)=result{eprintln!("TESS Horizons : {e} · cache conservé");}
  }
  if once{return;}
  tokio::time::sleep(std::time::Duration::from_secs(7200)).await;
 }
}
#[cfg(test)]mod tests{use super::*;#[test]fn official_vectors_are_utc_and_bounded(){let raw:Value=serde_json::from_slice(include_bytes!("../resources/tess-horizons-sample.json")).unwrap();let parsed=parse(&raw).unwrap();assert_eq!(parsed["id"],43435);assert!(parsed["samples"].as_array().unwrap().len()>1000);let bad=json!({"result":raw["result"].as_str().unwrap().replace("Earth (399)","Sun (10)")});assert!(parse(&bad).is_err());}}

#[cfg(test)]mod archive_tests{use super::*;
 #[test]fn rolling_vectors_keep_old_samples_and_add_new_years(){
 let dir=std::env::temp_dir().join(format!("atlas-vectors-{}",std::process::id()));let _=std::fs::remove_dir_all(&dir);
 let doc=|samples|json!({"id":43435,"samples":samples});
 archive(&dir,&doc(json!([[1735686000,1],[1735689600,2]]))).unwrap();
 archive(&dir,&doc(json!([[1735689600,3],[1735693200,4]]))).unwrap();
 let index:Value=serde_json::from_slice(&std::fs::read(dir.join("tess-index.json")).unwrap()).unwrap();assert_eq!(index["years"]["2024"]["samples"],1);assert_eq!(index["years"]["2025"]["samples"],2);
 let saved:Value=serde_json::from_slice(&std::fs::read(dir.join("tess/2025-collected.json")).unwrap()).unwrap();assert_eq!(saved["samples"][0][1],3);std::fs::remove_dir_all(dir).unwrap();
 }}
