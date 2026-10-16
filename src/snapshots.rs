//! Shared immutable editions: visitors keep one edition until they reload.
use super::Database;
use std::{collections::VecDeque, sync::{Arc, Mutex, OnceLock}, time::{Duration, Instant}};
const MAX_EDITIONS: usize = 16;
const MAX_AGE: Duration = Duration::from_secs(24 * 3600);
#[derive(Default)]
struct Store { editions: VecDeque<(String, Instant, Arc<Database>)> }
impl Store {
    fn capture(&mut self, db: &Database) -> (String, Arc<Database>) {
        self.editions.retain(|(_, time, _)| time.elapsed() < MAX_AGE);
        let boot = BOOT.get_or_init(|| chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default());
        let id = format!("{boot}-{}", db.revision);
        if let Some((id, _, data)) = self.editions.iter().find(|(key, _, _)| *key == id) {
            return (id.clone(), data.clone());
        }
        let data = Arc::new(db.clone());
        self.editions.push_back((id.clone(), Instant::now(), data.clone()));
        while self.editions.len() > MAX_EDITIONS { self.editions.pop_front(); }
        (id, data)
    }
    fn get(&self, id: &str) -> Option<Arc<Database>> {
        self.editions.iter().find(|(key, time, _)| key == id && time.elapsed() < MAX_AGE).map(|(_, _, data)| data.clone())
    }
}
static BOOT: OnceLock<i64> = OnceLock::new();
static STORE: OnceLock<Mutex<Store>> = OnceLock::new();
pub fn capture(db: &Database) -> (String, Arc<Database>) {
    STORE.get_or_init(|| Mutex::new(Store::default())).lock().unwrap_or_else(|e| e.into_inner()).capture(db)
}
pub fn get(id: &str) -> Option<Arc<Database>> {
    STORE.get_or_init(|| Mutex::new(Store::default())).lock().unwrap_or_else(|e| e.into_inner()).get(id)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn visits_share_an_edition_while_new_visits_receive_updates() {
        let mut store=Store::default();let mut db=Database::default();
        db.catalog.insert(1,serde_json::json!({"OBJECT_NAME":"STARLINK-OLD"}));
        let (old_id,old)=store.capture(&db);let (_,same)=store.capture(&db);
        assert!(Arc::ptr_eq(&old,&same));
        db.revision+=1;db.catalog.get_mut(&1).unwrap()["OBJECT_NAME"]=serde_json::json!("STARLINK-NEW");
        let (new_id,new)=store.capture(&db);assert_ne!(old_id,new_id);
        assert_eq!(store.get(&old_id).unwrap().catalog[&1]["OBJECT_NAME"],"STARLINK-OLD");
        assert_eq!(new.catalog[&1]["OBJECT_NAME"],"STARLINK-NEW");
        for _ in 0..MAX_EDITIONS {db.revision+=1;store.capture(&db);}
        assert!(store.get(&old_id).is_none());assert!(store.get("unknown").is_none());
    }
}
