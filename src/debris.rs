//! All public Earth-orbit debris / rocket bodies in SATCAT, across all space programmes.
use super::*;
pub const CATALOG:&str="https://celestrak.org/pub/satcat.csv";
const QUERIES:&[&str]=&["DEB","R/B","AKM","PKM","FUEL CORE","COOLANT","NEEDLES","INTERSTAGE","SL-24 PLAT"];
pub fn is_debris(row:&Value)->bool {(matches!(row["OBJECT_TYPE"].as_str(),Some("DEB"|"R/B")) || (row["OBJECT_TYPE"]=="UNK" && row["ANALYST"]==true)) && row["ORBIT_CENTER"]=="EA"}
pub fn load_cache(db:&mut Database,dir:&std::path::Path){if let Ok(bytes)=std::fs::read(dir.join("debris-catalog.json")){if let Err(e)=load_cat(db,&bytes){eprintln!("Débris : {e}");}}}
fn analyst_catalog(rows:&[Value])->Vec<Value>{rows.iter().filter_map(|row|row["NORAD_CAT_ID"].as_u64().map(|id|json!({"NORAD_CAT_ID":id,"OBJECT_NAME":format!("Objet non identifié {id}"),"OBJECT_TYPE":"UNK","ORBIT_CENTER":"EA","ANALYST":true,"OBJECT_ID":null,"LAUNCH_DATE":null,"DECAY_DATE":null,"OWNER":null,"OPS_STATUS_CODE":"?"}))).collect()}
fn filtered(rows:Vec<Value>,catalogue:&[Value])->Result<Vec<u8>,String>{
    let ids:std::collections::BTreeSet<_>=catalogue.iter().filter(|r|is_debris(r)).filter_map(|r|r["NORAD_CAT_ID"].as_u64()).collect();let mut output=BTreeMap::new();
    for row in rows {let id=row["NORAD_CAT_ID"].as_u64().unwrap_or(0);if !ids.contains(&id){continue;}
        let elements:sgp4::Elements=serde_json::from_value(row.clone()).map_err(|e|e.to_string())?;sgp4::Constants::from_elements(&elements).map_err(|e|e.to_string())?;output.insert(id,row);
    }
    if output.is_empty(){return Err("Aucune orbite publique de débris disponible".into());}
    serde_json::to_vec(&output.into_values().collect::<Vec<_>>()).map_err(|e|e.to_string())
}
pub async fn collect(shared:Shared,dir:PathBuf,once:bool){
    let client=reqwest::Client::builder().user_agent("Atlas/0.3 (educational orbital observer)").redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(120)).build().unwrap();
    loop {
        let now=Utc::now().timestamp();let last=std::fs::read_to_string(dir.join("debris-attempt.txt")).ok().and_then(|v|v.parse::<i64>().ok()).unwrap_or(0);
        if now-last>=7200 {
            let _=std::fs::write(dir.join("debris-attempt.txt"),now.to_string());
            let result:Result<(),String>=async {
                let file=dir.join("debris-catalog.json");let age=std::fs::metadata(&file).and_then(|m|m.modified()).ok().and_then(|t|t.elapsed().ok()).map(|d|d.as_secs()).unwrap_or(u64::MAX);
                let mut catalogue:Vec<Value>=if age>=86400 {
                    let mut rows:Vec<_>=constellations::bulk_catalogue(&client,&dir).await?.into_iter().filter(is_debris).collect();if let Ok(bytes)=std::fs::read(dir.join("gp-analyst.json")){if let Ok(extra)=serde_json::from_slice::<Vec<Value>>(&bytes){let known:std::collections::BTreeSet<_>=rows.iter().filter_map(|r|r["NORAD_CAT_ID"].as_u64()).collect();rows.extend(analyst_catalog(&extra).into_iter().filter(|r|!known.contains(&r["NORAD_CAT_ID"].as_u64().unwrap())));}}if rows.is_empty(){return Err("Catalogue des débris vide".into());}
                    let bytes=serde_json::to_vec(&rows).map_err(|e|e.to_string())?;sources::atomic(&dir,"debris-catalog.json",&bytes)?;load_cat(&mut *shared.write().await,&bytes)?;rows
                }else{serde_json::from_slice(&std::fs::read(file).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?};
                let extra:std::collections::BTreeSet<_>=catalogue.iter().filter(|r|r["ANALYST"]!=true && r["DECAY_DATE"].as_str().unwrap_or("").is_empty() && !QUERIES.iter().any(|q|r["OBJECT_NAME"].as_str().unwrap_or("").contains(q))).filter_map(|r|r["NORAD_CAT_ID"].as_u64()).collect();
                let mut queries:Vec<_>=QUERIES.iter().map(|q|("NAME",q.to_string())).collect();queries.extend(extra.iter().map(|id|("CATNR",id.to_string())));
                let mut rows=Vec::new();let mut unavailable=Vec::new();
                for (key,value) in queries {
                    let url=reqwest::Url::parse_with_params("https://celestrak.org/NORAD/elements/gp.php",&[(key,value.as_str()),("FORMAT","JSON")]).map_err(|e|e.to_string())?;
                    match download(&client,url.as_str()).await {
                        Ok(bytes)=>rows.extend(serde_json::from_slice::<Vec<Value>>(&bytes).map_err(|e|e.to_string())?),
                        Err(error) if error.contains("404")=>unavailable.push(value),
                        Err(error)=>return Err(error),
                    }
                }
                let analyst_url="https://celestrak.org/NORAD/elements/gp.php?GROUP=analyst&FORMAT=JSON";
                let last=std::fs::read_to_string(dir.join("analyst-attempt.txt")).ok().and_then(|s|s.parse::<i64>().ok()).unwrap_or(0);
                if now-last>=7200 {
                    sources::atomic(&dir,"analyst-attempt.txt",now.to_string().as_bytes())?;
                    match download(&client,analyst_url).await {
                        Ok(bytes)=>{let extra:Vec<Value>=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
                            for row in &extra {let el:sgp4::Elements=serde_json::from_value(row.clone()).map_err(|e|e.to_string())?;sgp4::Constants::from_elements(&el).map_err(|e|e.to_string())?;}
                            let known:std::collections::BTreeSet<_>=catalogue.iter().filter_map(|r|r["NORAD_CAT_ID"].as_u64()).collect();catalogue.extend(analyst_catalog(&extra).into_iter().filter(|r|!known.contains(&r["NORAD_CAT_ID"].as_u64().unwrap())));
                            sources::atomic(&dir,"debris-catalog.json",&serde_json::to_vec(&catalogue).map_err(|e|e.to_string())?)?;load_cat(&mut *shared.write().await,&serde_json::to_vec(&catalogue).map_err(|e|e.to_string())?)?;
                            sources::atomic(&dir,"gp-analyst.json",&bytes)?;sources::atomic(&dir,&format!("gp-analyst-{now}.json"),&bytes)?;
                            sources::atomic(&dir,"analyst-fetched.txt",Utc::now().to_rfc3339().as_bytes())?;rows.extend(extra);
                        },Err(error)=>{eprintln!("Objets non identifiés (cache conservé) : {error}");}
                    }
                } else if let Ok(bytes)=std::fs::read(dir.join("gp-analyst.json")){if let Ok(extra)=serde_json::from_slice::<Vec<Value>>(&bytes){rows.extend(extra);}}
                let bytes=filtered(rows,&catalogue)?;
                sources::atomic(&dir,&format!("gp-debris-{now}.json"),&bytes)?;sources::atomic(&dir,"gp-debris.json",&bytes)?;load_gp(&mut *shared.write().await,&bytes)?;
                sources::atomic(&dir,"debris-fetched.txt",Utc::now().to_rfc3339().as_bytes())?;
                sources::atomic(&dir,"debris-coverage.json",&serde_json::to_vec(&json!({"scope":"Public Earth-orbit debris and rocket bodies","catalogued":catalogue.len(),"unavailable_queries":unavailable,"source":CATALOG})).map_err(|e|e.to_string())?)?;
                Ok(())
            }.await;
            if let Err(error)=result {eprintln!("Débris : {error}");let _=std::fs::write(dir.join("debris-error.txt"),error);}
        }
        if once{return;}tokio::time::sleep(std::time::Duration::from_secs(7200)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
       #[test]
    fn analyst_objects_are_distinguished_from_confirmed_fragments(){
        let rows=analyst_catalog(&[json!({"NORAD_CAT_ID":81011,"OBJECT_NAME":"UNKNOWN"})]);
        assert!(is_debris(&rows[0]));assert_eq!(rows[0]["OBJECT_TYPE"],"UNK");assert_eq!(rows[0]["ANALYST"],true);assert!(rows[0]["OBJECT_ID"].is_null());assert!(rows[0]["LAUNCH_DATE"].is_null());
        assert!(!is_debris(&json!({"OBJECT_TYPE":"UNK","ORBIT_CENTER":"EA"})));
    }
 #[test]
    fn all_programmes_include_fragments_and_stages_but_not_payloads(){
        for kind in ["DEB","R/B"]{assert!(is_debris(&json!({"OBJECT_TYPE":kind,"ORBIT_CENTER":"EA"})));}
        assert!(!is_debris(&json!({"OBJECT_TYPE":"PAY","OPS_STATUS_CODE":"-","ORBIT_CENTER":"EA"})));
        assert!(!is_debris(&json!({"OBJECT_TYPE":"UNK","ORBIT_CENTER":"EA"})));
        assert!(!is_debris(&json!({"OBJECT_TYPE":"DEB","ORBIT_CENTER":"MO"})));
        let rows:Vec<Value>=serde_json::from_str(include_str!("../resources/debris-example.json")).unwrap();let id=rows[0]["NORAD_CAT_ID"].as_u64().unwrap();
        let catalogue=vec![json!({"NORAD_CAT_ID":id,"OBJECT_NAME":rows[0]["OBJECT_NAME"],"OBJECT_TYPE":"DEB","ORBIT_CENTER":"EA","LAUNCH_DATE":"1958-01-01"})];
        let bytes=filtered(rows,&catalogue).unwrap();let mut db=Database::default();load_cat(&mut db,&serde_json::to_vec(&catalogue).unwrap()).unwrap();load_gp(&mut db,&bytes).unwrap();assert!(in_collection(&db,id,"debris"));assert!(!in_collection(&db,id,"starlink"));
    }
}
