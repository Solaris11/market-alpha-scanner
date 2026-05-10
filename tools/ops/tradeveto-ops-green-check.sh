#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${TRADEVETO_OPS_BASE_URL:-https://tradeveto.com}"
APP_DIR="${TRADEVETO_APP_DIR:-/opt/apps/market-alpha-scanner/app}"
LOG_DIR="${TRADEVETO_LOG_DIR:-/var/log/market-alpha}"
BACKUP_ROOT="${TRADEVETO_BACKUP_ROOT:-/opt/backups/market-alpha}"
BACKUP_ENV_FILE="${TRADEVETO_BACKUP_ENV_FILE:-/etc/market-alpha-backup.env}"
POSTGRES_CONTAINER="${TRADEVETO_POSTGRES_CONTAINER:-market-alpha-scanner-market-alpha-postgres-1}"
HTTP_TIMEOUT_SECONDS="${TRADEVETO_OPS_HTTP_TIMEOUT_SECONDS:-12}"
RCLONE_STALE_SECONDS="${TRADEVETO_RCLONE_STALE_SECONDS:-3600}"
SCANNER_STALE_SECONDS="${TRADEVETO_SCANNER_STALE_SECONDS:-7200}"

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
TMP_FILES=()

cleanup() {
  local file
  for file in "${TMP_FILES[@]+"${TMP_FILES[@]}"}"; do
    rm -f "$file"
  done
}
trap cleanup EXIT

usage() {
  cat <<'USAGE'
Usage: tradeveto-ops-green-check.sh [--base-url URL] [--app-dir PATH] [--log-dir PATH] [--backup-root PATH]

Read-only production ops green check for TradeVeto. It performs route, TLS,
Docker, Postgres, cron, backup, rclone, scanner-process, and log-safety checks.

Environment overrides:
  TRADEVETO_OPS_BASE_URL
  TRADEVETO_APP_DIR
  TRADEVETO_LOG_DIR
  TRADEVETO_BACKUP_ROOT
  TRADEVETO_BACKUP_ENV_FILE
  TRADEVETO_POSTGRES_CONTAINER
  TRADEVETO_OPS_HTTP_TIMEOUT_SECONDS
  TRADEVETO_RCLONE_STALE_SECONDS
  TRADEVETO_SCANNER_STALE_SECONDS
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --log-dir)
      LOG_DIR="${2:-}"
      shift 2
      ;;
    --backup-root)
      BACKUP_ROOT="${2:-}"
      shift 2
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

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  log "PASS: $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  log "WARN: $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  log "FAIL: $*"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

new_tmp() {
  local file
  file="$(mktemp)"
  TMP_FILES+=("$file")
  printf '%s' "$file"
}

url_for_path() {
  local path="$1"
  printf '%s/%s' "${BASE_URL%/}" "${path#/}"
}

host_from_base_url() {
  printf '%s' "$BASE_URL" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##; s/:.*$//'
}

status_allowed() {
  local code="$1"
  local expected="$2"
  local item
  for item in $expected; do
    if [[ "$code" == "$item" ]]; then
      return 0
    fi
  done
  return 1
}

check_http() {
  local name="$1"
  local path="$2"
  local expected="$3"
  local body
  local err
  local output
  local code
  local time_total
  body="$(new_tmp)"
  err="$(new_tmp)"
  output="$(
    curl -sS -o "$body" -w '%{http_code} %{time_total}' \
      --max-time "$HTTP_TIMEOUT_SECONDS" \
      -A 'TradeVetoOpsGreenCheck/1.0 (+https://tradeveto.com)' \
      "$(url_for_path "$path")" 2>"$err"
  )"
  code="$(printf '%s' "$output" | awk '{print $1}')"
  time_total="$(printf '%s' "$output" | awk '{print $2}')"
  if status_allowed "$code" "$expected"; then
    pass "$name returned HTTP $code in ${time_total}s"
  else
    local error_text
    error_text="$(tr '\n' ' ' < "$err" | cut -c 1-180)"
    fail "$name expected [$expected] but got HTTP ${code:-none}; ${error_text:-no curl error}"
  fi
}

check_head() {
  local name="$1"
  local path="$2"
  local expected_content_type="$3"
  local header_file
  local code
  header_file="$(new_tmp)"
  code="$(
    curl -sS -I -o "$header_file" -w '%{http_code}' \
      --max-time "$HTTP_TIMEOUT_SECONDS" \
      -A 'TradeVetoOpsGreenCheck/1.0 (+https://tradeveto.com)' \
      "$(url_for_path "$path")" 2>/dev/null
  )"
  if [[ "$code" != "200" ]]; then
    fail "$name HEAD expected 200 but got HTTP ${code:-none}"
    return
  fi
  if grep -Eiq "^content-type:[[:space:]]*${expected_content_type}" "$header_file"; then
    pass "$name HEAD returned 200 with ${expected_content_type}"
  else
    fail "$name HEAD returned 200 but content-type did not match ${expected_content_type}"
  fi
}

