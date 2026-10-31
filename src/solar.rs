//! Bounded, validated local ephemeris cache. The importer serializes JPL calls.
use axum::{extract::Query, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
#[derive(Deserialize)]
pub struct Request { id: i64, at: f64 }
pub async fn vectors(Query(q): Query<Request>) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !q.at.is_finite() || q.at < -5364662400.0 || q.at > 7258118400.0 || !(1..100000).contains(&q.id) {
        return Err((StatusCode::BAD_REQUEST,Json(json!({"error":"Date ou corps invalide"}))));
    }
    let output=tokio::process::Command::new("python3").arg("scripts/solar_vectors.py").arg("--id").arg(q.id.to_string()).arg("--at").arg(q.at.to_string()).output().await
        .map_err(|_|(StatusCode::SERVICE_UNAVAILABLE,Json(json!({"error":"Importateur local indisponible"}))))?;
    let data: Value=serde_json::from_slice(&output.stdout).map_err(|_|(StatusCode::SERVICE_UNAVAILABLE,Json(json!({"error":"Éphémérides indisponibles"}))))?;
    Ok(Json(data))
}
