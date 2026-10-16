mod history;
mod sources;
mod snapshots;
mod orbit_math;
use orbit_math::*;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::BTreeMap, path::PathBuf, sync::Arc};
use tokio::sync::RwLock;
use tower_http::{compression::CompressionLayer, services::ServeDir};

const GP: &str = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json";
const CAT: &str = "https://celestrak.org/satcat/records.php?NAME=STARLINK&FORMAT=JSON";
const MAX_AGE: i64 = 72 * 3600;
#[derive(Clone)]
struct Orbit {
    el: sgp4::Elements,
    constants: sgp4::Constants,
    source: &'static str,
}
#[derive(Default, Clone)]
struct Database {
    revision: u64,
    orbits: BTreeMap<u64, Vec<Orbit>>,
    catalog: BTreeMap<u64, Value>,
    gcat: BTreeMap<u64, Value>,
    message: String,
    fetched: Option<String>,
}
type Shared = Arc<RwLock<Database>>;
#[derive(Deserialize)]
struct Q {
    at: Option<String>,
    id: Option<u64>,
    snapshot: Option<String>,
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
fn load_gp(db: &mut Database, bytes: &[u8]) -> Result<usize, String> {
    load_gp_source(db, bytes, "CelesTrak GP / Space-Track")
}
fn load_gp_source(db: &mut Database, bytes: &[u8], source: &'static str) -> Result<usize, String> {
    let els: Vec<sgp4::Elements> = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let mut parsed = Vec::new();
    for el in els {
        if !el
            .object_name
            .as_deref()
            .unwrap_or("")
            .starts_with("STARLINK")
        {
            continue;
        }
        let constants = sgp4::Constants::from_elements(&el).map_err(|e| e.to_string())?;
        parsed.push(Orbit {
            el,
            constants,
            source,
        });
    }
    if parsed.is_empty() {
        return Err("Aucun élément Starlink valide".into());
    }
    let count = parsed.len();
    for orbit in parsed {
        let list = db.orbits.entry(orbit.el.norad_id).or_default();
        if !list
            .iter()
            .any(|o| o.el.datetime == orbit.el.datetime && o.source == orbit.source)
        {
            list.push(orbit);
            list.sort_by_key(|o| o.el.datetime);
        }
    }
    db.revision += 1;
    Ok(count)
}
fn load_cat(db: &mut Database, bytes: &[u8]) -> Result<(), String> {
    let rows: Vec<Value> = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let rows: Vec<_> = rows
        .into_iter()
        .filter(|v| {
            v["OBJECT_NAME"]
                .as_str()
                .unwrap_or("")
                .starts_with("STARLINK")
        })
        .collect();
    if rows.is_empty() {
        return Err("Catalogue vide".into());
    }
    for v in rows {
        if let Some(id) = v["NORAD_CAT_ID"].as_u64() {
            db.catalog.insert(id, v);
        }
    }
    db.revision += 1;
    Ok(())
}
fn query_time(q: &Q) -> Result<DateTime<Utc>, (StatusCode, String)> {
    let now = Utc::now();
    let at = match &q.at {
        None => now,
        Some(s) => DateTime::parse_from_rfc3339(s)
            .map_err(|_| (StatusCode::BAD_REQUEST, "Date RFC3339 UTC attendue".into()))?
            .with_timezone(&Utc),
    };
    if at > now {
        return Err((StatusCode::BAD_REQUEST, "Le futur est interdit".into()));
    }
    Ok(at)
}
async fn catalog(State(s): State<Shared>) -> Result<Json<Value>, (StatusCode, String)> {
    let (snapshot, db) = snapshots::capture(&*s.read().await);
    if db.catalog.is_empty() && db.orbits.is_empty() { return Err((StatusCode::SERVICE_UNAVAILABLE, "Première collecte en cours".into())); }
    Ok(Json(catalog_document(&db, &snapshot)))
}
fn catalog_document(db: &Database, snapshot: &str) -> Value {
    let mut rows = BTreeMap::new();
    for (id, v) in &db.catalog {
        rows.insert(*id,json!({"id":id,"name":v["OBJECT_NAME"],"designator":v["OBJECT_ID"],"launch":db.gcat.get(id).map(|g|g["launch_time"].clone()).unwrap_or_else(||v["LAUNCH_DATE"].clone()),"decay":v["DECAY_DATE"],"ops":v["OPS_STATUS_CODE"],"verification":db.gcat.get(id)}));
    }
    for (id, list) in &db.orbits {
        let e = &list.last().unwrap().el;
        rows.entry(*id).or_insert(json!({"id":id,"name":e.object_name,"designator":e.international_designator,"launch":null,"decay":null,"ops":null}));
    }
    let min = db
        .orbits
        .values()
        .flat_map(|v| v.iter())
        .map(|o| o.el.datetime)
        .min();
    let max = db
        .orbits
        .values()
        .flat_map(|v| v.iter())
        .map(|o| o.el.datetime)
        .max();
    json!({"snapshot":snapshot,"satellites":rows.values().collect::<Vec<_>>(),"message":db.message,"fetched":db.fetched,"first_epoch":min,"last_epoch":max,"max_age_hours":72,"source":GP,"history":history::info()})
}
async fn positions(
    State(s): State<Shared>,
    Query(q): Query<Q>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let at = query_time(&q)?;
    let historical = history::orbits(at).await.map_err(|e| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            format!("Archive historique invalide : {e}"),
        )
    })?;
    let db = match q.snapshot.as_deref() {
        Some(id) => snapshots::get(id).ok_or((StatusCode::GONE, "Cette édition des données a expiré. Rechargez la page pour charger les dernières données.".into()))?,
        None => snapshots::capture(&*s.read().await).1,
    };
    let mut points = Vec::new();
    let mut missing = 0;
    let ids: std::collections::BTreeSet<_> =
        db.orbits.keys().chain(historical.keys()).copied().collect();
    for id in &ids {
        if !exists_in_db(&db, *id, at) {
            continue;
        }
        match select_sources(db.orbits.get(id), historical.get(id), at)
            .and_then(|o| position(o, at))
        {
            Some(p) => points.push(p),
            None => missing += 1,
        }
    }
    // Catalogued objects without any orbital archive also count as unavailable.
    missing += db
        .catalog
        .iter()
        .filter(|(id, _v)| !ids.contains(id) && exists_in_db(&db, **id, at))
        .count();
    let suggested_at = if points.is_empty() {
        let now = Utc::now();
        db.orbits
            .iter()
            .flat_map(|(id, list)| list.iter().map(move |o| (*id, o)))
            .map(|(id, o)| (id, o.el.datetime.and_utc()))
            .filter(|(id, t)| *t <= now && exists_in_db(&db, *id, *t))
            .min_by_key(|(_, t)| (*t - at).num_seconds().abs())
            .map(|(_, t)| t)
            .into_iter()
            .chain(history::nearest_date(at))
            .min_by_key(|t| (*t - at).num_seconds().abs())
    } else {
        None
    };
    let mut track = Vec::new();
    let mut future_track = Vec::new();
    let mut track_3d = Vec::new();
    let mut future_track_3d = Vec::new();
    if let Some(id) = q.id {
        if exists_in_db(&db, id, at) {
            if let Some(o) = select_sources(db.orbits.get(&id), historical.get(&id), at) {
                // Same orbital elements for past and predicted path; the timeline still rejects future dates.
                let period = (1440.0 / o.el.mean_motion * 60.0) as i64;
                for i in 0..=120 {
                    let t = at - chrono::Duration::seconds(period * (120 - i) / 120);
                    if exists_in_db(&db, id, t) {
                        if let Some(p) = position(o, t) {
                            track.push(json!([p.lat, p.lon]));
                            track_3d.push(json!([p.lat, p.lon, p.altitude_km]));
                        }
                    }
                }
                for i in 0..=120 {
                    let t = at + chrono::Duration::seconds(period * i / 120);
                    if !exists_in_db(&db, id, t) {
                        break;
                    }
                    match position(o, t) {
                        Some(p) => {
                            future_track.push(json!([p.lat, p.lon]));
                            future_track_3d.push(json!([p.lat, p.lon, p.altitude_km]));
                        }
                        None => break,
                    }
                }
            }
        }
    }
    Ok(Json(
        json!({"at":at,"points":points,"missing":missing,"track":track,"future_track":future_track,"track_3d":track_3d,"future_track_3d":future_track_3d,"suggested_at":suggested_at}),
    ))
}
async fn download(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let r = client.get(url).send().await.map_err(|e| e.to_string())?;
    if r.status() != StatusCode::OK {
        return Err(format!(
            "HTTP {} : collecte arrêtée ; intervention requise",
            r.status()
        ));
    }
    let b = r.bytes().await.map_err(|e| e.to_string())?;
    if b.len() > 30_000_000 {
        return Err("Réponse trop volumineuse".into());
    }
    Ok(b.to_vec())
}
async fn refresh(s: Shared, dir: PathBuf, once: bool) {
    let client = reqwest::Client::builder()
        .user_agent("StarlinkAtlas/0.1 (local educational tracker)")
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .unwrap();
    loop {
        if dir.join("collection-stopped.txt").exists() {
            s.write().await.message="Collecte arrêtée. Consulter data/collection-stopped.txt puis corriger la cause avant de supprimer ce fichier.".into();
            return;
        }
        let now = Utc::now().timestamp();
        let last = std::fs::read_to_string(dir.join("last-attempt.txt"))
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        if now - last < 7200 {
            if once { return; }
            tokio::time::sleep(std::time::Duration::from_secs((7200 - (now - last)) as u64)).await;
            continue;
        }
        if let Err(e) = std::fs::write(dir.join("last-attempt.txt"), now.to_string()) {
            s.write().await.message = format!("Cache non accessible : {e}");
            return;
        }
        let result: Result<(), String> = async {
            let bytes = download(&client, GP).await?;
            // Validate before replacing any state or durable cache.
            let mut temp = Database::default();
            load_gp(&mut temp, &bytes)?;
            std::fs::write(dir.join(format!("gp-{now}.json")), &bytes)
                .map_err(|e| e.to_string())?;
            load_gp(&mut *s.write().await, &bytes)?;
            let last_cat = std::fs::metadata(dir.join("satcat.json"))
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.elapsed().ok())
                .map(|d| d.as_secs())
                .unwrap_or(u64::MAX);
            if last_cat >= 86400 {
                let b = download(&client, CAT).await?;
                load_cat(&mut temp, &b)?;
                std::fs::write(dir.join("satcat.json"), &b).map_err(|e| e.to_string())?;
                load_cat(&mut *s.write().await, &b)?;
            }
            let date = Utc::now().to_rfc3339();
            std::fs::write(dir.join("fetched.txt"), &date).map_err(|e| e.to_string())?;
            let mut db = s.write().await;
            db.fetched = Some(date);
            db.message = "Collecte disponible · SGP4 estimé, pas de télémétrie".into();
            Ok(())
        }
        .await;
        if let Err(e) = result {
            eprintln!("{e}");
            let _ = std::fs::write(dir.join("collection-stopped.txt"), &e);
            s.write().await.message = e;
            return;
        }
        if once { return; }
    }
}
async fn config() -> Json<Value> {
    Json(
        json!({"tile_url":std::env::var("TILE_URL").unwrap_or("https://tile.openstreetmap.org/{z}/{x}/{y}.png".into()),"tile_attribution":std::env::var("TILE_ATTRIBUTION").unwrap_or("© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors · ODbL".into())}),
    )
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()));
    std::fs::create_dir_all(&dir)?;
    let args: Vec<String> = std::env::args().collect();
    if args.len() == 3 && args[1] == "--import-catalog" {
        let b = std::fs::read(&args[2])?;
        let mut db = Database::default();
        load_cat(&mut db, &b).map_err(std::io::Error::other)?;
        std::fs::write(dir.join("satcat.json"), b)?;
        println!("{} objets importés", db.catalog.len());
        return Ok(());
    }
    if args.len() == 3 && args[1] == "--import" {
        let b = std::fs::read(&args[2])?;
        let mut db = Database::default();
        let rows: Vec<Value> = serde_json::from_slice(&b)?;
        let supplemental = rows.iter().any(|v| v["CLASSIFICATION_TYPE"] == "C");
        let (n, prefix) = if supplemental {
            load_cat(&mut db, &std::fs::read(dir.join("satcat.json"))?)
                .map_err(std::io::Error::other)?;
            (
                sources::load_supgp(&mut db, &b).map_err(std::io::Error::other)?,
                "supgp",
            )
        } else {
            (
                load_gp_source(&mut db, &b, "Archive importée / GP")
                    .map_err(std::io::Error::other)?,
                "gp-import",
            )
        };
        std::fs::write(
            dir.join(format!("{prefix}-{}.json", Utc::now().timestamp_millis())),
            b,
        )?;
        println!("{n} éléments archivés");
        return Ok(());
    }
    let mut db = Database::default();
    db.message = "Cache local · collecte programmée (intervalle 2 h)".into();
    for file in std::fs::read_dir(&dir)? {
        let p = file?.path();
        if p.file_name().unwrap().to_string_lossy().starts_with("gp-")
            && p.extension().is_some_and(|e| e == "json")
        {
            let bytes = std::fs::read(&p)?;
            let result = if p
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("gp-import-")
            {
                load_gp_source(&mut db, &bytes, "Archive importée / GP")
            } else {
                load_gp(&mut db, &bytes)
            };
            match result {
                Ok(_) => {}
                Err(e) => eprintln!("Archive {} ignorée: {e}", p.display()),
            }
        }
    }
    if let Ok(b) = std::fs::read(dir.join("satcat.json")) {
        if let Err(e) = load_cat(&mut db, &b) {
            eprintln!("Catalogue ignoré: {e}");
        }
    }
    if let Ok(bytes) = std::fs::read(dir.join("supplemental-catalog.json")) {
        load_cat(&mut db, &bytes).map_err(std::io::Error::other)?;
    }
    for file in std::fs::read_dir(&dir)? {
        let p = file?.path();
        if p.file_name()
            .unwrap()
            .to_string_lossy()
            .strip_prefix("supgp-")
            .and_then(|v| v.strip_suffix(".json"))
            .is_some_and(|v| v.chars().all(|c| c.is_ascii_digit()))
            && p.extension().is_some_and(|e| e == "json")
        {
            if let Err(e) = sources::load_supgp(&mut db, &std::fs::read(&p)?) {
                eprintln!("SupGP ignoré : {e}");
            }
        }
    }
    if let Ok(bytes) = std::fs::read(dir.join("gcat-launchlog.tsv")) {
        if let Err(e) = sources::load_gcat(&mut db, &bytes) {
            eprintln!("GCAT ignoré : {e}");
        }
    }
    db.fetched = std::fs::read_to_string(dir.join("fetched.txt")).ok();
    if args.len()==3 && args[1]=="--export-web" {
        let target=PathBuf::from(&args[2]);std::fs::create_dir_all(&target)?;
        let rows:Vec<_>=db.orbits.values().flat_map(|rows|rows.iter().map(|o|json!({"elements":o.el,"source":o.source}))).collect();
        let bundle=json!({"catalog_response":catalog_document(&db,"browser-edition"),"raw_catalog":db.catalog.values().collect::<Vec<_>>(),"gcat":db.gcat,"orbits":rows,"config":config().await.0,"sources":sources::status().await.0});
        std::fs::write(target.join("bundle.json"),serde_json::to_vec(&bundle)?)?;
        println!("Export navigateur : {} satellites",db.catalog.len());return Ok(());
    }
    let shared = Arc::new(RwLock::new(db));
    if args.len()==2 && args[1]=="--collect-once" {
        refresh(shared.clone(),dir.clone(),true).await;
        sources::collect(shared,dir,true).await;
        return Ok(());
    }
    if std::env::var("OFFLINE").as_deref() != Ok("1") {
        tokio::spawn(refresh(shared.clone(), dir.clone(), false));
        tokio::spawn(sources::collect(shared.clone(), dir, false));
    } else {
        shared.write().await.message = "Mode hors ligne : archives locales uniquement".into();
    }
    let app = Router::new()
        .route("/api/config", get(config))
        .route("/api/sources", get(sources::status))
        .route("/api/catalog", get(catalog))
        .route("/api/positions", get(positions))
        .with_state(shared)
        .fallback_service(ServeDir::new("static"))
        .layer(CompressionLayer::new());
    let bind = std::env::var("BIND").unwrap_or("127.0.0.1:3000".into());
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    println!("Starlink Atlas http://{bind}");
    axum::serve(listener, app).await?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn equator_and_pole() {
        let (a, b, h) = geodetic([6928.137, 0.0, 0.0], 0.0);
        assert!(a.abs() < 1e-8 && b.abs() < 1e-8 && (h - 550.0).abs() < 1e-6);
        let (a, _, h) = geodetic([0.0, 0.0, 6906.752314], 0.0);
        assert!((a - 90.0).abs() < 1e-6 && (h - 550.0).abs() < 1e-5);
    }
    #[test]
    fn future_and_bad_dates_rejected() {
        assert!(query_time(&Q {
            snapshot: None,
            at: Some((Utc::now() + chrono::Duration::hours(1)).to_rfc3339()),
            id: None
        })
        .is_err());
        assert!(query_time(&Q {
            snapshot: None,
            at: Some("bad".into()),
            id: None
        })
        .is_err());
    }
    #[test]
    fn lifetime_boundaries() {
        let v = json!({"LAUNCH_DATE":"2020-01-01","DECAY_DATE":"2021-01-01"});
        let at = |s: &str| DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc);
        assert!(!exists(Some(&v), at("2019-12-31T23:59:59Z")));
        assert!(exists(Some(&v), at("2020-01-01T00:00:00Z")));
        assert!(!exists(Some(&v), at("2021-01-01T00:00:00Z")));
    }
    fn sample() -> sgp4::Elements {
        sgp4::Elements::from_tle(
            Some("STARLINK-TEST-FIXTURE".into()),
            b"1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753",
            b"2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667",
        )
        .unwrap()
    }
    #[test]
    fn vallado_reference_vector() {
        let c = sgp4::Constants::from_elements_afspc_compatibility_mode(&sample()).unwrap();
        let p = c.propagate(sgp4::MinutesSinceEpoch(0.0)).unwrap();
        let xyz = [7022.46529266, -1400.08296755, 0.03995155];
        let vel = [1.893841015, 6.405893759, 4.534807250];
        for i in 0..3 {
            assert!((p.position[i] - xyz[i]).abs() < 1e-7);
            assert!((p.velocity[i] - vel[i]).abs() < 1e-8);
        }
    }
    #[test]
    fn archive_dedup_and_age_limit() {
        let el = sample();
        let bytes = serde_json::to_vec(&vec![el.clone()]).unwrap();
        let mut db = Database::default();
        load_gp(&mut db, &bytes).unwrap();
        load_gp(&mut db, &bytes).unwrap();
        assert_eq!(db.orbits[&5].len(), 1);
        let at = el.datetime.and_utc();
        assert!(select(&db.orbits[&5], at).is_some());
        assert!(select(&db.orbits[&5], at + chrono::Duration::hours(73)).is_none());
        assert!(select(&db.orbits[&5], at - chrono::Duration::hours(73)).is_none());
        assert!(load_gp(&mut db, b"[]").is_err());
        assert!(load_gp(&mut db, b"bad").is_err());
        assert_eq!(db.orbits[&5].len(), 1);
    }
    #[test]
    fn nearest_historical_epoch() {
        let el = sample();
        let mut later = el.clone();
        later.datetime += chrono::Duration::days(2);
        let mut db = Database::default();
        load_gp(
            &mut db,
            &serde_json::to_vec(&vec![later.clone(), el.clone()]).unwrap(),
        )
        .unwrap();
        assert_eq!(
            select(
                &db.orbits[&5],
                el.datetime.and_utc() + chrono::Duration::hours(2)
            )
            .unwrap()
            .el
            .datetime,
            el.datetime
        );
        assert_eq!(
            select(&db.orbits[&5], later.datetime.and_utc())
                .unwrap()
                .el
                .datetime,
            later.datetime
        );
    }
    #[test]
    fn sidereal_j2000() {
        let t = DateTime::parse_from_rfc3339("2000-01-01T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!((gmst(t).to_degrees() - 280.46061837).abs() < 1e-7);
    }
}
