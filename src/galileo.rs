//! Public Galileo GP feed. Cache failures never erase valid observations.
use super::*;
pub const GP: &str = "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=JSON";
const CATALOG: &str = "https://celestrak.org/satcat/records.php?NAME=GSAT&FORMAT=JSON";
pub fn load_cache(db: &mut Database, dir: &std::path::Path) {
    if let Ok(bytes)=std::fs::read(dir.join("galileo-catalog.json")) {
        if let Err(error)=load_cat(db,&bytes) { eprintln!("Catalogue Galileo ignoré : {error}"); }
    }
}
fn validate(bytes: &[u8]) -> Result<(),String> {
    let rows: Vec<sgp4::Elements>=serde_json::from_slice(bytes).map_err(|e|e.to_string())?;
    if rows.is_empty() || rows.iter().any(|row| collections::family(row.norad_id,row.object_name.as_deref().unwrap_or("")) != Some("galileo")) { return Err("Réponse orbitale Galileo incorrecte".into()); }
    for row in rows { sgp4::Constants::from_elements(&row).map_err(|e|e.to_string())?; }
    Ok(())
}
pub async fn collect(shared: Shared, dir: PathBuf, once: bool) {
    let client=reqwest::Client::builder().user_agent("Atlas/0.3 (educational orbital observer)").redirect(reqwest::redirect::Policy::none()).timeout(std::time::Duration::from_secs(45)).build().unwrap();
    loop {
        let now=Utc::now().timestamp();
        let last=std::fs::read_to_string(dir.join("galileo-attempt.txt")).ok().and_then(|v|v.parse::<i64>().ok()).unwrap_or(0);
        if !dir.join("galileo-stopped.txt").exists() && now-last>=7200 {
            let _=std::fs::write(dir.join("galileo-attempt.txt"),now.to_string());
            let result: Result<(),String>=async {
                let bytes=download(&client,GP).await?;validate(&bytes)?;
                sources::atomic(&dir,&format!("gp-galileo-{now}.json"),&bytes)?;
                sources::atomic(&dir,"gp-galileo.json",&bytes)?;
                load_gp(&mut *shared.write().await,&bytes)?;
                let age=std::fs::metadata(dir.join("galileo-catalog.json")).and_then(|m|m.modified()).ok().and_then(|t|t.elapsed().ok()).map(|d|d.as_secs()).unwrap_or(u64::MAX);
                if age>=86400 {
                    let bytes=download(&client,CATALOG).await?;
                    let rows: Vec<Value>=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
                    let rows: Vec<_>=rows.into_iter().filter(|row|collections::family(row["NORAD_CAT_ID"].as_u64().unwrap_or(0),row["OBJECT_NAME"].as_str().unwrap_or(""))==Some("galileo")).collect();
                    if rows.is_empty(){return Err("Catalogue Galileo vide".into());}
                    let bytes=serde_json::to_vec(&rows).map_err(|e|e.to_string())?;
                    sources::atomic(&dir,"galileo-catalog.json",&bytes)?;
                    load_cat(&mut *shared.write().await,&bytes)?;
                }
                sources::atomic(&dir,"galileo-fetched.txt",Utc::now().to_rfc3339().as_bytes())?;
                Ok(())
            }.await;
            if let Err(error)=result { eprintln!("Galileo : {error}"); let _=std::fs::write(dir.join("galileo-stopped.txt"),error); }
        }
        if once { return; }
        tokio::time::sleep(std::time::Duration::from_secs(7200)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_galileo_orbit_and_source_validation() {
        let bytes=include_bytes!("../resources/galileo-example.json");assert!(validate(bytes).is_ok());
        let mut db=Database::default();load_gp(&mut db,bytes).unwrap();
        let orbit=db.orbits.values().next().unwrap().first().unwrap();let at=orbit.el.datetime.and_utc()+chrono::Duration::hours(1);
        let p=position(orbit,at).unwrap();assert!((20000.0..26000.0).contains(&p.altitude_km));assert!((3.0..4.5).contains(&p.speed_km_s));
        assert!(!in_collection(&db,p.id,"starlink"));assert!(in_collection(&db,p.id,"galileo"));
        assert!(validate(include_bytes!("../resources/iss-example.json")).is_err());assert!(validate(b"[]").is_err());
    }
}
