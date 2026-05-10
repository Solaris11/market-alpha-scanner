#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRADEVETO_PERFORMANCE_BASE_URL:-https://tradeveto.com}"
ALLOW_404="${TRADEVETO_PERFORMANCE_ALLOW_404:-true}"
ALLOW_DEGRADED_HEALTH="${TRADEVETO_PERFORMANCE_ALLOW_DEGRADED_HEALTH:-false}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  printf '[performance-budget] %s\n' "$*"
}

fail() {
  log "FAIL $*"
  exit 1
}

to_ms() {
  python3 - "$1" <<'PY'
import sys
print(int(round(float(sys.argv[1]) * 1000)))
PY
}

over_budget() {
  python3 - "$1" "$2" <<'PY'
import sys
latency = int(sys.argv[1])
budget = int(sys.argv[2])
print("1" if latency > budget else "0")
PY
}

request_route() {
  local method="$1"
  local path="$2"
  local budget_ms="$3"
  local payload="${4:-}"
  local url="${BASE_URL%/}${path}"
  local body="$TMP_DIR/body-$(printf '%s' "$method-$path" | tr -c 'A-Za-z0-9' '_')"
  local output code time_total start_transfer size latency_ms ttfb_ms

  if [[ "$method" == "POST" ]]; then
    output="$(curl -sS -o "$body" -w '%{http_code} %{time_total} %{time_starttransfer} %{size_download}' \
      -X POST \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer tvk_live_invalid_perf_check' \
      --data "$payload" \
      --max-time 20 \
      "$url" || true)"
  else
    output="$(curl -sS -o "$body" -w '%{http_code} %{time_total} %{time_starttransfer} %{size_download}' \
      -H 'Authorization: Bearer tvk_live_invalid_perf_check' \
      --max-time 20 \
      "$url" || true)"
  fi

  code="$(printf '%s' "$output" | awk '{print $1}')"
  time_total="$(printf '%s' "$output" | awk '{print $2}')"
  start_transfer="$(printf '%s' "$output" | awk '{print $3}')"
  size="$(printf '%s' "$output" | awk '{print $4}')"
  [[ "$code" =~ ^[0-9]{3}$ ]] || fail "$method $path did not return an HTTP status"

  if [[ "$code" == "404" ]]; then
    if [[ "$ALLOW_404" == "true" ]]; then
      log "SKIP $method $path -> 404 route not deployed on ${BASE_URL}; budget=${budget_ms}ms"
      return
    fi
    fail "$method $path returned HTTP 404 with TRADEVETO_PERFORMANCE_ALLOW_404=false"
  fi

  case "$code" in
    200|301|302|401|403|429) ;;
    503)
      if [[ "$ALLOW_DEGRADED_HEALTH" == "true" && "$path" == /api/health* ]]; then
        :
      else
        fail "$method $path returned unexpected HTTP $code"
      fi
      ;;
    *) fail "$method $path returned unexpected HTTP $code" ;;
  esac

  latency_ms="$(to_ms "$time_total")"
  ttfb_ms="$(to_ms "$start_transfer")"
  if [[ "$(over_budget "$latency_ms" "$budget_ms")" == "1" ]]; then
    fail "$method $path HTTP $code latency=${latency_ms}ms ttfb=${ttfb_ms}ms size=${size}B budget=${budget_ms}ms"
  fi

  log "OK $method $path HTTP $code latency=${latency_ms}ms ttfb=${ttfb_ms}ms size=${size}B budget=${budget_ms}ms"
}

log "TradeVeto performance budget route check"
log "base_url=${BASE_URL}"

request_route GET /api/health 750
request_route GET /api/health/deep 1500
request_route GET /terminal 3500
request_route GET /dashboard 3500
request_route GET /opportunities 3500
request_route GET /symbol/AMD 4000
request_route GET /paper 3500
request_route GET /strategy-labs 3500
request_route GET /community 3000
request_route GET /developers 3000
request_route GET /history 3000
request_route GET '/api/history/replay?symbol=AMD' 2000
request_route GET /api/v1/opportunities 1500
request_route GET /api/v1/macro 1500
request_route GET /api/v1/shocks 1500
request_route GET '/api/v1/replay?symbol=AMD' 1500
request_route POST /api/v1/portfolio/scenario 2000 '{"accountValue":100000,"positions":[]}'

log "RESULT: PERFORMANCE BUDGET CHECK PASSED"
