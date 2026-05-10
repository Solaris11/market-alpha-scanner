#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TRADEVETO_BILLING_QA_BASE_URL:-https://tradeveto.com}"
TIMEOUT_SECONDS="${TRADEVETO_BILLING_QA_TIMEOUT_SECONDS:-15}"

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/tradeveto-billing-qa.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

failures=0

log() {
  printf '[billing-qa] %s\n' "$*"
}

record_failure() {
  failures=$((failures + 1))
  printf '[billing-qa][FAIL] %s\n' "$*" >&2
}

normalize_base_url() {
  printf '%s' "$BASE_URL" | sed 's#/$##'
}

contains_secret_pattern() {
  local file="$1"
  grep -Eiq 'sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|postgres(ql)?://[^[:space:]]+:[^@[:space:]]+@|OPENAI_API_KEY=' "$file"
}

http_status() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local output="$tmp_dir/response.txt"
  local status
  if [[ "$method" == "POST" ]]; then
    status="$(curl -sS -m "$TIMEOUT_SECONDS" -o "$output" -w '%{http_code}' \
      -X POST \
      -H "Origin: $(normalize_base_url)" \
      -H "Content-Type: application/json" \
      --data "$body" \
      "$url" || true)"
  else
    status="$(curl -sS -m "$TIMEOUT_SECONDS" -o "$output" -w '%{http_code}' "$url" || true)"
  fi

  if [[ ! "$status" =~ ^[0-9]{3}$ ]]; then
    record_failure "$method $url did not return an HTTP status"
    return 1
  fi
  if contains_secret_pattern "$output"; then
    record_failure "$method $url response appears to contain a secret pattern"
  fi
  printf '%s' "$status"
}

expect_status() {
  local method="$1"
  local path="$2"
  local allowed="$3"
  local body="${4:-}"
  local url
  url="$(normalize_base_url)$path"
  local status
  status="$(http_status "$method" "$url" "$body")" || return
  if [[ " $allowed " == *" $status "* ]]; then
    log "OK $method $path -> $status"
  else
    record_failure "$method $path expected one of [$allowed], got $status"
  fi
}

log "TradeVeto billing launch QA route check"
log "base_url=$(normalize_base_url)"

expect_status "GET" "/pricing" "200 301 302"
expect_status "GET" "/account" "200 301 302"
expect_status "GET" "/api/health" "200"
expect_status "GET" "/api/health/deep" "200"

# Anonymous mutation checks should not create Stripe objects. These validate access-control,
# CSRF/host handling, and safe failure copy without requiring a paid test user session.
expect_status "POST" "/api/stripe/checkout" "401 403" "{}"
expect_status "POST" "/api/stripe/portal" "401 403" "{}"

# Invalid webhook signatures must fail closed and must not leak webhook secrets.
expect_status "POST" "/api/stripe/webhook" "400" '{"id":"evt_invalid_signature","type":"checkout.session.completed","data":{"object":{}}}'

if [[ "$failures" -gt 0 ]]; then
  log "RESULT: BILLING STILL NEEDS HARDENING"
  exit 1
fi

log "RESULT: BILLING ROUTE QA PASSED"
