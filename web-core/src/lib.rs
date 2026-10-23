//! No network or clock imports: JavaScript supplies UTC time and an immutable data edition.
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{Mutex, OnceLock},
};
const MAX_AGE: i64 = 72 * 3600;
#[derive(Clone)]
struct Orbit {
    el: sgp4::Elements,
    constants: sgp4::Constants,
    source: &'static str,
}
#[derive(Default)]
struct Database {
    orbits: BTreeMap<u64, Vec<Orbit>>,
    catalog: BTreeMap<u64, Value>,
    gcat: BTreeMap<u64, Value>,
}
#[derive(Serialize)]
struct Point {
    id: u64,
    lat: f64,
    lon: f64,
    altitude_km: f64,
    speed_km_s: f64,
    epoch: String,
    age_hours: f64,
    source: &'static str,
}
#[derive(Serialize)]
struct Positions {
    at:DateTime<Utc>,points:Vec<Point>,missing:usize,track:Vec<[f64;2]>,future_track:Vec<[f64;2]>,track_3d:Vec<[f64;3]>,future_track_3d:Vec<[f64;3]>,suggested_at:Option<DateTime<Utc>>,recovery_at:Option<DateTime<Utc>>,
}
#[derive(Serialize)]
#[serde(untagged)]
enum Reply {Positions(Positions),Other(Value)}
#[derive(Serialize)]
struct Response {#[serde(skip_serializing_if="Option::is_none")]data:Option<Reply>,#[serde(skip_serializing_if="Option::is_none")]error:Option<String>}
#[path = "../../src/orbit_math.rs"]
mod orbit_math;
#[path = "../../src/collections.rs"]
mod collections;
use orbit_math::*;
#[derive(Default)]
struct Lifetime {launch:Option<DateTime<Utc>>,decay:Option<DateTime<Utc>>}
#[derive(Default)]
struct Engine {
    lifetimes:BTreeMap<u64,Lifetime>,
    allowed: std::collections::BTreeSet<u64>,
    db: Database,
    history: BTreeMap<u64, Vec<Orbit>>,
    live: BTreeMap<u64, Vec<Orbit>>,
    live_window: Option<(DateTime<Utc>, DateTime<Utc>)>,
}
fn add(
    rows: &[Value],
    dest: &mut BTreeMap<u64, Vec<Orbit>>,
    default_source: &'static str,
    allowed: &std::collections::BTreeSet<u64>,
) -> Result<(), String> {
    for row in rows {
        let wrapped = row.get("elements").unwrap_or(row);
        let source = match row.get("source").and_then(Value::as_str) {
            Some("CelesTrak SupGP / SpaceX") => "CelesTrak SupGP / SpaceX",
            Some("Archive importée / GP") => "Archive importée / GP",
            Some("CelesTrak GP / Space-Track") => "CelesTrak GP / Space-Track",
            Some("SatNOGS / Space-Track") => "SatNOGS / Space-Track",
            Some("N2YO / Space-Track") => "N2YO / Space-Track",
            Some("SatNOGS / CelesTrak") => "SatNOGS / CelesTrak",
            Some("SatNOGS / autre fournisseur") => "SatNOGS / autre fournisseur",
            Some("KeepTrack / fournisseurs multiples") => "KeepTrack / fournisseurs multiples",
            Some("Archive publique Julien Simon / Space-Track") => "Archive publique Julien Simon / Space-Track",
            _ => default_source,
        };
        let Ok(el)=serde_json::from_value::<sgp4::Elements>(wrapped.clone()) else {continue;};
        if collections::family(el.norad_id,el.object_name.as_deref().unwrap_or("")).is_none() && !allowed.contains(&el.norad_id){continue;}
        let Ok(constants)=sgp4::Constants::from_elements(&el) else {continue;};
        dest.entry(el.norad_id).or_default().push(Orbit {
            el,
            constants,
            source,
        });
    }
    Ok(())
}
fn add_packed(data: &Value, key: &str, dest: &mut BTreeMap<u64, Vec<Orbit>>, allowed: &std::collections::BTreeSet<u64>) -> Result<(), String> {
    let fields = data["orbit_fields"].as_array().ok_or("Missing orbit fields")?;
    let sources = data["orbit_sources"].as_array().ok_or("Missing orbit sources")?;
    for values in data[key].as_array().ok_or("Missing packed orbits")? {
        let values = values.as_array().ok_or("Invalid orbit row")?;
        if values.len() != fields.len() + 1 { return Err("Invalid orbit field count".into()); }
        let index = values[0].as_u64().ok_or("Invalid source index")? as usize;
        let source = sources.get(index).ok_or("Unknown orbit source")?;
        let mut elements = serde_json::Map::new();
        for (field, value) in fields.iter().zip(values.iter().skip(1)) {
            if !value.is_null() { elements.insert(field.as_str().ok_or("Invalid orbit field")?.to_owned(), value.clone()); }
        }
        add(&[json!({"elements":elements,"source":source})], dest, "CelesTrak GP / Space-Track",allowed)?;
    }
    Ok(())
}
impl Engine {
    fn catalogue(&mut self,rows:&[Value],gcat:&Value){
        for row in rows {if let Some(id)=row["NORAD_CAT_ID"].as_u64(){self.allowed.insert(id);self.lifetimes.insert(id,Lifetime{launch:event_time(row,"LAUNCH_DATE"),decay:event_time(row,"DECAY_DATE")});}}
        if let Some(rows)=gcat.as_object(){for (key,row) in rows {if let (Ok(id),Some(launch))=(key.parse::<u64>(),event_time(row,"launch_time")){self.lifetimes.entry(id).or_default().launch=Some(launch);}}}
    }
    fn exists(&self,id:u64,at:DateTime<Utc>)->bool {self.lifetimes.get(&id).is_none_or(|v|v.launch.is_none_or(|d|at>=d)&&v.decay.is_none_or(|d|at<d))}

