//! Independently cached spacewalk facts. No upstream calls per visitor.
use super::*;
fn normalize(rows:&[Value], complete:bool, total:u64)->Result<Value,String>{
 let mut unique=BTreeMap::new();
 for r in rows{
  let id=r["id"].as_u64().ok_or("Identifiant de sortie absent")?;
  if !r["crew"].is_array(){return Err("Participants des sorties absents".into());}
  let crew:Vec<_>=r["crew"].as_array().unwrap().iter().filter_map(|c|c["astronaut"]["id"].as_u64().map(|id|json!({"id":id,"name":c["astronaut"]["name"],"role":c["role"]["role"]}))).collect();
  unique.insert(id,json!({"id":id,"name":r["name"],"url":r["url"],"start":r["start"],"end":r["end"],"duration":r["duration"],"location":r["location"],"station_id":r["spacestation"]["id"],"expedition":r["expedition"]["name"],"crew":crew}));
 }
 if unique.is_empty(){return Err("Historique de sorties vide : cache conservé".into());}
 Ok(json!({"fetched_at":Utc::now().to_rfc3339(),"source":"The Space Devs · Launch Library 2","complete":complete && unique.len() as u64 == total,"reported_total":total,"spacewalks":unique.into_values().collect::<Vec<_>>()}))
}
pub fn import(dir:&std::path::Path, rawdir:&std::path::Path)->Result<(),String>{
 let read=|name:&str|->Result<Value,String>{serde_json::from_slice(&std::fs::read(rawdir.join(name)).map_err(|e|e.to_string())?).map_err(|e|e.to_string())};
 let first=read("iss-evas-first.json")?;let total=first["count"].as_u64().ok_or("Nombre de sorties absent")?;
 let mut rows=first["results"].as_array().ok_or("Sorties absentes")?.clone();
 for offset in (100..total).step_by(100){let name=format!("iss-evas-{offset}.json");if !rawdir.join(&name).exists(){break;}let v=read(&name)?;rows.extend(v["results"].as_array().ok_or("Page invalide")?.iter().cloned());}
 let complete=rows.len() as u64==total;
 let doc=normalize(&rows,complete,total)?;
 sources::atomic(dir,"iss-evas.json",&serde_json::to_vec(&doc).map_err(|e|e.to_string())?)?;
 sources::atomic(dir,"iss-evas-attempt.txt",Utc::now().timestamp().to_string().as_bytes())?;
 if complete{sources::atomic(dir,"iss-evas-full.txt",Utc::now().timestamp().to_string().as_bytes())?;}Ok(())
}
pub async fn endpoint()->Result<Json<Value>,(StatusCode,String)>{
 let dir=PathBuf::from(std::env::var("DATA_DIR").unwrap_or("data".into()));
 let b=tokio::fs::read(dir.join("iss-evas.json")).await.map_err(|_|(StatusCode::SERVICE_UNAVAILABLE,"Historique des sorties en cours de collecte".into()))?;
 Ok(Json(serde_json::from_slice(&b).map_err(|_|(StatusCode::SERVICE_UNAVAILABLE,"Cache des sorties illisible".into()))?))
}
pub async fn collect(dir:PathBuf,once:bool){
 let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(60)).user_agent("Atlas/0.3 (cached educational spacewalk facts)").build().unwrap();
 loop{
  let now=Utc::now().timestamp();let stamp=|name:&str|std::fs::read_to_string(dir.join(name)).ok().and_then(|s|s.parse::<i64>().ok()).unwrap_or(0);
  // Leave a full hour after the 12-call mission history refresh (public quota: 15/hour).
  if now-stamp("iss-evas-attempt.txt")>=21600 && stamp("iss-missions-full.txt")>0 && now-stamp("iss-missions-full.txt")>=3600{
   let _=sources::atomic(&dir,"iss-evas-attempt.txt",now.to_string().as_bytes());
   let result:Result<(),String>=async{
    let previous=std::fs::read(dir.join("iss-evas.json")).ok().and_then(|b|serde_json::from_slice::<Value>(&b).ok());
    let full=previous.as_ref().map(|p|p["complete"]!=true).unwrap_or(true)||now-stamp("iss-evas-full.txt")>=7*86400;
    let mut rows=Vec::new();let mut complete=false;let mut total=0;
    for page in 0..if full{10}else{1}{
     let url=format!("https://ll.thespacedevs.com/2.3.0/spacewalks/?format=json&mode=normal&limit=100&offset={}&ordering=-start",page*100);
     let v:Value=serde_json::from_slice(&download(&client,&url).await?).map_err(|e|e.to_string())?;
     total=v["count"].as_u64().ok_or("Nombre de sorties absent")?;
     rows.extend(v["results"].as_array().ok_or("Page de sorties invalide")?.iter().cloned());
     if v["next"].is_null(){complete=true;break;}
    }
    let mut doc=normalize(&rows,complete,total)?;
    if full{complete=complete&&doc["spacewalks"].as_array().map(|a|a.len() as u64==total).unwrap_or(false);doc["complete"]=json!(complete);}
    if !full{if let Some(p)=previous{let mut all:BTreeMap<u64,Value>=BTreeMap::new();for row in p["spacewalks"].as_array().into_iter().flatten().chain(doc["spacewalks"].as_array().into_iter().flatten()){if let Some(id)=row["id"].as_u64(){all.insert(id,row.clone());}}doc["spacewalks"]=json!(all.into_values().collect::<Vec<_>>());doc["complete"]=json!(p["complete"]==true);}}
    sources::atomic(&dir,"iss-evas.json",&serde_json::to_vec(&doc).map_err(|e|e.to_string())?)?;
    if full && complete{sources::atomic(&dir,"iss-evas-full.txt",now.to_string().as_bytes())?;}Ok(())
   }.await;
   if let Err(e)=result{eprintln!("Sorties extravéhiculaires (cache conservé) : {e}");}
  }
  if once{break;}tokio::time::sleep(std::time::Duration::from_secs(900)).await;
 }
}
#[cfg(test)]mod tests{use super::*;
 #[test]fn rejects_missing_crew(){assert!(normalize(&[json!({"id":1})],true,1).is_err());}
 #[test]fn deduplicates_and_preserves_unknown_duration(){let row=json!({"id":1,"crew":[{"astronaut":{"id":7,"name":"Test"}}],"duration":null});let v=normalize(&[row.clone(),row],true,1).unwrap();assert_eq!(v["spacewalks"].as_array().unwrap().len(),1);assert!(v["spacewalks"][0]["duration"].is_null());assert_eq!(v["spacewalks"][0]["crew"][0]["id"],7);assert_eq!(normalize(&[json!({"id":1,"crew":[]}),json!({"id":1,"crew":[]})],true,2).unwrap()["complete"],false);}
}
