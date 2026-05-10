#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRADEVETO_SECURITY_QA_BASE_URL:-https://tradeveto.com}"
TIMEOUT_SECONDS="${TRADEVETO_SECURITY_QA_TIMEOUT_SECONDS:-15}"

CURL_BIN="${CURL_BIN:-}"
if [[ -z "$CURL_BIN" ]]; then
  if command -v curl >/dev/null 2>&1; then CURL_BIN="$(command -v curl)"; elif [[ -x /usr/bin/curl ]]; then CURL_BIN="/usr/bin/curl"; fi
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/tradeveto-security-qa.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

failures=0
warnings=0

log() {
  printf '[security-qa] %s\n' "$*"
}

warn() {
  warnings=$((warnings + 1))
  printf '[security-qa][WARN] %s\n' "$*" >&2
}

fail() {
  failures=$((failures + 1))
  printf '[security-qa][FAIL] %s\n' "$*" >&2
}

normalize_base_url() {
  printf '%s' "$BASE_URL" | sed 's#/$##'
}

contains_secret_pattern() {
  local file="$1"
  grep -Eiq 'sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|tvk_live_[A-Za-z0-9_-]{16,}|tvwhsec_[A-Za-z0-9_-]{16,}|postgres(ql)?://[^[:space:]]+:[^@[:space:]]+@|OPENAI_API_KEY=|SMTP_PASS=' "$file"
}

http_request() {
  local method="$1"
  local route_path="$2"
  local body="${3:-}"
  local origin="${4:-}"
  local user_agent="${5:-}"
  local output="$tmp_dir/response.txt"
  local url
  url="$(normalize_base_url)$route_path"

  local args=(-sS -m "$TIMEOUT_SECONDS" -o "$output" -w '%{http_code}' -X "$method")
  if [[ -n "$origin" ]]; then args+=(-H "Origin: $origin"); fi
  if [[ -n "$user_agent" ]]; then args+=(-H "User-Agent: $user_agent"); fi
  if [[ "$method" == "POST" ]]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi

  local status
  status="$("$CURL_BIN" "${args[@]}" "$url" || true)"
  if [[ ! "$status" =~ ^[0-9]{3}$ ]]; then
    fail "$method $route_path did not return an HTTP status"
    return 1
  fi
  if contains_secret_pattern "$output"; then
    fail "$method $route_path response appears to contain a secret pattern"
  fi
  printf '%s' "$status"
}

expect_status() {
  local method="$1"
  local route_path="$2"
  local allowed="$3"
  local body="${4:-}"
  local origin="${5:-}"
  local user_agent="${6:-}"
  local status
  status="$(http_request "$method" "$route_path" "$body" "$origin" "$user_agent")" || return
  if [[ " $allowed " == *" $status "* ]]; then
    log "OK $method $route_path -> $status"
  else
    fail "$method $route_path expected one of [$allowed], got $status"
  fi
  if [[ "$route_path" == "/api/ranking" && "$status" == "200" ]] && ! grep -q '"limited":true' "$tmp_dir/response.txt"; then
    fail "GET /api/ranking returned 200 without limited preview marker"
  fi
}

check_headers() {
  local output="$tmp_dir/headers.txt"
  "$CURL_BIN" -sSI -m "$TIMEOUT_SECONDS" "$(normalize_base_url)/" >"$output" || {
    fail "Unable to fetch response headers"
    return
  }
  for header in \
    "content-security-policy:" \
    "strict-transport-security:" \
    "x-frame-options:" \
    "x-content-type-options:" \
    "referrer-policy:" \
    "permissions-policy:"; do
    if grep -iq "^$header" "$output"; then
      log "OK header $header present"
    else
      fail "Missing security header $header"
    fi
  done
  if grep -iq '^x-powered-by:' "$output"; then
    warn "X-Powered-By header is present"
  fi
}

main() {
  [[ -n "$CURL_BIN" ]] || {
    fail "curl is required for security QA"
    exit 1
  }

  log "TradeVeto security abuse QA route check"
  log "base_url=$(normalize_base_url)"

  check_headers

  expect_status "GET" "/api/health" "200"
  expect_status "GET" "/api/ranking" "200 401 403"
  expect_status "GET" "/api/admin/summary" "401 403"
  expect_status "GET" "/api/developer/api-keys" "401 403 404" # 404 allowed until developer UI routes are deployed on production.
  expect_status "GET" "/api/history/latest" "401 403"

  expect_status "POST" "/api/stripe/webhook" "400" '{"id":"evt_invalid_signature"}'
  expect_status "POST" "/api/support/contact" "403" '{"message":"origin probe"}' "https://evil.example"
  expect_status "GET" "/api/v1/opportunities" "401 403 404" "" "" "" # 404 allowed until developer API routes are deployed on production.

  expect_status "GET" "/" "200" "" "" "facebookexternalhit/1.1"
  expect_status "GET" "/terminal" "200 401 403" "" "" "facebookexternalhit/1.1"
  expect_status "GET" "/api/ranking" "200 401 403 404" "" "" "facebookexternalhit/1.1"

  if [[ "$failures" -gt 0 ]]; then
    log "RESULT: SECURITY HARDENING STILL REQUIRED"
    exit 1
  fi

  log "RESULT: SECURITY ABUSE QA PASSED with $warnings warning(s)"
}

main "$@"
