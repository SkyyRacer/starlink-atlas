// Independent public inputs. Identity must agree with SATCAT before enrichment.
use crate::collection_health;
use super::{download, load_gp_source, Database, Shared};
use chrono::{NaiveDateTime, Utc};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub const SUPGP: &str =
    "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?SOURCE=SpaceX-E&FORMAT=JSON";
pub const GCAT: &str = "https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv";

pub fn load_supgp(db: &mut Database, bytes: &[u8]) -> Result<usize, String> {
    let rows: Vec<Value> = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let matched: Vec<_> = rows
        .into_iter()
        .filter(|v| {
            v["DATA_SOURCE"] == "SpaceX-E"
                && v["NORAD_CAT_ID"]
                    .as_u64()
                    .and_then(|id| db.catalog.get(&id))
                    .is_some_and(|cat| {
                        v["OBJECT_NAME"] == cat["OBJECT_NAME"] && v["OBJECT_ID"] == cat["OBJECT_ID"]
                    })
        })
        .collect();
    // Exclude unmatched temporary IDs and reported cross-tags; never rename them.
    load_gp_source(
        db,
        &serde_json::to_vec(&matched).map_err(|e| e.to_string())?,
        "CelesTrak SupGP / SpaceX",
    )
}
pub fn load_gcat(db: &mut Database, bytes: &[u8]) -> Result<usize, String> {
    let text = std::str::from_utf8(bytes).map_err(|e| e.to_string())?;
    let mut lines = text.lines();
    let header: Vec<_> = lines.next().ok_or("GCAT vide")?.split('\t').collect();
    let column = |name| {
        header
            .iter()
            .position(|v| *v == name)
            .ok_or_else(|| format!("Colonne GCAT absente : {name}"))
    };
    let piece = column("Piece")?;
    let date = column("Launch_Date")?;
    let name = column("Name")?;
    let mission = column("PLName")?;
    let ids: std::collections::BTreeMap<_, _> = db
        .catalog
        .iter()
        .filter_map(|(id, v)| Some((v["OBJECT_ID"].as_str()?.to_owned(), *id)))
        .collect();
    let mut verified = std::collections::BTreeMap::new();
    for line in lines.filter(|l| !l.starts_with('#')) {
        let fields: Vec<_> = line.split('\t').map(str::trim).collect();
        let get = |i| fields.get(i).copied().unwrap_or("");
        let Some(id) = ids.get(get(piece)) else {
            continue;
        };
        let cat = &db.catalog[id];
        let normalized = get(name).replacen("Starlink ", "STARLINK-", 1);
        if normalized != cat["OBJECT_NAME"].as_str().unwrap_or("") {
            continue;
        }
        let raw = get(date);
        let exact = NaiveDateTime::parse_from_str(raw, "%Y %b %d %H%M:%S")
            .ok()
            .or_else(|| {
                NaiveDateTime::parse_from_str(&format!("{raw}:00"), "%Y %b %d %H%M:%S").ok()
            });
        let Some(time) = exact else { continue }; // No fabricated precision for uncertain dates.
        if time.date().to_string() != cat["LAUNCH_DATE"].as_str().unwrap_or("") {
            continue;
        }
        verified.insert(*id, json!({"launch_time":time.and_utc().to_rfc3339(),"launch_name":get(mission),"source":"GCAT · Jonathan McDowell","source_url":"https://planet4589.org/space/gcat/","precision":if raw.contains(':'){"second"}else{"minute"}}));
    }
    if verified.is_empty() {
        return Err("Aucun lancement GCAT recoupé avec SATCAT".into());
    }
    let count = verified.len();
    db.gcat = verified;
    db.revision += 1;
    Ok(count)
}
pub(crate) fn atomic(dir: &Path, file: &str, bytes: &[u8]) -> Result<(), String> {
    if (file.starts_with("gp-")||file.starts_with("supgp-"))&&file.ends_with(".json"){
        super::history::record(dir,bytes,if file.starts_with("supgp-"){"CelesTrak SupGP / SpaceX"}else{"CelesTrak GP / Space-Track"})?;
    }
    let temp = dir.join(format!("{file}.tmp"));
    std::fs::write(&temp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(temp, dir.join(file)).map_err(|e| e.to_string())
}
pub async fn collect(shared: Shared, dir: PathBuf, once: bool) {
    let client = reqwest::Client::builder()
        .user_agent("StarlinkAtlas/0.1 (local educational tracker)")
        .redirect(reqwest::redirect::Policy::none()).connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .unwrap();
    loop {
        if shared.read().await.catalog.is_empty() {
            if once {
                return;
            }
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            continue;
        }
        for (key, url, interval) in [("supgp", SUPGP, 7200), ("gcat", GCAT, 86400)] {
            let now=Utc::now().timestamp();
            if !collection_health::due(&dir,key,now,interval){continue;}
            if let Err(e) = std::fs::write(dir.join(format!("{key}-attempt.txt")), now.to_string())
            {
                eprintln!("{key}: {e}");
                continue;
            }
            let result: Result<(),String>=async {
                let bytes=download(&client,url).await?;
                let mut test=Database::default();test.catalog=shared.read().await.catalog.clone();
                let count=if key=="supgp" {load_supgp(&mut test,&bytes)?} else {load_gcat(&mut test,&bytes)?};
                let file=if key=="supgp" {format!("supgp-{now}.json")} else {"gcat-launchlog.tsv".into()};
                atomic(&dir,&file,&bytes)?;
                let mut db=shared.write().await;
                if key=="supgp" {load_supgp(&mut db,&bytes)?;} else {load_gcat(&mut db,&bytes)?;}
                atomic(&dir,&format!("{key}-status.json"),&serde_json::to_vec(&json!({"source":url,"fetched":Utc::now().to_rfc3339(),"matched":count,"file":file})).unwrap())?;
                Ok(())
            }.await;
            if let Err(e) = result {
                eprintln!("{key}: {e}");
                collection_health::finish(&dir,key,Some(&e));
            }else{collection_health::finish(&dir,key,None);}
        }
        if once {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    }
}
pub async fn status() -> axum::Json<Value> {
    let dir = PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()));
    let rows: Vec<_> = ["supgp", "gcat", "satnogs", "keeptrack"]
        .into_iter()
        .map(|key| {
            let cached = std::fs::read(dir.join(format!("{key}-status.json")))
                .ok()
                .and_then(|b| serde_json::from_slice::<Value>(&b).ok());
            let error = std::fs::read_to_string(dir.join(format!("{key}-stopped.txt"))).ok().or_else(||std::fs::read_to_string(dir.join(format!("{key}-error.txt"))).ok());
            json!({"key":key,"cache":cached,"error":error,"configured":key!="keeptrack" || crate::secondary::api_key(&dir).is_some()})
        })
        .collect();
    axum::Json(json!({"additional_sources":rows}))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn catalog() -> Database {
        let mut db = Database::default();
        db.catalog.insert(100753,json!({"OBJECT_NAME":"STARLINK-38381","OBJECT_ID":"2026-219A","LAUNCH_DATE":"2026-09-20"}));
        db
    }
    #[test]
    fn supplemental_identity_and_forward_validity() {
        let bytes = include_bytes!("../resources/supgp-example.json");
        let mut db = catalog();
        assert_eq!(load_supgp(&mut db, bytes).unwrap(), 1);
        let epoch = db.orbits[&100753][0].el.datetime.and_utc();
        assert!(super::super::select(&db.orbits[&100753], epoch).is_some());
        assert!(
            super::super::select(&db.orbits[&100753], epoch - chrono::Duration::seconds(1))
                .is_none()
        );
        assert!(
            super::super::select(&db.orbits[&100753], epoch + chrono::Duration::hours(25))
                .is_none()
        );
        load_supgp(&mut db, bytes).unwrap();
        assert_eq!(db.orbits[&100753].len(), 1);
        db.catalog.get_mut(&100753).unwrap()["OBJECT_NAME"] = json!("STARLINK-OTHER");
        assert!(load_supgp(&mut db, bytes).is_err());
    }
    #[test]
    fn launch_crosscheck_and_uncertain_dates() {
        let mut db = catalog();
        let header = "#Launch_Tag\tLaunch_Date\tPiece\tName\tPLName\n";
        let valid=format!("{header}2026-219\t2026 Sep 20 0147:00\t2026-219A\tStarlink 38381\tStarlink Group 15-27-01\n");
        assert_eq!(load_gcat(&mut db, valid.as_bytes()).unwrap(), 1);
        assert_eq!(db.gcat[&100753]["launch_time"], "2026-09-20T01:47:00+00:00");
        assert!(load_gcat(&mut db, valid.replace("0147:00", "0147?").as_bytes()).is_err());
        assert!(load_gcat(&mut db, valid.replace("Sep 20", "Sep 21").as_bytes()).is_err());
        assert!(load_gcat(
            &mut db,
            valid.replace("Starlink 38381", "Starlink 38382").as_bytes()
        )
        .is_err());
        assert!(!super::super::exists_in_db(
            &db,
            100753,
            chrono::DateTime::parse_from_rfc3339("2026-09-20T01:46:59Z")
                .unwrap()
                .with_timezone(&Utc)
        ));
        assert!(super::super::exists_in_db(
            &db,
            100753,
            chrono::DateTime::parse_from_rfc3339("2026-09-20T01:47:00Z")
                .unwrap()
                .with_timezone(&Utc)
        ));
        assert_eq!(db.gcat.len(), 1); // An invalid update keeps the previous validated cache.
    }
}
