#!/usr/bin/env bash
set -euo pipefail
umask 027

CONFIG_FILE="/etc/market-alpha-backup.env"
BACKUP_SCRIPT="/opt/ops/market-alpha-backup.sh"
POSTGRES_CONTAINER="market-alpha-scanner-market-alpha-postgres-1"
BACKUP_ROOT="/opt/backups/market-alpha"
POSTGRES_DIR="$BACKUP_ROOT/postgres"
SCANNER_DIR="$BACKUP_ROOT/scanner_output"
LOG_FILE="/var/log/market-alpha/post-deploy-backup.log"

install -d -o root -g sre -m 750 "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"
chown root:sre "$LOG_FILE"
chmod 640 "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
  printf "[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

latest_file() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -maxdepth 1 -type f -name "$pattern" -printf "%T@ %p\n" | sort -nr | head -n 1 | cut -d " " -f 2-
}

json_escape() {
  python3 -c 'import json, sys; print(json.dumps(sys.stdin.read()))'
}

write_monitoring_event() {
  local severity="$1"
  local status="$2"
  local message="$3"
  local metadata="$4"

  docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || return 0
  docker exec -i "$POSTGRES_CONTAINER" sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null' <<SQL || log "WARNING: monitoring event insert failed"
INSERT INTO monitoring_events (event_type, severity, status, message, metadata, created_at)
VALUES ('backup', '$severity', '$status', '$message', '$metadata'::jsonb, now());
SQL
}

on_error() {
  local line="$1"
  local metadata
  metadata="$(printf '{"script":"market-alpha-post-deploy-backup.sh","line":%s,"timestamp":"%s"}' "$line" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")")"
  write_monitoring_event "error" "error" "post-deploy backup failed" "$metadata"
}

trap 'on_error "$LINENO"' ERR

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

MARKET_ALPHA_BACKUP_RCLONE_REMOTE="${MARKET_ALPHA_BACKUP_RCLONE_REMOTE:-}"
MARKET_ALPHA_BACKUP_VERIFY_OFFSITE="${MARKET_ALPHA_BACKUP_VERIFY_OFFSITE:-1}"

[[ -x "$BACKUP_SCRIPT" ]] || fail "backup script is not executable: $BACKUP_SCRIPT"

log "Post-deploy backup started"
"$BACKUP_SCRIPT"

LATEST_PG="$(latest_file "$POSTGRES_DIR" "*.sql.gz")"
LATEST_SCANNER="$(latest_file "$SCANNER_DIR" "*.tar.gz")"

[[ -n "$LATEST_PG" && -f "$LATEST_PG" ]] || fail "latest Postgres backup was not found"
[[ -n "$LATEST_SCANNER" && -f "$LATEST_SCANNER" ]] || fail "latest scanner_output backup was not found"

log "Verifying Postgres gzip: $LATEST_PG"
gzip -t "$LATEST_PG" || fail "Postgres gzip verification failed"

log "Verifying scanner_output tar: $LATEST_SCANNER"
tar -tzf "$LATEST_SCANNER" >/dev/null || fail "scanner_output tar verification failed"

PG_SIZE_BYTES="$(stat -c "%s" "$LATEST_PG")"
SCANNER_SIZE_BYTES="$(stat -c "%s" "$LATEST_SCANNER")"
log "Verified Postgres backup size=${PG_SIZE_BYTES} bytes"
log "Verified scanner_output backup size=${SCANNER_SIZE_BYTES} bytes"

OFFSITE_STATUS="skipped"
if [[ -n "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE" && "$MARKET_ALPHA_BACKUP_VERIFY_OFFSITE" != "0" ]]; then
  command -v rclone >/dev/null 2>&1 || fail "rclone is not installed"
  PG_NAME="$(basename "$LATEST_PG")"
  SCANNER_NAME="$(basename "$LATEST_SCANNER")"
  log "Verifying offsite Postgres backup exists"
  rclone lsf "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE/postgres/" | grep -Fx "$PG_NAME" >/dev/null || fail "offsite Postgres backup missing: $PG_NAME"
  log "Verifying offsite scanner_output backup exists"
  rclone lsf "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE/scanner_output/" | grep -Fx "$SCANNER_NAME" >/dev/null || fail "offsite scanner_output backup missing: $SCANNER_NAME"
  OFFSITE_STATUS="ok"
elif [[ -n "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE" ]]; then
  OFFSITE_STATUS="disabled"
else
  log "WARNING: offsite verification skipped because backup remote is not configured"
fi

METADATA="$(python3 - <<PY
import json
from datetime import datetime, timezone

print(json.dumps({
    "postgres_backup": "$(basename "$LATEST_PG")",
    "postgres_size_bytes": int("$PG_SIZE_BYTES"),
    "scanner_backup": "$(basename "$LATEST_SCANNER")",
    "scanner_size_bytes": int("$SCANNER_SIZE_BYTES"),
    "offsite": "$OFFSITE_STATUS",
    "timestamp": datetime.now(timezone.utc).isoformat(),
}))
PY
)"
write_monitoring_event "info" "ok" "post-deploy backup completed" "$METADATA"

trap - ERR
log "Post-deploy backup SUCCESS"
