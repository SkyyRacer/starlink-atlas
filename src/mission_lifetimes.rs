//! Apply exact public GCAT times only when they agree with the SATCAT calendar day.
use serde_json::Value;
pub fn normalize(row:&mut Value) {
    static FACTS:std::sync::OnceLock<Value>=std::sync::OnceLock::new();
    let facts=FACTS.get_or_init(||serde_json::from_str(include_str!("../resources/mission-lifetimes.json")).expect("Invalid mission lifetimes"));
    let Some(id)=row["NORAD_CAT_ID"].as_u64() else{return;};
    for (field,key) in [("LAUNCH_DATE","launch_time"),("DECAY_DATE","decay_time")] {
        let Some(day)=row[field].as_str().filter(|s|s.len()==10) else{continue;};
        let Some(exact)=facts["objects"][id.to_string()][key].as_str().filter(|s|s.starts_with(day)) else{continue;};
        row[field]=serde_json::json!(exact);
        row[format!("{field}_SOURCE")]=serde_json::json!("GCAT · heure publiée, jour recoupé avec SATCAT");
    }
}
#[cfg(test)] mod tests {
 use super::*;
 #[test]fn exact_times_keep_short_missions_visible_without_inventing_precision(){
  let mut row=serde_json::json!({"NORAD_CAT_ID":433,"LAUNCH_DATE":"1962-10-03","DECAY_DATE":"1962-10-03"});normalize(&mut row);assert_eq!(row["DECAY_DATE"],"1962-10-03T21:28:22Z");
  let mut conflict=serde_json::json!({"NORAD_CAT_ID":433,"DECAY_DATE":"1962-10-04"});normalize(&mut conflict);assert_eq!(conflict["DECAY_DATE"],"1962-10-04");
  let mut unknown=serde_json::json!({"NORAD_CAT_ID":2,"DECAY_DATE":"1958-01-03"});normalize(&mut unknown);assert_eq!(unknown["DECAY_DATE"],"1958-01-03");
 }
}
