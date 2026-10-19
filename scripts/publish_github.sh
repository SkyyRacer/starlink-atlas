#!/bin/bash
# Run manually to publish. Preparing this script does not publish anything.
set -euo pipefail
source_dir="$(cd "$(dirname "$0")/.." && pwd)"
task_dir="$(cd "$source_dir/../.." && pwd)"
repo_dir="$task_dir/work/publish-repository"
export GH_CONFIG_DIR="$task_dir/work/github-cli"
gh_bin="$task_dir/work/tools/gh"
if [ ! -x "$gh_bin" ]; then gh_bin="$(command -v gh)"; fi
"$gh_bin" auth status --hostname github.com
[ "$(git -C "$repo_dir" remote get-url origin)" = 'https://github.com/SkyyRacer/starlink-atlas.git' ] || { echo 'Dépôt cible inattendu : arrêt.'; exit 1; }
[ "$(git -C "$repo_dir" branch --show-current)" = main ] || { echo 'Le dépôt de publication doit être sur main.'; exit 1; }
[ -z "$(git -C "$repo_dir" status --porcelain)" ] || { echo 'Le dépôt de publication contient des modifications. Les vérifier avant de relancer.'; exit 1; }
"$gh_bin" auth setup-git --hostname github.com
git -C "$repo_dir" pull --ff-only origin main
# Keep the existing orbital history and Git metadata. Copy only project sources.
rsync -a --exclude=.git --exclude=target --exclude=data --exclude=data-runtime --exclude=public --exclude=.env --exclude=.DS_Store --exclude=__pycache__ --exclude='*.pyc' --exclude='*.zip' --exclude='*.zip.sha256' "$source_dir/" "$repo_dir/"
mkdir -p "$repo_dir/data-seed"
for file in gp-debris.json debris-catalog.json debris-attempt.txt debris-fetched.txt gp-beidou.json beidou-catalog.json beidou-attempt.txt beidou-fetched.txt gp-cosmo-skymed.json cosmo-skymed-catalog.json cosmo-skymed-attempt.txt cosmo-skymed-fetched.txt gp-globalstar.json globalstar-catalog.json globalstar-attempt.txt globalstar-fetched.txt gp-glonass.json glonass-catalog.json glonass-attempt.txt glonass-fetched.txt gp-goes.json goes-catalog.json goes-attempt.txt goes-fetched.txt gp-iceye.json iceye-catalog.json iceye-attempt.txt iceye-fetched.txt gp-iridium.json iridium-catalog.json iridium-attempt.txt iridium-fetched.txt gp-meteosat.json meteosat-catalog.json meteosat-attempt.txt meteosat-fetched.txt gp-oneweb.json oneweb-catalog.json oneweb-attempt.txt oneweb-fetched.txt gp-pleiades-neo.json pleiades-neo-catalog.json pleiades-neo-attempt.txt pleiades-neo-fetched.txt gp-sentinel.json sentinel-catalog.json sentinel-attempt.txt sentinel-fetched.txt gp-gps.json gps-catalog.json gps-attempt.txt gps-fetched.txt gp-galileo.json galileo-catalog.json galileo-attempt.txt galileo-fetched.txt gp-iss.json iss-catalog.json iss-missions.json iss-evas.json iss-missions-attempt.txt iss-missions-full.txt iss-evas-attempt.txt iss-evas-full.txt; do
  if [ -f "$source_dir/data/$file" ]; then cp "$source_dir/data/$file" "$repo_dir/data-seed/$file"; fi
done
git -C "$repo_dir" add -A
if ! git -C "$repo_dir" diff --cached --quiet; then
  git -C "$repo_dir" commit -m 'Pages Atlas ISS et Starlink, fiches astronautes, EVA et interface'
fi
"$gh_bin" api --method PUT repos/SkyyRacer/starlink-atlas/pages -f build_type=workflow >/dev/null
git -C "$repo_dir" push origin main
echo 'Envoi terminé. GitHub Actions compile et publie ensuite le site.'
"$gh_bin" run list --repo SkyyRacer/starlink-atlas --workflow publish.yml --limit 3
echo 'Suivi : https://github.com/SkyyRacer/starlink-atlas/actions'
echo 'Site : https://skyyracer.github.io/starlink-atlas/'
