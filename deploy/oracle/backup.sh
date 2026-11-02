#!/bin/sh
# Run from the repository root. Both writers stop for a consistent snapshot.
set -eu
compose() {
    docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml "$@"
}
restart() { compose up -d app maintenance; }
compose stop maintenance app
trap restart EXIT
compose --profile tools run --rm --no-deps backup
