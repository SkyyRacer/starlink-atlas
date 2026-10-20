//! Persistent, bounded orbital changes. Position/epoch refreshes never generate news.
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
 value.as_str().and_then(|s|chrono::NaiveDate::parse_from_str(s.get(..10)?,"%Y-%m-%d").ok()).is_some_and(|d|d<=now.date_naive()&&d>=now.date_naive()-chrono::Duration::days(30))
}
fn push(store:&mut Store,kind:&str,id:u64,row:&Value,at:&str,now:DateTime<Utc>,before:Option<&str>){
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
 for (&id,value) in &db.catalog {
  let row=snapshot(db,id,value);let previous=store.baseline.get(&id).cloned();
  if store.initialized&&!families.contains(row["family"].as_str().unwrap_or("")){store.baseline.insert(id,row);continue;}
  if let Some(old)=previous{
   if row["decay"].as_str().is_some_and(|v|!v.is_empty())&&row["decay"]!=old["decay"]{
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
 store.events.truncate(60);
}
pub fn update(dir:&Path,db:&Database)->Result<(),String>{
 let mut store=read(dir);reconcile(&mut store,db,Utc::now());sources::atomic(dir,"orbital-news.json",&serde_json::to_vec(&store).map_err(|e|e.to_string())?)
}
pub fn document(dir:&Path)->Value{json!({"items":read(dir).events,"limit":60})}
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
 #[test]fn changes_only_grouped_and_bounded(){
  let now=DateTime::parse_from_rfc3339("2026-10-20T12:00:00Z").unwrap().with_timezone(&Utc);let mut db=Database::default();db.catalog.insert(1,object(1));db.catalog.insert(2,object(2));let mut store=Store::default();reconcile(&mut store,&db,now);
  assert_eq!(store.events.len(),1);assert_eq!(store.events[0]["objects"].as_array().unwrap().len(),2);
  db.revision+=1;reconcile(&mut store,&db,now);assert_eq!(store.events.len(),1,"Position refresh alone is silent");
  db.catalog.get_mut(&1).unwrap()["OPS_STATUS_CODE"]=json!("-");reconcile(&mut store,&db,now);assert_eq!(store.events[0]["kind"],"status");
  db.catalog.get_mut(&1).unwrap()["DECAY_DATE"]=json!("2026-10-20");reconcile(&mut store,&db,now);assert!(store.events.iter().any(|e|e["kind"]=="decay"));
  let count=store.events.len();let mut manual=object(20580);manual["OBJECT_NAME"]=json!("HST");db.catalog.insert(20580,manual);reconcile(&mut store,&db,now);assert_eq!(store.events.len(),count,"A newly configured page/family is silent");
  db.catalog.remove(&1);reconcile(&mut store,&db,now);assert_eq!(store.events.len(),count,"Disappearance is not deorbiting");
  for id in 3..90{let mut row=object(id);row["LAUNCH_DATE"]=json!("2020-01-01");row["OBJECT_ID"]=json!(format!("2020-{id:03}A"));db.catalog.insert(id,row);}
  reconcile(&mut store,&db,now);assert_eq!(store.events.len(),60);
 }
}
