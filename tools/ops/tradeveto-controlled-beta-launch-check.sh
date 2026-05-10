#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRADEVETO_BETA_LAUNCH_BASE_URL:-https://tradeveto.com}"
TIMEOUT_SECONDS="${TRADEVETO_BETA_LAUNCH_TIMEOUT_SECONDS:-15}"
RUN_EXTENDED_QA="${TRADEVETO_BETA_LAUNCH_EXTENDED_QA:-false}"
ALLOW_DEGRADED_HEALTH="${TRADEVETO_BETA_LAUNCH_ALLOW_DEGRADED_HEALTH:-false}"

CURL_BIN="${CURL_BIN:-}"
PYTHON_BIN="${PYTHON_BIN:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tradeveto-beta-launch.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

usage() {
  cat <<'USAGE'
Usage: tradeveto-controlled-beta-launch-check.sh [options]

Read-only controlled public beta launch gate for TradeVeto. It checks public
routes, health, deep-health JSON, SEO/social essentials, security headers, and
optionally runs the focused Phase 11 QA scripts.

Options:
  --base-url URL             Target base URL. Default: https://tradeveto.com.
  --extended                 Run billing, email, security, API, and performance QA scripts.
  --allow-degraded-health    Allow /api/health/deep to be non-200. Use only for local dev.
  -h, --help                 Show this help.

Environment:
  TRADEVETO_BETA_LAUNCH_BASE_URL
  TRADEVETO_BETA_LAUNCH_TIMEOUT_SECONDS
  TRADEVETO_BETA_LAUNCH_EXTENDED_QA=true|false
  TRADEVETO_BETA_LAUNCH_ALLOW_DEGRADED_HEALTH=true|false
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --extended)
      RUN_EXTENDED_QA="true"
      shift
      ;;
    --allow-degraded-health)
      ALLOW_DEGRADED_HEALTH="true"
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

if [[ -z "$CURL_BIN" ]]; then
  if command -v curl >/dev/null 2>&1; then
    CURL_BIN="$(command -v curl)"
  elif [[ -x /usr/bin/curl ]]; then
    CURL_BIN="/usr/bin/curl"
  fi
fi

if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  elif [[ -x /usr/bin/python3 ]]; then
    PYTHON_BIN="/usr/bin/python3"
  fi
fi

log() {
  printf '[beta-launch] %s\n' "$*"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  log "PASS $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[beta-launch][WARN] %s\n' "$*" >&2
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[beta-launch][FAIL] %s\n' "$*" >&2
}

normalize_base_url() {
  printf '%s' "$BASE_URL" | sed 's#/$##'
}

contains_secret_pattern() {
  local file="$1"
  grep -Eiq 'sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|tvk_live_[A-Za-z0-9_-]{16,}|tvwhsec_[A-Za-z0-9_-]{16,}|postgres(ql)?://[^[:space:]]+:[^@[:space:]]+@|OPENAI_API_KEY=|SMTP_PASS=' "$file"
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

request_path() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local body_file="$TMP_DIR/body-$(printf '%s' "$method-$path" | tr -c 'A-Za-z0-9' '_')"
  local output
  local status
  local time_total
  output="$("$CURL_BIN" -sS -m "$TIMEOUT_SECONDS" -o "$body_file" -w '%{http_code} %{time_total}' -X "$method" "$(normalize_base_url)$path" || true)"
  status="$(printf '%s' "$output" | awk '{print $1}')"
  time_total="$(printf '%s' "$output" | awk '{print $2}')"

  if [[ ! "$status" =~ ^[0-9]{3}$ ]]; then
    fail "$method $path did not return an HTTP status"
    return
  fi
  if contains_secret_pattern "$body_file"; then
    fail "$method $path response contains a secret-like pattern"
  fi
  if status_allowed "$status" "$expected"; then
    pass "$method $path -> HTTP $status in ${time_total}s"
  else
    fail "$method $path expected [$expected], got HTTP $status"
  fi
}

