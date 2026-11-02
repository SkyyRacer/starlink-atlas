#!/bin/sh
set -eu
python3 /app/deploy/oracle/seed.py
exec "$@"
