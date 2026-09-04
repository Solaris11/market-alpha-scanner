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

# Hard ceiling per probe. Without it a single hung request blocks the whole
# observation loop: the 2026-06-10 run lost ~15 minutes of samples to one
# /api/health request that took 934s to first byte.
PROBE_TIMEOUT_SECONDS="${PROBE_TIMEOUT_SECONDS:-30}"

curl_timing_json() {
  local path="$1"
  local url="${BASE_URL%/}${path}"
  local timing
  timing="$(curl -k -sS --max-time "$PROBE_TIMEOUT_SECONDS" -o /dev/null -w '{"path":"%{url_effective}","status":"%{http_code}","time_namelookup":%{time_namelookup},"time_connect":%{time_connect},"time_appconnect":%{time_appconnect},"time_starttransfer":%{time_starttransfer},"time_total":%{time_total}}' "$url" 2>/dev/null || true)"
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
  local health_body
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
  health_body="$(curl -k -sS --max-time "$PROBE_TIMEOUT_SECONDS" "${BASE_URL%/}/api/health" 2>/dev/null || true)"
  deep="$(curl_timing_json /api/health/deep)"
  terminal="$(curl_timing_json /terminal)"
  symbol="$(curl_timing_json /symbol/AMD)"

  DOCKER_STATS="$docker_stats" \
  DOCKER_PS="$docker_ps" \
  HEALTH_BODY="$health_body" \
  SCANNER_PROCESSES="$scanner_processes" \
  RCLONE_PROCESSES="$rclone_processes" \
  SYSTEMD_FAILED="$systemd_failed" \
  TIMERS="$timers" \
  python3 - "$now" "$connections" "$health" "$deep" "$terminal" "$symbol" <<'PY' >> "$SAMPLES_FILE"
import json
import os
import sys

timestamp, connections, health, deep, terminal, symbol = sys.argv[1:7]


def probe(raw):
    """Parse one curl timing blob without ever ending the observation run.

    curl reports http_code 000 when a request fails to complete. Emitted bare
    that is not valid JSON (leading zeros), which used to raise here and kill
    the whole 24h run on the first transient probe failure.
    """
    try:
        obj = json.loads(raw)
    except (TypeError, ValueError):
        return {"path": None, "status": 0, "parse_error": (raw or "")[:200]}
    if not isinstance(obj, dict):
        return {"path": None, "status": 0, "parse_error": (raw or "")[:200]}
    status = obj.get("status")
    if isinstance(status, str):
        try:
            obj["status"] = int(status, 10)
        except ValueError:
            obj["status"] = 0
    return obj


def process_snapshot(raw):
    """Pull the process block out of the /api/health body, if present.

    Carries event-loop delay and memory so a stalled sample can be attributed
    to the process rather than guessed at. Older deployments do not emit it;
    an empty dict is the correct answer then, never an exception.
    """
    try:
        body = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    if not isinstance(body, dict):
        return {}
    snapshot = body.get("process")
    return snapshot if isinstance(snapshot, dict) else {}


def jsonl_entries(raw):
    """Parse a `--format '{{json .}}'` blob into dicts, skipping anything odd.

    Both docker blobs were already being collected and stored verbatim, which
    is why the 24h observation had to report running-container count and
    Postgres memory as UNMEASURABLE: the data was in the file, but only as an
    opaque string the summary could not read. Parsing here changes nothing
    about what is collected on the host -- no extra command, no extra cost --
    it just makes the two fields addressable.
    """
    entries = []
    for line in (raw or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except (TypeError, ValueError):
            continue
        if isinstance(obj, dict):
            entries.append(obj)
    return entries


_MEM_UNITS = {"b": 1.0 / (1024 * 1024), "kib": 1.0 / 1024, "kb": 1.0 / 1024,
              "mib": 1.0, "mb": 1.0, "gib": 1024.0, "gb": 1024.0, "tib": 1024.0 * 1024}


def memory_mb(usage):
    """'1.117GiB / 31.08GiB' -> 1143.8. Returns None rather than raising.

    Only the used side is taken; the limit is the host total and is the same
    for every container, so it carries no per-container information.
    """
    text = str(usage or "").split("/")[0].strip()
    if not text:
        return None
    number, unit = "", ""
    for char in text:
        if char.isdigit() or char in ".,":
            number += "." if char == "," else char
        elif not char.isspace():
            unit += char
    try:
        value = float(number)
    except ValueError:
        return None
    scale = _MEM_UNITS.get(unit.lower())
    if scale is None:
        return None
    return round(value * scale, 1)


def container_memory(raw):
    out = {}
    for entry in jsonl_entries(raw):
        name = entry.get("Name") or entry.get("Container")
        if not name:
            continue
        mb = memory_mb(entry.get("MemUsage"))
        if mb is not None:
            out[str(name)] = mb
    return out


_ps_entries = jsonl_entries(os.environ.get("DOCKER_PS", ""))
_memory_by_container = container_memory(os.environ.get("DOCKER_STATS", ""))
# `docker ps` without -a lists running containers only, so the count is the
# number of entries. Threshold 11 in the stability report is >= 6.
_running_containers = len(_ps_entries)
# Named rather than matched loosely: the compose project prefixes the service,
# and a substring match on "postgres" would also catch a future pgbouncer or
# postgres-exporter and silently report the wrong number.
_postgres_memory_mb = next(
    (mb for name, mb in _memory_by_container.items() if "postgres" in name.lower()),
    None,
)

payload = {
    "timestamp": timestamp,
    "open_connections": int(connections or "0"),
    "running_containers": _running_containers,
    "running_container_names": sorted(
        str(entry.get("Names") or entry.get("Name") or "") for entry in _ps_entries
    ),
    "container_memory_mb": _memory_by_container,
    "postgres_memory_mb": _postgres_memory_mb,
    "http_timings": [
        probe(health),
        probe(deep),
        probe(terminal),
        probe(symbol),
    ],
    "process": process_snapshot(os.environ.get("HEALTH_BODY", "")),
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

# Sample on a fixed grid rather than sleeping a flat interval after a
# variable-length collection. The 2026-06-10 run drifted to 68.1s per sample
# because collection takes 6-8s, so a "24h at 60s" run produced ~1268 samples
# instead of 1440 and every downstream expectation was wrong. If a collection
# overruns a tick the grid skips forward rather than falling permanently behind.
NEXT_TICK="$START_EPOCH"
while [[ "$(date +%s)" -lt "$END_EPOCH" ]]; do
  collect_sample
  NEXT_TICK=$((NEXT_TICK + INTERVAL_SECONDS))
  NOW_EPOCH="$(date +%s)"
  while [[ "$NEXT_TICK" -le "$NOW_EPOCH" ]]; do
    NEXT_TICK=$((NEXT_TICK + INTERVAL_SECONDS))
  done
  sleep "$((NEXT_TICK - NOW_EPOCH))"
done

write_summary
