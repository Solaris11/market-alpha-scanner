#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${TRADEVETO_EMAIL_QA_DOMAIN:-tradeveto.com}"
BASE_URL="${TRADEVETO_EMAIL_QA_BASE_URL:-https://tradeveto.com}"
DKIM_SELECTOR="${TRADEVETO_EMAIL_QA_DKIM_SELECTOR:-google}"
TIMEOUT_SECONDS="${TRADEVETO_EMAIL_QA_TIMEOUT_SECONDS:-15}"

DIG_BIN="${DIG_BIN:-}"
CURL_BIN="${CURL_BIN:-}"
OPENSSL_BIN="${OPENSSL_BIN:-}"

if [[ -z "$DIG_BIN" ]]; then
  if command -v dig >/dev/null 2>&1; then DIG_BIN="$(command -v dig)"; elif [[ -x /usr/bin/dig ]]; then DIG_BIN="/usr/bin/dig"; fi
fi
if [[ -z "$CURL_BIN" ]]; then
  if command -v curl >/dev/null 2>&1; then CURL_BIN="$(command -v curl)"; elif [[ -x /usr/bin/curl ]]; then CURL_BIN="/usr/bin/curl"; fi
fi
if [[ -z "$OPENSSL_BIN" ]]; then
  if command -v openssl >/dev/null 2>&1; then OPENSSL_BIN="$(command -v openssl)"; elif [[ -x /opt/homebrew/bin/openssl ]]; then OPENSSL_BIN="/opt/homebrew/bin/openssl"; elif [[ -x /usr/bin/openssl ]]; then OPENSSL_BIN="/usr/bin/openssl"; fi
fi

failures=0
warnings=0
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/tradeveto-email-qa.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

log() {
  printf '[email-qa] %s\n' "$*"
}

warn() {
  warnings=$((warnings + 1))
  printf '[email-qa][WARN] %s\n' "$*" >&2
}

fail() {
  failures=$((failures + 1))
  printf '[email-qa][FAIL] %s\n' "$*" >&2
}

normalize_base_url() {
  printf '%s' "$BASE_URL" | sed 's#/$##'
}

dns_txt() {
  local name="$1"
  "$DIG_BIN" +short TXT "$name" | tr -d '"' | tr '\n' ' '
}

dns_mx() {
  "$DIG_BIN" +short MX "$DOMAIN" | tr '[:upper:]' '[:lower:]'
}

require_tooling() {
  [[ -n "$DIG_BIN" ]] || fail "dig is required for DNS verification"
  [[ -n "$CURL_BIN" ]] || fail "curl is required for route verification"
}

check_mx() {
  local mx
  mx="$(dns_mx)"
  if [[ "$mx" == *"aspmx.l.google.com"* ]]; then
    log "OK MX uses Google Workspace"
  else
    fail "MX records do not include Google Workspace aspmx hosts"
  fi
}

check_spf() {
  local spf
  spf="$(dns_txt "$DOMAIN")"
  local count
  count="$(printf '%s\n' "$spf" | grep -o 'v=spf1' | wc -l | tr -d ' ')"
  if [[ "$count" != "1" ]]; then
    fail "Expected exactly one SPF record, found $count"
    return
  fi
  if [[ "$spf" == *"include:_spf.google.com"* ]]; then
    log "OK SPF includes Google Workspace"
  else
    fail "SPF record does not include _spf.google.com"
  fi
  if [[ "$spf" == *" ~all"* ]]; then
    warn "SPF uses softfail (~all). Acceptable for beta, but hardfail (-all) is stronger after sender inventory is complete."
  elif [[ "$spf" == *" -all"* ]]; then
    log "OK SPF uses hardfail"
  else
    warn "SPF record does not clearly end with ~all or -all"
  fi
}

check_dkim() {
  local record
  record="$(dns_txt "${DKIM_SELECTOR}._domainkey.${DOMAIN}")"
  if [[ "$record" == *"v=DKIM1"* && "$record" == *"p="* ]]; then
    log "OK DKIM exists at ${DKIM_SELECTOR}._domainkey.${DOMAIN}"
  else
    fail "DKIM record missing or incomplete at ${DKIM_SELECTOR}._domainkey.${DOMAIN}"
  fi
}

