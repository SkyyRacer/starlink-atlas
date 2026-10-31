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
        return at>=time.with_timezone(&Utc) && db.catalog.get(&id).and_then(|v|event_time(v,"DECAY_DATE")).is_none_or(|end|at<end);
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
        // Inertial velocity expressed in the same Earth-fixed axes as the position.
        // This is not the ground-track derivative (do not subtract Earth rotation).
        velocity_inertial_fixed_km_s: if matches!(o.el.norad_id, 5160 | 6398 | 6633 | 7342 | 7591 | 8911 | 10382 | 13138 | 16609 | 25544 | 37820 | 41765 | 48274) {
            let angle = gmst(at);
            Some([p.velocity[0]*angle.cos()+p.velocity[1]*angle.sin(),
                  -p.velocity[0]*angle.sin()+p.velocity[1]*angle.cos(),p.velocity[2]])
        } else { None },
        epoch: o.el.datetime.and_utc().to_rfc3339(),
        age_hours: age / 60.0,
        source: o.source,
    })
}

// WGS84 Earth-fixed position, in kilometres, matching Cesium's geodetic conversion.
fn track_xyz(p: &Point) -> [f64; 3] {
    let lat=p.lat.to_radians();let lon=p.lon.to_radians();
    let n=6378.137/(1.0-6.69437999014e-3*lat.sin().powi(2)).sqrt();
    [(n+p.altitude_km)*lat.cos()*lon.cos(),(n+p.altitude_km)*lat.cos()*lon.sin(),(n*(1.0-6.69437999014e-3)+p.altitude_km)*lat.sin()]
}
// Refine actual SGP4 samples rather than inventing a spline between coarse vertices.
// Only the selected object's orbit pays this cost. A depth cap bounds extreme cases.
pub(crate) fn orbit_track(o:&Orbit,start:DateTime<Utc>,end:DateTime<Utc>)->Vec<(DateTime<Utc>,Point)> {
    fn append(o:&Orbit,a:DateTime<Utc>,xyz:[f64;3],b:DateTime<Utc>,right:Point,depth:u8,out:&mut Vec<(DateTime<Utc>,Point)>) {
        let mid=a+chrono::Duration::milliseconds((b-a).num_milliseconds()/2);
        if depth<8 && mid>a && mid<b {
            if let Some(p)=position(o,mid) {
                let m=track_xyz(&p);let r=track_xyz(&right);let u=(mid-a).num_milliseconds() as f64/(b-a).num_milliseconds() as f64;
                let error=(0..3).map(|i|(m[i]-(xyz[i]+(r[i]-xyz[i])*u)).powi(2)).sum::<f64>().sqrt();
                if error>0.005 {
                    append(o,a,xyz,mid,p,depth+1,out);
                    append(o,mid,m,b,right,depth+1,out);return;
                }
            }
        }
        out.push((b,right));
    }
    let mut out=Vec::new();let span=(end-start).num_milliseconds();
    for i in 0..=120 {
        let t=start+chrono::Duration::milliseconds(span*i/120);
        if let Some(p)=position(o,t) {
            if let Some((a,left))=out.last() {let xyz=track_xyz(left);append(o,*a,xyz,t,p,0,&mut out);}else{out.push((t,p));}
        }
    }
    out
}

// Median of the last real observation of each object, never a fabricated current epoch.
pub(crate) fn recovery_epoch<'a>(rows:impl Iterator<Item=&'a Orbit>,now:DateTime<Utc>)->Option<DateTime<Utc>> {
    let mut latest=std::collections::BTreeMap::new();
    for row in rows {let epoch=row.el.datetime.and_utc();if epoch<=now {latest.entry(row.el.norad_id).and_modify(|v:&mut DateTime<Utc>|*v=(*v).max(epoch)).or_insert(epoch);}}
    let mut dates:Vec<_>=latest.into_values().collect();if dates.is_empty(){return None;}
    let mid=dates.len()/2;dates.select_nth_unstable(mid);Some(dates[mid])
}

#[cfg(test)]
mod track_tests {
    use super::*;
    #[test]
    fn station_attitude_velocity_matches_orbit() {
        let rows:Vec<Value>=serde_json::from_str(include_str!("../resources/iss-example.json")).unwrap();
        for id in [5160,6398,6633,7342,7591,8911,10382,13138,16609,25544,37820,41765,48274,12345] {
            let mut row=rows[0].clone();row["NORAD_CAT_ID"]=serde_json::json!(id);
            let el:sgp4::Elements=serde_json::from_value(row).unwrap();let constants=sgp4::Constants::from_elements(&el).unwrap();let at=el.datetime.and_utc()+chrono::Duration::minutes(30);
            let o=Orbit{el,constants,source:"Test"};let point=position(&o,at).unwrap();
            if id==12345 {assert!(point.velocity_inertial_fixed_km_s.is_none());continue;}
            let actual=point.velocity_inertial_fixed_km_s.unwrap();let raw=o.constants.propagate(sgp4::MinutesSinceEpoch(30.0)).unwrap();let angle=gmst(at);
            let expected=[raw.velocity[0]*angle.cos()+raw.velocity[1]*angle.sin(),-raw.velocity[0]*angle.sin()+raw.velocity[1]*angle.cos(),raw.velocity[2]];
            for i in 0..3 {assert!((actual[i]-expected[i]).abs()<1e-10);}
        }
    }
    #[test]
    fn adaptive_tracks_preserve_sgp4_and_resolve_curvature() {
        let rows:Vec<Value>=serde_json::from_str(include_str!("../resources/iss-example.json")).unwrap();
        for (motion,eccentricity) in [(15.48879905,0.00067551),(2.0,0.7)] {
            let mut row=rows[0].clone();row["MEAN_MOTION"]=serde_json::json!(motion);row["ECCENTRICITY"]=serde_json::json!(eccentricity);
            let el:sgp4::Elements=serde_json::from_value(row).unwrap();let constants=sgp4::Constants::from_elements(&el).unwrap();let at=el.datetime.and_utc();
            let o=Orbit{el,constants,source:"Test"};let end=at+chrono::Duration::milliseconds((86400000.0/motion) as i64);
            let track=orbit_track(&o,at,end);assert!(track.len()>120);assert!(track.len()<=30721);assert_eq!(track.first().unwrap().0,at);assert_eq!(track.last().unwrap().0,end);
            for pair in track.windows(2) {
                let (a,p)=&pair[0];let (b,q)=&pair[1];assert!(b>a);
                let mid=*a+chrono::Duration::milliseconds((*b-*a).num_milliseconds()/2);
                let actual=track_xyz(&position(&o,mid).unwrap());let left=track_xyz(p);let right=track_xyz(q);let u=(mid-*a).num_milliseconds() as f64/(*b-*a).num_milliseconds() as f64;
                let error=(0..3).map(|i|(actual[i]-(left[i]+(right[i]-left[i])*u)).powi(2)).sum::<f64>().sqrt();
                assert!(error<=0.0051,"{} m deviation",error*1000.0);
                let original=position(&o,*b).unwrap();assert_eq!(q.lat,original.lat);assert_eq!(q.lon,original.lon);assert_eq!(q.altitude_km,original.altitude_km);
            }
        }
    }
}
