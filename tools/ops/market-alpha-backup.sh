#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

CONFIG_FILE="/etc/market-alpha-backup.env"
POSTGRES_CONTAINER="market-alpha-scanner-market-alpha-postgres-1"
BACKUP_ROOT="/opt/backups/market-alpha"
POSTGRES_DIR="$BACKUP_ROOT/postgres"
SCANNER_DIR="$BACKUP_ROOT/scanner_output"
SCANNER_SOURCE="/opt/apps/market-alpha-scanner/runtime/scanner_output"
LOG_FILE="/var/log/market-alpha/backup.log"

BOUNDED_PIDS=()
LAST_RETRY_ATTEMPTS_USED=0
SCRIPT_STARTED_SECONDS=$SECONDS
BACKUP_ENV_OVERRIDE_NAMES=(
  MARKET_ALPHA_BACKUP_RCLONE_REMOTE
  MARKET_ALPHA_BACKUP_REQUIRE_OFFSITE
  MARKET_ALPHA_BACKUP_RCLONE_COPY_TIMEOUT_SECONDS
  MARKET_ALPHA_BACKUP_RCLONE_OP_TIMEOUT
  MARKET_ALPHA_BACKUP_RCLONE_CONNECT_TIMEOUT
  MARKET_ALPHA_BACKUP_RCLONE_RETRIES
  MARKET_ALPHA_BACKUP_RCLONE_LOW_LEVEL_RETRIES
  MARKET_ALPHA_BACKUP_RCLONE_TRANSFERS
  MARKET_ALPHA_BACKUP_RCLONE_CHECKERS
  MARKET_ALPHA_BACKUP_RCLONE_STATS_INTERVAL
  MARKET_ALPHA_BACKUP_RCLONE_COPY_ATTEMPTS
  MARKET_ALPHA_BACKUP_RCLONE_COPY_BACKOFF_SECONDS
)
declare -A BACKUP_ENV_OVERRIDES=()

capture_env_overrides() {
  local name
  for name in "${BACKUP_ENV_OVERRIDE_NAMES[@]}"; do
    if [[ ${!name+x} ]]; then
      BACKUP_ENV_OVERRIDES["$name"]="${!name}"
    fi
  done
}

restore_env_overrides() {
  local name
  for name in "${BACKUP_ENV_OVERRIDE_NAMES[@]}"; do
    if [[ ${BACKUP_ENV_OVERRIDES[$name]+x} ]]; then
      printf -v "$name" "%s" "${BACKUP_ENV_OVERRIDES[$name]}"
    fi
  done
}

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

kill_process_group() {
  local pid="$1"
  kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  sleep 5
  kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
}

cleanup_bounded_processes() {
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    for pid in "${BOUNDED_PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        log "Cleaning up bounded child process group: $pid"
        kill_process_group "$pid"
      fi
    done
  fi
}

trap cleanup_bounded_processes EXIT

run_bounded() {
  local limit_seconds="$1"
  shift
  local command_display="$*"
  local child
  local started
  local status=0

  setsid "$@" &
  child=$!
  BOUNDED_PIDS+=("$child")
  started=$SECONDS

  while kill -0 "$child" 2>/dev/null; do
    if (( SECONDS - started >= limit_seconds )); then
      log "ERROR: command timed out after ${limit_seconds}s: ${command_display}"
      kill_process_group "$child"
      wait "$child" 2>/dev/null || true
      return 124
    fi
    sleep 1
  done

  wait "$child" || status=$?
  return "$status"
}

run_bounded_retry() {
  local attempts="$1"
  local backoff_seconds="$2"
  local limit_seconds="$3"
  shift 3
  local attempt
  local status=0

  LAST_RETRY_ATTEMPTS_USED=0
  for attempt in $(seq 1 "$attempts"); do
    LAST_RETRY_ATTEMPTS_USED="$attempt"
    if run_bounded "$limit_seconds" "$@"; then
      if [[ "$attempt" -gt 1 ]]; then
        log "Retry attempt ${attempt}/${attempts} succeeded"
      fi
      return 0
    fi
    status=$?
    if [[ "$attempt" -lt "$attempts" ]]; then
      log "WARNING: command attempt ${attempt}/${attempts} failed with status ${status}; retrying in ${backoff_seconds}s"
      sleep "$backoff_seconds"
    fi
  done

  return "$status"
}

