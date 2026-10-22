//! Bounded lazy cache: only the seven daily files surrounding the requested date.
use super::{Database, Orbit};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value;
use std::{
    collections::{BTreeMap, VecDeque},
    io::Read,
    path::PathBuf,
    sync::{Arc, OnceLock},
};
use tokio::sync::Mutex;
type Orbits = Arc<BTreeMap<u64, Vec<Orbit>>>;
// Keep an ISS window alongside the full window, so switching pages cannot evict it.
static CACHE: OnceLock<Mutex<VecDeque<(String, Orbits)>>> = OnceLock::new();
fn directory() -> PathBuf {
    std::env::var("HISTORY_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into())).join("history")
        })
}
pub fn info() -> Option<Value> {
    let mut value:Value=serde_json::from_slice(&std::fs::read(directory().join("manifest.json")).ok()?).ok()?;
    let object=value.as_object_mut()?;
    if let Some(coverage)=object.remove("object_coverage"){object.insert("objects_with_history".into(),serde_json::json!(coverage.as_object().map_or(0,|rows|rows.len())));}
    if let Some(requested)=object.remove("requested_objects"){object.insert("objects_requested".into(),serde_json::json!(requested["all"].as_array().map_or(0,|rows|rows.len())));}
    Some(value)
}
pub fn nearest_date(at: DateTime<Utc>) -> Option<DateTime<Utc>> {
    info()?["days"]
        .as_object()?
        .keys()
        .filter_map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
        .map(|d| d.and_hms_opt(12, 0, 0).unwrap().and_utc())
        .filter(|t| *t <= Utc::now())
        .min_by_key(|t| (*t - at).num_seconds().abs())
}
pub async fn orbits(at: DateTime<Utc>, collection: &str, allowed: &std::collections::BTreeSet<u64>) -> Result<Orbits, String> {
    use std::hash::{Hash,Hasher};
    let mut hash=std::collections::hash_map::DefaultHasher::new();allowed.hash(&mut hash);let scope=hash.finish();
    let allowed=allowed.clone();let collection=collection.to_owned();
    let dir = directory();
    let updates=PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into())).join("history-updates");
    let stamp=std::fs::metadata(dir.join("manifest.json")).and_then(|m|m.modified()).ok();
    let update_stamp=std::fs::metadata(&updates).and_then(|m|m.modified()).ok();
    if stamp.is_none()&&update_stamp.is_none(){return Ok(Arc::new(BTreeMap::new()));}
    let key = format!("{}:{}:{stamp:?}:{update_stamp:?}:{collection}:{scope}", dir.display(), at.date_naive());
    let mut cache = CACHE.get_or_init(|| Mutex::new(VecDeque::new())).lock().await;
    if let Some((_, value)) = cache.iter().find(|(k, _)| *k == key) {
        return Ok(value.clone());
    }
    let value = tokio::task::spawn_blocking(move || {
        let mut db = Database::default();
        for offset in -3..=3 {
            let day = at.date_naive() + chrono::Duration::days(offset);
            for directory in [&dir,&updates] {
            let path = directory.join(format!("{day}.json.gz"));
            if !path.exists() {
                continue;
            }
            let f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            let mut bytes = Vec::new();
            flate2::read::GzDecoder::new(f)
                .take(100_000_001)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > 100_000_000 {
                return Err(format!("{} trop volumineuse", path.display()));
            }
            let rows:Vec<Value>=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
            // Filter the requested family before constructing costly SGP4 constants.
            let mut grouped:BTreeMap<String,Vec<Value>>=BTreeMap::new();
            for row in rows {
                let elements=row.get("elements").unwrap_or(&row);let id=elements["NORAD_CAT_ID"].as_u64().unwrap_or(0);let name=elements["OBJECT_NAME"].as_str().unwrap_or("");
                if collection!="all"&&!allowed.contains(&id)&&!super::collections::belongs(id,name,&collection){continue;}
                let source=row["source"].as_str().unwrap_or("Archive publique Julien Simon / Space-Track").to_owned();
                grouped.entry(source).or_default().push(elements.clone());
            }
            for (source,rows) in grouped {
                let source=match source.as_str(){"CelesTrak SupGP / SpaceX"=>"CelesTrak SupGP / SpaceX","KeepTrack / fournisseurs multiples"=>crate::secondary::KEEPTRACK,"SatNOGS / Space-Track"=>crate::secondary::SATNOGS,"SatNOGS / CelesTrak"=>crate::secondary::SATNOGS_CELESTRAK,"SatNOGS / autre fournisseur"=>crate::secondary::SATNOGS_OTHER,s if s.contains("Julien Simon")=>"Archive publique Julien Simon / Space-Track",_=>"Archive de collectes / GP"};
                // A malformed public observation must not discard the other satellites or days.
                for row in rows {
                    let Ok(el)=serde_json::from_value::<sgp4::Elements>(row) else {continue;};
                    let Ok(constants)=sgp4::Constants::from_elements(&el) else {continue;};
                    let entries=db.orbits.entry(el.norad_id).or_default();
                    if !entries.iter().any(|o|o.el.datetime==el.datetime&&o.source==source){entries.push(Orbit{el,constants,source});}
                }
            }
            }
        }
        for rows in db.orbits.values_mut(){rows.sort_by_key(|o|o.el.datetime);}
        Ok(Arc::new(db.orbits))
    })
    .await
    .map_err(|e| e.to_string())??;
    cache.push_back((key, value.clone()));
    while cache.len() > 4 { cache.pop_front(); }
    Ok(value)
}

