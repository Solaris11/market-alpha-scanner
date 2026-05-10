#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

CONFIG_FILE="${TRADEVETO_BACKUP_ENV_FILE:-/etc/market-alpha-backup.env}"
POSTGRES_CONTAINER="${TRADEVETO_POSTGRES_CONTAINER:-market-alpha-scanner-market-alpha-postgres-1}"
BACKUP_ROOT="${TRADEVETO_BACKUP_ROOT:-/opt/backups/market-alpha}"
POSTGRES_DIR="${TRADEVETO_POSTGRES_BACKUP_DIR:-${BACKUP_ROOT}/postgres}"
SCANNER_DIR="${TRADEVETO_SCANNER_BACKUP_DIR:-${BACKUP_ROOT}/scanner_output}"
WORK_ROOT="${TRADEVETO_RESTORE_DRILL_WORK_ROOT:-/tmp}"
DRILL_ID="tradeveto_restore_drill_$(date -u +%Y%m%dT%H%M%SZ)_$$"
WORK_DIR="${WORK_ROOT%/}/${DRILL_ID}"
RESTORE_DB="${TRADEVETO_RESTORE_DRILL_DB:-market_alpha_restore_$(date -u +%Y%m%d_%H%M%S)_$$}"
POSTGRES_BACKUP=""
SCANNER_BACKUP=""
KEEP_DB=0
KEEP_WORKDIR=0
SCRIPT_STARTED_SECONDS=$SECONDS

TABLES_TO_VERIFY=(
  scan_runs
  scanner_signals
  symbol_price_history
  forward_returns
  market_memory_snapshots
  narrative_intelligence_snapshots
  shock_move_patterns
  shock_move_events
  user_decision_journal
  community_replay_studies
  monitoring_events
)

usage() {
  cat <<'USAGE'
Usage: tradeveto-restore-drill.sh [options]

Runs an isolated production backup restore drill:
  - verifies latest Postgres and scanner_output backup archives
  - restores Postgres backup into a temporary database
  - verifies table presence and row counts
  - extracts scanner_output into a temporary path and verifies readability
  - drops the temporary database unless --keep-db is provided

Options:
  --postgres-backup PATH   Use a specific .sql.gz Postgres backup.
  --scanner-backup PATH    Use a specific .tar.gz scanner_output backup.
  --backup-root PATH       Backup root. Default: /opt/backups/market-alpha.
  --target-db NAME         Temporary restore database name.
  --work-dir PATH          Temporary working directory.
  --keep-db                Keep temporary restore DB for manual inspection.
  --keep-workdir           Keep temporary extracted scanner files.
  -h, --help               Show this help.

This script never restores over production.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --postgres-backup)
      POSTGRES_BACKUP="${2:-}"
      shift 2
      ;;
    --scanner-backup)
      SCANNER_BACKUP="${2:-}"
      shift 2
      ;;
    --backup-root)
      BACKUP_ROOT="${2:-}"
      POSTGRES_DIR="${BACKUP_ROOT%/}/postgres"
      SCANNER_DIR="${BACKUP_ROOT%/}/scanner_output"
      shift 2
      ;;
    --target-db)
      RESTORE_DB="${2:-}"
      shift 2
      ;;
    --work-dir)
      WORK_DIR="${2:-}"
      shift 2
      ;;
    --keep-db)
      KEEP_DB=1
      shift
      ;;
    --keep-workdir)
      KEEP_WORKDIR=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

duration_seconds() {
  printf '%s' "$((SECONDS - SCRIPT_STARTED_SECONDS))"
}

cleanup() {
  local status=$?
  if [[ "$KEEP_DB" -ne 1 ]]; then
    drop_restore_db || true
  fi
  if [[ "$KEEP_WORKDIR" -ne 1 && -n "$WORK_DIR" && -d "$WORK_DIR" ]]; then
    rm -rf "$WORK_DIR"
  fi
  return "$status"
}
trap cleanup EXIT

