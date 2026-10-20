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
    std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;sources::atomic(&dir,"tess.json",&serde_json::to_vec(&parsed).unwrap())?;Ok(())}.await;
   if let Err(e)=result{eprintln!("TESS Horizons : {e} · cache conservé");}
  }
  if once{return;}
  tokio::time::sleep(std::time::Duration::from_secs(7200)).await;
 }
}
#[cfg(test)]mod tests{use super::*;#[test]fn official_vectors_are_utc_and_bounded(){let raw:Value=serde_json::from_slice(include_bytes!("../resources/tess-horizons-sample.json")).unwrap();let parsed=parse(&raw).unwrap();assert_eq!(parsed["id"],43435);assert!(parsed["samples"].as_array().unwrap().len()>1000);let bad=json!({"result":raw["result"].as_str().unwrap().replace("Earth (399)","Sun (10)")});assert!(parse(&bad).is_err());}}
