//! Supported observation families; shared by the native and browser engines.
#[derive(serde::Deserialize, Debug)]
pub struct Numbered {pub prefix:String,pub min:u64,pub max:u64}
#[derive(serde::Deserialize, Debug)]
pub struct Definition {
    #[serde(default)] pub parent: Option<String>,
    #[serde(default)] pub numbered: Option<Numbered>,
    pub id: String, pub label: String, pub description: String, pub group: String,
     pub prefixes: Vec<String>, pub contains: Vec<String>, pub ids: Vec<u64>,
}
pub fn definitions() -> &'static [Definition] {
    static DEFINITIONS: std::sync::OnceLock<Vec<Definition>> = std::sync::OnceLock::new();
    DEFINITIONS.get_or_init(||serde_json::from_str(include_str!("../resources/constellations.json")).expect("Invalid constellation registry"))
}
pub fn definition(id: &str) -> Option<&'static Definition> { definitions().iter().find(|row|row.id==id) }
pub fn source(id: &str) -> Option<String> { if id=="debris" { return Some("https://celestrak.org/pub/satcat.csv".to_owned()); } definition(id).map(|row|format!("https://celestrak.org/NORAD/elements/gp.php?GROUP={}&FORMAT=JSON",row.group)) }
fn matches(row: &Definition, id: u64, name: &str) -> bool {
    if row.id!="debris" && !row.ids.contains(&id) && (name.contains(" DEB") || name.contains(" AKM") || name.contains(" R/B")) { return false; }
    row.numbered.as_ref().is_some_and(|range|name.strip_prefix(&range.prefix).and_then(|rest| {
        let end=rest.find(|c:char|!c.is_ascii_digit()).unwrap_or(rest.len());
        if rest[end..].chars().next().is_some_and(char::is_alphanumeric) {return None;}
        rest[..end].parse::<u64>().ok()
    }).is_some_and(|n|n>=range.min&&n<=range.max)) || row.ids.contains(&id) || row.prefixes.iter().any(|p|name.starts_with(p)) || row.contains.iter().any(|p|name.contains(p))
}
pub fn family(id: u64, name: &str) -> Option<&'static str> {
    static IDENTITIES:std::sync::OnceLock<std::collections::BTreeMap<u64,&'static str>>=std::sync::OnceLock::new();
    let identities=IDENTITIES.get_or_init(||definitions().iter().filter(|row|row.parent.is_none()).flat_map(|row|row.ids.iter().map(move |id|(*id,row.id.as_str()))).collect());
    if let Some(family)=identities.get(&id) {return Some(family);}
    if definition("debris").is_some_and(|row|matches(row,id,name)) { return Some("debris"); }
    if id == 25544 { return Some("iss"); }
    if name.starts_with("STARLINK") { return Some("starlink"); }
    if name.starts_with("GPS B") || name.starts_with("GPS III") || name.strip_prefix("NAVSTAR ").is_some_and(|rest|rest.as_bytes().first().is_some_and(u8::is_ascii_digit)) { return Some("gps"); }
    let galileo = name.strip_prefix("GSAT").is_some_and(|rest| {
        rest.len() >= 4 && rest.as_bytes()[..4].iter().all(u8::is_ascii_digit)
            && rest.as_bytes().get(4).is_none_or(|c| c.is_ascii_whitespace() || *c == b'(')
    }) || name.starts_with("GIOVE-A") || name.starts_with("GIOVE-B") || name == "GALILEO" || name.starts_with("GALILEO ") || name.starts_with("GALILEO-");
    if galileo { return Some("galileo"); }
    definitions().iter().find(|row|row.parent.is_none() && matches(row,id,name)).map(|row|row.id.as_str())
}
/// A targeted page may share physical objects with its broader constellation.
pub fn belongs(id:u64,name:&str,collection:&str)->bool {
    family(id,name)==Some(collection) || definition(collection).is_some_and(|row|row.parent.is_some() && matches(row,id,name) && family(id,name)!=Some("debris"))
}
pub fn memberships(id:u64,name:&str)->Vec<&'static str> {
    let Some(primary)=family(id,name) else {return Vec::new();};
    let mut result=vec![primary];
    if primary!="debris" {result.extend(definitions().iter().filter(|row|row.parent.is_some() && matches(row,id,name)).map(|row|row.id.as_str()));}
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn gps_names_are_separate() {
        for name in ["GPS BIIR-5 (PRN 22)","GPS BIII-1 (PRN 04)","NAVSTAR 1 (OPS 5111)"] { assert_eq!(family(1,name),Some("gps")); }
        for name in ["GPS-DEMO","NAVSTARLINK","NAVSTAR TEST"] { assert_eq!(family(1,name),None); }
    }
    #[test]
    fn galileo_is_not_the_indian_gsat_family() {
        for name in ["GSAT0101 (GALILEO-PFM)", "GSAT0234 (GALILEO 34)", "GSAT0001 (GIOVE-A)"] { assert_eq!(family(1,name),Some("galileo")); }
        for name in ["GSAT-1", "GSAT-8", "MAGSAT", "GSAT12345"] { assert_eq!(family(1,name),None); }
        assert_eq!(family(1,"GHGSAT-D"),Some("ghgsat"));
        assert_eq!(family(25544,"ISS (ZARYA)"),Some("iss"));
        assert_eq!(family(43216,"STARLINK-TEST"),Some("starlink"));
    }
}

#[cfg(test)]
mod registry_tests {
    use super::*;
    #[test]
    fn catalogue_aliases_and_debris_are_separate() {
        assert_eq!(family(32275,"COSMOS 2433 (720)"),Some("glonass"));
        assert_eq!(family(35491,"EWS-G3 (GOES 14)"),Some("goes"));
        assert_eq!(family(64723,"MTG-S1"),Some("meteosat"));
        assert_eq!(family(31598,"COSMO-SKYMED 1"),Some("cosmo-skymed"));
        assert_eq!(family(41798,"SENTINEL-1A DEB"),Some("debris"));assert_eq!(family(11970,"GOES 4 AKM"),Some("debris"));
        for (id,name) in [(123,"COSMOS 999"),(38012,"PLEIADES 1A")] { assert_eq!(family(id,name),None); }
    }
}