check_headers() {
  local headers="$TMP_DIR/headers.txt"
  local status
  status="$("$CURL_BIN" -sSI -m "$TIMEOUT_SECONDS" -o "$headers" -w '%{http_code}' "$(normalize_base_url)/" || true)"
  if [[ "$status" != "200" ]]; then
    fail "Homepage HEAD expected 200, got ${status:-none}"
    return
  fi
  for header in \
    "content-security-policy:" \
    "strict-transport-security:" \
    "x-frame-options:" \
    "x-content-type-options:" \
    "referrer-policy:"; do
    if grep -iq "^$header" "$headers"; then
      pass "security header present: $header"
    else
      fail "missing security header: $header"
    fi
  done
}

check_deep_health_json() {
  local body="$TMP_DIR/deep-health.json"
  local status
  status="$("$CURL_BIN" -sS -m "$TIMEOUT_SECONDS" -o "$body" -w '%{http_code}' "$(normalize_base_url)/api/health/deep" || true)"
  if [[ "$status" != "200" ]]; then
    if [[ "$ALLOW_DEGRADED_HEALTH" == "true" ]]; then
      warn "/api/health/deep returned HTTP ${status:-none}; allowed for degraded/local check"
      return
    fi
    fail "/api/health/deep expected 200, got ${status:-none}"
    return
  fi
  if [[ -z "$PYTHON_BIN" ]]; then
    warn "python3 unavailable; deep-health JSON fields were not inspected"
    return
  fi
  "$PYTHON_BIN" - "$body" <<'PY' >"$TMP_DIR/deep-health-summary.txt" || {
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
checks = {
    "deep_ok": payload.get("ok") is True,
    "db_ok": (payload.get("db") or {}).get("status") == "ok",
    "backup_ok": (payload.get("backup") or {}).get("status") == "ok"
    or (payload.get("backup") or {}).get("overallBackup") == "ok"
    or (payload.get("backup") or {}).get("overall_backup") == "ok",
    "scanner_acceptable": (payload.get("scanner") or {}).get("status") in {"ok", "warn"},
}
for key, value in checks.items():
    print(f"{key}={str(value).lower()}")
if not all(checks.values()):
    raise SystemExit(1)
PY
    fail "/api/health/deep JSON did not meet beta launch criteria"
    sed 's/^/[beta-launch][deep-health] /' "$TMP_DIR/deep-health-summary.txt" >&2 || true
    return
  }
  sed 's/^/[beta-launch][deep-health] /' "$TMP_DIR/deep-health-summary.txt"
  pass "/api/health/deep JSON reports ok DB, backup, and scanner state"
}

check_metadata() {
  local route="$1"
  local html="$TMP_DIR/html-$(printf '%s' "$route" | tr -c 'A-Za-z0-9' '_')"
  local status
  status="$("$CURL_BIN" -sS -m "$TIMEOUT_SECONDS" -o "$html" -w '%{http_code}' "$(normalize_base_url)$route" || true)"
  if [[ "$status" != "200" ]]; then
    fail "$route metadata fetch expected 200, got ${status:-none}"
    return
  fi
  if grep -qi '<link rel="canonical" href="https://tradeveto.com' "$html"; then
    pass "$route canonical URL is present"
  else
    fail "$route is missing canonical TradeVeto URL"
  fi
  if grep -qi '<meta property="og:image" content="https://tradeveto.com/og-image.png"' "$html" &&
     grep -qi '<meta name="twitter:image" content="https://tradeveto.com/og-image.png"' "$html"; then
    pass "$route social image metadata is consistent"
  else
    fail "$route missing expected OpenGraph/Twitter image metadata"
  fi
}