/// Preserve each successful collection as a daily observation before the latest cache changes.
pub fn record(dir: &std::path::Path, bytes: &[u8], source: &str) -> Result<(), String> {
    use std::io::Write;
    static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let rows:Vec<Value>=serde_json::from_slice(bytes).map_err(|e|e.to_string())?;
    let mut incoming:BTreeMap<String,Vec<Value>>=BTreeMap::new();
    for elements in rows {
        let epoch=elements["EPOCH"].as_str().ok_or("Époque orbitale manquante")?;
        let day=epoch.get(..10).ok_or("Époque orbitale incorrecte")?;
        NaiveDate::parse_from_str(day,"%Y-%m-%d").map_err(|e|e.to_string())?;
        let origin=elements["ATLAS_SOURCE"].as_str().unwrap_or(source).to_owned();
        incoming.entry(day.to_owned()).or_default().push(serde_json::json!({"elements":elements,"source":origin}));
    }
    let _guard=LOCK.lock().map_err(|e|e.to_string())?;
    let target=dir.join("history-updates");std::fs::create_dir_all(&target).map_err(|e|e.to_string())?;
    for (day,mut rows) in incoming {
        let file=target.join(format!("{day}.json.gz"));
        if file.exists(){let input=std::fs::File::open(&file).map_err(|e|e.to_string())?;let old:Vec<Value>=serde_json::from_reader(flate2::read::GzDecoder::new(input)).map_err(|e|e.to_string())?;rows.extend(old);}
        let noon=NaiveDate::parse_from_str(&day,"%Y-%m-%d").unwrap().and_hms_opt(12,0,0).unwrap().and_utc();
        let mut selected:BTreeMap<(u64,String),(i64,Value)>=BTreeMap::new();
        for row in rows {
            let el=row.get("elements").unwrap_or(&row);let stamp=el["EPOCH"].as_str().ok_or("Époque manquante")?;
            let time=DateTime::parse_from_rfc3339(stamp).or_else(|_|DateTime::parse_from_rfc3339(&format!("{stamp}Z"))).map_err(|e|e.to_string())?;
            let key=(el["NORAD_CAT_ID"].as_u64().ok_or("NORAD manquant")?,row["source"].as_str().unwrap_or(source).to_owned());let rank=(time.with_timezone(&Utc)-noon).num_seconds().abs();
            if selected.get(&key).is_none_or(|(previous,_)|rank<*previous){selected.insert(key,(rank,row));}
        }
        let rows:Vec<_>=selected.into_values().map(|(_,row)|row).collect();let temp=file.with_extension("gz.tmp");
        let output=std::fs::File::create(&temp).map_err(|e|e.to_string())?;let mut writer=flate2::write::GzEncoder::new(output,flate2::Compression::default());
        writer.write_all(&serde_json::to_vec(&rows).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;writer.finish().map_err(|e|e.to_string())?;std::fs::rename(temp,file).map_err(|e|e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod preservation_tests {
 use super::*;
 #[test]
 fn repeated_collections_preserve_dates_and_new_objects(){
  let dir=std::env::temp_dir().join(format!("atlas-archive-test-{}",std::process::id()));let _=std::fs::remove_dir_all(&dir);std::fs::create_dir_all(&dir).unwrap();
  let row=|id,epoch|serde_json::json!({"NORAD_CAT_ID":id,"EPOCH":epoch});
  record(&dir,&serde_json::to_vec(&vec![row(1,"2026-01-01T08:00:00"),row(2,"2026-01-02T11:00:00")]).unwrap(),"CelesTrak GP / Space-Track").unwrap();
  record(&dir,&serde_json::to_vec(&vec![row(1,"2026-01-01T12:10:00"),row(3,"2026-01-02T12:00:00")]).unwrap(),"CelesTrak GP / Space-Track").unwrap();
  let read=|day|{let f=std::fs::File::open(dir.join(format!("history-updates/{day}.json.gz"))).unwrap();serde_json::from_reader::<_,Vec<Value>>(flate2::read::GzDecoder::new(f)).unwrap()};
  let first=read("2026-01-01");assert_eq!(first.len(),1);assert_eq!(first[0]["elements"]["EPOCH"],"2026-01-01T12:10:00");let second=read("2026-01-02");assert_eq!(second.len(),2);assert!(second.iter().any(|r|r["elements"]["NORAD_CAT_ID"]==2));assert!(second.iter().any(|r|r["elements"]["NORAD_CAT_ID"]==3));
  std::fs::remove_dir_all(dir).unwrap();
 }
}
