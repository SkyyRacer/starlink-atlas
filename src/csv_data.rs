//! RFC 4180 records for the public SATCAT bulk CSV, including quoted UTF-8 names.
pub fn catalogue(bytes: &[u8]) -> Result<Vec<serde_json::Value>,String> {
    let text=std::str::from_utf8(bytes).map_err(|e|e.to_string())?.trim_start_matches('\u{feff}');
    let mut rows=Vec::new();let mut row=Vec::new();let mut field=String::new();let mut quoted=false;let mut chars=text.chars().peekable();
    while let Some(c)=chars.next() {
        match c {
            '"' if quoted && chars.peek()==Some(&'"') => {field.push('"');chars.next();},
            '"' => quoted=!quoted,
            ',' if !quoted => {row.push(std::mem::take(&mut field));},
            '\n' if !quoted => {row.push(std::mem::take(&mut field));if row.iter().any(|s|!s.is_empty()){rows.push(std::mem::take(&mut row));}else{row.clear();}},
            '\r' if !quoted && chars.peek()==Some(&'\n') => {},
            other => field.push(other),
        }
    }
    if quoted { return Err("CSV incomplet : guillemets non fermés".into()); }
    if !field.is_empty() || !row.is_empty() {row.push(field);rows.push(row);}
    if rows.is_empty(){return Err("Catalogue CSV vide".into());}
    let header=rows.remove(0);if !["OBJECT_NAME","NORAD_CAT_ID","OBJECT_TYPE","ORBIT_CENTER"].iter().all(|key|header.iter().any(|h|h==key)){return Err("En-tête SATCAT CSV incorrect".into());}
    rows.into_iter().map(|row|{
        if row.len()!=header.len(){return Err("Nombre de colonnes CSV incorrect".into());}
        let mut object=serde_json::Map::new();
        for (key,value) in header.iter().zip(row) {object.insert(key.clone(),if key=="NORAD_CAT_ID"{serde_json::json!(value.parse::<u64>().map_err(|_|"Identifiant NORAD invalide")?)}else{serde_json::Value::String(value)});}
        Ok(serde_json::Value::Object(object))
    }).collect()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn csv_preserves_quotes_commas_newlines_unicode_and_large_ids(){
        assert!(catalogue(b"OBJECT_NAME,NORAD_CAT_ID,OBJECT_TYPE,ORBIT_CENTER\n\"unclosed").is_err());
        let rows=catalogue("OBJECT_NAME,NORAD_CAT_ID,OBJECT_TYPE,ORBIT_CENTER\r\n\"Étage, \"\"essai\"\"\norbital\",100001,R/B,EA\r\n".as_bytes()).unwrap();
        assert_eq!(rows[0]["NORAD_CAT_ID"],100001);assert_eq!(rows[0]["OBJECT_NAME"],"Étage, \"essai\"\norbital");
        assert!(catalogue(b"<html>no CSV</html>").is_err());assert!(catalogue(b"OBJECT_NAME,NORAD_CAT_ID,OBJECT_TYPE,ORBIT_CENTER\nx,1").is_err());
    }
}
