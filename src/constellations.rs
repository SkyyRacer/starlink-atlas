//! Shared collector for the additional constellations; one request per shared feed per cycle.
use super::*;
pub fn added() -> impl Iterator<Item=&'static collections::Definition> {
    collections::definitions().iter().filter(|row|!["starlink","iss","gps","galileo","debris"].contains(&row.id.as_str()))
}
pub fn load_cache(db: &mut Database, dir: &std::path::Path) {
    for row in added() { if let Ok(bytes)=std::fs::read(dir.join(format!("{}-catalog.json",row.id))) { if let Err(error)=load_cat(db,&bytes) { eprintln!("{} : {error}",row.label); } } }
}
fn filtered_catalog(def: &collections::Definition, rows: &[Value]) -> Vec<Value> {
    rows.iter().filter(|row|row["OBJECT_TYPE"]=="PAY" && (def.trajectory.is_some() || row["ORBIT_CENTER"].as_str().is_none_or(|center|center=="EA") || (row["ORBIT_TYPE"]=="DOC" && def.ids.contains(&row["NORAD_CAT_ID"].as_u64().unwrap_or(0)))) && collections::belongs(row["NORAD_CAT_ID"].as_u64().unwrap_or(0),row["OBJECT_NAME"].as_str().unwrap_or(""),&def.id)).cloned().collect()
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
        sgp4::Constants::from_elements(&elements).map_err(|e|e.to_string())?;
        output.push(row);
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
        match download(client,debris::CATALOG).await {
            Ok(bytes)=>{csv_data::catalogue(&bytes)?;sources::atomic(dir,"satcat-all.csv",&bytes)?;bytes},
            Err(error) if collection_health::temporary(&error)=>{let cached=std::fs::read(&file).map_err(|_|error.clone())?;csv_data::catalogue(&cached)?;cached},
            Err(error)=>return Err(error)
        }
    };
    csv_data::catalogue(&bytes)
}
pub const BACKUP_SOURCE:&str="SatNOGS / Space-Track";
pub const TRACKER_SOURCE:&str="N2YO / Space-Track";
fn backup_elements(id:u64,name:&str,line1:&str,line2:&str,source:&str)->Result<Value,String>{
    let el=sgp4::Elements::from_tle(Some(name.to_owned()),line1.as_bytes(),line2.as_bytes()).map_err(|e|e.to_string())?;
    if el.norad_id!=id{return Err("Identité TLE incorrecte".into());}
    sgp4::Constants::from_elements(&el).map_err(|e|e.to_string())?;
    let mut row=serde_json::to_value(el).map_err(|e|e.to_string())?;row["ATLAS_SOURCE"]=json!(source);Ok(row)
}
pub fn parse_backup(rows:&[Value])->Result<Vec<u8>,String>{
    let mut output=Vec::new();
    for row in rows {let id=row["norad_cat_id"].as_u64().ok_or("Identifiant TLE manquant")?;
        let def=collections::definitions().iter().find(|d|d.ids.contains(&id)).ok_or("Objet TLE non pris en charge")?;
        let source=if row["provider"]=="N2YO"{TRACKER_SOURCE}else{BACKUP_SOURCE};
        output.push(backup_elements(id,row["name"].as_str().unwrap_or(&def.label),row["tle1"].as_str().ok_or("TLE 1 manquant")?,row["tle2"].as_str().ok_or("TLE 2 manquant")?,source)?);
    }
    serde_json::to_vec(&output).map_err(|e|e.to_string())
}
async fn backup(def:&collections::Definition,client:&reqwest::Client,shared:&Shared,dir:&std::path::Path)->Result<(),String>{
    let mut rows=Vec::new();
    for id in &def.ids{
        let url=format!("https://db.satnogs.org/api/tle/?norad_cat_id={id}");
        let records:Vec<Value>=match download(client,&url).await{Ok(bytes)=>serde_json::from_slice(&bytes).unwrap_or_default(),Err(_)=>Vec::new()};
        if let Some(row)=records.into_iter().find(|r|r["norad_cat_id"].as_u64()==Some(*id)){rows.push(row);continue;}
        let bytes=download(client,&format!("https://www.n2yo.com/satellite/?s={id}")).await?;
        let html=std::str::from_utf8(&bytes).map_err(|e|e.to_string())?;
        let first=html.find(&format!("1 {id:05}U")).ok_or("TLE absent de la source de secours")?;
        let second=html.find(&format!("2 {id:05} ")).ok_or("TLE 2 absent de la source de secours")?;
        rows.push(json!({"norad_cat_id":id,"name":def.label,"tle1":html.get(first..first+69).ok_or("TLE incomplet")?,"tle2":html.get(second..second+69).ok_or("TLE incomplet")?,"provider":"N2YO"}));
    }
    let bytes=parse_backup(&rows)?;
    let elements:Vec<sgp4::Elements>=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
    if elements.iter().any(|el|(Utc::now()-el.datetime.and_utc()).num_seconds().abs()>MAX_AGE){return Err("Éléments de secours périmés : archive conservée, aucune position actuelle inventée".into());}
    let now=Utc::now().timestamp();
    sources::atomic(dir,&format!("gp-backup-{}-{now}.json",def.id),&bytes)?;
    load_gp(&mut *shared.write().await,&bytes)?;
    sources::atomic(dir,&format!("{}-fetched.txt",def.id),Utc::now().to_rfc3339().as_bytes())?;
    Ok(())
}
pub async fn collect(shared: Shared, dir: PathBuf, once: bool) {
    let client=reqwest::Client::builder().user_agent("Atlas/0.3 (educational orbital observer)").redirect(reqwest::redirect::Policy::none()).connect_timeout(std::time::Duration::from_secs(8)).timeout(std::time::Duration::from_secs(60)).build().unwrap();
    loop {
        let mut feeds:BTreeMap<String,Result<Vec<Value>,String>>=BTreeMap::new();
        let mut bulk:Option<Vec<Value>>=None;
        for def in added() {
            let now=Utc::now().timestamp();
            if !collection_health::due(&dir,&def.id,now,7200){continue;}
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
                // Historical missions and deep-space trajectories do not need a current GP feed.
                // The already validated catalogue and lazy historical archives stay available.
                let today=Utc::now().format("%Y-%m-%d").to_string();
                let all_retired=!catalogue.is_empty()&&catalogue.iter().all(|row|row["DECAY_DATE"].as_str().is_some_and(|date|!date.is_empty()&&date<=today.as_str()));
                if def.trajectory.is_some()||all_retired{return Ok(());}
                let url=collections::source(&def.id).unwrap();
                if !feeds.contains_key(&url) {
                    let result=match download(&client,&url).await { Ok(bytes)=>serde_json::from_slice(&bytes).map_err(|e|e.to_string()),Err(e)=>Err(e) };
                    feeds.insert(url.clone(),result);
                }
                let rows=feeds.get(&url).unwrap().as_ref().map_err(Clone::clone)?;
                let bytes=filtered_orbits(def,rows,&catalogue)?;
                if ["tess","xposat"].contains(&def.id.as_str()){
                    let elements:Vec<sgp4::Elements>=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
                    if elements.iter().all(|el|(Utc::now()-el.datetime.and_utc()).num_seconds().abs()>MAX_AGE){return Err(format!("{} : éléments orbitaux périmés",def.label));}
                }
                sources::atomic(&dir,&format!("gp-{}-{now}.json",def.id),&bytes)?;sources::atomic(&dir,&format!("gp-{}.json",def.id),&bytes)?;
                load_gp(&mut *shared.write().await,&bytes)?;
                sources::atomic(&dir,&format!("{}-fetched.txt",def.id),Utc::now().to_rfc3339().as_bytes())?;
                let _=std::fs::remove_file(dir.join(format!("{}-error.txt",def.id)));
                Ok(())
            }.await;
            let result=match result{Err(primary) if ["proba-2","proba-3","mev-1","mev-2","lares-2","tess","xposat"].contains(&def.id.as_str())=>backup(def,&client,&shared,&dir).await.map_err(|fallback|format!("{primary} · secours : {fallback}")),other=>other};
            collection_health::finish(&dir,&def.id,result.as_ref().err().map(String::as_str));
            if let Err(error)=result { eprintln!("{} : {error}",def.label);let _=std::fs::write(dir.join(format!("{}-error.txt",def.id)),error); }
        }
        if once { return; }tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn verified_backup_tles_keep_identity_epoch_and_provenance(){
        let input:Vec<Value>=serde_json::from_str(include_str!("../resources/experimental-tle-examples.json")).unwrap();
        let bytes=parse_backup(&input).unwrap();let mut db=Database::default();assert_eq!(load_gp(&mut db,&bytes).unwrap(),6);
        for row in &input{let id=row["norad_cat_id"].as_u64().unwrap();let orbit=&db.orbits[&id][0];
            assert_eq!(orbit.source,if row["provider"]=="N2YO"{TRACKER_SOURCE}else{BACKUP_SOURCE});
            let p=position(orbit,orbit.el.datetime.and_utc()).unwrap();assert!(p.altitude_km>100.&&p.altitude_km<100000.);
        }
        let mut bad=input.clone();bad[0]["norad_cat_id"]=json!(53105);assert!(parse_backup(&bad).is_err());
    }
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