check_tls() {
  if [[ "$BASE_URL" != https://* ]]; then
    warn "TLS check skipped for non-HTTPS base URL: $BASE_URL"
    return
  fi
  if ! has_command openssl; then
    warn "openssl is unavailable; TLS certificate expiry was not checked"
    return
  fi
  local host
  local expiry
  local expiry_epoch
  local now_epoch
  local days_left
  host="$(host_from_base_url)"
  expiry="$(
    echo | openssl s_client -servername "$host" -connect "${host}:443" 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null \
      | sed 's/^notAfter=//'
  )"
  if [[ -z "$expiry" ]]; then
    fail "TLS certificate could not be read for $host"
    return
  fi
  expiry_epoch="$(date -j -f '%b %e %T %Y %Z' "$expiry" '+%s' 2>/dev/null || date -d "$expiry" '+%s' 2>/dev/null || true)"
  now_epoch="$(date '+%s')"
  if [[ -z "$expiry_epoch" ]]; then
    warn "TLS expiry parsed but not converted: $expiry"
    return
  fi
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
  if (( days_left < 14 )); then
    fail "TLS certificate expires in ${days_left} days"
  elif (( days_left < 30 )); then
    warn "TLS certificate expires in ${days_left} days"
  else
    pass "TLS certificate expires in ${days_left} days"
  fi
}

check_docker() {
  if ! has_command docker; then
    warn "docker is unavailable; container health was not checked"
    return
  fi
  local lines
  lines="$(docker ps --filter 'name=market-alpha' --format '{{.Names}} {{.Status}}' 2>/dev/null || true)"
  if [[ -z "$lines" ]]; then
    warn "No running market-alpha Docker containers visible to this user"
    return
  fi
  if printf '%s\n' "$lines" | grep -qi 'unhealthy'; then
    fail "At least one market-alpha container is unhealthy"
  else
    pass "Visible market-alpha containers are running without unhealthy status"
  fi
}

check_postgres_container() {
  if ! has_command docker; then
    warn "docker is unavailable; Postgres container health was not checked"
    return
  fi
  if ! docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
    warn "Postgres container not visible: $POSTGRES_CONTAINER"
    return
  fi
  if docker exec "$POSTGRES_CONTAINER" sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    pass "Postgres container accepts pg_isready"
  else
    fail "Postgres container failed pg_isready"
  fi
}

check_cron_file() {
  local name="$1"
  local file="$2"
  local expected="$3"
  if [[ ! -f "$file" ]]; then
    warn "$name cron file missing: $file"
    return
  fi
  if grep -q "$expected" "$file"; then
    pass "$name cron file exists and references $expected"
  else
    fail "$name cron file exists but does not reference $expected"
  fi
}

check_stale_processes() {
  if ! has_command ps || ! has_command awk; then
    warn "ps/awk unavailable; stale process checks skipped"
    return
  fi
  local stale_rclone
  local stale_scanner
  stale_rclone="$(ps -eo etimes=,comm= 2>/dev/null | awk -v max="$RCLONE_STALE_SECONDS" '$2 ~ /rclone/ && $1 > max { c++ } END { print c + 0 }')"
  stale_scanner="$(ps -eo etimes=,args= 2>/dev/null | awk -v max="$SCANNER_STALE_SECONDS" '$1 > max && $0 ~ /(investment_scanner_mvp|scanner-job|run-scanner)/ { c++ } END { print c + 0 }')"
  if [[ "$stale_rclone" == "0" ]]; then
    pass "No stale rclone processes older than ${RCLONE_STALE_SECONDS}s"
  else
    fail "Found ${stale_rclone} stale rclone process(es) older than ${RCLONE_STALE_SECONDS}s"
  fi
  if [[ "$stale_scanner" == "0" ]]; then
    pass "No stale scanner processes older than ${SCANNER_STALE_SECONDS}s"
  else
    fail "Found ${stale_scanner} stale scanner process(es) older than ${SCANNER_STALE_SECONDS}s"
  fi
}

latest_file() {
  local dir="$1"
  local pattern="$2"
  find "$dir" -maxdepth 1 -type f -name "$pattern" -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n 1 | cut -d' ' -f2-
}

check_backup_artifacts() {
  local latest_pg
  local latest_scanner
  latest_pg="$(latest_file "${BACKUP_ROOT}/postgres" '*.sql.gz')"
  latest_scanner="$(latest_file "${BACKUP_ROOT}/scanner_output" '*.tar.gz')"

  if [[ -z "$latest_pg" ]]; then
    fail "No local Postgres backup found in ${BACKUP_ROOT}/postgres"
  elif gzip -t "$latest_pg" >/dev/null 2>&1; then
    pass "Latest local Postgres backup gzip verifies"
  else
    fail "Latest local Postgres backup gzip failed verification"
  fi

  if [[ -z "$latest_scanner" ]]; then
    fail "No local scanner backup found in ${BACKUP_ROOT}/scanner_output"
  elif tar -tzf "$latest_scanner" >/dev/null 2>&1; then
    pass "Latest local scanner backup tar verifies"
  else
    fail "Latest local scanner backup tar failed verification"
  fi
}

backup_remote_from_env() {
  if [[ ! -f "$BACKUP_ENV_FILE" ]]; then
    return 1
  fi
  awk -F= '
    $1 == "MARKET_ALPHA_BACKUP_PRIMARY_REMOTE" && $2 != "" { print $2; found=1; exit }
    $1 == "MARKET_ALPHA_BACKUP_R2_REMOTE" && $2 != "" { candidate=$2 }
    END { if (!found && candidate != "") print candidate }
  ' "$BACKUP_ENV_FILE" | tr -d '"' | tr -d "'"
}

check_r2_listing() {
  if ! has_command rclone; then
    warn "rclone is unavailable; R2/offsite listing was not checked"
    return
  fi
  local remote
  remote="$(backup_remote_from_env || true)"
  if [[ -z "$remote" ]]; then
    warn "No R2/primary backup remote found in $BACKUP_ENV_FILE"
    return
  fi
  if timeout 45 rclone lsf "${remote%/}/postgres/" >/dev/null 2>&1 && timeout 45 rclone lsf "${remote%/}/scanner_output/" >/dev/null 2>&1; then
    pass "R2/offsite backup prefixes are listable"
  else
    fail "R2/offsite backup prefixes could not be listed"
  fi
}

check_log_secret_leakage() {
  if [[ ! -d "$LOG_DIR" ]]; then
    warn "Log directory missing: $LOG_DIR"
    return
  fi
  local matches
  matches="$(
    find "$LOG_DIR" -maxdepth 2 -type f -mtime -2 2>/dev/null \
      | xargs grep -Eil 'sk_(live|test)_|OPENAI_API_KEY=|STRIPE_(TEST_)?SECRET_KEY=|STRIPE_(TEST_)?WEBHOOK_SECRET=|SMTP_PASS=|postgresql://[^[:space:]]+:[^@[:space:]]+@' 2>/dev/null \
      | wc -l | tr -d ' '
  )"
  if [[ "${matches:-0}" == "0" ]]; then
    pass "No obvious secret patterns found in recent ops logs"
  else
    fail "Recent ops logs contain ${matches} file(s) with obvious secret patterns"
  fi
}

