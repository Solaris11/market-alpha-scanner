#!/usr/bin/env bash
set -euo pipefail

LOCK_FILE="/var/lock/tradeveto-backup.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  printf "[%s] backup skipped: another backup run holds %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$LOCK_FILE" >&2
  exit 0
fi

/opt/ops/tradeveto-backup-lifecycle.sh --stage pre-backup
status=0
/opt/ops/market-alpha-backup.sh "$@" || status=$?
/opt/ops/tradeveto-backup-lifecycle.sh --stage post-backup || true
exit "$status"
