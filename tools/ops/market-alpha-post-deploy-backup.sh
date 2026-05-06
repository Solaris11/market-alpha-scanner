#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

CONFIG_FILE="/etc/market-alpha-backup.env"
BACKUP_SCRIPT="/opt/ops/market-alpha-backup.sh"
POSTGRES_CONTAINER="market-alpha-scanner-market-alpha-postgres-1"
BACKUP_ROOT="/opt/backups/market-alpha"
POSTGRES_DIR="$BACKUP_ROOT/postgres"
SCANNER_DIR="$BACKUP_ROOT/scanner_output"
LOG_FILE="/var/log/market-alpha/post-deploy-backup.log"

BOUNDED_PIDS=()
SCRIPT_STARTED_SECONDS=$SECONDS
LAST_RETRY_ATTEMPTS_USED=0
BACKUP_ENV_OVERRIDE_NAMES=(
  MARKET_ALPHA_RCLONE_TIMEOUT_SECONDS
  MARKET_ALPHA_RCLONE_RETRIES
  MARKET_ALPHA_RCLONE_LOW_LEVEL_RETRIES
  MARKET_ALPHA_RCLONE_CONTIMEOUT
  MARKET_ALPHA_BACKUP_R2_REMOTE
  MARKET_ALPHA_BACKUP_PRIMARY_REMOTE
  MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER
  MARKET_ALPHA_BACKUP_GDRIVE_REMOTE
  MARKET_ALPHA_BACKUP_SECONDARY_REMOTE
  MARKET_ALPHA_BACKUP_SECONDARY_PROVIDER
  MARKET_ALPHA_BACKUP_SECONDARY_ENABLED
  MARKET_ALPHA_BACKUP_RCLONE_REMOTE
  MARKET_ALPHA_BACKUP_VERIFY_OFFSITE
  MARKET_ALPHA_BACKUP_RCLONE_LSF_TIMEOUT_SECONDS
  MARKET_ALPHA_BACKUP_RCLONE_OP_TIMEOUT
  MARKET_ALPHA_BACKUP_RCLONE_CONNECT_TIMEOUT
  MARKET_ALPHA_BACKUP_RCLONE_RETRIES
  MARKET_ALPHA_BACKUP_RCLONE_LOW_LEVEL_RETRIES
  MARKET_ALPHA_BACKUP_RCLONE_STATS_INTERVAL
  MARKET_ALPHA_BACKUP_RCLONE_VERIFY_ATTEMPTS
  MARKET_ALPHA_BACKUP_RCLONE_VERIFY_BACKOFF_SECONDS
  MARKET_ALPHA_BACKUP_RCLONE_COPY_TIMEOUT_SECONDS
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

apply_operator_override_aliases() {
  # Operator override aliases intentionally win over /etc/market-alpha-backup.env.
  if [[ -n "${MARKET_ALPHA_RCLONE_TIMEOUT_SECONDS:-}" ]]; then
    RCLONE_LSF_TIMEOUT_SECONDS="$MARKET_ALPHA_RCLONE_TIMEOUT_SECONDS"
  fi
  if [[ -n "${MARKET_ALPHA_RCLONE_RETRIES:-}" ]]; then
    RCLONE_RETRIES="$MARKET_ALPHA_RCLONE_RETRIES"
  fi
  if [[ -n "${MARKET_ALPHA_RCLONE_LOW_LEVEL_RETRIES:-}" ]]; then
    RCLONE_LOW_LEVEL_RETRIES="$MARKET_ALPHA_RCLONE_LOW_LEVEL_RETRIES"
  fi
  if [[ -n "${MARKET_ALPHA_RCLONE_CONTIMEOUT:-}" ]]; then
    RCLONE_CONNECT_TIMEOUT="$MARKET_ALPHA_RCLONE_CONTIMEOUT"
  fi
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

  for attempt in $(seq 1 "$attempts"); do
    LAST_RETRY_ATTEMPTS_USED="$attempt"
    if run_bounded "$limit_seconds" "$@"; then
      if [[ "$attempt" -gt 1 ]]; then
        log "Retry attempt ${attempt}/${attempts} succeeded"
      fi
      return 0
    else
      status=$?
    fi
    if [[ "$attempt" -lt "$attempts" ]]; then
      log "WARNING: command attempt ${attempt}/${attempts} failed with status ${status}; retrying in ${backoff_seconds}s"
      sleep "$backoff_seconds"
    fi
  done

  return "$status"
}

latest_file() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -maxdepth 1 -type f -name "$pattern" -printf "%T@ %p\n" | sort -nr | head -n 1 | cut -d " " -f 2-
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

safe_remote_label() {
  local remote="$1"
  if [[ "$remote" == *"://"* ]]; then
    printf "url-redacted"
  else
    printf "%s" "$remote"
  fi
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
  local provider="${9:-${MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER:-}}"
  local backup_path="${10:-${MARKET_ALPHA_BACKUP_PRIMARY_REMOTE:-}}"
  python3 - "$classification" "$offsite_status" "$pg_file" "$scanner_file" "$exit_code" "$retry_count" "$duration_seconds" "$failure_type" "$provider" "$(safe_remote_label "$backup_path")" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

classification, offsite_status, pg_file, scanner_file, exit_code, retry_count, duration_seconds, failure_type, provider, backup_path = sys.argv[1:11]
payload = {
    "script": "market-alpha-post-deploy-backup.sh",
    "classification": classification,
    "offsite_status": offsite_status,
    "postgres_backup": os.path.basename(pg_file) if pg_file else None,
    "scanner_backup": os.path.basename(scanner_file) if scanner_file else None,
    "postgres_size_bytes": os.path.getsize(pg_file) if pg_file and os.path.exists(pg_file) else None,
    "scanner_size_bytes": os.path.getsize(scanner_file) if scanner_file and os.path.exists(scanner_file) else None,
    "exit_code": int(exit_code),
    "retry_count": int(retry_count),
    "duration_seconds": int(duration_seconds),
    "timestamp": datetime.now(timezone.utc).isoformat(),
}
if provider:
    payload["provider"] = provider
    payload["offsite_provider"] = provider
    payload["active_backup_provider"] = provider
if backup_path:
    payload["backup_path"] = backup_path
if failure_type:
    payload["failure_type"] = failure_type
print(json.dumps(payload))
PY
}

on_error() {
  local line="$1"
  local metadata
  metadata="$(metadata_json "backup_failed" "unknown" "" "" "$line" "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "script_error")"
  write_monitoring_event "error" "backup_failed" "post-deploy backup failed" "$metadata"
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

trap 'on_error "$LINENO"' ERR

capture_env_overrides
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi
restore_env_overrides

MARKET_ALPHA_BACKUP_R2_REMOTE="${MARKET_ALPHA_BACKUP_R2_REMOTE:-}"
MARKET_ALPHA_BACKUP_GDRIVE_REMOTE="${MARKET_ALPHA_BACKUP_GDRIVE_REMOTE:-}"
MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER="${MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER:-}"
MARKET_ALPHA_BACKUP_PRIMARY_REMOTE="${MARKET_ALPHA_BACKUP_PRIMARY_REMOTE:-}"
MARKET_ALPHA_BACKUP_SECONDARY_PROVIDER="${MARKET_ALPHA_BACKUP_SECONDARY_PROVIDER:-gdrive}"
MARKET_ALPHA_BACKUP_SECONDARY_REMOTE="${MARKET_ALPHA_BACKUP_SECONDARY_REMOTE:-${MARKET_ALPHA_BACKUP_GDRIVE_REMOTE:-}}"
MARKET_ALPHA_BACKUP_SECONDARY_ENABLED="${MARKET_ALPHA_BACKUP_SECONDARY_ENABLED:-0}"
MARKET_ALPHA_BACKUP_RCLONE_REMOTE="${MARKET_ALPHA_BACKUP_RCLONE_REMOTE:-}"
MARKET_ALPHA_BACKUP_VERIFY_OFFSITE="${MARKET_ALPHA_BACKUP_VERIFY_OFFSITE:-1}"
RCLONE_LSF_TIMEOUT_SECONDS="${MARKET_ALPHA_BACKUP_RCLONE_LSF_TIMEOUT_SECONDS:-90}"
RCLONE_OP_TIMEOUT="${MARKET_ALPHA_BACKUP_RCLONE_OP_TIMEOUT:-60s}"
RCLONE_CONNECT_TIMEOUT="${MARKET_ALPHA_BACKUP_RCLONE_CONNECT_TIMEOUT:-20s}"
RCLONE_RETRIES="${MARKET_ALPHA_BACKUP_RCLONE_RETRIES:-2}"
RCLONE_LOW_LEVEL_RETRIES="${MARKET_ALPHA_BACKUP_RCLONE_LOW_LEVEL_RETRIES:-3}"
RCLONE_STATS_INTERVAL="${MARKET_ALPHA_BACKUP_RCLONE_STATS_INTERVAL:-30s}"
RCLONE_VERIFY_ATTEMPTS="${MARKET_ALPHA_BACKUP_RCLONE_VERIFY_ATTEMPTS:-3}"
RCLONE_VERIFY_BACKOFF_SECONDS="${MARKET_ALPHA_BACKUP_RCLONE_VERIFY_BACKOFF_SECONDS:-30}"
apply_operator_override_aliases

if [[ -z "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE" ]]; then
  if [[ -n "$MARKET_ALPHA_BACKUP_R2_REMOTE" ]]; then
    MARKET_ALPHA_BACKUP_PRIMARY_REMOTE="$MARKET_ALPHA_BACKUP_R2_REMOTE"
    MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER="r2"
  elif [[ -n "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE" ]]; then
    MARKET_ALPHA_BACKUP_PRIMARY_REMOTE="$MARKET_ALPHA_BACKUP_RCLONE_REMOTE"
  fi
fi

if [[ -z "$MARKET_ALPHA_BACKUP_RCLONE_REMOTE" && -n "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE" ]]; then
  MARKET_ALPHA_BACKUP_RCLONE_REMOTE="$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE"
fi

provider_for_remote() {
  local remote="$1"
  local configured="${2:-}"
  if [[ -n "$configured" ]]; then
    printf "%s" "$configured"
  elif [[ "$remote" == r2:* ]]; then
    printf "r2"
  elif [[ "$remote" == GDRIVE:* || "$remote" == gdrive:* ]]; then
    printf "gdrive"
  else
    printf "offsite"
  fi
}

MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER="$(provider_for_remote "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER")"
MARKET_ALPHA_BACKUP_SECONDARY_PROVIDER="$(provider_for_remote "$MARKET_ALPHA_BACKUP_SECONDARY_REMOTE" "$MARKET_ALPHA_BACKUP_SECONDARY_PROVIDER")"

RCLONE_FLAGS=(
  --contimeout "$RCLONE_CONNECT_TIMEOUT"
  --timeout "$RCLONE_OP_TIMEOUT"
  --retries "$RCLONE_RETRIES"
  --low-level-retries "$RCLONE_LOW_LEVEL_RETRIES"
  --stats-one-line
  --stats "$RCLONE_STATS_INTERVAL"
)

[[ -x "$BACKUP_SCRIPT" ]] || fail "backup script is not executable: $BACKUP_SCRIPT"

log "Post-deploy backup started"
set +e
"$BACKUP_SCRIPT"
BACKUP_STATUS=$?
set -e

if [[ "$BACKUP_STATUS" -eq 1 ]]; then
  fail "backup script failed before a complete local backup was available"
elif [[ "$BACKUP_STATUS" -eq 2 ]]; then
  log "WARNING: backup script reported partial backup; verifying local artifacts before failing offsite status"
elif [[ "$BACKUP_STATUS" -ne 0 ]]; then
  fail "backup script returned unexpected status: $BACKUP_STATUS"
fi

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
if [[ -n "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE" && "$MARKET_ALPHA_BACKUP_VERIFY_OFFSITE" != "0" ]]; then
  command -v rclone >/dev/null 2>&1 || fail "rclone is not installed"
  PG_NAME="$(basename "$LATEST_PG")"
  SCANNER_NAME="$(basename "$LATEST_SCANNER")"
  PG_LIST="$(mktemp)"
  SCANNER_LIST="$(mktemp)"
  RCLONE_STATUS=0
  trap 'rm -f "$PG_LIST" "$SCANNER_LIST"; on_error "$LINENO"' ERR

  log "Verifying primary offsite Postgres backup exists provider=${MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER}"
  if run_bounded_retry "$RCLONE_VERIFY_ATTEMPTS" "$RCLONE_VERIFY_BACKOFF_SECONDS" "$RCLONE_LSF_TIMEOUT_SECONDS" rclone "${RCLONE_FLAGS[@]}" lsf "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE/postgres/" > "$PG_LIST"; then
    :
  else
    RCLONE_STATUS=$?
    FAILURE_TYPE="$(failure_type_for_status "$RCLONE_STATUS")"
    METADATA="$(metadata_json "offsite_sync_failed" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "offsite_sync_failed" "post-deploy backup partial: offsite Postgres verification failed" "$METADATA"
    if [[ "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" == "r2" ]]; then
      METADATA="$(metadata_json "backup_r2_failure" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
      write_monitoring_event "error" "backup_r2_failure" "post-deploy backup partial: R2 Postgres verification failed" "$METADATA"
    fi
    METADATA="$(metadata_json "backup_partial" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "backup_partial" "post-deploy backup partial: offsite Postgres verification failed" "$METADATA"
    fail "offsite Postgres backup verification failed: $PG_NAME"
  fi
  grep -Fx "$PG_NAME" "$PG_LIST" >/dev/null || {
    METADATA="$(metadata_json "offsite_sync_failed" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_missing" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "offsite_sync_failed" "post-deploy backup partial: offsite Postgres backup missing" "$METADATA"
    if [[ "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" == "r2" ]]; then
      METADATA="$(metadata_json "backup_r2_failure" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_missing" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
      write_monitoring_event "error" "backup_r2_failure" "post-deploy backup partial: R2 Postgres backup missing" "$METADATA"
    fi
    METADATA="$(metadata_json "backup_partial" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_missing" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "backup_partial" "post-deploy backup partial: offsite Postgres backup missing" "$METADATA"
    fail "offsite Postgres backup missing: $PG_NAME"
  }

  log "Verifying primary offsite scanner_output backup exists provider=${MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER}"
  if run_bounded_retry "$RCLONE_VERIFY_ATTEMPTS" "$RCLONE_VERIFY_BACKOFF_SECONDS" "$RCLONE_LSF_TIMEOUT_SECONDS" rclone "${RCLONE_FLAGS[@]}" lsf "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE/scanner_output/" > "$SCANNER_LIST"; then
    :
  else
    RCLONE_STATUS=$?
    FAILURE_TYPE="$(failure_type_for_status "$RCLONE_STATUS")"
    METADATA="$(metadata_json "offsite_sync_failed" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "offsite_sync_failed" "post-deploy backup partial: offsite scanner_output verification failed" "$METADATA"
    if [[ "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" == "r2" ]]; then
      METADATA="$(metadata_json "backup_r2_failure" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
      write_monitoring_event "error" "backup_r2_failure" "post-deploy backup partial: R2 scanner_output verification failed" "$METADATA"
    fi
    METADATA="$(metadata_json "backup_partial" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "$FAILURE_TYPE" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "backup_partial" "post-deploy backup partial: offsite scanner_output verification failed" "$METADATA"
    fail "offsite scanner_output backup verification failed: $SCANNER_NAME"
  fi
  grep -Fx "$SCANNER_NAME" "$SCANNER_LIST" >/dev/null || {
    METADATA="$(metadata_json "offsite_sync_failed" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_missing" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "offsite_sync_failed" "post-deploy backup partial: offsite scanner_output backup missing" "$METADATA"
    if [[ "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" == "r2" ]]; then
      METADATA="$(metadata_json "backup_r2_failure" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_missing" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
      write_monitoring_event "error" "backup_r2_failure" "post-deploy backup partial: R2 scanner_output backup missing" "$METADATA"
    fi
    METADATA="$(metadata_json "backup_partial" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_missing" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "error" "backup_partial" "post-deploy backup partial: offsite scanner_output backup missing" "$METADATA"
    fail "offsite scanner_output backup missing: $SCANNER_NAME"
  }
  rm -f "$PG_LIST" "$SCANNER_LIST"
  trap 'on_error "$LINENO"' ERR
  OFFSITE_STATUS="ok"
  if [[ "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" == "r2" ]]; then
    METADATA="$(metadata_json "backup_r2_success" "ok" "$LATEST_PG" "$LATEST_SCANNER" 0 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
    write_monitoring_event "info" "backup_r2_success" "post-deploy R2 backup verified" "$METADATA"
  fi
elif [[ -n "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE" ]]; then
  OFFSITE_STATUS="disabled"
else
  log "WARNING: offsite verification skipped because backup remote is not configured"
fi

if [[ "$BACKUP_STATUS" -eq 2 ]]; then
  METADATA="$(metadata_json "backup_partial" "offsite_sync_failed" "$LATEST_PG" "$LATEST_SCANNER" 2 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "offsite_sync_failed" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
  write_monitoring_event "error" "backup_partial" "post-deploy backup partial: offsite sync failed" "$METADATA"
  fail "local backup verified but offsite sync failed"
fi

METADATA="$(metadata_json "backup_success" "$OFFSITE_STATUS" "$LATEST_PG" "$LATEST_SCANNER" 0 "$LAST_RETRY_ATTEMPTS_USED" "$(duration_seconds)" "" "$MARKET_ALPHA_BACKUP_PRIMARY_PROVIDER" "$MARKET_ALPHA_BACKUP_PRIMARY_REMOTE")"
write_monitoring_event "info" "backup_success" "post-deploy backup completed" "$METADATA"

trap - ERR
log "Post-deploy backup SUCCESS"