check_dmarc() {
  local record
  record="$(dns_txt "_dmarc.${DOMAIN}")"
  if [[ "$record" != *"v=DMARC1"* ]]; then
    fail "DMARC record is missing"
    return
  fi
  log "OK DMARC record exists"
  if [[ "$record" == *"p=none"* ]]; then
    warn "DMARC policy is p=none. Inbox proof can pass, but launch-hardening should move to quarantine/reject after monitoring."
  elif [[ "$record" == *"p=quarantine"* || "$record" == *"p=reject"* ]]; then
    log "OK DMARC has an enforcement policy"
  else
    warn "DMARC policy is present but not clearly p=none, p=quarantine, or p=reject"
  fi
}

contains_secret_pattern() {
  local file="$1"
  grep -Eiq 'SMTP_PASS=|sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|postgres(ql)?://[^[:space:]]+:[^@[:space:]]+@|OPENAI_API_KEY=' "$file"
}

check_route() {
  local path="$1"
  local allowed="$2"
  local output="$tmp_dir/route.txt"
  local status
  status="$("$CURL_BIN" -sS -m "$TIMEOUT_SECONDS" -o "$output" -w '%{http_code}' "$(normalize_base_url)$path" || true)"
  if [[ " $allowed " == *" $status "* ]]; then
    log "OK GET $path -> $status"
  else
    fail "GET $path expected one of [$allowed], got ${status:-none}"
  fi
  if contains_secret_pattern "$output"; then
    fail "GET $path response appears to contain a secret pattern"
  fi
}

check_routes() {
  check_route "/api/health" "200"
  check_route "/api/health/deep" "200"
  check_route "/support/contact" "200 301 302"
  check_route "/reset-password" "200 301 302"
}

check_smtp_env() {
  local missing=()
  for key in SMTP_HOST SMTP_USER SMTP_PASS EMAIL_FROM SUPPORT_EMAIL BILLING_EMAIL; do
    if [[ -z "${!key:-}" ]]; then missing+=("$key"); fi
  done
  if [[ "${#missing[@]}" -gt 0 ]]; then
    warn "SMTP send test not run; missing env: ${missing[*]}"
    return
  fi
  log "OK SMTP env present (values redacted)"
}

check_smtp_connectivity() {
  if [[ -z "$OPENSSL_BIN" ]]; then
    warn "openssl unavailable; SMTP STARTTLS connectivity not checked"
    return
  fi
  if "$OPENSSL_BIN" s_client -starttls smtp -connect smtp.gmail.com:587 -servername smtp.gmail.com </dev/null >/dev/null 2>&1; then
    log "OK smtp.gmail.com:587 STARTTLS reachable"
  else
    warn "smtp.gmail.com:587 STARTTLS connectivity check failed from this host"
  fi
}

run_optional_email_smoke() {
  local to="${TRADEVETO_EMAIL_QA_SEND_TO:-}"
  if [[ -z "$to" ]]; then
    warn "Live inbox placement not checked; set TRADEVETO_EMAIL_QA_SEND_TO to send smoke emails."
    return
  fi
  if [[ -z "${SMTP_HOST:-}" || -z "${SMTP_USER:-}" || -z "${SMTP_PASS:-}" ]]; then
    warn "Live email smoke skipped because SMTP env is incomplete."
    return
  fi
  if [[ ! -f frontend/package.json ]]; then
    warn "Live email smoke skipped; frontend/package.json not found from current working directory."
    return
  fi
  for category in system verification password_reset support billing strategy replay onboarding; do
    (cd frontend && npm run email:test -- --to "$to" --category "$category") >/dev/null
    log "OK sent $category smoke email to $to"
  done
}

require_tooling
if [[ "$failures" -eq 0 ]]; then
  log "TradeVeto email infrastructure check domain=$DOMAIN base_url=$(normalize_base_url)"
  check_mx
  check_spf
  check_dkim
  check_dmarc
  check_routes
  check_smtp_env
  check_smtp_connectivity
  run_optional_email_smoke
fi

if [[ "$failures" -gt 0 ]]; then
  log "RESULT: EMAIL DELIVERY STILL RISKY"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  log "RESULT: EMAIL DNS QA PASSED_WITH_WARNINGS warnings=$warnings"
else
  log "RESULT: EMAIL DNS QA PASSED"
fi