log "TradeVeto ops green check starting base_url=$BASE_URL app_dir=$APP_DIR"

check_http "Landing page" "/" "200"
check_http "Pricing page" "/pricing" "200"
check_http "Features page" "/features" "200"
check_http "App health" "/api/health" "200"
check_http "Deep health" "/api/health/deep" "200"
check_head "OpenGraph image" "/og-image.png" "image/png"
check_tls
check_docker
check_postgres_container
check_cron_file "Backup" "/etc/cron.d/market-alpha-backup" "tradeveto-backup"
check_cron_file "Monitoring synthetics" "/etc/cron.d/market-alpha-monitoring" "monitoring:synthetics"
check_cron_file "Stripe reconciliation" "/etc/cron.d/market-alpha-stripe-reconcile" "tradeveto-stripe-reconcile"
check_stale_processes
check_backup_artifacts
check_r2_listing
check_log_secret_leakage

log "SUMMARY: pass=$PASS_COUNT warn=$WARN_COUNT fail=$FAIL_COUNT"
if (( FAIL_COUNT > 0 )); then
  log "RESULT: OPS HARDENING STILL REQUIRED"
  exit 1
fi
if (( WARN_COUNT > 0 )); then
  log "RESULT: PRODUCTION OPS PARTIAL - warnings require review before broad launch"
  exit 2
fi
log "RESULT: PRODUCTION OPS GREEN"
