#!/usr/bin/env bash
# Relaunch the current source on the usual preview port, keeping existing data.
set -euo pipefail
ATLAS_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ATLAS_REPO_DIR"
ATLAS_PREVIEW_DATA="$ATLAS_REPO_DIR/../../outputs/starlink-atlas/data"
if [[ -n "${DATA_DIR:-}" ]]; then
  ATLAS_PREVIEW_DATA="$DATA_DIR"
elif [[ ! -d "$ATLAS_PREVIEW_DATA" ]]; then
  ATLAS_PREVIEW_DATA="$ATLAS_REPO_DIR/data"
fi
printf '%s\n' 'Compilation de la version actuelle avant de relancer Atlas…'
cargo build --release --locked --offline
ATLAS_LISTENERS="$(lsof -nP -tiTCP:3003 -sTCP:LISTEN || true)"
if [[ -n "$ATLAS_LISTENERS" ]]; then
  while IFS= read -r ATLAS_PID; do
    ATLAS_PROCESS="$(ps -p "$ATLAS_PID" -o comm= || true)"
    case "$ATLAS_PROCESS" in
      *starlink-atlas*) kill "$ATLAS_PID" ;;
      *) printf 'Le port 3003 est utilisé par un autre programme : %s\n' "$ATLAS_PROCESS" >&2; exit 1 ;;
    esac
  done <<< "$ATLAS_LISTENERS"
  for ATLAS_ATTEMPT in {1..30}; do
    if ! lsof -nP -tiTCP:3003 -sTCP:LISTEN >/dev/null 2>&1; then break; fi
    sleep 0.1
  done
fi
printf '%s\n' 'Atlas à jour : http://127.0.0.1:3003/atlas'
BIND=127.0.0.1:3003 DATA_DIR="$ATLAS_PREVIEW_DATA" exec "$ATLAS_REPO_DIR/target/release/starlink-atlas"
