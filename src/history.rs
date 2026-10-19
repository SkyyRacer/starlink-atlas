//! Bounded lazy cache: only the seven daily files surrounding the requested date.
use super::{load_gp_source_for, Database, Orbit};
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
    std::fs::read(directory().join("manifest.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
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
pub async fn orbits(at: DateTime<Utc>, iss_only: bool) -> Result<Orbits, String> {
    let dir = directory();
    if !dir.join("manifest.json").exists() {
        return Ok(Arc::new(BTreeMap::new()));
    }
    let stamp = std::fs::metadata(dir.join("manifest.json"))
        .and_then(|m| m.modified())
        .map_err(|e| e.to_string())?;
    let key = format!("{}:{}:{stamp:?}:{iss_only}", dir.display(), at.date_naive());
    let mut cache = CACHE.get_or_init(|| Mutex::new(VecDeque::new())).lock().await;
    if let Some((_, value)) = cache.iter().find(|(k, _)| *k == key) {
        return Ok(value.clone());
    }
    let value = tokio::task::spawn_blocking(move || {
        let mut db = Database::default();
        for offset in -3..=3 {
            let day = at.date_naive() + chrono::Duration::days(offset);
            let path = dir.join(format!("{day}.json.gz"));
            if !path.exists() {
                continue;
            }
            let f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            let mut bytes = Vec::new();
            flate2::read::GzDecoder::new(f)
                .take(30_000_001)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > 30_000_000 {
                return Err(format!("{} trop volumineuse", path.display()));
            }
            load_gp_source_for(
                &mut db,
                &bytes,
                "Archive publique Julien Simon / Space-Track",
                iss_only,
            )
            .map_err(|e| format!("{}: {e}", path.display()))?;
        }
        Ok(Arc::new(db.orbits))
    })
    .await
    .map_err(|e| e.to_string())??;
    cache.push_back((key, value.clone()));
    while cache.len() > 2 { cache.pop_front(); }
    Ok(value)
}
