//! Shared collector for the additional constellations; one request per shared feed per cycle.
use super::*;
pub fn added() -> impl Iterator<Item=&'static collections::Definition> {
    collections::definitions().iter().filter(|row|!["starlink","iss","gps","galileo","debris"].contains(&row.id.as_str()))
}
pub fn load_cache(db: &mut Database, dir: &std::path::Path) {
    for row in added() { if let Ok(bytes)=std::fs::read(dir.join(format!("{}-catalog.json",row.id))) { if let Err(error)=load_cat(db,&bytes) { eprintln!("{} : {error}",row.label); } } }
}
fn filtered_catalog(def: &collections::Definition, rows: Vec<Value>) -> Vec<Value> {
    rows.into_iter().filter(|row|row["OBJECT_TYPE"]=="PAY" && collections::family(row["NORAD_CAT_ID"].as_u64().unwrap_or(0),row["OBJECT_NAME"].as_str().unwrap_or(""))==Some(def.id.as_str())).collect()
}
fn filtered_orbits(def: &collections::Definition, rows: &[Value], catalog: &[Value]) -> Result<Vec<u8>,String> {
    let identities: BTreeMap<_,_>=catalog.iter().filter_map(|r|r["NORAD_CAT_ID"].as_u64().map(|id|(id,r))).collect();
    let mut output=Vec::new();
    for original in rows {
        let id=original["NORAD_CAT_ID"].as_u64().unwrap_or(0);let mut row=original.clone();
        let family=collections::family(id,row["OBJECT_NAME"].as_str().unwrap_or(""));
        if family!=Some(def.id.as_str()) {
            let Some(identity)=identities.get(&id) else { continue; };
            // Resolve operator/group names through the verified SATCAT identity (e.g. new Cosmos / GLONASS).
            row["OBJECT_NAME"]=identity["OBJECT_NAME"].clone();
        }
        if collections::family(id,row["OBJECT_NAME"].as_str().unwrap_or(""))!=Some(def.id.as_str()) { continue; }
        let elements: sgp4::Elements=serde_json::from_value(row.clone()).map_err(|e|e.to_string())?;
        sgp4::Constants::from_elements(&elements).map_err(|e|e.to_string())?;output.push(row);
    }
    if output.is_empty() { return Err(format!("Aucun élément orbital {} exploitable",def.label)); }
    serde_json::to_vec(&output).map_err(|e|e.to_string())
}
pub async fn collect(shared: Shared, dir: PathBuf, once: bool) {
    let client=reqwest::Client::builder().user_agent("Atlas/0.3 (educational orbital observer)").redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(60)).build().unwrap();
    loop {
        let mut feeds:BTreeMap<String,Result<Vec<Value>,String>>=BTreeMap::new();
        for def in added() {
            let now=Utc::now().timestamp();
            let last=std::fs::read_to_string(dir.join(format!("{}-attempt.txt",def.id))).ok().and_then(|v|v.parse::<i64>().ok()).unwrap_or(0);
            if now-last<7200 { continue; }
            let _=std::fs::write(dir.join(format!("{}-attempt.txt",def.id)),now.to_string());
            let result:Result<(),String>=async {
                let file=dir.join(format!("{}-catalog.json",def.id));
                let age=std::fs::metadata(&file).and_then(|m|m.modified()).ok().and_then(|v|v.elapsed().ok()).map(|v|v.as_secs()).unwrap_or(u64::MAX);
                let mut catalogue:Vec<Value>=std::fs::read(&file).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default();
                if age>=86400 {
                    let mut records=BTreeMap::new();
                    for query in &def.catalog_queries {
                        let url=reqwest::Url::parse_with_params("https://celestrak.org/satcat/records.php",&[("NAME",query.as_str()),("FORMAT","JSON")]).map_err(|e|e.to_string())?;
                        let bytes=download(&client,url.as_str()).await?;
                        let rows=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
                        for row in filtered_catalog(def,rows) { records.insert(row["NORAD_CAT_ID"].as_u64().unwrap(),row); }
                    }
                    if records.is_empty() { return Err(format!("Catalogue {} vide",def.label)); }
                    catalogue=records.into_values().collect();
                    let bytes=serde_json::to_vec(&catalogue).map_err(|e|e.to_string())?;
                    sources::atomic(&dir,&format!("{}-catalog.json",def.id),&bytes)?;load_cat(&mut *shared.write().await,&bytes)?;
                }
                let url=collections::source(&def.id).unwrap();
                if !feeds.contains_key(&url) {
                    let result=match download(&client,&url).await { Ok(bytes)=>serde_json::from_slice(&bytes).map_err(|e|e.to_string()),Err(e)=>Err(e) };
                    feeds.insert(url.clone(),result);
                }
                let rows=feeds.get(&url).unwrap().as_ref().map_err(Clone::clone)?;
                let bytes=filtered_orbits(def,rows,&catalogue)?;
                sources::atomic(&dir,&format!("gp-{}-{now}.json",def.id),&bytes)?;sources::atomic(&dir,&format!("gp-{}.json",def.id),&bytes)?;
                load_gp(&mut *shared.write().await,&bytes)?;
                sources::atomic(&dir,&format!("{}-fetched.txt",def.id),Utc::now().to_rfc3339().as_bytes())?;
                let _=std::fs::remove_file(dir.join(format!("{}-error.txt",def.id)));
                Ok(())
            }.await;
            if let Err(error)=result { eprintln!("{} : {error}",def.label);let _=std::fs::write(dir.join(format!("{}-error.txt",def.id)),error); }
        }
        if once { return; }tokio::time::sleep(std::time::Duration::from_secs(7200)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_eleven_feeds_have_real_valid_orbits() {
        let samples:BTreeMap<String,Value>=serde_json::from_str(include_str!("../resources/constellation-examples.json")).unwrap();assert_eq!(samples.len(),11);
        for (key,row) in samples {
            let def=collections::definition(&key).unwrap();let bytes=filtered_orbits(def,&[row],&[]).unwrap();
            let mut db=Database::default();load_gp(&mut db,&bytes).unwrap();let orbit=db.orbits.values().next().unwrap().first().unwrap();
            let p=position(orbit,orbit.el.datetime.and_utc()+chrono::Duration::hours(1)).unwrap();
            assert!(p.altitude_km>100.0&&p.altitude_km<50000.0,"{key}");assert!(in_collection(&db,p.id,&key));assert!(!in_collection(&db,p.id,"starlink"));
        }
    }
    #[test]
    fn mixed_feed_and_future_glonass_aliases_do_not_leak() {
        let samples:BTreeMap<String,Value>=serde_json::from_str(include_str!("../resources/constellation-examples.json")).unwrap();
        let all:Vec<_>=samples.values().cloned().collect();for def in added(){let out:Vec<Value>=serde_json::from_slice(&filtered_orbits(def,&all,&[]).unwrap()).unwrap();assert_eq!(out.len(),1);}
        let mut future=samples["glonass"].clone();future["NORAD_CAT_ID"]=json!(999888);future["OBJECT_NAME"]=json!("COSMOS 9999 (999)");
        let cat=json!({"NORAD_CAT_ID":999888,"OBJECT_TYPE":"PAY","OBJECT_NAME":"COSMOS 9999 [GLONASS]"});
        let def=collections::definition("glonass").unwrap();assert!(filtered_orbits(def,&[future.clone()],&[]).is_err());assert!(filtered_orbits(def,&[future],&[cat]).is_ok());
    }
}
