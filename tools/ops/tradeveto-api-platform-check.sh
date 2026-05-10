#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRADEVETO_API_QA_BASE_URL:-https://tradeveto.com}"
TIMEOUT_SECONDS="${TRADEVETO_API_QA_TIMEOUT_SECONDS:-15}"
INVALID_KEY="${TRADEVETO_API_QA_INVALID_KEY:-tvk_live_invalid}"

CURL_BIN="${CURL_BIN:-}"
if [[ -z "$CURL_BIN" ]]; then
  if command -v curl >/dev/null 2>&1; then CURL_BIN="$(command -v curl)"; elif [[ -x /usr/bin/curl ]]; then CURL_BIN="/usr/bin/curl"; fi
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/tradeveto-api-qa.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

failures=0

log() {
  printf '[api-platform-qa] %s\n' "$*"
}

fail() {
  failures=$((failures + 1))
  printf '[api-platform-qa][FAIL] %s\n' "$*" >&2
}

normalize_base_url() {
  printf '%s' "$BASE_URL" | sed 's#/$##'
}

contains_secret_pattern() {
  local file="$1"
  grep -Eiq 'sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|tvk_live_[A-Za-z0-9_-]{16,}|tvwhsec_[A-Za-z0-9_-]{16,}|postgres(ql)?://[^[:space:]]+:[^@[:space:]]+@|OPENAI_API_KEY=|SMTP_PASS=' "$file"
}

request_status() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local output="$tmp_dir/response.txt"
  local args=(-sS -m "$TIMEOUT_SECONDS" -o "$output" -w '%{http_code}' -X "$method" -H "Authorization: Bearer $INVALID_KEY")
  if [[ "$method" == "POST" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi
  local status
  status="$("$CURL_BIN" "${args[@]}" "$(normalize_base_url)$path" || true)"
  if [[ ! "$status" =~ ^[0-9]{3}$ ]]; then
    fail "$method $path did not return an HTTP status"
    return 1
  fi
  if contains_secret_pattern "$output"; then
    fail "$method $path response contains a secret-like value"
  fi
  printf '%s' "$status"
}

expect_status() {
  local method="$1"
  local path="$2"
  local allowed="$3"
  local body="${4:-}"
  local status
  status="$(request_status "$method" "$path" "$body")" || return
  if [[ " $allowed " == *" $status "* ]]; then
    log "OK $method $path -> $status"
  else
    fail "$method $path expected one of [$allowed], got $status"
  fi
}

main() {
  [[ -n "$CURL_BIN" ]] || {
    fail "curl is required for API platform QA"
    exit 1
  }

  log "TradeVeto API platform route check"
  log "base_url=$(normalize_base_url)"

  expect_status "GET" "/developers" "200 301 302 401 403 404" # 404 allowed until the developer console is deployed on production.
  expect_status "GET" "/api/v1/opportunities" "401 404"
  expect_status "GET" "/api/v1/macro" "401 404"
  expect_status "GET" "/api/v1/shocks" "401 404"
  expect_status "GET" "/api/v1/replay?symbol=AMD" "401 404"
  expect_status "POST" "/api/v1/portfolio/scenario" "401 404" '{"positions":[{"symbol":"AMD","allocationPct":25}]}'

  if [[ "$failures" -gt 0 ]]; then
    log "RESULT: API PLATFORM STILL BETA-GRADE"
    exit 1
  fi

  log "RESULT: API PLATFORM ROUTE QA PASSED"
}

main "$@"
