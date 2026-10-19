//! Textual flight facts only: no third-party photos, biographies or mission patches.
use super::*;
const API: &str = "https://ll.thespacedevs.com/2.3.0/";
fn array(v: &Value) -> &[Value] {
    v.as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn person(c: &Value) -> Value {
    let a = &c["astronaut"];
    json!({"id":a["id"],"name":a["name"],"role":c["role"]["role"],
        "agency":a["agency"]["name"],"agency_abbrev":a["agency"]["abbrev"],
        "affiliation_type":a["type"]["name"],"nationalities":array(&a["nationality"]).iter().map(|n|json!({"name":n["name"],"code":n["alpha_2_code"]})).collect::<Vec<_>>()})
}
fn iss_events(f: &Value) -> Vec<&Value> {
    array(&f["docking_events"])
        .iter()
        .filter(|e| {
            e["space_station_target"]["id"] == 4 || e["docking_location"]["spacestation"]["id"] == 4
        })
        .collect()
}
fn flight(f: &Value) -> Option<Value> {
    let events = iss_events(f);
    let dest = f["destination"].as_str().unwrap_or("").to_lowercase();
    if events.is_empty() && !dest.contains("international space station") && dest != "iss" {
        return None;
    }
    let l = &f["launch"];
    let arrival = events.iter().filter_map(|e| e["docking"].as_str()).min();
    let departure = if events.iter().any(|e| e["departure"].is_null()) {
        None
    } else {
        events.iter().filter_map(|e| e["departure"].as_str()).max()
    };
    let name = l["mission"]["name"]
        .as_str()
        .or(l["name"].as_str())
        .unwrap_or("Vol ISS");
    Some(
        json!({"id":f["id"],"name":name,"url":f["url"],"launch":l["net"],"precision":l["net_precision"]["name"],
      "status":l["status"]["name"],"status_id":l["status"]["id"],"end":f["mission_end"],"arrival":arrival,"departure":departure,
      "rocket":l["rocket"]["configuration"]["full_name"],"spacecraft":f["spacecraft"]["name"],
      "provider":l["launch_service_provider"]["name"],"pad":l["pad"]["name"],"launch_site":l["pad"]["location"]["name"],
      "landing_site":f["landing"]["landing_location"]["name"],"landed":f["landing"]["success"],
      "crew":array(&f["launch_crew"]).iter().map(person).collect::<Vec<_>>(),
      "landing_crew":array(&f["landing_crew"]).iter().map(person).collect::<Vec<_>>() }),
    )
}
fn document(
    station: &Value,
    expedition: &Value,
    raw: &[Value],
    previous: Option<&Value>,
) -> Result<Value, String> {
    if station["id"] != 4 || expedition["spacestation"]["id"] != 4 {
        return Err("Identité de station incorrecte".into());
    }
    let mut flights: BTreeMap<u64, Value> = BTreeMap::new();
    if let Some(p) = previous {
        for f in array(&p["flights"]) {
            if let Some(id) = f["id"].as_u64() {
                flights.insert(id, f.clone());
            }
        }
    }
    for f in raw {
        if let Some(v) = flight(f) {
            if let Some(id) = v["id"].as_u64() {
                flights.insert(id, v);
            }
        }
    }
    let mut flights: Vec<_> = flights.into_values().collect();
    flights.sort_by(|a, b| b["launch"].as_str().cmp(&a["launch"].as_str()));
    let now = Utc::now();
    // Visiting private crews need not belong to the long-duration expedition.
    let active_ids:Vec<_>=array(&station["docking_location"]).iter().filter_map(|p|p["currently_docked"]["flight_vehicle_chaser"]["id"].as_u64()).collect();
    let mut members:BTreeMap<u64,Value>=BTreeMap::new();
    for c in array(&expedition["crew"]).iter().chain(raw.iter().filter(|f|f["id"].as_u64().map(|id|active_ids.contains(&id)).unwrap_or(false)).flat_map(|f|array(&f["launch_crew"]).iter())) {
        if let Some(id)=c["astronaut"]["id"].as_u64(){members.entry(id).or_insert_with(||c.clone());}
    }
    let crew: Vec<_> = members.values()
        .filter(|c| c["astronaut"]["in_space"] == true)
        .map(|c| {
            let mut p = person(c);
            // Latest known ISS arrival flight for this person, never their lifetime flight duration.
            let visit = flights
                .iter()
                .filter(|f| {
                    f["arrival"]
                        .as_str()
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                        .map(|d| d <= now)
                        .unwrap_or(false)
                        && array(&f["crew"]).iter().any(|a| a["id"] == p["id"])
                })
                .max_by_key(|f| f["arrival"].as_str());
            p["arrival"] = visit.map(|f| f["arrival"].clone()).unwrap_or(Value::Null);
            p["mission"] = visit.map(|f| f["name"].clone()).unwrap_or(Value::Null);
            p
        })
        .collect();
    if crew.is_empty() || flights.is_empty() {
        return Err("Réponse missions ou équipage vide ; cache conservé".into());
    }
    Ok(
        json!({"fetched_at":now.to_rfc3339(),"source":"The Space Devs · Launch Library 2","source_url":"https://thespacedevs.com/llapi", "station_url":station["url"],"expedition":expedition["name"],"reported_crew":station["onboard_crew"],"crew":crew,"flights":flights}),
    )
}
pub fn import(dir: &std::path::Path, rawdir: &std::path::Path) -> Result<(), String> {
    let read = |name: &str| -> Result<Value, String> {
        serde_json::from_slice(&std::fs::read(rawdir.join(name)).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())
    };
    let station = read("iss-station.json")?;
    let exp = read("iss-expedition.json")?;
    let first=read("iss-flights-first.json")?;
    let total=first["count"].as_u64().ok_or("Nombre de vols absent")?;
    let mut rows = array(&first["results"]).to_vec();
    for offset in (100..total).step_by(100) {
        rows.extend(
            array(&read(&format!("iss-flights-{offset}.json"))?["results"])
                .iter()
                .cloned(),
        );
    }
    if rows.len() as u64 != total {return Err("Import incomplet : cache conservé".into());}
    let mut doc = document(&station, &exp, &rows, None)?;
    doc["history_complete"] = json!(true);
    sources::atomic(
        dir,
        "iss-missions.json",
        &serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
    )?;
    sources::atomic(
        dir,
        "iss-missions-full.txt",
        Utc::now().timestamp().to_string().as_bytes(),
    )?;
    sources::atomic(
        dir,
        "iss-missions-attempt.txt",
        Utc::now().timestamp().to_string().as_bytes(),
    )
}
pub async fn endpoint() -> Result<Json<Value>, (StatusCode, String)> {
    let dir = PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()));
    let bytes = tokio::fs::read(dir.join("iss-missions.json"))
        .await
        .map_err(|_| {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Missions ISS : première collecte en cours ou source indisponible.".into(),
            )
        })?;
    let v = serde_json::from_slice(&bytes).map_err(|_| {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            "Cache missions illisible".into(),
        )
    })?;
    Ok(Json(v))
}
pub async fn collect(dir: PathBuf, once: bool) {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("Atlas/0.3 (local educational observer; cached flight facts)")
        .build()
        .unwrap();
    loop {
        let now = Utc::now().timestamp();
        let stamp = |name: &str| {
            std::fs::read_to_string(dir.join(name))
                .ok()
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0)
        };
        if now - stamp("iss-missions-attempt.txt") >= 21600 {
            let _ = sources::atomic(&dir, "iss-missions-attempt.txt", now.to_string().as_bytes());
            let result:Result<(),String>=async{
    let station:Value=serde_json::from_slice(&download(&client,&format!("{API}space_stations/4/?format=json")).await?).map_err(|e|e.to_string())?;
    let id=station["active_expeditions"].as_array().and_then(|a|a.first()).and_then(|e|e["id"].as_u64()).ok_or("Expédition courante absente")?;
    let exp:Value=serde_json::from_slice(&download(&client,&format!("{API}expeditions/{id}/?format=json")).await?).map_err(|e|e.to_string())?;
    let previous=std::fs::read(dir.join("iss-missions.json")).ok().and_then(|b|serde_json::from_slice::<Value>(&b).ok());
    let full=previous.is_none() || now-stamp("iss-missions-full.txt")>=7*86400;
    let mut raw=Vec::new();
    let mut reached_end=false;
    // At most 12 requests per refresh, below the public 15/hour quota. No per-visitor calls.
    for page in 0..if full {10}else{1}{
      let v:Value=serde_json::from_slice(&download(&client,&format!("{API}spacecraft_flights/?format=json&mode=detailed&limit=100&offset={}&ordering=-id",page*100)).await?).map_err(|e|e.to_string())?;
      if !v["results"].is_array(){return Err("Liste de vols invalide".into());}
      raw.extend(array(&v["results"]).iter().cloned());
      if v["next"].is_null(){reached_end=true;break;}
    }
    let mut doc=document(&station,&exp,&raw,previous.as_ref())?;
    doc["history_complete"]=json!((full && reached_end) || (!full && previous.as_ref().map(|p|p["history_complete"]==true).unwrap_or(false)));
    sources::atomic(&dir,"iss-missions.json",&serde_json::to_vec(&doc).map_err(|e|e.to_string())?)?;
    if full {sources::atomic(&dir,"iss-missions-full.txt",now.to_string().as_bytes())?;}
    Ok(())
   }.await;
            if let Err(e) = result {
                eprintln!("Missions ISS (cache conservé) : {e}");
            }
        }
        // Serialize public LL2 collectors so a full mission refresh cannot race the EVA history.
        crate::iss_evas::collect(dir.clone(), true).await;
        if once {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_secs(900)).await;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn excludes_non_iss_and_keeps_failed_iss() {
        assert!(flight(&json!({"destination":"Moon"})).is_none());
        assert!(flight(&json!({"id":1,"destination":"International Space Station","launch":{"status":{"id":4}}})).is_some());
    }
    #[test]
    fn current_crew_uses_arrival_and_ignores_future_visits() {
        let a=json!({"id":7,"name":"Test Astronaut","in_space":true,"agency":{"name":"Test Agency","abbrev":"TA"},"nationality":[{"alpha_2_code":"FR"}]});
        let crew=json!({"astronaut":a,"role":{"role":"Commander"}});
        let station=json!({"id":4,"onboard_crew":1});
        let expedition=json!({"spacestation":{"id":4},"crew":[crew.clone(),{"astronaut":{"id":8,"in_space":false}}]});
        let raw=vec![json!({"id":1,"destination":"ISS","launch":{"net":"2020-01-01T00:00:00Z","mission":{"name":"Actual visit"}},"launch_crew":[crew.clone()],"docking_events":[{"space_station_target":{"id":4},"docking":"2020-01-02T00:00:00Z","departure":"2020-01-10T00:00:00Z"},{"space_station_target":{"id":4},"docking":"2020-01-10T01:00:00Z","departure":null}]}),json!({"id":2,"destination":"ISS","launch_crew":[crew],"docking_events":[{"space_station_target":{"id":4},"docking":"2099-01-01T00:00:00Z"}]})];
        let doc=document(&station,&expedition,&raw,None).unwrap();
        assert_eq!(doc["crew"].as_array().unwrap().len(),1);
        assert_eq!(doc["crew"][0]["arrival"],"2020-01-02T00:00:00Z");
        assert_eq!(doc["crew"][0]["mission"],"Actual visit");
        assert_eq!(doc["crew"][0]["nationalities"][0]["code"],"FR");
    }
    #[test]
    fn rejects_wrong_station() {
        assert!(document(&json!({"id":5}), &json!({}), &[], None).is_err());
    }
    #[test]
    fn arrival_uses_only_iss_events() {
        let f=flight(&json!({"id":1,"docking_events":[{"space_station_target":{"id":9},"docking":"2020-01-01T00:00:00Z"},{"space_station_target":{"id":4},"docking":"2021-01-01T00:00:00Z","departure":null}]})).unwrap();
        assert_eq!(f["arrival"], "2021-01-01T00:00:00Z");
        assert!(f["departure"].is_null());
    }
}
