#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run sandbox
log_dir=$(mktemp -d /tmp/printnow-e2e.XXXXXX)
export PRINTNOW_BUILD_DIR=.next-marketplace
export PRINTNOW_E2E_URL=http://localhost:3101
setsid node --use-env-proxy node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101 >"$log_dir/web.log" 2>&1 &
web_pid=$!
setsid node --use-env-proxy --env-file-if-exists=.env.local workers/runner.mjs >"$log_dir/worker.log" 2>&1 &
worker_pid=$!
cleanup(){
 status=$?
 kill -- -"$web_pid" -"$worker_pid" 2>/dev/null || true
 if [[ "$status" != 0 ]];then tail -80 "$log_dir/web.log";tail -40 "$log_dir/worker.log";fi
 exit "$status"
}
trap cleanup EXIT
ready=0
for attempt in {1..60};do
 if curl --silent --fail --max-time 3 "$PRINTNOW_E2E_URL" >/dev/null;then ready=1;break;fi
 sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Development test server did not become ready.';exit 1; }
npm exec playwright -- test -c playwright.marketplace.config.ts
