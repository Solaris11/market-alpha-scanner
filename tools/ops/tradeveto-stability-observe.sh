#!/usr/bin/env bash
set -Eeuo pipefail

DURATION_SECONDS=3600
INTERVAL_SECONDS=60
OUTPUT_DIR=""
BASE_URL="${TRADEVETO_OBSERVE_BASE_URL:-https://tradeveto.com}"

usage() {
  cat <<'USAGE'
Usage: tradeveto-stability-observe.sh [options]

Collects long-duration production stability samples for TradeVeto.

Options:
  --duration-seconds N   Total observation window. Default: 3600.
  --interval-seconds N   Seconds between samples. Default: 60.
  --output-dir PATH      Output directory for samples and summary. Required.
  --base-url URL         Public base URL. Default: https://tradeveto.com.
  -h, --help             Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --duration-seconds)
      DURATION_SECONDS="${2:-}"
      shift 2
      ;;
    --interval-seconds)
      INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf "Unknown argument: %s\n" "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ "$DURATION_SECONDS" =~ ^[0-9]+$ && "$DURATION_SECONDS" -gt 0 ]] || { echo "duration must be a positive integer" >&2; exit 2; }
[[ "$INTERVAL_SECONDS" =~ ^[0-9]+$ && "$INTERVAL_SECONDS" -gt 0 ]] || { echo "interval must be a positive integer" >&2; exit 2; }
[[ -n "$OUTPUT_DIR" ]] || { echo "--output-dir is required" >&2; exit 2; }

mkdir -p "$OUTPUT_DIR"
SAMPLES_FILE="$OUTPUT_DIR/samples.jsonl"
SUMMARY_FILE="$OUTPUT_DIR/summary.txt"
START_EPOCH="$(date +%s)"
END_EPOCH="$((START_EPOCH + DURATION_SECONDS))"

json_string() {
  python3 -c 'import json, sys; print(json.dumps(sys.stdin.read()))'
}

curl_timing_json() {
  local path="$1"
  local url="${BASE_URL%/}${path}"
  local timing
  timing="$(curl -k -sS -o /dev/null -w '{"path":"%{url_effective}","status":%{http_code},"time_namelookup":%{time_namelookup},"time_connect":%{time_connect},"time_appconnect":%{time_appconnect},"time_starttransfer":%{time_starttransfer},"time_total":%{time_total}}' "$url" 2>/dev/null || true)"
  if [[ -n "$timing" ]]; then
    printf "%s" "$timing"
  else
    printf '{"path":"%s","status":0,"time_total":null}' "$url"
  fi
}

count_lines() {
  wc -l | tr -d ' '
}

collect_sample() {
  local now
  local docker_stats
  local docker_ps
  local connections
  local scanner_processes
  local rclone_processes
  local systemd_failed
  local timers
  local health
  local deep
  local terminal
  local symbol

  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  docker_stats="$(docker stats --no-stream --format '{{json .}}' 2>/dev/null || true)"
  docker_ps="$(docker ps --format '{{json .}}' 2>/dev/null || true)"
  connections="$(ss -tan 2>/dev/null | count_lines || printf "0")"
  scanner_processes="$(ps -eo pid=,ppid=,etimes=,pcpu=,pmem=,rss=,comm=,args= 2>/dev/null | grep -E 'scanner|investment_scanner|market-alpha-full-scan' | grep -v grep || true)"
  rclone_processes="$(ps -eo pid=,ppid=,etimes=,pcpu=,pmem=,rss=,comm=,args= 2>/dev/null | grep -E '[r]clone' || true)"
  systemd_failed="$(systemctl --failed --no-legend 2>/dev/null || true)"
  timers="$(systemctl list-timers --all --no-legend 2>/dev/null | grep -E 'scanner|market-alpha|tradeveto|backup' || true)"
  health="$(curl_timing_json /api/health)"
  deep="$(curl_timing_json /api/health/deep)"
  terminal="$(curl_timing_json /terminal)"
  symbol="$(curl_timing_json /symbol/AMD)"

  DOCKER_STATS="$docker_stats" \
  DOCKER_PS="$docker_ps" \
  SCANNER_PROCESSES="$scanner_processes" \
  RCLONE_PROCESSES="$rclone_processes" \
  SYSTEMD_FAILED="$systemd_failed" \
  TIMERS="$timers" \
  python3 - "$now" "$connections" "$health" "$deep" "$terminal" "$symbol" <<'PY' >> "$SAMPLES_FILE"
import json
import os
import sys

timestamp, connections, health, deep, terminal, symbol = sys.argv[1:7]
payload = {
    "timestamp": timestamp,
    "open_connections": int(connections or "0"),
    "http_timings": [
        json.loads(health),
        json.loads(deep),
        json.loads(terminal),
        json.loads(symbol),
    ],
    "docker_stats_jsonl": os.environ.get("DOCKER_STATS", ""),
    "docker_ps_jsonl": os.environ.get("DOCKER_PS", ""),
    "scanner_processes": os.environ.get("SCANNER_PROCESSES", ""),
    "rclone_processes": os.environ.get("RCLONE_PROCESSES", ""),
    "systemd_failed": os.environ.get("SYSTEMD_FAILED", ""),
    "timers": os.environ.get("TIMERS", ""),
}
print(json.dumps(payload, sort_keys=True))
PY
}

write_summary() {
  local now
  local samples
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  samples="$(wc -l < "$SAMPLES_FILE" 2>/dev/null | tr -d ' ' || printf "0")"
  {
    printf "TradeVeto stability observation\n"
    printf "started_epoch=%s\n" "$START_EPOCH"
    printf "completed_at=%s\n" "$now"
    printf "duration_seconds=%s\n" "$DURATION_SECONDS"
    printf "interval_seconds=%s\n" "$INTERVAL_SECONDS"
    printf "sample_count=%s\n" "$samples"
    printf "base_url=%s\n" "$BASE_URL"
  } > "$SUMMARY_FILE"
}

echo "TradeVeto stability observation started $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SUMMARY_FILE"
echo "duration_seconds=$DURATION_SECONDS interval_seconds=$INTERVAL_SECONDS" >> "$SUMMARY_FILE"

while [[ "$(date +%s)" -lt "$END_EPOCH" ]]; do
  collect_sample
  sleep "$INTERVAL_SECONDS"
done

write_summary