capture_env_overrides
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi
restore_env_overrides

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
MARKET_ALPHA_BACKUP_RCLONE_REMOTE="${MARKET_ALPHA_BACKUP_RCLONE_REMOTE:-}"
MARKET_ALPHA_BACKUP_REQUIRE_OFFSITE="${MARKET_ALPHA_BACKUP_REQUIRE_OFFSITE:-0}"
RCLONE_COPY_TIMEOUT_SECONDS="${MARKET_ALPHA_BACKUP_RCLONE_COPY_TIMEOUT_SECONDS:-900}"
RCLONE_OP_TIMEOUT="${MARKET_ALPHA_BACKUP_RCLONE_OP_TIMEOUT:-60s}"
RCLONE_CONNECT_TIMEOUT="${MARKET_ALPHA_BACKUP_RCLONE_CONNECT_TIMEOUT:-20s}"
RCLONE_RETRIES="${MARKET_ALPHA_BACKUP_RCLONE_RETRIES:-2}"
RCLONE_LOW_LEVEL_RETRIES="${MARKET_ALPHA_BACKUP_RCLONE_LOW_LEVEL_RETRIES:-3}"
RCLONE_TRANSFERS="${MARKET_ALPHA_BACKUP_RCLONE_TRANSFERS:-4}"
RCLONE_CHECKERS="${MARKET_ALPHA_BACKUP_RCLONE_CHECKERS:-8}"
RCLONE_STATS_INTERVAL="${MARKET_ALPHA_BACKUP_RCLONE_STATS_INTERVAL:-30s}"
RCLONE_COPY_ATTEMPTS="${MARKET_ALPHA_BACKUP_RCLONE_COPY_ATTEMPTS:-3}"
RCLONE_COPY_BACKOFF_SECONDS="${MARKET_ALPHA_BACKUP_RCLONE_COPY_BACKOFF_SECONDS:-45}"

RCLONE_FLAGS=(
  --contimeout "$RCLONE_CONNECT_TIMEOUT"
  --timeout "$RCLONE_OP_TIMEOUT"
  --retries "$RCLONE_RETRIES"
  --low-level-retries "$RCLONE_LOW_LEVEL_RETRIES"
  --stats-one-line
  --stats "$RCLONE_STATS_INTERVAL"
  --transfers "$RCLONE_TRANSFERS"
  --checkers "$RCLONE_CHECKERS"
)

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

metadata_json() {
  local classification="$1"
  local offsite_status="$2"
  local pg_file="${3:-}"
  local scanner_file="${4:-}"
  local exit_code="${5:-0}"
  local retry_count="${6:-0}"
  local duration_seconds="${7:-0}"
  local failure_type="${8:-}"
  python3 - "$classification" "$offsite_status" "$pg_file" "$scanner_file" "$exit_code" "$retry_count" "$duration_seconds" "$failure_type" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

classification, offsite_status, pg_file, scanner_file, exit_code, retry_count, duration_seconds, failure_type = sys.argv[1:9]
payload = {
    "script": "market-alpha-backup.sh",
    "classification": classification,
    "offsite_status": offsite_status,
    "postgres_backup": os.path.basename(pg_file) if pg_file else None,
    "scanner_backup": os.path.basename(scanner_file) if scanner_file else None,
    "exit_code": int(exit_code),
    "retry_count": int(retry_count),
    "duration_seconds": int(duration_seconds),
    "timestamp": datetime.now(timezone.utc).isoformat(),
}
if failure_type:
    payload["failure_type"] = failure_type
print(json.dumps(payload))
PY
}

duration_seconds() {
  printf "%s" "$((SECONDS - SCRIPT_STARTED_SECONDS))"
}

failure_type_for_status() {
  local status="$1"
  if [[ "$status" -eq 124 ]]; then
    printf "timeout"
  else
    printf "rclone_error"
  fi
}

install -d -o root -g sre -m 750 "$POSTGRES_DIR" "$SCANNER_DIR"

unique_path() {
  local dir="$1"
  local suffix="$2"
  local stamp base candidate idx
  stamp="$(date +"%Y-%m-%d_%H-%M")"
  base="$dir/$stamp"
  candidate="$base$suffix"
  idx=1
  while [[ -e "$candidate" || -e "$candidate.tmp" ]]; do
    candidate="$base-$idx$suffix"
    idx=$((idx + 1))
  done
  printf "%s" "$candidate"
}

