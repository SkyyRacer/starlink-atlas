//! Independent delivery paths. Agreement never implies independent measurements.
use super::*;
use std::path::Path;
pub const SATNOGS:&str="SatNOGS / Space-Track";
pub const SATNOGS_CELESTRAK:&str="SatNOGS / CelesTrak";
pub const SATNOGS_OTHER:&str="SatNOGS / autre fournisseur";
pub const KEEPTRACK:&str="KeepTrack / fournisseurs multiples";
const SATNOGS_URL:&str="https://db.satnogs.org/api/tle/?format=json";
const KEEPTRACK_URL:&str="https://api.keeptrack.space/v4/sats/brief";
fn value<'a>(row:&'a Value,keys:&[&str])->Option<&'a str>{keys.iter().find_map(|key|row[*key].as_str())}
fn identifier(row:&Value)->Option<u64>{["norad_cat_id","noradId","satelliteId","sccNum","NORAD_CAT_ID","SCC_NUM"].iter().find_map(|k|row[*k].as_u64().or_else(||row[*k].as_str()?.parse().ok()))}
pub fn normalize(db:&Database,rows:&[Value],keeptrack:bool)->Result<(Vec<Value>,usize),String>{
 if rows.is_empty(){return Err("Catalogue secondaire vide : cache conservé".into());}
 let mut output=Vec::new();let mut rejected=0;
 for row in rows {
  let normalized=(||->Result<Option<Value>,String>{
   let name=value(row,&["tle0","name","NAME","OBJECT_NAME"]).unwrap_or("").trim_start_matches("0 ");
   let el=if row.get("MEAN_MOTION").is_some(){serde_json::from_value::<sgp4::Elements>(row.clone()).map_err(|e|e.to_string())?}else{
    sgp4::Elements::from_tle(Some(name.to_owned()),value(row,&["tle1","TLE_LINE_1"]).ok_or("TLE 1 absent")?.as_bytes(),value(row,&["tle2","TLE_LINE_2"]).ok_or("TLE 2 absent")?.as_bytes()).map_err(|e|e.to_string())?
   };
   if identifier(row).is_some_and(|id|id!=el.norad_id){return Err("Identité NORAD contradictoire".into());}
   let identity=db.catalog.get(&el.norad_id);
   if let (Some(known),Some(found))=(identity.and_then(|r|r["OBJECT_ID"].as_str()),el.international_designator.as_deref()){
    if !known.is_empty()&&!found.is_empty()&&known!=found{return Err("Identifiant international contradictoire".into());}
   }
   let name=identity.and_then(|v|v["OBJECT_NAME"].as_str()).unwrap_or(name);
   if collections::family(el.norad_id,name).is_none()&&!identity.is_some_and(debris::is_debris)&&!(keeptrack&&matches!(row["type"].as_u64(),Some(2|3))){return Ok(None);}
   sgp4::Constants::from_elements(&el).map_err(|e|e.to_string())?;
   let mut result=serde_json::to_value(el).map_err(|e|e.to_string())?;
   let upstream=value(row,&["tle_source","source"]).unwrap_or("Non précisé");
   if keeptrack {
    let kind=row["type"].as_u64().or_else(||row["TYPE"].as_u64());
    let date=|keys:&[&str]|value(row,keys).and_then(|v|v.get(..10)).filter(|v|chrono::NaiveDate::parse_from_str(v,"%Y-%m-%d").is_ok());
    result["ATLAS_CATALOG"]=json!({"NORAD_CAT_ID":result["NORAD_CAT_ID"],"OBJECT_NAME":name,"OBJECT_ID":result["OBJECT_ID"],"ORBIT_CENTER":"EA","OBJECT_TYPE":match kind{Some(2)=>"R/B",Some(3)=>"DEB",_=>"PAY"},"LAUNCH_DATE":date(&["launchDate","LAUNCH_DATE"]),"DECAY_DATE":date(&["decayDate","DECAY_DATE"]),"OWNER":value(row,&["country","COUNTRY"])});
   }
   result["OBJECT_NAME"]=json!(name);result["ATLAS_SOURCE"]=json!(if keeptrack{KEEPTRACK}else if upstream.to_lowercase().contains("celestrak"){SATNOGS_CELESTRAK}else if upstream=="Space-Track.org"{SATNOGS}else{SATNOGS_OTHER});result["ATLAS_UPSTREAM"]=json!(upstream);
   Ok(Some(result))
  })();
  match normalized {Ok(Some(v))=>output.push(v),Ok(None)=>{},Err(_)=>rejected+=1}
 }
 if output.is_empty(){return Err(format!("Aucun élément secondaire pris en charge ({rejected} rejetés), cache conservé"));}
 Ok((output,rejected))
}
pub fn checks(db:&Database,now:DateTime<Utc>)->Value {
 let mut objects=serde_json::Map::new();let mut compared=0;let mut divergent=0;
 for (&id,rows) in &db.orbits {
  if !rows.iter().any(|r|r.source.starts_with("SatNOGS")||r.source==KEEPTRACK){continue;}
  let mut latest:BTreeMap<&str,&Orbit>=BTreeMap::new();
  for row in rows {let age=(now.naive_utc()-row.el.datetime).num_seconds();if !(0..=MAX_AGE).contains(&age){continue;}if select(std::slice::from_ref(row),now).is_none(){continue;}
   if latest.get(row.source).is_none_or(|old|old.el.datetime<row.el.datetime){latest.insert(row.source,row);}
  }
  let sources:Vec<_>=latest.keys().copied().collect();let mut max_distance:f64=0.;let mut pairs=0;
  let values:Vec<_>=latest.values().copied().collect();
  for i in 0..values.len(){for j in i+1..values.len(){
   let predict=|o:&Orbit|o.constants.propagate(sgp4::MinutesSinceEpoch((now.naive_utc()-o.el.datetime).num_milliseconds() as f64/60000.));
   if let (Ok(a),Ok(b))=(predict(values[i]),predict(values[j])){let distance=a.position.iter().zip(b.position).map(|(a,b)|(a-b).powi(2)).sum::<f64>().sqrt();if distance.is_finite(){max_distance=max_distance.max(distance);pairs+=1;}}
  }}
  let state=if pairs==0{"single_source"}else if max_distance>100.{divergent+=1;"divergence"}else{compared+=1;"compared"};
  objects.insert(id.to_string(),json!({"state":state,"sources":sources,"at":now,"distance_km":if pairs>0{Some(max_distance)}else{None},"independent_verification":false,"note":"Écart entre modèles à la même date. Origines parfois communes : accord non équivalent à une mesure indépendante. Seuil indicatif de signalement : 100 km."}));
 }
 json!({"checked_at":now,"compared":compared,"divergent":divergent,"objects":objects})
}
pub fn checks_document(dir:&Path)->Value {std::fs::read(dir.join("orbital-checks.json")).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_else(||json!({"objects":{}}))}
pub fn load_metadata(db:&mut Database,dir:&Path){
 if let Some(rows)=std::fs::read(dir.join("secondary-catalog.json")).ok().and_then(|b|serde_json::from_slice::<Vec<Value>>(&b).ok()) {
  for row in rows {if let Some(id)=row["NORAD_CAT_ID"].as_u64(){let target=db.catalog.entry(id).or_insert_with(||json!({}));for (key,v) in row.as_object().into_iter().flatten(){if !v.is_null()&&target.get(key).is_none_or(Value::is_null){target[key]=v.clone();}}}}
 }
}
pub fn restore_freshness(db:&mut Database,dir:&Path){
 for key in ["satnogs","keeptrack"] {if let Some(status)=std::fs::read(dir.join(format!("{key}-status.json"))).ok().and_then(|b|serde_json::from_slice::<Value>(&b).ok()){
  if let Some(stamp)=status["fetched"].as_str(){let date=DateTime::parse_from_rfc3339(stamp).ok();let old=db.fetched.as_ref().and_then(|v|DateTime::parse_from_rfc3339(v).ok());if date.is_some()&&date>old {db.fetched=Some(stamp.to_owned());db.message="Collecte multi-sources · positions SGP4 estimées".into();}}
 }}
}
pub fn api_key(dir:&Path)->Option<String>{std::env::var("KEEPTRACK_API_KEY").ok().or_else(||std::fs::read_to_string(dir.join("keeptrack-api-key.txt")).ok()).map(|v|v.trim().to_owned()).filter(|v|!v.is_empty())}
pub async fn collect(shared:Shared,dir:PathBuf,once:bool){
 let client=reqwest::Client::builder().user_agent("Atlas/0.4 (cached educational orbital data)").connect_timeout(std::time::Duration::from_secs(8)).timeout(std::time::Duration::from_secs(60)).build().unwrap();let mut checked_revision=u64::MAX;
 loop {
  for key in ["satnogs","keeptrack"] {
   let credential=if key=="keeptrack"{api_key(&dir)}else{None};if key=="keeptrack"&&credential.is_none(){continue;}
   let now=Utc::now().timestamp();if !collection_health::due(&dir,key,now,7200){continue;}
   let _=sources::atomic(&dir,&format!("{key}-attempt.txt"),now.to_string().as_bytes());
   let result:Result<(),String>=async {
    let bytes=if let Some(secret)=credential {
     let mut header=reqwest::header::HeaderValue::from_str(&secret).map_err(|_|"Clé KeepTrack invalide")?;header.set_sensitive(true);
     let response=client.get(KEEPTRACK_URL).header("X-API-Key",header).send().await.map_err(|e|format!("Réseau temporaire KeepTrack : {e}"))?;
     if !response.status().is_success(){let wait=response.headers().get("retry-after").and_then(|v|v.to_str().ok()).and_then(|v|v.parse::<i64>().ok()).unwrap_or(0);return Err(format!("HTTP {} : KeepTrack indisponible retry_after_seconds={wait}",response.status().as_u16()));}
     let bytes=response.bytes().await.map_err(|e|e.to_string())?;if bytes.len()>100_000_000{return Err("Catalogue KeepTrack trop volumineux".into());}bytes.to_vec()
    }else{download(&client,SATNOGS_URL).await?};
    let doc:Value=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;let rows=doc.as_array().or_else(||doc["data"].as_array()).ok_or("Catalogue secondaire invalide")?;
    let (rows,rejected)=normalize(&*shared.read().await,rows,key=="keeptrack")?;let fresh=rows.iter().filter(|r|r["EPOCH"].as_str().and_then(|t|chrono::NaiveDateTime::parse_from_str(t,"%Y-%m-%dT%H:%M:%S%.f").ok()).is_some_and(|epoch|(0..=MAX_AGE).contains(&(Utc::now().naive_utc()-epoch).num_seconds()))).count();
    let validated=serde_json::to_vec(&rows).map_err(|e|e.to_string())?;
    // Parse in a temporary database before touching the cache or current edition.
    let mut temp=Database::default();temp.catalog=shared.read().await.catalog.clone();
    let metadata:Vec<_>=rows.iter().filter_map(|r|r.get("ATLAS_CATALOG").cloned()).collect();if !metadata.is_empty(){load_cat(&mut temp,&serde_json::to_vec(&metadata).map_err(|e|e.to_string())?)?;}load_gp(&mut temp,&validated)?;
    sources::atomic(&dir,&format!("gp-{key}-{now}.json"),&validated)?;sources::atomic(&dir,&format!("gp-{key}.json"),&validated)?;
    {let mut db=shared.write().await;
     for row in &rows {if let Some(meta)=row.get("ATLAS_CATALOG"){let id=row["NORAD_CAT_ID"].as_u64().unwrap();let target=db.catalog.entry(id).or_insert_with(||json!({}));for (key,v) in meta.as_object().unwrap(){if !v.is_null() && target.get(key).is_none_or(Value::is_null){target[key]=v.clone();}}}}
     load_gp(&mut db,&validated)?;
    }
    let metadata:Vec<_>=rows.iter().filter_map(|r|r.get("ATLAS_CATALOG").cloned()).collect();
    if !metadata.is_empty(){
     let previous=std::fs::read(dir.join("secondary-catalog.json")).ok().and_then(|b|serde_json::from_slice::<Vec<Value>>(&b).ok()).unwrap_or_default();
     let mut all:BTreeMap<u64,Value>=previous.into_iter().filter_map(|row|Some((row["NORAD_CAT_ID"].as_u64()?,row))).collect();
     for row in metadata {let id=row["NORAD_CAT_ID"].as_u64().unwrap();let target=all.entry(id).or_insert_with(||json!({}));for (key,v) in row.as_object().unwrap(){if !v.is_null(){target[key]=v.clone();}}}
     sources::atomic(&dir,"secondary-catalog.json",&serde_json::to_vec(&all.into_values().collect::<Vec<_>>()).map_err(|e|e.to_string())?)?;
    }
    sources::atomic(&dir,&format!("{key}-status.json"),&serde_json::to_vec(&json!({"source":if key=="keeptrack"{KEEPTRACK_URL}else{SATNOGS_URL},"fetched":Utc::now(),"matched":rows.len(),"fresh":fresh,"rejected":rejected,"coverage":"Partielle, dépend du fournisseur"})).unwrap())?;restore_freshness(&mut *shared.write().await,&dir);Ok(())
   }.await;
   collection_health::finish(&dir,key,result.as_ref().err().map(String::as_str));if let Err(error)=result{eprintln!("{key} : {error}");}
  }
  {let db=shared.read().await;if db.revision!=checked_revision{checked_revision=db.revision;let _=sources::atomic(&dir,"orbital-checks.json",&serde_json::to_vec(&checks(&db,Utc::now())).unwrap());}}
  if once{return;}tokio::time::sleep(std::time::Duration::from_secs(60)).await;
 }
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn identity_upstream_and_scope_are_preserved(){
  let db=Database::default();let raw=serde_json::to_value(sgp4::Elements::from_tle(Some("ISS".into()),b"1 25544U 98067A   26295.53177894  .00010215  00000-0  19326-3 0  9991",b"2 25544  51.6333  29.9219 0006847 296.1942  63.8342 15.48996468591497").unwrap()).unwrap();
  let (rows,fail)=normalize(&db,&[raw.clone()],false).unwrap();assert_eq!(fail,0);assert_eq!(rows[0]["NORAD_CAT_ID"],25544);assert_eq!(rows[0]["ATLAS_SOURCE"],SATNOGS_OTHER);
  let mut bad=raw.clone();bad["norad_cat_id"]=json!(999);assert!(normalize(&db,&[bad],false).is_err());
  let mut db=Database::default();db.catalog.insert(25544,json!({"OBJECT_ID":"2000-001A"}));assert!(normalize(&db,&[raw],false).is_err());
 }
 #[test]fn duplicate_upstreams_are_not_independent_verification(){
  let mut db=Database::default();let bytes=include_bytes!("../resources/iss-example.json");load_gp_source(&mut db,bytes,"CelesTrak GP / Space-Track").unwrap();load_gp_source(&mut db,bytes,SATNOGS).unwrap();
  let now=db.orbits[&25544][0].el.datetime.and_utc()+chrono::Duration::hours(1);let c=checks(&db,now);assert_eq!(c["objects"]["25544"]["state"],"compared");assert_eq!(c["objects"]["25544"]["independent_verification"],false);assert!(c["objects"]["25544"]["distance_km"].as_f64().unwrap()<0.00001);
  assert_eq!(checks(&db,now+chrono::Duration::days(10))["objects"]["25544"]["state"],"single_source");
 }
}
