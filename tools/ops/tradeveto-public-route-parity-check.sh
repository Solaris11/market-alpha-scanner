#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRADEVETO_ROUTE_PARITY_BASE_URL:-https://tradeveto.com}"
TIMEOUT_SECONDS="${TRADEVETO_ROUTE_PARITY_TIMEOUT_SECONDS:-15}"

CURL_BIN="${CURL_BIN:-}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tradeveto-route-parity.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "$CURL_BIN" ]]; then
  if command -v curl >/dev/null 2>&1; then
    CURL_BIN="$(command -v curl)"
  elif [[ -x /usr/bin/curl ]]; then
    CURL_BIN="/usr/bin/curl"
  fi
fi

failures=0
warnings=0

log() {
  printf '[route-parity] %s\n' "$*"
}

warn() {
  warnings=$((warnings + 1))
  printf '[route-parity][WARN] %s\n' "$*" >&2
}

fail() {
  failures=$((failures + 1))
  printf '[route-parity][FAIL] %s\n' "$*" >&2
}

normalize_base_url() {
  printf '%s' "$BASE_URL" | sed 's#/$##'
}

status_allowed() {
  local code="$1"
  local expected="$2"
  local item
  for item in $expected; do
    if [[ "$code" == "$item" ]]; then return 0; fi
  done
  return 1
}

fetch_route() {
  local route="$1"
  local output="$2"
  "$CURL_BIN" -sS -m "$TIMEOUT_SECONDS" -o "$output" -w '%{http_code} %{time_total}' "$(normalize_base_url)$route" || true
}

check_route() {
  local route="$1"
  local expected="$2"
  local body="$TMP_DIR/body-$(printf '%s' "$route" | tr -c 'A-Za-z0-9' '_')"
  local result status duration
  result="$(fetch_route "$route" "$body")"
  status="$(printf '%s' "$result" | awk '{print $1}')"
  duration="$(printf '%s' "$result" | awk '{print $2}')"
  if [[ ! "$status" =~ ^[0-9]{3}$ ]]; then
    fail "$route did not return an HTTP status"
    return
  fi
  if status_allowed "$status" "$expected"; then
    log "OK $route -> HTTP $status in ${duration}s"
  else
    fail "$route expected [$expected], got HTTP $status"
  fi
}

check_not_exposed() {
  local route="$1"
  local pattern="$2"
  local body="$TMP_DIR/body-$(printf '%s' "$route" | tr -c 'A-Za-z0-9' '_')"
  local result status
  result="$(fetch_route "$route" "$body")"
  status="$(printf '%s' "$result" | awk '{print $1}')"
  if [[ "$status" != "200" ]]; then
    fail "$route expected 200 while checking public links, got HTTP $status"
    return
  fi
  if grep -Eq "$pattern" "$body"; then
    fail "$route exposes undeployed public-beta route pattern: $pattern"
  else
    log "OK $route does not expose undeployed public-beta route pattern"
  fi
}

check_metadata() {
  local route="$1"
  local body="$TMP_DIR/meta-$(printf '%s' "$route" | tr -c 'A-Za-z0-9' '_')"
  local result status
  result="$(fetch_route "$route" "$body")"
  status="$(printf '%s' "$result" | awk '{print $1}')"
  if [[ "$status" != "200" ]]; then
    fail "$route metadata expected HTTP 200, got $status"
    return
  fi
  if grep -q '<link rel="canonical" href="https://tradeveto.com' "$body"; then
    log "OK $route canonical metadata present"
  else
    fail "$route missing canonical TradeVeto metadata"
  fi
  if grep -q '<meta property="og:image" content="https://tradeveto.com/og-image.png"' "$body" &&
     grep -q '<meta name="twitter:image" content="https://tradeveto.com/og-image.png"' "$body"; then
    log "OK $route social preview metadata present"
  else
    fail "$route missing expected OG/Twitter image metadata"
  fi
}

main() {
  if [[ -z "$CURL_BIN" ]]; then
    fail "curl is required"
    exit 1
  fi

  log "TradeVeto public route parity check base_url=$(normalize_base_url)"

  for route in \
    / \
    /features \
    /pricing \
    /how-it-works \
    /faq \
    /intelligence \
    /intelligence/shock-opportunities \
    /intelligence/macro-regime \
    /symbol/AMD \
    /intelligence/why-wait/AMD \
    /risk-disclaimer \
    /risk-disclosure \
    /privacy \
    /terms \
    /robots.txt \
    /sitemap.xml \
    /og-image.png; do
    check_route "$route" "200"
  done

  for route in /strategy-labs /community /developers /team /intelligence/strategy-performance; do
    check_route "$route" "200 301 302 401 403 404"
  done

  check_not_exposed / 'href="/intelligence/strategy-performance"|href="/strategy-labs"|href="/community"|href="/developers"|href="/team"'
  check_not_exposed /intelligence 'href="/intelligence/strategy-performance"|href="/strategy-labs"|href="/community"|href="/developers"|href="/team"'
  check_not_exposed /sitemap.xml 'intelligence/strategy-performance|strategy-labs|community|developers|/team'
  check_not_exposed /robots.txt 'Allow: /intelligence/strategy-performance'

  for route in / /pricing /features /how-it-works /faq /intelligence /intelligence/shock-opportunities /intelligence/macro-regime /symbol/AMD /intelligence/why-wait/AMD; do
    check_metadata "$route"
  done

  if [[ "$warnings" -gt 0 ]]; then
    log "warnings=$warnings"
  fi
  if [[ "$failures" -gt 0 ]]; then
    log "RESULT: PRODUCTION PARITY STILL BLOCKED"
    exit 1
  fi
  log "RESULT: PRODUCTION ROUTE PARITY CHECK PASSED"
}

main "$@"
