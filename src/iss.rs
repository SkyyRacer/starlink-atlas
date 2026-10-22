//! Dedicated, independently cached ISS feed; a failed source never clears a valid orbit.
use super::*;
pub const GP_ISS: &str = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON";
const CAT_ISS: &str = "https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=JSON";
fn validate(bytes: &[u8]) -> Result<(), String> {
    let rows: Vec<sgp4::Elements> = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if rows.len() != 1 || rows[0].norad_id != 25544 {
        return Err("Réponse ISS incorrecte".into());
    }
    sgp4::Constants::from_elements(&rows[0]).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn load_cache(db: &mut Database, dir: &std::path::Path) {
    if let Ok(bytes) = std::fs::read(dir.join("iss-catalog.json")) {
        if let Err(e) = load_cat(db, &bytes) {
            eprintln!("Catalogue ISS ignoré : {e}");
        }
    }
    // GP cache is loaded by the ordinary gp-*.json loader.
}
pub async fn collect(shared: Shared, dir: PathBuf, once: bool) {
    let client = reqwest::Client::builder()
        .user_agent("Atlas/0.2 (educational orbital observer)")
        .redirect(reqwest::redirect::Policy::none()).connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .unwrap();
    loop {
        let now = Utc::now().timestamp();
        if collection_health::due(&dir,"iss",now,7200) {
            let _ = std::fs::write(dir.join("iss-attempt.txt"), now.to_string());
            let result: Result<(), String> = async {
                let bytes = download(&client, GP_ISS).await?;
                validate(&bytes)?;
                sources::atomic(&dir, "gp-iss.json", &bytes)?;
                load_gp(&mut *shared.write().await, &bytes)?;
                let age = std::fs::metadata(dir.join("iss-catalog.json"))
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.elapsed().ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(u64::MAX);
                if age >= 86400 {
                    let bytes = download(&client, CAT_ISS).await?;
                    let rows: Vec<Value> =
                        serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
                    if rows.len() != 1 || rows[0]["NORAD_CAT_ID"].as_u64() != Some(25544) {
                        return Err("Catalogue ISS incorrect".into());
                    }
                    sources::atomic(&dir, "iss-catalog.json", &bytes)?;
                    load_cat(&mut *shared.write().await, &bytes)?;
                }
                Ok(())
            }
            .await;
            if let Err(e) = result {
                eprintln!("ISS : {e}");
                collection_health::finish(&dir,"iss",Some(&e));
            }else{collection_health::finish(&dir,"iss",None);}
        }
        if once {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn identity_and_real_orbit() {
        let bytes = include_bytes!("../resources/iss-example.json");
        assert!(validate(bytes).is_ok());
        let mut rows: Vec<Value> = serde_json::from_slice(bytes).unwrap();
        rows[0]["NORAD_CAT_ID"] = json!(12345);
        assert!(validate(&serde_json::to_vec(&rows).unwrap()).is_err());
        assert!(validate(b"[]").is_err());
        let mut db = Database::default();
        load_gp(&mut db, bytes).unwrap();
        let orbit = &db.orbits[&25544][0];
        let at = orbit.el.datetime.and_utc() + chrono::Duration::minutes(30);
        let p = position(orbit, at).unwrap();
        assert!((350.0..500.0).contains(&p.altitude_km));
        assert!((7.0..8.5).contains(&p.speed_km_s));
        assert!(select(&db.orbits[&25544], at - chrono::Duration::days(5)).is_none());
    }
}