finalize_file() {
  local tmp="$1"
  local final="$2"
  chown root:sre "$tmp"
  chmod 640 "$tmp"
  mv -f "$tmp" "$final"
  chown root:sre "$final"
  chmod 640 "$final"
  log "Created $(du -h "$final" | awk "{print \$1}") $final"
}

log "Backup started"

docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || fail "Postgres container is not available"

PG_FILE="$(unique_path "$POSTGRES_DIR" ".sql.gz")"
PG_TMP="$PG_FILE.tmp"
rm -f "$PG_TMP"
log "Creating Postgres backup"
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -9 > "$PG_TMP"
gzip -t "$PG_TMP" || fail "Postgres gzip validation failed"
finalize_file "$PG_TMP" "$PG_FILE"

SCANNER_FILE="$(unique_path "$SCANNER_DIR" ".tar.gz")"
SCANNER_TMP="$SCANNER_FILE.tmp"
rm -f "$SCANNER_TMP"
log "Creating scanner_output backup"
if [[ -d "$SCANNER_SOURCE" ]]; then
  tar -C "$(dirname "$SCANNER_SOURCE")" -czf "$SCANNER_TMP" "$(basename "$SCANNER_SOURCE")"
else
  mkdir -p /tmp/market-alpha-empty-scanner-output
  tar -C /tmp -czf "$SCANNER_TMP" market-alpha-empty-scanner-output
fi
tar -tzf "$SCANNER_TMP" >/dev/null || fail "Scanner tar validation failed"
finalize_file "$SCANNER_TMP" "$SCANNER_FILE"

LOCAL_METADATA="$(metadata_json "local_backup_ok" "pending" "$PG_FILE" "$SCANNER_FILE" 0)"
write_monitoring_event "info" "local_backup_ok" "local backup completed" "$LOCAL_METADATA"

if [[ -n "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE" ]]; then
  command -v rclone >/dev/null 2>&1 || fail "rclone is not installed"
  log "Syncing backups off-host with bounded rclone timeout=${RCLONE_COPY_TIMEOUT_SECONDS}s attempts=${RCLONE_COPY_ATTEMPTS}"
  if run_bounded_retry "$RCLONE_COPY_ATTEMPTS" "$RCLONE_COPY_BACKOFF_SECONDS" "$RCLONE_COPY_TIMEOUT_SECONDS" rclone "${RCLONE_FLAGS[@]}" copy "$BACKUP_ROOT" "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE"; then
    OFFSITE_METADATA="$(metadata_json "offsite_sync_ok" "ok" "$PG_FILE" "$SCANNER_FILE" 0 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)")"
    write_monitoring_event "info" "offsite_sync_ok" "offsite backup sync completed" "$OFFSITE_METADATA"
    log "Off-host sync complete"
  else
    RCLONE_EXIT=$?
    FAILURE_TYPE="$(failure_type_for_status "$RCLONE_EXIT")"
    OFFSITE_METADATA="$(metadata_json "offsite_sync_failed" "offsite_sync_failed" "$PG_FILE" "$SCANNER_FILE" "$RCLONE_EXIT" "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE")"
    write_monitoring_event "error" "offsite_sync_failed" "offsite backup sync failed; local backup remains available" "$OFFSITE_METADATA"
    OFFSITE_METADATA="$(metadata_json "backup_partial" "offsite_sync_failed" "$PG_FILE" "$SCANNER_FILE" "$RCLONE_EXIT" "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE")"
    write_monitoring_event "error" "backup_partial" "backup partial: offsite sync failed" "$OFFSITE_METADATA"
    log "ERROR: off-host sync failed; local backup remains available"
    log "Backup PARTIAL"
    exit 2
  fi
elif [[ "$MARKET_ALPHA_BACKUP_REQUIRE_OFFSITE" == "1" ]]; then
  fail "MARKET_ALPHA_BACKUP_RCLONE_REMOTE is required for off-host backups"
else
  SKIP_METADATA="$(metadata_json "local_backup_ok" "offsite_not_configured" "$PG_FILE" "$SCANNER_FILE" 0)"
  write_monitoring_event "warning" "local_backup_ok" "local backup completed without offsite configuration" "$SKIP_METADATA"
  log "WARNING: off-host backup remote is not configured"
fi

SUCCESS_METADATA="$(metadata_json "backup_success" "ok" "$PG_FILE" "$SCANNER_FILE" 0 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)")"
write_monitoring_event "info" "backup_success" "backup completed" "$SUCCESS_METADATA"
log "Backup SUCCESS"
