mod history;
mod mission_lifetimes;
mod collection_health;
mod secondary;
mod news;
mod collections;
mod galileo;
mod gps;
mod constellations;
mod ephemeris;
mod debris;
mod csv_data;
mod iss;
mod iss_missions;
mod iss_evas;
mod orbit_math;
mod snapshots;
mod sources;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use orbit_math::*;
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
    collection: Option<String>,
}
#[derive(Serialize)]
struct Point {
    id: u64,
    lat: f64,
    lon: f64,
    altitude_km: f64,
    speed_km_s: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    velocity_inertial_fixed_km_s: Option<[f64; 3]>,
    epoch: String,
    age_hours: f64,
    source: &'static str,
}
fn load_gp(db: &mut Database, bytes: &[u8]) -> Result<usize, String> {
    if !bytes.windows(b"\"ATLAS_SOURCE\"".len()).any(|w|w==b"\"ATLAS_SOURCE\""){return load_gp_source(db,bytes,"CelesTrak GP / Space-Track");}
    let rows:Vec<Value>=serde_json::from_slice(bytes).map_err(|e|e.to_string())?;
    if rows.is_empty(){return Err("Aucun élément orbital pris en charge".into());}
    let mut groups:BTreeMap<&'static str,Vec<Value>>=BTreeMap::new();
    for row in rows{let source=match row["ATLAS_SOURCE"].as_str(){Some("SatNOGS / Space-Track")=>constellations::BACKUP_SOURCE,Some("N2YO / Space-Track")=>constellations::TRACKER_SOURCE,Some("SatNOGS / CelesTrak")=>secondary::SATNOGS_CELESTRAK,Some("SatNOGS / autre fournisseur")=>secondary::SATNOGS_OTHER,Some("KeepTrack / fournisseurs multiples")=>secondary::KEEPTRACK,_=>"CelesTrak GP / Space-Track"};groups.entry(source).or_default().push(row);}
    let mut count=0;for (source,rows) in groups{count+=load_gp_source(db,&serde_json::to_vec(&rows).map_err(|e|e.to_string())?,source)?;}Ok(count)
}
fn load_gp_source(db: &mut Database, bytes: &[u8], source: &'static str) -> Result<usize, String> {
    load_gp_source_for(db, bytes, source, false)
}
fn load_gp_source_for(db: &mut Database, bytes: &[u8], source: &'static str, iss_only: bool) -> Result<usize, String> {
    let els: Vec<sgp4::Elements> = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    let mut parsed = Vec::new();
    for el in els {
        if collections::requires_ephemeris(el.norad_id){continue;}
        if iss_only && el.norad_id != 25544 { continue; }
        if collections::family(el.norad_id,el.object_name.as_deref().unwrap_or("")).is_none() && !db.catalog.get(&el.norad_id).is_some_and(debris::is_debris) { continue; }
        let constants = sgp4::Constants::from_elements(&el).map_err(|e| e.to_string())?;
        parsed.push(Orbit {
            el,
            constants,
            source,
        });
    }
    if parsed.is_empty() && !iss_only {
        return Err("Aucun élément orbital pris en charge".into());
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
        .filter(|v| (debris::is_debris(v) || collections::family(v["NORAD_CAT_ID"].as_u64().unwrap_or(0),v["OBJECT_NAME"].as_str().unwrap_or("")).is_some()))
        .collect();
    if rows.is_empty() {
        return Err("Catalogue vide".into());
    }
    for mut v in rows {
        mission_lifetimes::normalize(&mut v);
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
#[derive(Default, Deserialize)]
struct CollectionQuery { collection: Option<String> }
fn object_family(db: &Database, id: u64) -> &'static str {
    if db.catalog.get(&id).is_some_and(debris::is_debris) { return "debris"; }
    let name=db.catalog.get(&id).and_then(|row|row["OBJECT_NAME"].as_str()).or_else(||db.orbits.get(&id).and_then(|rows|rows.last()).and_then(|orbit|orbit.el.object_name.as_deref())).unwrap_or("");
    collections::family(id,name).unwrap_or("starlink")
}
fn object_collections(db:&Database,id:u64)->Vec<&'static str> {
    if object_family(db,id)=="debris" { return vec!["debris"]; }
    let name=db.catalog.get(&id).and_then(|r|r["OBJECT_NAME"].as_str()).or_else(||db.orbits.get(&id).and_then(|rows|rows.last()).and_then(|o|o.el.object_name.as_deref())).unwrap_or("");
    collections::memberships(id,name)
}
fn in_collection(db: &Database, id: u64, collection: &str) -> bool {
    if collection=="all" || collections::definition(collection).is_none() || object_family(db,id)==collection {return true;}
    object_collections(db,id).contains(&collection)
}
async fn catalog(State(s): State<Shared>, Query(q): Query<CollectionQuery>) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let db = s.read().await;
    if db.catalog.is_empty() && db.orbits.is_empty() {
        return Err((StatusCode::SERVICE_UNAVAILABLE, "Première collecte en cours".into()));
    }
    let document = snapshots::catalog(&db, q.collection.as_deref().unwrap_or("all"));
    Ok(([(axum::http::header::CONTENT_TYPE, "application/json")], document))
}
fn orbit_info(db:&Database,id:u64)->Option<Value>{
    if let Some(el)=db.orbits.get(&id).and_then(|rows|rows.last()).map(|o|&o.el){
        return Some(json!({"mean_motion":el.mean_motion,"eccentricity":el.eccentricity,"inclination":el.inclination,"epoch":el.datetime}));
    }
    let row=db.catalog.get(&id)?;
    let number=|key:&str|row[key].as_f64().or_else(||row[key].as_str().and_then(|s|s.parse::<f64>().ok()));
    let (perigee,apogee)=(number("PERIGEE")?,number("APOGEE")?);
    Some(json!({"perigee_km":perigee,"apogee_km":apogee,"period_minutes":number("PERIOD"),"inclination":number("INCLINATION")}))
}
async fn satellite_detail(State(s): State<Shared>, Query(q): Query<Q>) -> Result<Json<Value>, (StatusCode, String)> {
    let id = q.id.ok_or((StatusCode::BAD_REQUEST, "Identifiant requis".into()))?;
    let db = match q.snapshot.as_deref() {
        Some(key) => snapshots::get(key).ok_or((StatusCode::GONE, "Édition expirée : rechargez la page".into()))?,
        None => snapshots::capture(&*s.read().await).1,
    };
    Ok(Json(json!({"launch_site":db.catalog.get(&id).and_then(|row|row.get("LAUNCH_SITE")),"verification":db.gcat.get(&id),"orbit":orbit_info(&db,id),"orbit_check":secondary::checks_document(&PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into())))["objects"][id.to_string()]})))
}
fn catalog_document(db: &Database, snapshot: &str) -> Value {
    catalog_for(db, snapshot, "all")
}
fn catalog_for(db: &Database, snapshot: &str, collection: &str) -> Value {
    let mut rows = BTreeMap::new();
    for (id, v) in &db.catalog {
        if !in_collection(&db, *id, collection) { continue; }
        rows.insert(*id,json!({"id":id,"name":v["OBJECT_NAME"],"family":object_family(db,*id),"collections":object_collections(db,*id),"designator":v["OBJECT_ID"],"launch":db.gcat.get(id).map(|g|g["launch_time"].clone()).unwrap_or_else(||v["LAUNCH_DATE"].clone()),"decay":v["DECAY_DATE"],"ops":v["OPS_STATUS_CODE"],"object_type":v["OBJECT_TYPE"],"owner":v["OWNER"],"verification":db.gcat.get(id)}));
    }
    for (id, list) in &db.orbits {
        if !in_collection(&db, *id, collection) { continue; }
        let e = &list.last().unwrap().el;
        rows.entry(*id).or_insert(json!({"id":id,"name":e.object_name,"family":object_family(db,*id),"collections":object_collections(db,*id),"designator":e.international_designator,"launch":null,"decay":null,"ops":null}));
    }
    let min = db
        .orbits
        .iter()
        .filter(|(id, _)| in_collection(&db, **id, collection))
        .flat_map(|(_, v)| v.iter())
        .map(|o| o.el.datetime)
        .min();
    let max = db
        .orbits
        .iter()
        .filter(|(id, _)| in_collection(&db, **id, collection))
        .flat_map(|(_, v)| v.iter())
        .map(|o| o.el.datetime)
        .max();
    let history=history::info();
    json!({"snapshot":snapshot,"satellites":rows.values().collect::<Vec<_>>(),"message":db.message,"fetched":db.fetched,"first_epoch":min,"last_epoch":max,"max_age_hours":72,"source":collections::source(collection).unwrap_or_else(||GP.to_owned()),"history":history})
}
async fn positions(
    State(s): State<Shared>,
    Query(q): Query<Q>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let at = query_time(&q)?;
    let collection = q.collection.as_deref().unwrap_or("all");
    let db = match q.snapshot.as_deref() {
        Some(id) => snapshots::get(id).ok_or((StatusCode::GONE, "Cette édition des données a expiré. Rechargez la page pour charger les dernières données.".into()))?,
        None => snapshots::capture(&*s.read().await).1,
    };
    let allowed:std::collections::BTreeSet<u64>=db.catalog.keys().chain(db.orbits.keys()).copied().filter(|id|in_collection(&db,*id,collection)).collect();
    if collections::definition(collection).is_some_and(|d|d.trajectory.is_some()) || (collection!="all" && !allowed.is_empty() && allowed.iter().all(|id|!exists_in_db(&db,*id,at))) {
        return Ok(Json(json!({"at":at,"points":[],"missing":allowed.len(),"track":[],"future_track":[],"track_3d":[],"future_track_3d":[],"suggested_at":null,"recovery_at":null})));
    }
    let historical = history::orbits(at, collection, &allowed).await.map_err(|e| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            format!("Archive historique invalide : {e}"),
        )
    })?;
    let mut points = Vec::new();
    let mut missing = 0;
    let ids: std::collections::BTreeSet<_> =
        db.orbits.keys().chain(historical.keys()).copied().filter(|id| in_collection(&db, *id, collection)).collect();
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
        .filter(|(id, _v)| in_collection(&db, **id, collection) && !ids.contains(id) && exists_in_db(&db, **id, at))
        .count();
    let suggested_at = if points.is_empty() {
        let now = Utc::now();
        db.orbits
            .iter()
            .filter(|(id, _)| in_collection(&db, **id, collection))
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
    let recovery_at=if missing>points.len() {recovery_epoch(db.orbits.iter().filter(|(id,_)|in_collection(&db,**id,collection)).flat_map(|(_,rows)|rows.iter()),Utc::now()).filter(|date|(*date-at).num_seconds().abs()>60)}else{None};
    let mut track = Vec::new();
    let mut future_track = Vec::new();
    let mut track_3d = Vec::new();
    let mut future_track_3d = Vec::new();
    if let Some(id) = q.id.filter(|id| in_collection(&db, *id, collection)) {
        if exists_in_db(&db, id, at) {
            if let Some(o) = select_sources(db.orbits.get(&id), historical.get(&id), at) {
                // Same orbital elements for past and predicted path; the timeline still rejects future dates.
                let period=chrono::Duration::milliseconds((86400000.0/o.el.mean_motion).round() as i64);
                for (t,p) in orbit_track(o,at-period,at) {if exists_in_db(&db,id,t){track.push(json!([p.lat,p.lon]));track_3d.push(json!([p.lat,p.lon,p.altitude_km]));}}
                for (t,p) in orbit_track(o,at,at+period) {if !exists_in_db(&db,id,t){break;}future_track.push(json!([p.lat,p.lon]));future_track_3d.push(json!([p.lat,p.lon,p.altitude_km]));}
            }
        }
    }
    Ok(Json(
        json!({"at":at,"points":points,"missing":missing,"track":track,"future_track":future_track,"track_3d":track_3d,"future_track_3d":future_track_3d,"suggested_at":suggested_at,"recovery_at":recovery_at}),
    ))
}
fn download_error(status:u16,retry_after:Option<&str>,url:&str)->String {
    if reqwest::Url::parse(url).ok().is_some_and(|u|u.host_str()==Some("celestrak.org")) {
        return format!("CelesTrak HTTP {status} : collecte suspendue, données de secours conservées · {url}");
    }
    let wait=retry_after.and_then(|v|v.parse::<i64>().ok().or_else(||chrono::DateTime::parse_from_rfc2822(v).ok().map(|at|(at.with_timezone(&Utc)-Utc::now()).num_seconds().max(0)))).unwrap_or(0);
    format!("HTTP {status} : source indisponible retry_after_seconds={wait}")
}
async fn download(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let celestrak=reqwest::Url::parse(url).ok().is_some_and(|u|u.host_str()==Some("celestrak.org"));
    let provider_stop=PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into())).join("celestrak-stopped.txt");
    if celestrak {if let Ok(error)=std::fs::read_to_string(&provider_stop){return Err(error);}}
    let r = client.get(url).send().await.map_err(|e| format!("Réseau temporaire : {e}"))?;
    if r.status() != StatusCode::OK {
        let error=download_error(r.status().as_u16(),r.headers().get("retry-after").and_then(|v|v.to_str().ok()),url);
        if celestrak {let _=std::fs::write(provider_stop,&error);}
        return Err(error);
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
        .redirect(reqwest::redirect::Policy::none()).connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .unwrap();
    loop {
        let now=Utc::now().timestamp();
        if !collection_health::due(&dir,"collection",now,7200) {
            if once{return;}
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;continue;
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
            sources::atomic(&dir,&format!("gp-{now}.json"),&bytes)?;
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
            collection_health::finish(&dir,"collection",Some(&e));
            let retry=collection_health::temporary(&e);
            s.write().await.message=if retry {format!("Source temporairement inaccessible · cache conservé · nouvelle tentative automatique : {e}")} else {e};
            if once || !retry{return;}
            continue;
        }
        collection_health::finish(&dir,"collection",None);
        if once {return;}
    }
}
async fn config() -> Json<Value> {
    Json(
        json!({"tile_url":std::env::var("TILE_URL").unwrap_or("https://tile.openstreetmap.org/{z}/{x}/{y}.png".into()),"tile_attribution":std::env::var("TILE_ATTRIBUTION").unwrap_or("© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors · ODbL".into())}),
    )
}
async fn observation_page(uri: axum::http::Uri) -> Result<axum::response::Html<String>, StatusCode> {
    let (mode, title) = match uri.path() {
        "/atlas" => ("all", "Atlas — Tous les satellites"),
        "/iss" => ("iss", "ISS — Station spatiale internationale"),
        "/galileo" => ("galileo", "Galileo — Navigation européenne"),
        "/gps" => ("gps", "GPS — Navigation américaine"),
        _ => collections::definition(uri.path().trim_matches('/')).map(|d|(d.id.as_str(),d.label.as_str())).unwrap_or(("starlink", "Starlink — Observatoire orbital")),
    };
    let title=collections::definition(mode).map(|row|format!("{} — {}",row.label,row.description)).unwrap_or_else(||title.to_owned());
    let html = tokio::fs::read_to_string("static/index.html").await.map_err(|_|StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(axum::response::Html(html.replace("<title>Starlink Atlas — Observatoire orbital</title>", &format!("<title>{title}</title>"))
        .replace("<body>", &format!("<body data-collection=\"{mode}\">"))))
}

fn is_fresh_entrypoint(path: &str) -> bool {
    collections::definition(path.trim_matches('/')).is_some() || matches!(path, "/" | "/index.html" | "/atlas" | "/atlas/" | "/iss" | "/iss/" | "/starlink" | "/starlink/" | "/galileo" | "/galileo/" | "/gps" | "/gps/" | "/loading.js" | "/asset-cache.js" | "/asset-sw.js")
}
async fn fresh_entrypoints(request: axum::extract::Request, next: axum::middleware::Next) -> axum::response::Response {
    let fresh = is_fresh_entrypoint(request.uri().path());
    let mut response = next.run(request).await;
    if fresh { response.headers_mut().insert(axum::http::header::CACHE_CONTROL, axum::http::HeaderValue::from_static("no-store")); }
    response
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dir = PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()));
    std::fs::create_dir_all(&dir)?;
    let args: Vec<String> = std::env::args().collect();
    if args.len()==3 && args[1]=="--import-tle-backup"{
        let rows:Vec<Value>=serde_json::from_slice(&std::fs::read(&args[2])?)?;
        let bytes=constellations::parse_backup(&rows).map_err(std::io::Error::other)?;
        let mut db=Database::default();let count=load_gp(&mut db,&bytes).map_err(std::io::Error::other)?;
        sources::atomic(&dir,&format!("gp-backup-experimental-{}.json",Utc::now().timestamp()),&bytes).map_err(std::io::Error::other)?;
        println!("{count} éléments orbitaux importés avec leur provenance");return Ok(());
    }
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
    debris::load_cache(&mut db, &dir);
    if let Ok(bytes)=std::fs::read(dir.join("secondary-catalog.json")){if let Err(error)=load_cat(&mut db,&bytes){eprintln!("Métadonnées secondaires : {error}");}}
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
    if args.len() == 3 && args[1] == "--import-iss-evas" {
        iss_evas::import(&dir, std::path::Path::new(&args[2])).map_err(std::io::Error::other)?;
        return Ok(());
    }
    if args.len()==3 && args[1]=="--import-tiangong-missions" {iss_missions::import_for(18,&dir,std::path::Path::new(&args[2])).map_err(std::io::Error::other)?;return Ok(());}
    if args.len() == 3 && args[1] == "--import-iss-missions" {
        iss_missions::import(&dir, std::path::Path::new(&args[2]))
            .map_err(std::io::Error::other)?;
        return Ok(());
    }
    iss::load_cache(&mut db, &dir);
    galileo::load_cache(&mut db, &dir);
    gps::load_cache(&mut db, &dir);
    constellations::load_cache(&mut db, &dir);
    secondary::load_metadata(&mut db,&dir);
    db.fetched = std::fs::read_to_string(dir.join("fetched.txt")).ok();
    secondary::restore_freshness(&mut db,&dir);
    news::update(&dir,&db).map_err(std::io::Error::other)?;
    if args.len() == 3 && args[1] == "--export-web" {
        let target = PathBuf::from(&args[2]);
        std::fs::create_dir_all(&target)?;
        let rows: Vec<_> = db
            .orbits
            .values()
            .flat_map(|rows| {
                rows.iter()
                    .map(|o| json!({"elements":o.el,"source":o.source}))
            })
            .collect();
        let bundle = json!({"catalog_response":catalog_document(&db,"browser-edition"),"raw_catalog":db.catalog.values().collect::<Vec<_>>(),"gcat":db.gcat,"orbits":rows,"config":config().await.0,"sources":sources::status().await.0,"news":news::document(&dir),"orbit_checks":secondary::checks_document(&dir)});
        std::fs::write(target.join("bundle.json"), serde_json::to_vec(&bundle)?)?;
        println!("Export navigateur : {} satellites", db.catalog.len());
        return Ok(());
    }
    let shared = Arc::new(RwLock::new(db));
    if args.len()==2 && args[1]=="--collect-secondary-once"{secondary::collect(shared.clone(),dir.clone(),true).await;news::update(&dir,&*shared.read().await).map_err(std::io::Error::other)?;return Ok(());}
    if args.len() == 2 && args[1] == "--collect-once" {
        secondary::collect(shared.clone(),dir.clone(),true).await;
        refresh(shared.clone(), dir.clone(), true).await;
        iss::collect(shared.clone(), dir.clone(), true).await;
        galileo::collect(shared.clone(), dir.clone(), true).await;
        gps::collect(shared.clone(), dir.clone(), true).await;
        constellations::collect(shared.clone(), dir.clone(), true).await;
        ephemeris::collect(true).await;
        debris::collect(shared.clone(), dir.clone(), true).await;
        iss_missions::collect(dir.clone(), true).await;
        sources::collect(shared, dir, true).await;
        return Ok(());
    }
    tokio::spawn(news::watch(shared.clone(),dir.clone()));
    if std::env::var("OFFLINE").as_deref() != Ok("1") {
        tokio::spawn(secondary::collect(shared.clone(),dir.clone(),false));
        tokio::spawn(refresh(shared.clone(), dir.clone(), false));
        tokio::spawn(sources::collect(shared.clone(), dir.clone(), false));
        tokio::spawn(iss_missions::collect(dir.clone(), false));
        tokio::spawn(iss::collect(shared.clone(), dir.clone(), false));
        tokio::spawn(galileo::collect(shared.clone(), dir.clone(), false));
        tokio::spawn(gps::collect(shared.clone(), dir.clone(), false));
        tokio::spawn(constellations::collect(shared.clone(), dir.clone(), false));
        tokio::spawn(ephemeris::collect(false));
        tokio::spawn(debris::collect(shared.clone(), dir, false));
    } else {
        shared.write().await.message = "Mode hors ligne : archives locales uniquement".into();
    }
    let mut app = Router::new();
    for def in collections::definitions().iter().filter(|d|!["starlink","iss","gps","galileo"].contains(&d.id.as_str())) {
        app=app.route(&format!("/{}",def.id),get(observation_page)).route(&format!("/{}/",def.id),get(|uri: axum::http::Uri|async move{axum::response::Redirect::permanent(uri.path().trim_end_matches('/'))}));
    }
    let app = app
        .route("/", get(|| async { axum::response::Redirect::temporary("/atlas") }))
        .route("/atlas", get(observation_page))
        .route("/iss", get(observation_page))
        .route("/starlink", get(observation_page))
        .route("/galileo", get(observation_page))
        .route("/gps", get(observation_page))
        .route("/atlas/", get(|| async { axum::response::Redirect::permanent("/atlas") }))
        .route("/iss/", get(|| async { axum::response::Redirect::permanent("/iss") }))
        .route("/starlink/", get(|| async { axum::response::Redirect::permanent("/starlink") }))
        .route("/gps/", get(|| async { axum::response::Redirect::permanent("/gps") }))
        .route("/galileo/", get(|| async { axum::response::Redirect::permanent("/galileo") }))
        .route("/api/news",get(news::endpoint))
        .route("/api/config", get(config))
        .route("/api/iss-missions", get(iss_missions::endpoint))
        .route("/api/tiangong-missions",get(iss_missions::tiangong_endpoint))
        .route("/api/iss-evas", get(iss_evas::endpoint))
        .route("/api/tiangong-evas",get(iss_evas::endpoint))
        .route("/api/sources", get(sources::status))
        .route("/api/catalog", get(catalog))
        .route("/api/satellite", get(satellite_detail))
        .route("/api/positions", get(positions))
        .with_state(shared)
        .fallback_service(ServeDir::new("static"))
        .layer(CompressionLayer::new())
        .layer(axum::middleware::from_fn(fresh_entrypoints));
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
    fn recovery_uses_real_past_observations_without_duplicate_bias() {
        let mut db=Database::default();load_gp(&mut db,include_bytes!("../resources/iss-example.json")).unwrap();
        let template=db.orbits.values().next().unwrap()[0].clone();let now=Utc::now();let mut rows=Vec::new();
        for (id,hours) in [(1,96),(2,72),(3,48),(1,-24),(2,1000),(2,1001)] {
            let mut row=template.clone();row.el.norad_id=id;row.el.datetime=(now-chrono::Duration::hours(hours)).naive_utc();rows.push(row);
        }
        assert_eq!(recovery_epoch(rows.iter(),now),Some(now-chrono::Duration::hours(72)));
        assert!(recovery_epoch(std::iter::empty(),now).is_none());
    }
    #[test]
    fn rate_limit_response_preserves_provider_wait() {
        let error=download_error(429,Some("10800"),"https://provider.invalid/data");
        assert!(collection_health::temporary(&error));assert!(error.contains("retry_after_seconds=10800"));
        let error=download_error(503,None,"https://celestrak.org/NORAD/elements/gp.php");
        assert!(!collection_health::temporary(&error),"CelesTrak HTTP errors suspend the provider, backup collectors remain independent");
        assert!(download_error(503,Some("Thu, 01 Jan 1970 00:00:00 GMT"),"https://provider.invalid/data").contains("retry_after_seconds=0"));
    }
    #[test]
    fn scoped_catalogues_keep_iss_separate() {
        let mut db = Database::default();
        db.catalog.insert(25544, json!({"OBJECT_NAME":"ISS"}));
        db.catalog.insert(12345, json!({"OBJECT_NAME":"STARLINK-TEST"}));
        assert_eq!(catalog_for(&db, "test", "all")["satellites"].as_array().unwrap().len(), 2);
        for (collection, expected) in [("iss", 25544), ("starlink", 12345)] {
            let document = catalog_for(&db, "test", collection);
            assert_eq!(document["satellites"].as_array().unwrap().len(), 1);
            assert_eq!(document["satellites"][0]["id"], expected);
        }
    }
    #[test]
    fn iss_history_filter_preserves_exact_orbital_solution() {
        let mut rows: Vec<Value> = serde_json::from_slice(include_bytes!("../resources/iss-example.json")).unwrap();
        let mut other = rows[0].clone();
        other["NORAD_CAT_ID"] = json!(12345);
        other["OBJECT_NAME"] = json!("STARLINK-TEST");
        rows.push(other);
        let bytes = serde_json::to_vec(&rows).unwrap();
        let mut all = Database::default(); let mut station = Database::default();
        load_gp_source_for(&mut all, &bytes, "test", false).unwrap();
        load_gp_source_for(&mut station, &bytes, "test", true).unwrap();
        assert_eq!(all.orbits.len(), 2); assert_eq!(station.orbits.len(), 1);
        let a = &all.orbits[&25544][0]; let b = &station.orbits[&25544][0];
        let at = a.el.datetime.and_utc() + chrono::Duration::minutes(20);
        assert_eq!(serde_json::to_value(position(a, at).unwrap()).unwrap(), serde_json::to_value(position(b, at).unwrap()).unwrap());
    }
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
            collection: None,
            at: Some((Utc::now() + chrono::Duration::hours(1)).to_rfc3339()),
            id: None
        })
        .is_err());
        assert!(query_time(&Q {
            snapshot: None,
            collection: None,
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
