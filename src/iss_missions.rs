//! Textual flight facts only: no third-party photos, biographies or mission patches.
use super::*;
const API: &str = "https://ll.thespacedevs.com/2.3.0/";
fn array(v: &Value) -> &[Value] {
    v.as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn person(c: &Value) -> Value {
    let a = &c["astronaut"];
    json!({"id":a["id"],"name":a["name"],"family_name":a["last_name"].as_str().map(str::to_owned).or_else(||array(&a["nationality"]).iter().any(|n|n["alpha_2_code"]=="CN").then(||a["name"].as_str().unwrap_or("").split_whitespace().next().unwrap_or("").to_owned())),"role":c["role"]["role"],
        "agency":a["agency"]["name"],"agency_abbrev":a["agency"]["abbrev"],
        "time_in_space":a["time_in_space"],"eva_time":a["eva_time"],"flights_count":a["flights_count"],"affiliation_type":a["type"]["name"],"nationalities":array(&a["nationality"]).iter().map(|n|json!({"name":n["name"],"code":n["alpha_2_code"]})).collect::<Vec<_>>()})
}
fn station_events(target:u64,f: &Value) -> Vec<&Value> {
    array(&f["docking_events"])
        .iter()
        .filter(|e| {
            e["space_station_target"]["id"] == target || e["docking_location"]["spacestation"]["id"] == target
        })
        .collect()
}
fn flight_for(target:u64,f: &Value) -> Option<Value> {
    let events = station_events(target,f);
    let dest = f["destination"].as_str().unwrap_or("").to_lowercase();
    if events.is_empty() && !(if target==4 {dest.contains("international space station") || dest=="iss"} else {dest.contains("tiangong space station")}) {
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
        .unwrap_or(if target==4 {"Vol ISS"} else {"Vol Tiangong"});
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
fn document_for(target:u64,
    station: &Value,
    expedition: &Value,
    raw: &[Value],
    previous: Option<&Value>,
) -> Result<Value, String> {
    if station["id"] != target || expedition["spacestation"]["id"] != target {
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
        if let Some(v) = flight_for(target,f) {
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
        json!({"fetched_at":now.to_rfc3339(),"source":"The Space Devs · Launch Library 2","station_id":target,"source_url":"https://thespacedevs.com/llapi", "station_url":station["url"],"expedition":expedition["name"],"reported_crew":station["onboard_crew"],"crew":crew,"flights":flights}),
    )
}
pub fn import_for(target:u64,dir: &std::path::Path, rawdir: &std::path::Path) -> Result<(), String> {
    let key=station_key(target);
    let read = |name: &str| -> Result<Value, String> {
        serde_json::from_slice(&std::fs::read(rawdir.join(name)).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())
    };
    let station = read(&format!("{key}-station.json"))?;
    let exp = read(&format!("{key}-expedition.json"))?;
    let first=read(&format!("{key}-flights-first.json"))?;
    let total=first["count"].as_u64().ok_or("Nombre de vols absent")?;
    let mut rows = array(&first["results"]).to_vec();
    for offset in (100..total).step_by(100) {
        rows.extend(
            array(&read(&format!("{key}-flights-{offset}.json"))?["results"])
                .iter()
                .cloned(),
        );
    }
    if rows.len() as u64 != total {return Err("Import incomplet : cache conservé".into());}
    let mut doc = document_for(target,&station, &exp, &rows, None)?;
    doc["history_complete"] = json!(true);
    sources::atomic(
        dir,
        &format!("{key}-missions.json"),
        &serde_json::to_vec(&doc).map_err(|e| e.to_string())?,
    )?;
    sources::atomic(
        dir,
        &format!("{key}-missions-full.txt"),
        Utc::now().timestamp().to_string().as_bytes(),
    )?;
    sources::atomic(
        dir,
        &format!("{key}-missions-attempt.txt"),
        Utc::now().timestamp().to_string().as_bytes(),
    )
}
pub async fn endpoint_for(target:u64) -> Result<Json<Value>, (StatusCode, String)> {
    let key=station_key(target);
    let dir = PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()));
    let bytes = tokio::fs::read(dir.join(&format!("{key}-missions.json")))
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
fn update_tiangong(dir:&std::path::Path,raw:&[Value])->Result<(),String>{
    let now=Utc::now();let flights:Vec<_>=raw.iter().filter(|f|flight_for(18,f).is_some()).cloned().collect();
    let active:Vec<_>=flights.iter().filter(|f|f["launch"]["status"]["id"]==3&&station_events(18,f).iter().any(|e|e["departure"].is_null()&&e["docking"].as_str().and_then(|v|DateTime::parse_from_rfc3339(v).ok()).is_some_and(|d|d<=now))).collect();
    let mut members:BTreeMap<u64,Value>=BTreeMap::new();
    for f in &active {for c in array(&f["launch_crew"]).iter().chain(array(&f["landing_crew"]).iter()) {if c["astronaut"]["in_space"]==true {if let Some(id)=c["astronaut"]["id"].as_u64(){members.entry(id).or_insert_with(||c.clone());}}}}
    let crew:Vec<_>=members.into_values().collect();
    if crew.is_empty(){return Err("Équipage Tiangong non confirmé : cache conservé".into());}
    let mission=active.iter().filter(|f|!array(&f["launch_crew"]).is_empty()).max_by_key(|f|f["launch"]["net"].as_str()).map(|f|f["launch"]["mission"]["name"].clone()).unwrap_or(Value::Null);
    let station=json!({"id":18,"url":"https://www.cmse.gov.cn/","onboard_crew":crew.len()});
    let exp=json!({"spacestation":{"id":18},"name":mission,"crew":crew});
    let previous=std::fs::read(dir.join("tiangong-missions.json")).ok().and_then(|b|serde_json::from_slice::<Value>(&b).ok());
    let mut doc=document_for(18,&station,&exp,&flights,previous.as_ref())?;
    doc["crew_basis"]=json!("Membres déclarés en vol, associés à un vol habité amarré à Tiangong");doc["history_complete"]=json!(previous.as_ref().is_some_and(|p|p["history_complete"]==true));
    sources::atomic(dir,"tiangong-missions.json",&serde_json::to_vec(&doc).map_err(|e|e.to_string())?)
}
pub async fn collect_for(target:u64,dir: PathBuf, once: bool) {
    let key=station_key(target);
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
        if now - stamp(&format!("{key}-missions-attempt.txt")) >= 21600 {
            let _ = sources::atomic(&dir, &format!("{key}-missions-attempt.txt"), now.to_string().as_bytes());
            let result:Result<(),String>=async{
    let station:Value=serde_json::from_slice(&download(&client,&format!("{API}space_stations/{target}/?format=json")).await?).map_err(|e|e.to_string())?;
    let id=station["active_expeditions"].as_array().and_then(|a|a.first()).and_then(|e|e["id"].as_u64()).ok_or("Expédition courante absente")?;
    let exp:Value=serde_json::from_slice(&download(&client,&format!("{API}expeditions/{id}/?format=json")).await?).map_err(|e|e.to_string())?;
    let previous=std::fs::read(dir.join(&format!("{key}-missions.json"))).ok().and_then(|b|serde_json::from_slice::<Value>(&b).ok());
    let full=previous.is_none() || now-stamp(&format!("{key}-missions-full.txt"))>=7*86400;
    let mut raw=Vec::new();
    let mut reached_end=false;
    // At most 12 requests per refresh, below the public 15/hour quota. No per-visitor calls.
    for page in 0..if full {10}else{1}{
      let v:Value=serde_json::from_slice(&download(&client,&format!("{API}spacecraft_flights/?format=json&mode=detailed&limit=100&offset={}&ordering=-id",page*100)).await?).map_err(|e|e.to_string())?;
      if !v["results"].is_array(){return Err("Liste de vols invalide".into());}
      raw.extend(array(&v["results"]).iter().cloned());
      if v["next"].is_null(){reached_end=true;break;}
    }
    if full && !reached_end{return Err("Historique des missions incomplet : cache précédent conservé".into());}
    if target==4 {if let Err(e)=update_tiangong(&dir,&raw){eprintln!("Tiangong (cache conservé) : {e}");}}
    let mut doc=document_for(target,&station,&exp,&raw,previous.as_ref())?;
    doc["history_complete"]=json!((full && reached_end) || (!full && previous.as_ref().map(|p|p["history_complete"]==true).unwrap_or(false)));
    sources::atomic(&dir,&format!("{key}-missions.json"),&serde_json::to_vec(&doc).map_err(|e|e.to_string())?)?;
    if full {sources::atomic(&dir,&format!("{key}-missions-full.txt"),now.to_string().as_bytes())?;}
    Ok(())
   }.await;
            if let Err(e) = result {
                eprintln!("Missions ISS (cache conservé) : {e}");
            }
        }
        // Serialize public LL2 collectors so a full mission refresh cannot race the EVA history.
        if target==4 {crate::iss_evas::collect(dir.clone(), true).await;}
        if once {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_secs(900)).await;
    }
}

fn station_key(target:u64)->&'static str {if target==18 {"tiangong"} else {"iss"}}
pub fn import(dir:&std::path::Path,rawdir:&std::path::Path)->Result<(),String>{import_for(4,dir,rawdir)}
pub async fn endpoint()->Result<Json<Value>,(StatusCode,String)>{endpoint_for(4).await}
pub async fn tiangong_endpoint()->Result<Json<Value>,(StatusCode,String)>{endpoint_for(18).await}
pub async fn collect(dir:PathBuf,once:bool){collect_for(4,dir,once).await}
#[cfg(test)]fn flight(f:&Value)->Option<Value>{flight_for(4,f)}
#[cfg(test)]fn document(station:&Value,exp:&Value,raw:&[Value],previous:Option<&Value>)->Result<Value,String>{document_for(4,station,exp,raw,previous)}
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
    fn tiangong_filters_station_and_crew_without_extra_source_requests(){
        let current=json!({"id":1,"launch":{"net":"2020-01-01T00:00:00Z","status":{"id":3},"mission":{"name":"Shenzhou test"}},"launch_crew":[{"astronaut":{"id":900,"name":"Zhang Test","in_space":true,"nationality":[{"alpha_2_code":"CN"}]}}],"docking_events":[{"space_station_target":{"id":18},"docking":"2020-01-02T00:00:00Z","departure":null}]});
        assert!(flight_for(18,&current).is_some());assert!(flight_for(4,&current).is_none());
        let station=json!({"id":18,"onboard_crew":1});let exp=json!({"spacestation":{"id":18},"crew":current["launch_crew"]});
        let doc=document_for(18,&station,&exp,&[current],None).unwrap();assert_eq!(doc["station_id"],18);assert_eq!(doc["crew"][0]["family_name"],"Zhang");assert_eq!(doc["crew"][0]["arrival"],"2020-01-02T00:00:00Z");
        assert!(document_for(4,&station,&exp,&[],None).is_err());
    }
    #[test]
    fn tiangong_handover_keeps_both_current_crews(){
        let dir=std::env::temp_dir().join(format!("atlas-tiangong-{}",Utc::now().timestamp_nanos_opt().unwrap()));std::fs::create_dir_all(&dir).unwrap();
        let flight=|id,name|json!({"id":id,"launch":{"net":"2020-01-01T00:00:00Z","status":{"id":3},"mission":{"name":name}},"launch_crew":[{"astronaut":{"id":id,"name":name,"in_space":true}}],"docking_events":[{"space_station_target":{"id":18},"docking":"2020-01-02T00:00:00Z","departure":null}]});
        update_tiangong(&dir,&[flight(1,"Crew A"),flight(2,"Crew B")]).unwrap();let data:Value=serde_json::from_slice(&std::fs::read(dir.join("tiangong-missions.json")).unwrap()).unwrap();assert_eq!(data["crew"].as_array().unwrap().len(),2);std::fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn arrival_uses_only_iss_events() {
        let f=flight(&json!({"id":1,"docking_events":[{"space_station_target":{"id":9},"docking":"2020-01-01T00:00:00Z"},{"space_station_target":{"id":4},"docking":"2021-01-01T00:00:00Z","departure":null}]})).unwrap();
        assert_eq!(f["arrival"], "2021-01-01T00:00:00Z");
        assert!(f["departure"].is_null());
    }
}
