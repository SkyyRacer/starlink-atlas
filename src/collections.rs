//! Supported observation families; shared by the native and browser engines.
#[derive(serde::Deserialize, Debug)]
pub struct Definition {
    pub id: String, pub label: String, pub description: String, pub group: String,
    pub catalog_queries: Vec<String>, pub prefixes: Vec<String>, pub contains: Vec<String>, pub ids: Vec<u64>,
}
pub fn definitions() -> &'static [Definition] {
    static DEFINITIONS: std::sync::OnceLock<Vec<Definition>> = std::sync::OnceLock::new();
    DEFINITIONS.get_or_init(||serde_json::from_str(include_str!("../resources/constellations.json")).expect("Invalid constellation registry"))
}
pub fn definition(id: &str) -> Option<&'static Definition> { definitions().iter().find(|row|row.id==id) }
pub fn local_history(id: &str) -> bool { id!="starlink" && id!="iss" && definition(id).is_some() }
pub fn source(id: &str) -> Option<String> { if id=="debris" { return Some("https://celestrak.org/pub/satcat.csv".to_owned()); } definition(id).map(|row|format!("https://celestrak.org/NORAD/elements/gp.php?GROUP={}&FORMAT=JSON",row.group)) }
fn matches(row: &Definition, id: u64, name: &str) -> bool {
    if row.id!="debris" && (name.contains(" DEB") || name.contains(" AKM") || name.contains(" R/B")) { return false; }
    row.ids.contains(&id) || row.prefixes.iter().any(|p|name.starts_with(p)) || row.contains.iter().any(|p|name.contains(p))
}
pub fn family(id: u64, name: &str) -> Option<&'static str> {
    if definition("debris").is_some_and(|row|matches(row,id,name)) { return Some("debris"); }
    if id == 25544 { return Some("iss"); }
    if name.starts_with("STARLINK") { return Some("starlink"); }
    if name.starts_with("GPS B") || name.starts_with("GPS III") || name.strip_prefix("NAVSTAR ").is_some_and(|rest|rest.as_bytes().first().is_some_and(u8::is_ascii_digit)) { return Some("gps"); }
    let galileo = name.strip_prefix("GSAT").is_some_and(|rest| {
        rest.len() >= 4 && rest.as_bytes()[..4].iter().all(u8::is_ascii_digit)
            && rest.as_bytes().get(4).is_none_or(|c| c.is_ascii_whitespace() || *c == b'(')
    }) || name.starts_with("GIOVE-A") || name.starts_with("GIOVE-B") || name == "GALILEO" || name.starts_with("GALILEO ") || name.starts_with("GALILEO-");
    if galileo { return Some("galileo"); }
    definitions().iter().find(|row|matches(row,id,name)).map(|row|row.id.as_str())
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
        for name in ["GSAT-1", "GSAT-8", "GHGSAT-D", "MAGSAT", "GSAT12345"] { assert_eq!(family(1,name),None); }
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