load_backup_env() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
  fi
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
}

latest_file() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

validate_restore_db_name() {
  if [[ ! "$RESTORE_DB" =~ ^[A-Za-z_][A-Za-z0-9_]{2,62}$ ]]; then
    fail "Unsafe restore DB name: $RESTORE_DB"
  fi
  if [[ "$RESTORE_DB" == "${POSTGRES_DB:-}" ]]; then
    fail "Refusing to restore into production database name: $RESTORE_DB"
  fi
}

docker_exec_postgres() {
  docker exec "$POSTGRES_CONTAINER" sh -lc "$1"
}

psql_restore_db() {
  docker exec -i "$POSTGRES_CONTAINER" sh -lc "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d '$RESTORE_DB'"
}

psql_restore_query() {
  local sql="$1"
  docker exec "$POSTGRES_CONTAINER" sh -lc "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d '$RESTORE_DB' -tAc \"$sql\""
}

create_restore_db() {
  log "Creating temporary restore database: $RESTORE_DB"
  docker_exec_postgres "dropdb -U \"\$POSTGRES_USER\" --if-exists '$RESTORE_DB'"
  docker_exec_postgres "createdb -U \"\$POSTGRES_USER\" '$RESTORE_DB'"
}

drop_restore_db() {
  docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || return 0
  docker_exec_postgres "dropdb -U \"\$POSTGRES_USER\" --if-exists '$RESTORE_DB'" >/dev/null 2>&1 || true
}

table_exists() {
  local table="$1"
  local exists
  exists="$(psql_restore_query "select exists (select 1 from information_schema.tables where table_schema='public' and table_name='${table}');" | tr -d '[:space:]')"
  [[ "$exists" == "t" || "$exists" == "true" ]]
}

count_table() {
  local table="$1"
  psql_restore_query "select count(*) from public.${table};" | tr -d '[:space:]'
}

backup_age_minutes() {
  local file="$1"
  local now
  local modified
  now="$(date +%s)"
  modified="$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null)"
  printf '%s' "$(( (now - modified) / 60 ))"
}

verify_postgres_backup() {
  [[ -n "$POSTGRES_BACKUP" && -f "$POSTGRES_BACKUP" ]] || fail "Postgres backup not found: ${POSTGRES_BACKUP:-missing}"
  log "Verifying Postgres backup archive: $POSTGRES_BACKUP"
  gzip -t "$POSTGRES_BACKUP" || fail "Postgres backup gzip verification failed"
  log "Postgres backup gzip OK size_bytes=$(wc -c < "$POSTGRES_BACKUP" | tr -d ' ') age_minutes=$(backup_age_minutes "$POSTGRES_BACKUP")"
}

restore_postgres_backup() {
  local start
  local elapsed
  start=$SECONDS
  log "Restoring Postgres backup into temporary DB"
  gunzip -c "$POSTGRES_BACKUP" | psql_restore_db >/dev/null
  elapsed=$((SECONDS - start))
  log "Postgres restore completed duration_seconds=$elapsed"
}

verify_restored_db() {
  local table_count
  local found
  local missing
  local table
  table_count="$(psql_restore_query "select count(*) from information_schema.tables where table_schema='public';" | tr -d '[:space:]')"
  [[ "${table_count:-0}" -gt 0 ]] || fail "Restored database has no public tables"
  log "Restored database public_table_count=$table_count"

  found=0
  missing=0
  for table in "${TABLES_TO_VERIFY[@]}"; do
    if table_exists "$table"; then
      found=$((found + 1))
      log "Restored table $table rows=$(count_table "$table")"
    else
      missing=$((missing + 1))
      log "WARNING: expected intelligence table missing in restored DB: $table"
    fi
  done

  if (( found < 6 )); then
    fail "Too few expected platform tables found in restore: found=$found missing=$missing"
  fi

  if table_exists scan_runs && table_exists scanner_signals; then
    local latest_scan
    local signal_count
    latest_scan="$(psql_restore_query "select coalesce(max(completed_at)::text, max(created_at)::text, '') from public.scan_runs;" | tr -d '\r')"
    signal_count="$(count_table scanner_signals)"
    log "Scanner restore evidence latest_scan='${latest_scan:-unknown}' scanner_signal_rows=${signal_count:-0}"
  fi

  if table_exists market_memory_snapshots; then
    log "Market memory snapshot rows=$(count_table market_memory_snapshots)"
  fi
  if table_exists shock_move_patterns; then
    log "Shock pattern rows=$(count_table shock_move_patterns)"
  fi
  if table_exists shock_move_events; then
    log "Shock event rows=$(count_table shock_move_events)"
  fi
  if table_exists community_replay_studies; then
    log "Replay study rows=$(count_table community_replay_studies)"
  fi
}

