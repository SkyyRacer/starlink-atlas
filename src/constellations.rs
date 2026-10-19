//! Shared collector for the additional constellations; one request per shared feed per cycle.
use super::*;
pub fn added() -> impl Iterator<Item=&'static collections::Definition> {
    collections::definitions().iter().filter(|row|!["starlink","iss","gps","galileo","debris"].contains(&row.id.as_str()))
}
pub fn load_cache(db: &mut Database, dir: &std::path::Path) {
    for row in added() { if let Ok(bytes)=std::fs::read(dir.join(format!("{}-catalog.json",row.id))) { if let Err(error)=load_cat(db,&bytes) { eprintln!("{} : {error}",row.label); } } }
}
fn filtered_catalog(def: &collections::Definition, rows: &[Value]) -> Vec<Value> {
    rows.iter().filter(|row|row["OBJECT_TYPE"]=="PAY" && (row["ORBIT_CENTER"].as_str().is_none_or(|center|center=="EA") || (row["ORBIT_TYPE"]=="DOC" && def.ids.contains(&row["NORAD_CAT_ID"].as_u64().unwrap_or(0)))) && collections::belongs(row["NORAD_CAT_ID"].as_u64().unwrap_or(0),row["OBJECT_NAME"].as_str().unwrap_or(""),&def.id)).cloned().collect()
}
fn filtered_orbits(def: &collections::Definition, rows: &[Value], catalog: &[Value]) -> Result<Vec<u8>,String> {
    let identities: BTreeMap<_,_>=catalog.iter().filter_map(|r|r["NORAD_CAT_ID"].as_u64().map(|id|(id,r))).collect();
    let mut output=Vec::new();
    for original in rows {
        let id=original["NORAD_CAT_ID"].as_u64().unwrap_or(0);let mut row=original.clone();
        let belongs=collections::belongs(id,row["OBJECT_NAME"].as_str().unwrap_or(""),&def.id);
        if !belongs {
            let Some(identity)=identities.get(&id) else { continue; };
            // Resolve operator/group names through the verified SATCAT identity (e.g. new Cosmos / GLONASS).
            row["OBJECT_NAME"]=identity["OBJECT_NAME"].clone();
        }
        if !collections::belongs(id,row["OBJECT_NAME"].as_str().unwrap_or(""),&def.id) { continue; }
        let elements: sgp4::Elements=serde_json::from_value(row.clone()).map_err(|e|e.to_string())?;
        sgp4::Constants::from_elements(&elements).map_err(|e|e.to_string())?;output.push(row);
    }
    if output.is_empty() { return Err(format!("Aucun élément orbital {} exploitable",def.label)); }
    serde_json::to_vec(&output).map_err(|e|e.to_string())
}
pub async fn bulk_catalogue(client:&reqwest::Client,dir:&std::path::Path)->Result<Vec<Value>,String> {
    static LOCK:std::sync::OnceLock<tokio::sync::Mutex<()>>=std::sync::OnceLock::new();
    let _guard=LOCK.get_or_init(||tokio::sync::Mutex::new(())).lock().await;
    let file=dir.join("satcat-all.csv");
    let fresh=std::fs::metadata(&file).and_then(|m|m.modified()).ok().and_then(|t|t.elapsed().ok()).is_some_and(|age|age.as_secs()<86400);
    let bytes=if fresh {std::fs::read(file).map_err(|e|e.to_string())?} else {
        let bytes=download(client,debris::CATALOG).await?;csv_data::catalogue(&bytes)?;sources::atomic(dir,"satcat-all.csv",&bytes)?;bytes
    };
    csv_data::catalogue(&bytes)
}
pub async fn collect(shared: Shared, dir: PathBuf, once: bool) {
    let client=reqwest::Client::builder().user_agent("Atlas/0.3 (educational orbital observer)").redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(60)).build().unwrap();
    loop {
        let mut feeds:BTreeMap<String,Result<Vec<Value>,String>>=BTreeMap::new();
        let mut bulk:Option<Vec<Value>>=None;
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
                    if bulk.is_none(){bulk=Some(bulk_catalogue(&client,&dir).await?);}
                    catalogue=filtered_catalog(def,bulk.as_ref().unwrap());
                    if catalogue.is_empty() { return Err(format!("Catalogue {} vide",def.label)); }
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
    fn experimental_catalogues_include_docked_mev_and_both_proba_spacecraft() {
        for (collection, ids) in [("proba-2",vec![36037]),("proba-3",vec![62256,62258]),("mev-1",vec![44625]),("mev-2",vec![46113]),("lares-2",vec![53105])] {
            let def=collections::definition(collection).unwrap();
            let rows:Vec<_>=ids.iter().map(|id|json!({"NORAD_CAT_ID":id,"OBJECT_NAME":def.label,"OBJECT_TYPE":"PAY","ORBIT_CENTER":if collection=="mev-2"{"28358"}else{"EA"},"ORBIT_TYPE":if collection=="mev-2"{"DOC"}else{"ORB"}})).collect();
            assert_eq!(filtered_catalog(def,&rows).len(),ids.len());
            for id in ids {assert_eq!(collections::family(id,""),Some(collection));}
        }
    }
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
        let all:Vec<_>=samples.values().cloned().collect();for def in added().filter(|def|samples.contains_key(&def.id)){let out:Vec<Value>=serde_json::from_slice(&filtered_orbits(def,&all,&[]).unwrap()).unwrap();assert_eq!(out.len(),1);}
        let mut future=samples["glonass"].clone();future["NORAD_CAT_ID"]=json!(999888);future["OBJECT_NAME"]=json!("COSMOS 9999 (999)");
        let cat=json!({"NORAD_CAT_ID":999888,"OBJECT_TYPE":"PAY","OBJECT_NAME":"COSMOS 9999 [GLONASS]"});
        let def=collections::definition("glonass").unwrap();assert!(filtered_orbits(def,&[future.clone()],&[]).is_err());assert!(filtered_orbits(def,&[future],&[cat]).is_ok());
    }
    #[test]
    fn added_pages_use_real_elements_and_shared_memberships() {
        let samples:BTreeMap<String,Value>=serde_json::from_str(include_str!("../resources/additional-constellation-examples.json")).unwrap();assert_eq!(samples.len(),75);
        for (key,row) in samples {
            let def=collections::definition(&key).unwrap();let bytes=filtered_orbits(def,&[row],&[]).unwrap();
            let mut db=Database::default();load_gp(&mut db,&bytes).unwrap();let orbit=db.orbits.values().next().unwrap().first().unwrap();
            let at=orbit.el.datetime.and_utc()+chrono::Duration::minutes(30);let p=position(orbit,at).unwrap();
            assert!(p.altitude_km>100.&&p.altitude_km<1000000.,"{key}");assert!(in_collection(&db,p.id,&key),"{key}");
            if let Some(parent)=&def.parent {assert!(in_collection(&db,p.id,parent));}
        }
        assert_eq!(collections::family(51850,"GOES 18"),Some("goes"));
        assert_eq!(collections::memberships(51850,"GOES 18"),vec!["goes","goes-18"]);
        for name in ["GLOBAL-40","GLOBAL-41"] {assert_eq!(collections::family(999999,name),Some("blacksky-gen3"));}
        assert_eq!(collections::family(999999,"GLOBAL-41B"),None);
        assert_eq!(collections::family(999999,"ORBCOMM FM121"),Some("orbcomm-og2"));
        assert_eq!(collections::family(999999,"ORBCOMM FM12"),None);
    }

}
