//! Persistent orbital changes retained for seven days. Position/epoch refreshes never generate news.
use super::*;
use std::{collections::BTreeMap,path::Path};
#[derive(Default,Serialize,Deserialize)]
struct Store {initialized:bool,baseline:BTreeMap<u64,Value>,events:Vec<Value>}
fn status(code:&str)->&str{match code{"+"=>"Opérationnel","-"=>"Hors service","P"=>"Partiellement opérationnel","B"=>"En réserve","S"=>"En attente d’activation","X"=>"Mission prolongée",_=>"État opérationnel inconnu"}}
fn known(code:&str)->bool{matches!(code,"+"|"-"|"P"|"B"|"S"|"X")}
fn read(dir:&Path)->Store{std::fs::read(dir.join("orbital-news.json")).ok().and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default()}
fn snapshot(db:&Database,id:u64,row:&Value)->Value{
 json!({"name":row["OBJECT_NAME"],"family":object_family(db,id),"designator":row["OBJECT_ID"],"launch":db.gcat.get(&id).and_then(|v|v["launch_time"].as_str()).or_else(||row["LAUNCH_DATE"].as_str()),"decay":row["DECAY_DATE"],"ops":row["OPS_STATUS_CODE"]})
}
fn dated(value:&Value,now:DateTime<Utc>)->bool{
 if let Some(at)=value.as_str().and_then(|s|DateTime::parse_from_rfc3339(s).ok()){if at.with_timezone(&Utc)>now{return false;}}
 value.as_str().and_then(|s|chrono::NaiveDate::parse_from_str(s.get(..10)?,"%Y-%m-%d").ok()).is_some_and(|d|d<=now.date_naive()&&d>=now.date_naive()-chrono::Duration::days(7))
}
fn push(store:&mut Store,kind:&str,id:u64,row:&Value,at:&str,now:DateTime<Utc>,before:Option<&str>){
 if event_time(&json!({"at":at}),"at").is_some_and(|date|date>now){return;}
 let family=row["family"].as_str().unwrap_or("all");
 // Launch groups use the international launch identifier. Independent flights on one day stay separate.
 let designator=row["designator"].as_str().unwrap_or("");let launch=designator.get(..8).filter(|s|s.as_bytes().get(4)==Some(&b'-')).unwrap_or(designator);
 let group=if kind=="launch"{format!("{launch}:{}",at.get(..10).unwrap_or(at))}else if kind=="status"{format!("{id}:{}:{}",row["ops"],now.to_rfc3339())}else{format!("{}:{}",at.get(..10).unwrap_or(at),if kind=="addition"{launch}else{""})};
 let key=format!("{kind}:{family}:{group}");
 if let Some(event)=store.events.iter_mut().find(|e|e["id"]==key){
  let objects=event["objects"].as_array_mut().unwrap();if !objects.iter().any(|v|v["id"]==id){objects.push(json!({"id":id,"name":row["name"]}));}return;
 }
 store.events.push(json!({"id":key,"kind":kind,"family":family,"label":collections::definition(family).map(|d|d.label.as_str()).unwrap_or(family),"at":at,"observed_at":now.to_rfc3339(),"objects":[{"id":id,"name":row["name"]}],"previous_status":before.map(status),"status":status(row["ops"].as_str().unwrap_or(""))}));
}
fn reconcile(store:&mut Store,db:&Database,now:DateTime<Utc>){
 if db.catalog.is_empty(){return;}
 let families:std::collections::BTreeSet<String>=store.baseline.values().filter_map(|v|v["family"].as_str().map(str::to_owned)).collect();
 let mut identities=db.catalog.clone();
 for (&id,rows) in &db.orbits {if let Some(last)=rows.last(){identities.entry(id).or_insert_with(||json!({"OBJECT_NAME":last.el.object_name,"OBJECT_ID":last.el.international_designator,"NORAD_CAT_ID":id}));}}
 for (&id,value) in &identities {
  let row=snapshot(db,id,value);let previous=store.baseline.get(&id).cloned();
  if store.initialized&&!families.contains(row["family"].as_str().unwrap_or("")){store.baseline.insert(id,row);continue;}
  if let Some(old)=previous{
   if !dated(&old["launch"],now)&&dated(&row["launch"],now){
    for event in &mut store.events {if event["kind"]=="addition"{if let Some(objects)=event["objects"].as_array_mut(){objects.retain(|object|object["id"]!=id);}}}
    store.events.retain(|event|event["objects"].as_array().is_some_and(|objects|!objects.is_empty()));
    push(store,"launch",id,&row,row["launch"].as_str().unwrap(),now,None);
   }
   if row["decay"].as_str().is_some_and(|v|!v.is_empty())&&row["decay"].as_str().and_then(|v|v.get(..10))!=old["decay"].as_str().and_then(|v|v.get(..10)){
    push(store,"decay",id,&row,row["decay"].as_str().unwrap(),now,None);
   }else{
    let code=row["ops"].as_str().unwrap_or("");let before=old["ops"].as_str().unwrap_or("");
    if known(code)&&code!=before&&row["decay"].as_str().is_none_or(|v|v.is_empty()){push(store,"status",id,&row,&now.to_rfc3339(),now,Some(before));}
   }
  }else if dated(&row["launch"],now){push(store,"launch",id,&row,row["launch"].as_str().unwrap(),now,None);}
  else if store.initialized{push(store,"addition",id,&row,&now.to_rfc3339(),now,None);}
  if !store.initialized&&dated(&row["decay"],now){push(store,"decay",id,&row,row["decay"].as_str().unwrap(),now,None);}
  store.baseline.insert(id,row);
 }
 store.initialized=true;
 store.events.sort_by(|a,b|b["at"].as_str().cmp(&a["at"].as_str()).then_with(||a["id"].as_str().cmp(&b["id"].as_str())));
 store.events.retain(|event|recent(event,now));
}
pub fn update(dir:&Path,db:&Database)->Result<(),String>{
 let mut store=read(dir);reconcile(&mut store,db,Utc::now());sources::atomic(dir,"orbital-news.json",&serde_json::to_vec(&store).map_err(|e|e.to_string())?)
}
fn within_week(value:&Value,now:DateTime<Utc>)->bool{
 let Some(text)=value.as_str() else{return false;};
 if let Ok(at)=DateTime::parse_from_rfc3339(text){let at=at.with_timezone(&Utc);return at<=now&&at>=now-chrono::Duration::days(7);}
 chrono::NaiveDate::parse_from_str(text,"%Y-%m-%d").is_ok_and(|date|date<=now.date_naive()&&date>=now.date_naive()-chrono::Duration::days(7))
}
fn recent(event:&Value,now:DateTime<Utc>)->bool{within_week(event.get("observed_at").filter(|v|v.is_string()).unwrap_or(&event["at"]),now)}
fn cached_document(dir:&Path,file:&str)->Value{std::fs::read(dir.join(file)).ok().and_then(|bytes|serde_json::from_slice(&bytes).ok()).unwrap_or(Value::Null)}
fn station_events(dir:&Path,now:DateTime<Utc>)->Vec<Value>{
 let mut events=Vec::new();
 for (file,family,label) in [("iss-missions.json","iss","ISS"),("tiangong-missions.json","tiangong","Tiangong")]{
  let doc=cached_document(dir,file);
  for flight in doc["flights"].as_array().into_iter().flatten(){
   if flight["status_id"].as_u64()!=Some(3){continue;}
   let crewed=flight["crew"].as_array().is_some_and(|rows|!rows.is_empty())||flight["landing_crew"].as_array().is_some_and(|rows|!rows.is_empty());
   let craft=format!("{} {}",flight["name"].as_str().unwrap_or(""),flight["spacecraft"].as_str().unwrap_or("")).to_lowercase();
   let cargo=["cargo","progress","tianzhou","cygnus","htv","atv","crs"].iter().any(|name|craft.contains(name));
   for (field,action) in [("launch","launch"),("arrival","arrival"),("departure","departure")]{
    if !within_week(&flight[field],now){continue;}
    let name=flight["name"].as_str().unwrap_or("Vaisseau");
    let title=match (crewed,action){(true,"arrival")=>format!("{name} · arrivée de l’équipage à {label}"),(true,"departure")=>format!("{name} · départ de l’équipage de {label}"),(true,_)=>format!("{name} · lancement d’un équipage vers {label}"),(false,"arrival")=>format!("{name} · arrivée à {label}"),(false,"departure")=>format!("{name} · départ de {label}"),(false,_)=>format!("{name} · lancement vers {label}")};
    events.push(json!({"id":format!("station:{family}:{}:{action}",flight["id"]),"kind":if crewed{"crew"}else if cargo{"cargo"}else{"mission"},"category":"stations","family":family,"label":label,"title":title,"at":flight[field],"crew":if action=="departure"{&flight["landing_crew"]}else{&flight["crew"]},"source":doc["source"],"source_url":flight["url"],"objects":[]}));
   }
  }
 }
 let doc=cached_document(dir,"iss-evas.json");
 for eva in doc["spacewalks"].as_array().into_iter().flatten(){
  if !within_week(&eva["start"],now){continue;}
  let family=match eva["station_id"].as_u64(){Some(4)=>"iss",Some(18)=>"tiangong",_=>continue};
  // An EVA is confirmed after an actual end/duration has been supplied, not by a scheduled start alone.
  if !eva["end"].as_str().and_then(|s|DateTime::parse_from_rfc3339(s).ok()).is_some_and(|end|end<=now)||eva["duration"].as_str().is_none(){continue;}
  events.push(json!({"id":format!("eva:{}",eva["id"]),"kind":"eva","category":"stations","family":family,"label":if family=="iss"{"ISS"}else{"Tiangong"},"title":format!("Sortie extravéhiculaire · {}",eva["name"].as_str().unwrap_or("EVA")),"at":eva["start"],"end":eva["end"],"duration":eva["duration"],"crew":eva["crew"],"source":doc["source"],"source_url":eva["url"],"objects":[]}));
 }
 events
}
fn document_at(dir:&Path,now:DateTime<Utc>)->Value{
 let mut events:Vec<_>=read(dir).events.into_iter().filter(|event|recent(event,now)).collect();
 events.extend(station_events(dir,now));
 events.sort_by(|a,b|b["at"].as_str().cmp(&a["at"].as_str()).then_with(||a["id"].as_str().cmp(&b["id"].as_str())));
 events.dedup_by(|a,b|a["id"]==b["id"]);
 json!({"items":events,"window_days":7,"from":(now-chrono::Duration::days(7)).to_rfc3339(),"generated_at":now.to_rfc3339()})
}
pub fn document(dir:&Path)->Value{document_at(dir,Utc::now())}
pub async fn endpoint()->Json<Value>{Json(document(&PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()))))}
pub async fn watch(shared:Shared,dir:PathBuf){
 let mut revision=u64::MAX;
 loop{
  let db=shared.read().await;if db.revision!=revision{revision=db.revision;if let Err(error)=update(&dir,&db){eprintln!("Actualités orbitales : {error}");}}drop(db);
  tokio::time::sleep(std::time::Duration::from_secs(30)).await;
 }
}
#[cfg(test)]mod tests{
 use super::*;
 fn object(id:u64)->Value{json!({"NORAD_CAT_ID":id,"OBJECT_NAME":format!("STARLINK-{id}"),"OBJECT_ID":format!("2026-100{}",id),"LAUNCH_DATE":"2026-10-19","OPS_STATUS_CODE":"+","DECAY_DATE":null})}
 #[test]fn orbital_only_addition_is_not_a_confirmed_launch(){
  let now=DateTime::parse_from_rfc3339("2026-10-20T12:00:00Z").unwrap().with_timezone(&Utc);let mut db=Database::default();db.catalog.insert(1,object(1));let mut store=Store::default();reconcile(&mut store,&db,now);
  let mut row:Value=serde_json::from_slice(include_bytes!("../resources/iss-example.json")).unwrap();let mut row=row.as_array_mut().unwrap().remove(0);row["OBJECT_NAME"]=json!("STARLINK-TEST");row["NORAD_CAT_ID"]=json!(99999);row["OBJECT_ID"]=json!("2026-123A");
  load_gp(&mut db,&serde_json::to_vec(&vec![row]).unwrap()).unwrap();reconcile(&mut store,&db,now);assert!(store.events.iter().any(|e|e["kind"]=="addition"&&e["objects"].as_array().unwrap().iter().any(|v|v["id"]==99999)));
  let mut confirmed=object(99999);confirmed["OBJECT_ID"]=json!("2026-123A");db.catalog.insert(99999,confirmed);reconcile(&mut store,&db,now);
  assert!(store.events.iter().any(|e|e["kind"]=="launch"&&e["objects"].as_array().unwrap().iter().any(|v|v["id"]==99999)));assert!(!store.events.iter().any(|e|e["kind"]=="addition"&&e["objects"].as_array().unwrap().iter().any(|v|v["id"]==99999)));
 }
 #[test]fn a_more_precise_return_time_is_not_another_deorbit(){
  let now=DateTime::parse_from_rfc3339("2026-10-20T12:00:00Z").unwrap().with_timezone(&Utc);let mut db=Database::default();let mut row=object(900001);row["DECAY_DATE"]=json!("2020-01-01");row["LAUNCH_DATE"]=json!("2019-01-01");db.catalog.insert(900001,row);let mut store=Store::default();reconcile(&mut store,&db,now);let count=store.events.len();db.catalog.get_mut(&900001).unwrap()["DECAY_DATE"]=json!("2020-01-01T12:34:00Z");reconcile(&mut store,&db,now);assert_eq!(store.events.len(),count);
 }
 #[test]fn changes_only_grouped_and_retained_for_a_week(){
  let now=DateTime::parse_from_rfc3339("2026-10-20T12:00:00Z").unwrap().with_timezone(&Utc);let mut db=Database::default();db.catalog.insert(900001,object(900001));db.catalog.insert(900002,object(900002));let mut store=Store::default();reconcile(&mut store,&db,now);
  assert_eq!(store.events.len(),1);assert_eq!(store.events[0]["objects"].as_array().unwrap().len(),2);
  db.revision+=1;reconcile(&mut store,&db,now);assert_eq!(store.events.len(),1,"Position refresh alone is silent");
  db.catalog.get_mut(&900001).unwrap()["OPS_STATUS_CODE"]=json!("-");reconcile(&mut store,&db,now);assert_eq!(store.events[0]["kind"],"status");
  db.catalog.get_mut(&900001).unwrap()["DECAY_DATE"]=json!("2026-10-20");reconcile(&mut store,&db,now);assert!(store.events.iter().any(|e|e["kind"]=="decay"));
  let count=store.events.len();let mut manual=object(20580);manual["OBJECT_NAME"]=json!("HST");db.catalog.insert(20580,manual);reconcile(&mut store,&db,now);assert_eq!(store.events.len(),count,"A newly configured page/family is silent");
  db.catalog.remove(&900001);reconcile(&mut store,&db,now);assert_eq!(store.events.len(),count,"Disappearance is not deorbiting");
  for id in 900003..900090{let mut row=object(id);row["LAUNCH_DATE"]=json!("2020-01-01");row["OBJECT_ID"]=json!(format!("2020-{:03}A",id-900000));db.catalog.insert(id,row);}
  reconcile(&mut store,&db,now);assert!(store.events.len()>60,"All changes in the seven-day window must be kept");
  reconcile(&mut store,&db,now+chrono::Duration::days(8));assert!(store.events.iter().all(|event|recent(event,now+chrono::Duration::days(8))));
 }
 #[test]fn station_news_use_actual_recent_events_and_refresh_without_orbit_changes(){
  let now=DateTime::parse_from_rfc3339("2026-10-22T12:00:00Z").unwrap().with_timezone(&Utc);
  let dir=std::env::temp_dir().join(format!("atlas-news-stations-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap()));std::fs::create_dir_all(&dir).unwrap();
  let flights=json!({"source":"Fixture provider","flights":[
   {"id":1,"name":"Cargo récent","status_id":3,"launch":"2026-10-20T12:00:00Z","arrival":"2026-10-21T12:00:00Z","crew":[],"landing_crew":[]},
   {"id":2,"name":"Équipage récent","status_id":3,"arrival":"2026-10-21T16:00:00Z","departure":"2026-10-23T12:00:00Z","crew":[{"name":"Test astronaut"}]},
   {"id":3,"name":"Vol prévu","status_id":1,"arrival":"2026-10-21T16:00:00Z","crew":[]},
   {"id":4,"name":"Ancien cargo","status_id":3,"arrival":"2026-09-01T12:00:00Z","crew":[]}
  ]});
  std::fs::write(dir.join("iss-missions.json"),serde_json::to_vec(&flights).unwrap()).unwrap();
  let evas=json!({"spacewalks":[
   {"id":1,"station_id":18,"name":"EVA récente","start":"2026-10-20T10:00:00Z","end":"2026-10-20T16:00:00Z","duration":"PT6H","crew":[]},
   {"id":2,"station_id":4,"name":"EVA prévue","start":"2026-10-21T10:00:00Z","end":null,"crew":[]}
  ]});std::fs::write(dir.join("iss-evas.json"),serde_json::to_vec(&evas).unwrap()).unwrap();
  let doc=document_at(&dir,now);let rows=doc["items"].as_array().unwrap();assert_eq!(doc["window_days"],7);assert_eq!(rows.len(),4);
  assert_eq!(rows.iter().filter(|row|row["kind"]=="cargo").count(),2);assert_eq!(rows.iter().filter(|row|row["kind"]=="crew").count(),1);assert!(rows.iter().any(|row|row["kind"]=="eva"&&row["family"]=="tiangong"));
  std::fs::write(dir.join("iss-evas.json"),serde_json::to_vec(&json!({"spacewalks":[]})).unwrap()).unwrap();assert_eq!(document_at(&dir,now)["items"].as_array().unwrap().len(),3,"New station cache is read even without an orbital revision");
  std::fs::remove_dir_all(dir).unwrap();
 }

}
