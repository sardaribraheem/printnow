#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="printnow-db-test-$$"
image='postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
# No host port, no mounted application data, no network after image acquisition.
docker run --detach --rm --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
ready=0
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=1; break; fi
 sleep 1
done
if [[ "$ready" != 1 ]]; then docker logs "$container"; exit 1; fi
run_sql() { docker exec -i "$container" psql -X -U postgres -v ON_ERROR_STOP=1 < "$1"; }
run_sql supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do run_sql "$migration"; done
run_sql supabase/tests/identity.sql

run_sql supabase/tests/sandbox-seed.sql
run_sql supabase/tests/marketplace.sql
run_sql supabase/tests/retention_and_location.sql

node scripts/concurrency-tests.mjs "$container"
