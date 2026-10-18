#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
name=printnow-development-db
image='postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
if docker container inspect "$name" >/dev/null 2>&1; then
 label=$(docker inspect --format '{{index .Config.Labels "app"}}' "$name")
 [[ "$label" == printnow-development ]] || { echo 'Existing container has a different owner; preserving it.'; exit 1; }
 docker start "$name" >/dev/null
else
 docker run -d --name "$name" --label app=printnow-development -p 127.0.0.1:55432:5432 -v printnow-development-db:/var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
fi
for attempt in {1..30}; do if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break;fi;sleep 1;done
run_sql(){ docker exec -i "$name" psql -qX -U postgres -v ON_ERROR_STOP=1 < "$1"; }
if [[ $(docker exec "$name" psql -qAt -U postgres -c "select to_regclass('auth.users') is not null") != t ]]; then run_sql supabase/tests/bootstrap.sql;fi
docker exec "$name" psql -q -U postgres -c 'create table if not exists public._dev_migrations(name text primary key)' >/dev/null
for migration in supabase/migrations/*.sql;do
 filename=$(basename "$migration")
 if [[ $(docker exec "$name" psql -qAt -U postgres -c "select count(*) from public._dev_migrations where name='$filename'") == 0 ]];then
  run_sql "$migration"
  docker exec "$name" psql -q -U postgres -c "insert into public._dev_migrations(name)values('$filename')" >/dev/null
 fi
done
run_sql supabase/tests/sandbox-seed.sql
node --input-type=module <<'JS'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = '.env.local';
const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
if (!existing.split(/\r?\n/).some(line => line.startsWith('PRINTNOW_LOCAL_DATABASE_URL='))) {
  const filesRoot = JSON.stringify(resolve('.printnow-files'));
  writeFileSync(path, existing + '\n# Explicit development sandbox only; ignored by production code.\nPRINTNOW_LOCAL_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/postgres\nPRINTNOW_LOCAL_FILES_ROOT=' + filesRoot + '\n');
  chmodSync(path, 0o600);
}
JS
printf '%s\n' 'Development database and sample accounts are ready. Run npm run dev and npm run worker in separate terminals.'
