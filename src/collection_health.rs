//! Retry temporary outages without unblocking invalid or forbidden responses.
use std::path::Path;
pub fn temporary(error:&str)->bool {
    error.contains("error sending request") || error.contains("error decoding response body")
        || error.starts_with("Réseau temporaire")
        || ["HTTP 408", "HTTP 429", "HTTP 500", "HTTP 502", "HTTP 503", "HTTP 504"].iter().any(|code|error.starts_with(code))
}
fn attempt_name(key:&str)->String {if key=="collection" {"last-attempt.txt".into()} else {format!("{key}-attempt.txt")}}
pub fn due(dir:&Path,key:&str,now:i64,interval:i64)->bool {
    let stopped=std::fs::read_to_string(dir.join(format!("{key}-stopped.txt"))).ok();
    if stopped.as_ref().is_some_and(|e|!temporary(e)){return false;}
    let error=stopped.or_else(||std::fs::read_to_string(dir.join(format!("{key}-error.txt"))).ok());
    let delay=error.as_ref().filter(|e|temporary(e)).map(|e|{
        let supplied=e.split("retry_after_seconds=").nth(1).and_then(|v|v.split_whitespace().next()).and_then(|v|v.parse::<i64>().ok()).unwrap_or(0);
        interval.max(7200).max(supplied)
    }).unwrap_or(interval);
    let last=std::fs::read_to_string(dir.join(attempt_name(key))).ok().and_then(|v|v.parse::<i64>().ok()).unwrap_or(0);
    now.saturating_sub(last)>=delay
}
pub fn finish(dir:&Path,key:&str,error:Option<&str>){
    let stopped=dir.join(format!("{key}-stopped.txt"));let failed=dir.join(format!("{key}-error.txt"));
    match error {
        Some(e) if temporary(e)=>{let _=std::fs::write(failed,e);let _=std::fs::remove_file(stopped);},
        Some(e)=>{let _=std::fs::write(stopped,e);},
        None=>{let _=std::fs::remove_file(stopped);let _=std::fs::remove_file(failed);}
    }
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn outages_retry_and_success_clears_legacy_markers(){
        let dir=std::env::temp_dir().join(format!("atlas-health-{}",std::process::id()));std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("iss-attempt.txt"),"10000").unwrap();std::fs::write(dir.join("iss-stopped.txt"),"error sending request for url (https://celestrak.org)").unwrap();
        assert!(!due(&dir,"iss",17199,7200));assert!(due(&dir,"iss",17200,7200));
        finish(&dir,"iss",Some("HTTP 429 : source indisponible retry_after_seconds=9000"));assert!(!due(&dir,"iss",18999,7200));assert!(due(&dir,"iss",19000,7200));
        finish(&dir,"iss",Some("HTTP 403 : source indisponible"));assert!(!due(&dir,"iss",100000,7200));
        assert!(!temporary("CelesTrak HTTP 503 : collecte suspendue"));
        finish(&dir,"iss",None);assert!(due(&dir,"iss",17200,7200));assert!(!dir.join("iss-error.txt").exists());
        finish(&dir,"iss",Some("Catalogue ISS incorrect"));assert!(!due(&dir,"iss",100000,7200));std::fs::remove_dir_all(dir).unwrap();
    }
}