verify_scanner_backup() {
  [[ -n "$SCANNER_BACKUP" && -f "$SCANNER_BACKUP" ]] || fail "scanner_output backup not found: ${SCANNER_BACKUP:-missing}"
  log "Verifying scanner_output archive: $SCANNER_BACKUP"
  tar -tzf "$SCANNER_BACKUP" >/dev/null || fail "scanner_output tar verification failed"
  log "scanner_output tar OK size_bytes=$(wc -c < "$SCANNER_BACKUP" | tr -d ' ') age_minutes=$(backup_age_minutes "$SCANNER_BACKUP")"
}

restore_scanner_backup() {
  local extract_dir="$WORK_DIR/scanner_restore"
  local file_count
  local ranking_count
  local analysis_count
  mkdir -p "$extract_dir"
  log "Extracting scanner_output backup into $extract_dir"
  tar -xzf "$SCANNER_BACKUP" -C "$extract_dir"
  file_count="$(find "$extract_dir" -type f | wc -l | tr -d ' ')"
  ranking_count="$(find "$extract_dir" -type f \( -name 'full_ranking.csv' -o -name 'ranking.csv' \) | wc -l | tr -d ' ')"
  analysis_count="$(find "$extract_dir" -type f -path '*/analysis/*' | wc -l | tr -d ' ')"
  [[ "${file_count:-0}" -gt 0 ]] || fail "Extracted scanner_output archive contains no files"
  log "Scanner restore evidence files=$file_count ranking_files=$ranking_count analysis_files=$analysis_count"
}

main() {
  require_command docker
  require_command gzip
  require_command gunzip
  require_command tar
  load_backup_env
  validate_restore_db_name

  docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || fail "Postgres container not available: $POSTGRES_CONTAINER"

  if [[ -z "$POSTGRES_BACKUP" ]]; then
    POSTGRES_BACKUP="$(latest_file "$POSTGRES_DIR" '*.sql.gz')"
  fi
  if [[ -z "$SCANNER_BACKUP" ]]; then
    SCANNER_BACKUP="$(latest_file "$SCANNER_DIR" '*.tar.gz')"
  fi

  mkdir -p "$WORK_DIR"
  log "TradeVeto restore drill started restore_db=$RESTORE_DB work_dir=$WORK_DIR"
  log "Latest Postgres backup=${POSTGRES_BACKUP:-missing}"
  log "Latest scanner_output backup=${SCANNER_BACKUP:-missing}"

  verify_postgres_backup
  verify_scanner_backup
  create_restore_db
  restore_postgres_backup
  verify_restored_db
  restore_scanner_backup

  log "RTO_ESTIMATE_SECONDS=$(duration_seconds)"
  log "RPO_ESTIMATE_MINUTES_POSTGRES=$(backup_age_minutes "$POSTGRES_BACKUP")"
  log "RPO_ESTIMATE_MINUTES_SCANNER=$(backup_age_minutes "$SCANNER_BACKUP")"
  log "RESULT: BACKUP RESTORE DRILL PASSED"
}

main "$@"