check_required_docs() {
  local docs=(
    "docs/ops/phase-11-production-ops-green-check.md"
    "docs/ops/backup-restore.md"
    "docs/ops/phase-11-stripe-billing-launch-qa.md"
    "docs/ops/phase-11-email-infrastructure-qa.md"
    "docs/ops/phase-11-security-abuse-hardening.md"
    "docs/ops/phase-11-api-webhook-platform-hardening.md"
    "docs/ops/phase-11-llm-cost-controls.md"
    "docs/ops/phase-11-mobile-pwa-hardening.md"
    "docs/ops/phase-11-public-beta-onboarding.md"
    "docs/ops/phase-11-public-trust-content.md"
    "docs/ops/phase-11-controlled-public-beta-launch-checklist.md"
    "docs/ops/phase-12-production-parity-report.md"
  )
  local doc
  for doc in "${docs[@]}"; do
    if [[ -s "$REPO_ROOT/$doc" ]]; then
      pass "required launch doc exists: $doc"
    else
      fail "required launch doc missing or empty: $doc"
    fi
  done
}

run_child_check() {
  local label="$1"
  local script="$2"
  shift 2
  if [[ ! -x "$script" ]]; then
    warn "$label skipped; script not executable: $script"
    return
  fi
  log "running $label"
  if "$script" "$@"; then
    pass "$label passed"
  else
    fail "$label failed"
  fi
}

main() {
  if [[ -z "$CURL_BIN" ]]; then
    fail "curl is required"
  fi
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    log "RESULT: PUBLIC BETA STILL BLOCKED"
    exit 1
  fi

  log "TradeVeto controlled public beta launch check"
  log "base_url=$(normalize_base_url)"

  check_required_docs
  check_headers

  request_path GET / "200"
  request_path GET /pricing "200 301 302"
  request_path GET /features "200"
  request_path GET /how-it-works "200"
  request_path GET /faq "200"
  request_path GET /intelligence "200"
  request_path GET /intelligence/shock-opportunities "200"
  request_path GET /intelligence/macro-regime "200"
  request_path GET /symbol/AMD "200"
  request_path GET /intelligence/why-wait/AMD "200"
  request_path GET /risk-disclosure "200"
  request_path GET /terms "200"
  request_path GET /privacy "200"
  request_path GET /robots.txt "200"
  request_path GET /sitemap.xml "200"
  request_path GET /og-image.png "200"
  request_path GET /api/health "200"
  check_deep_health_json

  check_metadata /
  check_metadata /pricing
  check_metadata /intelligence
  check_metadata /symbol/AMD
  check_metadata /intelligence/why-wait/AMD

  if [[ "$RUN_EXTENDED_QA" == "true" ]]; then
    run_child_check "billing route QA" "$SCRIPT_DIR/tradeveto-billing-lifecycle-check.sh"
    run_child_check "email DNS/route QA" "$SCRIPT_DIR/tradeveto-email-infrastructure-check.sh"
    run_child_check "security abuse QA" "$SCRIPT_DIR/tradeveto-security-abuse-check.sh"
    run_child_check "API platform QA" "$SCRIPT_DIR/tradeveto-api-platform-check.sh"
    run_child_check "performance budget QA" "$SCRIPT_DIR/tradeveto-performance-budget-check.sh"
  else
    warn "extended QA skipped; rerun with --extended before launch-day GO"
  fi

  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    log "SUMMARY pass=$PASS_COUNT warn=$WARN_COUNT fail=$FAIL_COUNT"
    log "RESULT: PUBLIC BETA STILL BLOCKED"
    exit 1
  fi
  if [[ "$WARN_COUNT" -gt 0 ]]; then
    log "SUMMARY pass=$PASS_COUNT warn=$WARN_COUNT fail=$FAIL_COUNT"
    log "RESULT: CONTROLLED PUBLIC BETA CONDITIONAL - operator sign-off required"
    exit 0
  fi
  log "SUMMARY pass=$PASS_COUNT warn=$WARN_COUNT fail=$FAIL_COUNT"
  log "RESULT: CONTROLLED PUBLIC BETA READY"
}

main "$@"
