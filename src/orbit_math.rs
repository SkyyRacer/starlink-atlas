//! Shared orbital calculations used by the server and browser WebAssembly.
use super::{Database, Orbit, Point, MAX_AGE};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value;
pub(crate) fn event_time(v: &Value, key: &str) -> Option<DateTime<Utc>> {
    let s = v[key].as_str()?;
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&Utc))
        .or_else(|| {
            NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .ok()
                .map(|d| d.and_hms_opt(0, 0, 0).unwrap().and_utc())
        })
}
pub(crate) fn exists(v: Option<&Value>, at: DateTime<Utc>) -> bool {
    v.map(|v| {
        event_time(v, "LAUNCH_DATE").is_none_or(|d| at >= d)
            && event_time(v, "DECAY_DATE").is_none_or(|d| at < d)
    })
    .unwrap_or(true)
}
pub(crate) fn exists_in_db(db: &Database, id: u64, at: DateTime<Utc>) -> bool {
    if let Some(time) = db
        .gcat
        .get(&id)
        .and_then(|v| v["launch_time"].as_str())
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
    {
        if at < time.with_timezone(&Utc) {
            return false;
        }
    }
    exists(db.catalog.get(&id), at)
}
pub(crate) fn select(list: &[Orbit], at: DateTime<Utc>) -> Option<&Orbit> {
    list.iter()
        .filter(|o| {
            let age = (at.naive_utc() - o.el.datetime).num_seconds();
            if o.source == "CelesTrak SupGP / SpaceX" {
                (0..=86400).contains(&age)
            } else {
                age.abs() <= MAX_AGE
            }
        })
        .min_by_key(|o| (at.naive_utc() - o.el.datetime).num_seconds().abs())
}
pub(crate) fn select_sources<'a>(
    current: Option<&'a Vec<Orbit>>,
    historic: Option<&'a Vec<Orbit>>,
    at: DateTime<Utc>,
) -> Option<&'a Orbit> {
    current
        .and_then(|v| select(v, at))
        .into_iter()
        .chain(historic.and_then(|v| select(v, at)))
        .min_by_key(|o| (at.naive_utc() - o.el.datetime).num_seconds().abs())
}
pub(crate) fn gmst(at: DateTime<Utc>) -> f64 {
    let jd = at.timestamp_millis() as f64 / 86400000.0 + 2440587.5;
    let t = (jd - 2451545.0) / 36525.0;
    (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t
        - t * t * t / 38710000.0)
        .to_radians()
        .rem_euclid(std::f64::consts::TAU)
}
pub(crate) fn geodetic(p: [f64; 3], theta: f64) -> (f64, f64, f64) {
    let lon = (p[1].atan2(p[0]) - theta + std::f64::consts::PI).rem_euclid(std::f64::consts::TAU)
        - std::f64::consts::PI;
    let r = p[0].hypot(p[1]);
    let e2 = 6.69437999014e-3;
    let mut lat = p[2].atan2(r);
    let mut n = 6378.137;
    for _ in 0..8 {
        n = 6378.137 / (1.0 - e2 * lat.sin().powi(2)).sqrt();
        lat = (p[2] + n * e2 * lat.sin()).atan2(r);
    }
    let h = if lat.cos().abs() > 1e-8 {
        r / lat.cos() - n
    } else {
        p[2].abs() - 6356.752314
    };
    (lat.to_degrees(), lon.to_degrees(), h)
}
pub(crate) fn position(o: &Orbit, at: DateTime<Utc>) -> Option<Point> {
    let age = (at.naive_utc() - o.el.datetime).num_milliseconds() as f64 / 60000.0;
    if age.abs() > MAX_AGE as f64 / 60.0
        || (o.source == "CelesTrak SupGP / SpaceX" && !(0.0..=1440.0).contains(&age))
    {
        return None;
    }
    let p = o.constants.propagate(sgp4::MinutesSinceEpoch(age)).ok()?;
    let (lat, lon, altitude_km) = geodetic(p.position, gmst(at));
    if altitude_km < 0.0 || !altitude_km.is_finite() {
        return None;
    }
    Some(Point {
        id: o.el.norad_id,
        lat,
        lon,
        altitude_km,
        speed_km_s: p.velocity.iter().map(|v| v * v).sum::<f64>().sqrt(),
        epoch: o.el.datetime.and_utc().to_rfc3339(),
        age_hours: age / 60.0,
        source: o.source,
    })
}

// Median of the last real observation of each object, never a fabricated current epoch.
pub(crate) fn recovery_epoch<'a>(rows:impl Iterator<Item=&'a Orbit>,now:DateTime<Utc>)->Option<DateTime<Utc>> {
    let mut latest=std::collections::BTreeMap::new();
    for row in rows {let epoch=row.el.datetime.and_utc();if epoch<=now {latest.entry(row.el.norad_id).and_modify(|v:&mut DateTime<Utc>|*v=(*v).max(epoch)).or_insert(epoch);}}
    let mut dates:Vec<_>=latest.into_values().collect();if dates.is_empty(){return None;}
    let mid=dates.len()/2;dates.select_nth_unstable(mid);Some(dates[mid])
}
