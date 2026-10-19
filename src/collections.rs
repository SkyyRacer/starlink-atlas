//! Supported observation families; shared by the native and browser engines.
pub fn family(id: u64, name: &str) -> Option<&'static str> {
    if id == 25544 { return Some("iss"); }
    if name.starts_with("STARLINK") { return Some("starlink"); }
    let galileo = name.strip_prefix("GSAT").is_some_and(|rest| {
        rest.len() >= 4 && rest.as_bytes()[..4].iter().all(u8::is_ascii_digit)
            && rest.as_bytes().get(4).is_none_or(|c| c.is_ascii_whitespace() || *c == b'(')
    }) || name.starts_with("GIOVE-A") || name.starts_with("GIOVE-B") || name == "GALILEO" || name.starts_with("GALILEO ") || name.starts_with("GALILEO-");
    galileo.then_some("galileo")
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn galileo_is_not_the_indian_gsat_family() {
        for name in ["GSAT0101 (GALILEO-PFM)", "GSAT0234 (GALILEO 34)", "GSAT0001 (GIOVE-A)"] { assert_eq!(family(1,name),Some("galileo")); }
        for name in ["GSAT-1", "GSAT-8", "GHGSAT-D", "MAGSAT", "GSAT12345"] { assert_eq!(family(1,name),None); }
        assert_eq!(family(25544,"ISS (ZARYA)"),Some("iss"));
        assert_eq!(family(43216,"STARLINK-TEST"),Some("starlink"));
    }
}
