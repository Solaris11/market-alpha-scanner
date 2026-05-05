#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${UPTIMEROBOT_API_KEY:-}" ]]; then
  echo "UPTIMEROBOT_API_KEY is required." >&2
  exit 1
fi

INTERVAL="${UPTIMEROBOT_INTERVAL_SECONDS:-60}"
ALERT_CONTACTS="${UPTIMEROBOT_ALERT_CONTACTS:-}"

monitors=(
  "Market Alpha Landing|https://marketalpha.co"
  "Market Alpha Features|https://marketalpha.co/features"
  "Market Alpha App Health|https://app.marketalpha.co/api/health"
  "Market Alpha App Deep Health|https://app.marketalpha.co/api/health/deep"
)

api_post() {
  local endpoint="$1"
  shift
  curl -fsS -X POST \
    -H "Cache-Control: no-cache" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "api_key=${UPTIMEROBOT_API_KEY}" \
    --data-urlencode "format=json" \
    "$@" \
    "https://api.uptimerobot.com/v2/${endpoint}"
}

for monitor in "${monitors[@]}"; do
  IFS="|" read -r friendly_name url <<<"${monitor}"
  echo "Ensuring UptimeRobot monitor: ${friendly_name}"
  existing="$(api_post getMonitors --data-urlencode "search=${url}")"
  if printf '%s' "${existing}" | grep -q "\"url\":\"${url//\//\\/}\""; then
    echo "  exists"
    continue
  fi

  args=(
    --data-urlencode "type=1"
    --data-urlencode "friendly_name=${friendly_name}"
    --data-urlencode "url=${url}"
    --data-urlencode "interval=${INTERVAL}"
  )
  if [[ -n "${ALERT_CONTACTS}" ]]; then
    args+=(--data-urlencode "alert_contacts=${ALERT_CONTACTS}")
  fi
  api_post newMonitor "${args[@]}" >/dev/null
  echo "  created"
done