    fn dispatch(&mut self, q: Value) -> Result<Value, String> {
        match q["op"].as_str().unwrap_or("") {
            "init" => {
                let data = &q["data"];
                self.lifetimes.clear();self.allowed=data["raw_catalog"].as_array().ok_or("Missing catalogue")?.iter().filter_map(|r|r["NORAD_CAT_ID"].as_u64()).collect();
                let mut db = Database::default();
                self.live.clear(); self.live_window = None;
                if data.get("packed_orbits").is_some() {
                    add_packed(data, "packed_orbits", &mut db.orbits,&self.allowed)?;
                    add_packed(data, "packed_live", &mut self.live,&self.allowed)?;
                    if let (Some(from), Some(until)) = (data["live_window"]["from"].as_str(), data["live_window"]["until"].as_str()) {
                        self.live_window = Some((DateTime::parse_from_rfc3339(from).map_err(|e|e.to_string())?.with_timezone(&Utc), DateTime::parse_from_rfc3339(until).map_err(|e|e.to_string())?.with_timezone(&Utc)));
                    }
                } else {
                    add(data["orbits"].as_array().ok_or("Missing orbits")?, &mut db.orbits, "CelesTrak GP / Space-Track",&self.allowed)?;
                }
                self.db = db;
                self.catalogue(data["raw_catalog"].as_array().ok_or("Missing catalogue")?,&data["gcat"]);
                self.history.clear();
                Ok(json!({"ready":true}))
            }
            "catalog-add" => {
                self.catalogue(q["rows"].as_array().ok_or("Missing catalogue batch")?,&q["gcat"]);
                Ok(json!({"ready":true}))
            }
            "orbits-start" => {
                match q["target"].as_str(){Some("current")=>self.db.orbits.clear(),Some("history")=>self.history.clear(),Some("live")=>self.live.clear(),_=>return Err("Unknown target".into())};
                Ok(json!({"ready":true}))
            }
            "orbits-add" => {
                let dest=match q["target"].as_str(){Some("current")=>&mut self.db.orbits,Some("history")=>&mut self.history,Some("live")=>&mut self.live,_=>return Err("Unknown target".into())};
                if q["data"].is_object(){add_packed(&q["data"],"packed_orbits",dest,&self.allowed)?;}else{add(q["rows"].as_array().ok_or("Missing orbit batch")?,dest,"Archive publique Julien Simon / Space-Track",&self.allowed)?;}
                Ok(json!({"ready":true}))
            }
            "current" => {
                let mut rows = BTreeMap::new();
                add_packed(&q["data"], "packed_orbits", &mut rows,&self.allowed)?;
                self.db.orbits = rows;
                Ok(json!({"ready":true}))
            }
            "history" => {
                let mut history = BTreeMap::new();
                add(
                    q["rows"].as_array().ok_or("Missing history")?,
                    &mut history,
                    "Archive publique Julien Simon / Space-Track",
                    &self.allowed,
                )?;
                self.history = history;
                Ok(json!({"ready":true}))
            }
            
            _ => Err("Unknown operation".into()),
        }
    }
    fn positions(&self, q: Value) -> Result<Positions, String> {
        let at = DateTime::parse_from_rfc3339(q["at"].as_str().ok_or("Date required")?)
            .map_err(|e| e.to_string())?
            .with_timezone(&Utc);
        let now = DateTime::parse_from_rfc3339(q["now"].as_str().ok_or("Clock required")?)
            .map_err(|e| e.to_string())?
            .with_timezone(&Utc);
        if at > now {
            return Err("Le futur est interdit".into());
        }
        let mut points = Vec::new();
        let mut missing = 0;
        let db = &self.db;
        let is_live = !q["use_history"].as_bool().unwrap_or(false) && self.live_window.is_some_and(|(from, until)| at >= from && at < until);
        let current = if is_live { &self.live } else { &db.orbits };
        let history = if is_live { None } else { Some(&self.history) };
        let ids: BTreeSet<_> = current
            .keys()
            .chain(history.into_iter().flat_map(|rows| rows.keys()))
            .copied()
            .collect();
        for id in &ids {
            if !self.exists(*id,at) {
                continue;
            }
            match select_sources(current.get(id), history.and_then(|rows| rows.get(id)), at)
                .and_then(|o| position(o, at))
            {
                Some(p) => points.push(p),
                None => missing += 1,
            }
        }
        missing += self.allowed
            .iter()
            .filter(|id| !ids.contains(id) && self.exists(**id,at))
            .count();
        let mut track = Vec::new();
        let mut future = Vec::new();
        let mut track3 = Vec::new();
        let mut future3 = Vec::new();
        if let Some(id) = q["id"].as_u64() {
            if self.exists(id,at) {
                if let Some(o) = select_sources(current.get(&id), history.and_then(|rows| rows.get(&id)), at) {
                    let period=chrono::Duration::milliseconds((86400000.0/o.el.mean_motion).round() as i64);
                    for (t,p) in orbit_track(o,at-period,at) {if self.exists(id,t){track.push([p.lat,p.lon]);track3.push([p.lat,p.lon,p.altitude_km]);}}
                    for (t,p) in orbit_track(o,at,at+period) {if !self.exists(id,t){break;}future.push([p.lat,p.lon]);future3.push([p.lat,p.lon,p.altitude_km]);}
                }
            }
        }
        let suggested = if points.is_empty() {
            db.orbits
                .iter()
                .flat_map(|(id, rows)| rows.iter().map(move |o| (*id, o.el.datetime.and_utc())))
                .filter(|(id, t)| *t <= now && self.exists(*id,*t))
                .min_by_key(|(_, t)| (*t - at).num_seconds().abs())
                .map(|(_, t)| t)
        } else {
            None
        };
        let recovery=if missing>points.len(){recovery_epoch(db.orbits.values().flat_map(|rows|rows.iter()),now).filter(|date|(*date-at).num_seconds().abs()>60)}else{None};
        Ok(Positions{at,points,missing,track,future_track:future,track_3d:track3,future_track_3d:future3,suggested_at:suggested,recovery_at:recovery})
    }
}
static ENGINE: OnceLock<Mutex<Engine>> = OnceLock::new();
// Length-prefixed response. Ownership is explicitly transferred across the WASM ABI.
#[no_mangle]
pub extern "C" fn atlas_alloc(len: usize) -> *mut u8 {
    let memory = vec![0u8; len].into_boxed_slice();
    Box::into_raw(memory) as *mut u8
}
#[no_mangle]
pub unsafe extern "C" fn atlas_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}
#[no_mangle]
pub unsafe extern "C" fn atlas_call(ptr: *const u8, len: usize) -> *mut u8 {
    let result=serde_json::from_slice::<Value>(std::slice::from_raw_parts(ptr,len)).map_err(|e|e.to_string()).and_then(|q|{
        let mut engine=ENGINE.get_or_init(||Mutex::new(Engine::default())).lock().map_err(|e|e.to_string())?;
        if q["op"]=="positions"{engine.positions(q).map(Reply::Positions)}else{engine.dispatch(q).map(Reply::Other)}
    });
    let response=match result {Ok(data)=>Response{data:Some(data),error:None},Err(error)=>Response{data:None,error:Some(error)}};
    let body=serde_json::to_vec(&response).unwrap();
    let mut output = Vec::with_capacity(body.len() + 4);
    output.extend_from_slice(&(body.len() as u32).to_le_bytes());
    output.extend_from_slice(&body);
    Box::into_raw(output.into_boxed_slice()) as *mut u8
}

#[cfg(test)]
mod historical_tests {
 use super::*;
 #[test]
 fn malformed_archived_object_does_not_clear_valid_history(){
  let good:Vec<Value>=serde_json::from_str(include_str!("../../resources/iss-example.json")).unwrap();
  let mut bad=good[0].clone();bad["MEAN_MOTION"]=json!(-1.0);
  let mut engine=Engine::default();engine.dispatch(json!({"op":"orbits-add","target":"history","rows":[{"garbage":true},bad,good[0]]})).unwrap();
  assert_eq!(engine.history.get(&25544).unwrap().len(),1);
 }
}
