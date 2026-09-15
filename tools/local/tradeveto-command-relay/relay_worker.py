#!/usr/bin/env python3
"""Allowlisted real-Mac command relay for TradeVeto agents.

This worker is intentionally not a shell executor. Agents write structured JSON
requests into .agent-relay/requests; this process runs only named actions and
writes JSON results into .agent-relay/results.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shlex
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


DEFAULT_REPO = Path("/Users/hdtv/dev/market-alpha-scanner")
PROD_HOST = "sre@100.68.155.121"
PROD_APP = "/opt/apps/market-alpha-scanner/app"
ALLOWED_BRANCHES = {"main", "work/terminal-ia-simplification", "work/backup-r2-timeout-fix"}
ALLOWED_ROUTES = {
    "/api/health",
    "/api/health/deep",
    "/terminal",
    "/discover",
    "/opportunities",
    "/symbol/AMD",
    "/symbol/NVDA",
    "/symbol/SNDK",
    "/symbol/OXY",
    "/pricing",
    "/account",
    "/api/terminal/market-charts",
}
ROUTE_RE = re.compile(r"^/[A-Za-z0-9._~/?=&:%+-]*$")
LABEL_RE = re.compile(r"^[A-Za-z0-9_.:-]+$")


class RelayError(Exception):
    pass


@dataclass(frozen=True)
class CommandResult:
    command: list[str]
    cwd: str | None
    duration_ms: int
    exit_code: int
    stderr: str
    stdout: str


def run_command(command: list[str], *, cwd: Path | None = None, timeout: int = 300) -> CommandResult:
    started = time.monotonic()
    proc = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )
    return CommandResult(
        command=command,
        cwd=str(cwd) if cwd else None,
        duration_ms=int((time.monotonic() - started) * 1000),
        exit_code=proc.returncode,
        stderr=proc.stderr[-20000:],
        stdout=proc.stdout[-60000:],
    )


def ssh_script(script: str, *, timeout: int = 300) -> CommandResult:
    return run_command(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", PROD_HOST, f"bash -lc {shlex.quote(script)}"],
        timeout=timeout,
    )


def require_branch(args: dict[str, Any], default: str = "work/terminal-ia-simplification") -> str:
    branch = str(args.get("branch") or default)
    if branch not in ALLOWED_BRANCHES:
        raise RelayError(f"branch not allowed: {branch}")
    return branch


def require_routes(args: dict[str, Any]) -> list[str]:
    raw = args.get("routes") or sorted(ALLOWED_ROUTES)
    if not isinstance(raw, list) or not raw:
        raise RelayError("routes must be a non-empty list")
    routes: list[str] = []
    for item in raw:
        route = str(item)
        if route not in ALLOWED_ROUTES or not ROUTE_RE.match(route):
            raise RelayError(f"route not allowed: {route}")
        routes.append(route)
    return routes


def action_list_actions(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    text = "\n".join(sorted(ACTIONS))
    return [CommandResult(["internal:list_actions"], None, 0, 0, "", text + "\n")]


def action_git_status(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    return [
        run_command(["git", "status", "--short", "--branch"], cwd=repo, timeout=30),
        run_command(["git", "log", "--oneline", "--decorate", "-8"], cwd=repo, timeout=30),
    ]


def action_git_push(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    branch = require_branch(args)
    return [run_command(["git", "push", "origin", branch], cwd=repo, timeout=180)]


def action_prod_ssh_probe(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    script = "hostname; whoami; uptime; cd /opt/apps/market-alpha-scanner/app && git rev-parse --short HEAD"
    return [ssh_script(script, timeout=45)]


def action_prod_status(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    script = r"""
set -euo pipefail
cd /opt/apps/market-alpha-scanner/app
echo "== identity =="
hostname; whoami; uptime
echo "== git =="
git rev-parse --short HEAD
git status --short --branch
echo "== compose ps =="
docker compose --env-file .env ps
echo "== timers =="
systemctl list-timers 'market-alpha-*' 'tradeveto-*' --no-pager || true
echo "== services =="
systemctl show market-alpha-fast-scan.service market-alpha-full-scan.service market-alpha-backup.service tradeveto-scanner-health.service -p Id -p ActiveState -p Result -p ExecMainStatus --no-pager || true
echo "== health =="
curl -fsS --max-time 10 https://tradeveto.com/api/health
printf '\n== deep ==\n'
curl -fsS --max-time 20 https://tradeveto.com/api/health/deep
printf '\n'
"""
    return [ssh_script(script, timeout=120)]


def action_prod_smoke(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    routes = require_routes(args)
    quoted = " ".join(shlex.quote(route) for route in routes)
    script = f"""
set -euo pipefail
for route in {quoted}; do
  curl -sS -o /tmp/tradeveto-relay-smoke-body -w "${{route}} status=%{{http_code}} ttfb=%{{time_starttransfer}}s total=%{{time_total}}s bytes=%{{size_download}}\\n" --max-time 45 "https://tradeveto.com${{route}}"
done
"""
    return [ssh_script(script, timeout=180)]


def action_prod_pull(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    branch = require_branch(args)
    script = f"""
set -euo pipefail
cd /opt/apps/market-alpha-scanner/app
git fetch origin {shlex.quote(branch)}
echo before=$(git rev-parse --short HEAD)
git pull --ff-only origin {shlex.quote(branch)}
echo after=$(git rev-parse --short HEAD)
git status --short --branch
"""
    return [ssh_script(script, timeout=120)]


def action_prod_frontend_deploy(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    tag = str(args.get("rollback_tag") or f"rollback-{time.strftime('%Y%m%d%H%M%S')}")
    if not LABEL_RE.match(tag):
        raise RelayError(f"invalid rollback_tag: {tag}")
    script = f"""
set -euo pipefail
cd /opt/apps/market-alpha-scanner/app
TAG={shlex.quote(tag)}
for img in market-alpha-scanner-market-alpha-frontend:latest market-alpha-scanner-market-alpha-frontend-hot-api:latest; do
  base=${{img%:latest}}
  docker image inspect "$base:$TAG" >/dev/null 2>&1 || docker tag "$img" "$base:$TAG"
done
docker compose --env-file .env build market-alpha-frontend market-alpha-frontend-hot-api
docker compose --env-file .env up -d --no-build market-alpha-frontend market-alpha-frontend-hot-api
for i in $(seq 1 12); do
  states=$(docker inspect -f '{{{{.Name}}}}={{{{if .State.Health}}}}{{{{.State.Health.Status}}}}{{{{else}}}}none{{{{end}}}}/{{{{.State.Status}}}}' market-alpha-frontend market-alpha-frontend-hot-api | tr '\\n' ';')
  echo "health[$i] $states"
  case "$states" in
    *market-alpha-frontend=healthy/running*market-alpha-frontend-hot-api=healthy/running*) break ;;
  esac
  sleep 5
done
"""
    return [ssh_script(script, timeout=900)]


def action_prod_scanner_build(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    tag = str(args.get("rollback_tag") or f"rollback-scanner-{time.strftime('%Y%m%d%H%M%S')}")
    if not LABEL_RE.match(tag):
        raise RelayError(f"invalid rollback_tag: {tag}")
    script = f"""
set -euo pipefail
cd /opt/apps/market-alpha-scanner/app
TAG={shlex.quote(tag)}
docker image inspect market-alpha-scanner-market-alpha-scanner-job:$TAG >/dev/null 2>&1 || docker tag market-alpha-scanner-market-alpha-scanner-job:latest market-alpha-scanner-market-alpha-scanner-job:$TAG
export SCANNER_BUILD_COMMIT=$(git rev-parse HEAD)
export SCANNER_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose --env-file .env --profile scanner-job build market-alpha-scanner-job
"""
    return [ssh_script(script, timeout=900)]


def action_prod_fast_scan(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    if args.get("confirm") != "writes scanner scan_run":
        raise RelayError('prod_fast_scan requires args.confirm = "writes scanner scan_run"')
    return [ssh_script("sudo systemctl start market-alpha-fast-scan.service; systemctl show market-alpha-fast-scan.service -p Result -p ExecMainStatus -p ActiveState --no-pager", timeout=900)]


def action_prod_full_scan(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    """Start the daily FULL scan (analysis + forward_returns) out of schedule.
    Same writes the 21:30 UTC timer performs; used when that run was skipped."""
    if args.get("confirm") != "writes scanner scan_run and analysis rows":
        raise RelayError('prod_full_scan requires args.confirm = "writes scanner scan_run and analysis rows"')
    return [ssh_script("sudo systemctl start --no-block market-alpha-full-scan.service; sleep 5; systemctl show market-alpha-full-scan.service -p Result -p ExecMainStatus -p ActiveState --no-pager", timeout=120)]


def action_prod_resource_snapshot(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    """Read-only host + docker resource picture for alert triage: memory/swap,
    live container stats, every scanner-job container (running or exited)
    with exit code / OOMKilled / memory limit, the watchdog's recent
    findings and the scan journal around a given UTC time. No env, no secrets."""
    around = str(args.get("around") or "")
    if around and not re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$", around):
        raise RelayError("around must look like 'YYYY-MM-DD HH:MM' (UTC)")
    window = ""
    if around:
        window = f"--since {shlex.quote(around + ':00')} --until {shlex.quote(around[:-2] + '59:59')}"
        # widen to the containing hour: HH:00 .. HH:59
        window = f"--since {shlex.quote(around[:13] + ':00:00')} --until {shlex.quote(around[:13] + ':59:59')}"
    script = f"""
set +e
echo "== host memory =="; free -m
echo "== host swap/pressure =="; cat /proc/pressure/memory 2>/dev/null; grep -E 'SwapTotal|SwapFree|MemAvailable' /proc/meminfo
echo "== docker stats (no-stream) =="; docker stats --no-stream --format 'table {{{{.Name}}}}\t{{{{.MemUsage}}}}\t{{{{.MemPerc}}}}\t{{{{.CPUPerc}}}}' 2>&1
echo "== scanner-job containers (all states) =="; docker ps -a --filter name=market-alpha-scanner-job --format '{{{{.Names}}}}\t{{{{.Status}}}}\t{{{{.CreatedAt}}}}' 2>&1 | head -20
echo "== scanner-job inspect =="; for c in $(docker ps -a --filter name=market-alpha-scanner-job --format '{{{{.Names}}}}' | head -10); do docker inspect -f '{{{{.Name}}}} status={{{{.State.Status}}}} exit={{{{.State.ExitCode}}}} oom={{{{.State.OOMKilled}}}} started={{{{.State.StartedAt}}}} finished={{{{.State.FinishedAt}}}} mem_limit={{{{.HostConfig.Memory}}}} memswap={{{{.HostConfig.MemorySwap}}}} restarts={{{{.RestartCount}}}}' "$c" 2>&1; done
echo "== compose memory limits (scanner-job service) =="; cd /opt/apps/market-alpha-scanner/app && docker compose --env-file .env --profile scanner-job config 2>/dev/null | grep -nE 'scanner-job:|mem_limit|memory:|cpus:|deploy:|resources:' | head -12
echo "== cgroup peak for running scanner-job =="; for c in $(docker ps --filter name=market-alpha-scanner-job --format '{{{{.ID}}}}'); do id=$(docker inspect -f '{{{{.Id}}}}' "$c"); for f in /sys/fs/cgroup/system.slice/docker-$id.scope/memory.peak /sys/fs/cgroup/system.slice/docker-$id.scope/memory.current /sys/fs/cgroup/system.slice/docker-$id.scope/memory.max; do [ -r "$f" ] && echo "$f=$(cat $f)"; done; done
echo "== watchdog findings (last 40 lines mentioning critical/warn/ok) =="; sudo journalctl -u tradeveto-resource-watchdog.service -n 400 --no-pager 2>&1 | grep -E 'status=|finding|CRITICAL|WARN' | tail -40
echo "== scan journal window {around or '(latest 120 lines)'} =="; sudo journalctl -u market-alpha-fast-scan.service -u market-alpha-full-scan.service {window} -n 120 --no-pager 2>&1 | grep -vE 'Failed download|quoteSummary' | tail -60
echo "== kernel oom / memory messages (current boot) =="; sudo journalctl -k -b 0 --no-pager 2>&1 | grep -iE 'oom|out of memory|killed process' | tail -10
"""
    return [ssh_script(script, timeout=120)]


def action_prod_docker_inspect_container(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    """Read-only inspect of one container by exact name (no env/secrets)."""
    name = str(args.get("container") or "")
    if not LABEL_RE.match(name):
        raise RelayError("container must be a plain container name")
    script = f"""
set +e
docker inspect -f 'name={{{{.Name}}}} image={{{{.Config.Image}}}} status={{{{.State.Status}}}} exit={{{{.State.ExitCode}}}} oom={{{{.State.OOMKilled}}}} error={{{{.State.Error}}}} started={{{{.State.StartedAt}}}} finished={{{{.State.FinishedAt}}}} mem_limit={{{{.HostConfig.Memory}}}} memswap={{{{.HostConfig.MemorySwap}}}} restarts={{{{.RestartCount}}}}' {shlex.quote(name)} 2>&1
echo "== logs tail (last 40, provider noise filtered) =="; docker logs --tail 200 {shlex.quote(name)} 2>&1 | grep -vE 'Failed download|quoteSummary' | tail -40
"""
    return [ssh_script(script, timeout=60)]


def action_prod_watchdog_source(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    """Read the (untracked) watchdog script and its unit from the box, read-only."""
    script = """
set +e
echo "== unit =="; systemctl cat tradeveto-resource-watchdog.service --no-pager 2>&1 | grep -vE 'Environment=.*(KEY|TOKEN|SECRET|PASS)' | head -40
echo "== timer =="; systemctl cat tradeveto-resource-watchdog.timer --no-pager 2>&1 | head -20
SRC=/opt/ops/tradeveto-resource-watchdog.py; [ -r "$SRC" ] || SRC=/opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-resource-watchdog.py
echo "== script: $SRC (thresholds + docker section) =="; grep -n "def thresholds_from_env" -A 22 "$SRC" 2>&1 | head -30; grep -n "def docker_metrics" -A 70 "$SRC" 2>&1 | head -80; echo "== differs from repo copy? =="; diff -q "$SRC" /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-resource-watchdog.py 2>&1
"""
    return [ssh_script(script, timeout=60)]


def action_prod_scanner_job_watch(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    """Read-only memory sampler for the one-shot scanner-job container.

    Polls cgroup memory (current/peak/anon/file/inactive_file/slab) every 3s for ~160s so a
    scan's end-phase high-water mark can be split into anonymous RSS vs page cache.
    Values are raw bytes; limit is the container's memory.max.
    """
    script = """
set +e
DEADLINE=$(( $(date +%s) + 158 ))
CG=""
while [ $(date +%s) -lt $DEADLINE ]; do
  if [ -z "$CG" ] || [ ! -d "$CG" ]; then
    CID=$(docker ps --filter name=market-alpha-scanner-job --format '{{.ID}}' | head -1)
    if [ -n "$CID" ]; then
      FULL=$(docker inspect -f '{{.Id}}' "$CID" 2>/dev/null)
      [ -n "$FULL" ] && CG=/sys/fs/cgroup/system.slice/docker-$FULL.scope
    fi
  fi
  if [ -n "$CG" ] && [ -d "$CG" ]; then
    printf '%s cur=%s peak=%s max=%s' "$(date -u +%H:%M:%S)" "$(cat "$CG/memory.current" 2>/dev/null)" "$(cat "$CG/memory.peak" 2>/dev/null)" "$(cat "$CG/memory.max" 2>/dev/null)"
    awk '$1=="anon"||$1=="file"||$1=="inactive_file"||$1=="active_file"||$1=="slab"{printf " %s=%s", $1, $2}' "$CG/memory.stat" 2>/dev/null
    echo ""
  else
    echo "$(date -u +%H:%M:%S) no-running-scanner-job"
  fi
  sleep 3
done
echo "== docker stats snapshot at end =="; docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>&1
echo "== scanner-job containers now =="; docker ps -a --filter name=market-alpha-scanner-job --format '{{.Names}} {{.Status}}' 2>&1
"""
    return [ssh_script(script, timeout=210)]


def action_prod_db_read(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    query_name = str(args.get("query") or "audit_summary")
    if query_name not in DB_QUERIES:
        raise RelayError(f"DB query not allowed: {query_name}")
    sql = DB_QUERIES[query_name]
    encoded_sql = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    script = f"""
set -euo pipefail
cd /opt/apps/market-alpha-scanner/app
printf %s {shlex.quote(encoded_sql)} | base64 -d | docker compose --env-file .env exec -T market-alpha-postgres sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off'
"""
    return [ssh_script(script, timeout=300)]


def action_prod_logs_recent(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    service = str(args.get("service") or "frontend")
    mapping = {
        "frontend": "market-alpha-frontend",
        "hot-api": "market-alpha-frontend-hot-api",
        "fast-scan": "market-alpha-fast-scan.service",
        "full-scan": "market-alpha-full-scan.service",
        "backup": "market-alpha-backup.service",
        "watchdog": "tradeveto-resource-watchdog.service",
    }
    if service not in mapping:
        raise RelayError(f"service not allowed: {service}")
    target = mapping[service]
    if target.endswith(".service"):
        script = f"sudo journalctl -u {shlex.quote(target)} -n 160 --no-pager"
    else:
        script = f"docker logs --since 30m {shlex.quote(target)} 2>&1 | tail -200"
    return [ssh_script(script, timeout=60)]


def action_prod_journal_recent(repo: Path, args: dict[str, Any]) -> list[CommandResult]:
    """Read-only boot/reboot forensics: last reboots, previous-boot journal,
    current-boot start, watchdog unit log, container StartedAt. No mutation."""
    script = """
set +e
echo "== uptime =="; uptime
echo "== last -x reboot/shutdown =="; last -x reboot shutdown 2>/dev/null | head -8
SINCE=$(date -d "$(uptime -s) 8 hours ago" '+%F %T' 2>/dev/null || date -d '1 day ago' '+%F %T')
echo "== window: previous boot since $SINCE =="
echo "== previous boot: warning+ excluding UFW noise (last 40) =="; sudo journalctl -b -1 -p warning --since "$SINCE" --no-pager 2>&1 | grep -v "UFW BLOCK" | tail -40
echo "== previous boot: final 25 lines =="; sudo journalctl -b -1 -n 25 --no-pager 2>&1
echo "== previous boot: who asked for the reboot (systemd-logind/unattended-upgrades/shutdown, last 30) =="; sudo journalctl -b -1 --since "$SINCE" --no-pager 2>&1 | grep -iE "unattended|reboot|shutdown|apt-daily|needrestart|logind|sudo:.*COMMAND|kernel: Linux version|watchdog" | grep -v "UFW BLOCK" | tail -30
NEAR=$(date -d "$(uptime -s) 6 minutes ago" '+%F %T' 2>/dev/null || echo "$SINCE")
echo "== 6 minutes before the reboot: sessions, sudo, reboot initiators (first 40) =="; sudo journalctl -b -1 --since "$NEAR" --no-pager 2>&1 | grep -iE "sudo:|reboot|power|polkit|unattended|session opened|Accepted publickey|systemd-logind" | grep -v "UFW BLOCK" | head -40
echo "== unattended-upgrades log tail =="; sudo tail -25 /var/log/unattended-upgrades/unattended-upgrades.log 2>&1
echo "== apt history tail =="; sudo tail -20 /var/log/apt/history.log 2>&1
echo "== watchdog unit, previous boot (last 15) =="; sudo journalctl -b -1 -u tradeveto-resource-watchdog.service --since "$SINCE" -n 15 --no-pager 2>&1
echo "== current boot: first 20 lines =="; sudo journalctl -b 0 --no-pager 2>&1 | head -20
echo "== watchdog unit (last 60) =="; sudo journalctl -u tradeveto-resource-watchdog.service -n 60 --no-pager 2>&1
echo "== watchdog timer =="; systemctl show tradeveto-resource-watchdog.timer -p LastTriggerUSec -p NextElapseUSecRealtime --no-pager 2>&1
echo "== container StartedAt / RestartCount =="; for c in $(docker ps --format '{{.Names}}'); do printf "%s " "$c"; docker inspect -f '{{.State.StartedAt}} restarts={{.RestartCount}}' "$c" 2>/dev/null; done
echo "== docker daemon start =="; sudo journalctl -u docker.service -b 0 -n 5 --no-pager 2>&1
"""
    return [ssh_script(script, timeout=120)]


DB_QUERIES = {
    "audit_summary": r"""
WITH latest_run AS (
  SELECT id, created_at, completed_at, status, symbols_scored
  FROM scan_runs
  ORDER BY created_at DESC
  LIMIT 1
), latest_signals AS (
  SELECT ss.symbol, ss.final_decision, ss.payload
  FROM scanner_signals ss
  JOIN latest_run lr ON lr.id = ss.scan_run_id
)
SELECT 'latest_run' AS section, row_to_json(latest_run)::text AS payload FROM latest_run
UNION ALL
SELECT 'decision_distribution', json_object_agg(COALESCE(final_decision, 'NULL'), count)::text
FROM (SELECT final_decision, count(*) FROM latest_signals GROUP BY final_decision ORDER BY final_decision) d
UNION ALL
SELECT 'setup_type_distribution', json_object_agg(COALESCE(setup_type, 'NULL'), count)::text
FROM (SELECT payload->>'setup_type' AS setup_type, count(*) FROM latest_signals GROUP BY payload->>'setup_type' ORDER BY count(*) DESC) s
UNION ALL
SELECT 'evidence_fields', json_build_object(
  'rows', count(*),
  'avwap_ytd', count(*) FILTER (WHERE payload ? 'avwap_ytd'),
  'avwap_swing', count(*) FILTER (WHERE payload ? 'avwap_swing'),
  'supertrend_line', count(*) FILTER (WHERE payload ? 'supertrend_line'),
  'recent_swing_low', count(*) FILTER (WHERE payload ? 'recent_swing_low'),
  'recent_resistance', count(*) FILTER (WHERE payload ? 'recent_resistance')
)::text FROM latest_signals
UNION ALL
SELECT 'sndk', COALESCE((SELECT row_to_json(x)::text FROM (
  SELECT symbol, final_decision, payload->>'final_score' AS final_score, payload->>'setup_type' AS setup_type
  FROM latest_signals WHERE symbol='SNDK' LIMIT 1
) x), 'null');
""",
    "latest_scan": "SELECT id, created_at, completed_at, status, symbols_scored FROM scan_runs ORDER BY created_at DESC LIMIT 5;",
    "decision_distribution": "SELECT final_decision, count(*) FROM scanner_signals WHERE scan_run_id=(SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1) GROUP BY final_decision ORDER BY final_decision;",
    # --- P1-1 shadow-engine evidence (read-only) ---
    "shadow_comparison": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (SELECT COALESCE(final_decision,'NULL') AS live, COALESCE(payload->>'candidate_decision','NULL') AS shadow
      FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id)
SELECT live, shadow, count(*) AS rows FROM s GROUP BY live, shadow ORDER BY live, shadow;
""",
    "shadow_summary": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (SELECT final_decision AS live, payload->>'candidate_decision' AS shadow FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id)
SELECT count(*) AS rows,
       count(*) FILTER (WHERE live='ENTER') AS live_enter,
       count(*) FILTER (WHERE shadow='ENTER') AS shadow_enter,
       count(*) FILTER (WHERE shadow='WAIT_PULLBACK') AS shadow_wait_pullback,
       count(*) FILTER (WHERE shadow='WATCH') AS shadow_watch,
       count(*) FILTER (WHERE shadow='AVOID') AS shadow_avoid,
       count(*) FILTER (WHERE shadow='EXIT') AS shadow_exit,
       count(*) FILTER (WHERE shadow IS NULL) AS shadow_null,
       count(*) FILTER (WHERE live=shadow) AS agree
FROM s;
""",
    "funnel_blockers": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1)
SELECT COALESCE(payload->>'funnel_blocking_gate','(none)') AS blocking_gate,
       COALESCE(final_decision,'NULL') AS live,
       count(*) AS rows
FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id
GROUP BY 1,2 ORDER BY rows DESC LIMIT 30;
""",
    "shadow_history_daily": r"""
SELECT date(sr.created_at) AS day,
       count(*) AS rows,
       count(*) FILTER (WHERE ss.final_decision='ENTER') AS live_enter,
       count(*) FILTER (WHERE ss.payload->>'candidate_decision'='ENTER') AS shadow_enter,
       count(*) FILTER (WHERE ss.payload->>'candidate_decision' IS NOT NULL) AS shadow_populated
FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
WHERE sr.created_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1;
""",
    "forward_returns_by_decision": r"""
WITH j AS (
  SELECT fr.horizon, fr.return_pct::numeric AS r,
         COALESCE(ss.final_decision,'NULL') AS live,
         COALESCE(ss.payload->>'candidate_decision','NULL') AS shadow
  FROM forward_returns fr JOIN scanner_signals ss ON ss.id=fr.scanner_signal_id
  WHERE fr.created_at > now() - interval '30 days' AND fr.return_pct IS NOT NULL
)
SELECT 'live' AS engine, live AS decision, horizon, count(*) AS n,
       round(avg(r),3) AS avg_ret, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r)::numeric,3) AS med_ret,
       round(100.0*count(*) FILTER (WHERE r>0)/count(*),1) AS win_pct
FROM j GROUP BY live, horizon
UNION ALL
SELECT 'shadow', shadow, horizon, count(*),
       round(avg(r),3), round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r)::numeric,3),
       round(100.0*count(*) FILTER (WHERE r>0)/count(*),1)
FROM j GROUP BY shadow, horizon
ORDER BY engine, decision, horizon;
""",
    "upstream_drivers": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (SELECT ss.final_decision AS live, ss.payload AS p FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id)
SELECT 'composite_action' AS field, COALESCE(p->>'composite_action','NULL') AS value, count(*) FROM s GROUP BY 2
UNION ALL SELECT 'recommendation_quality', COALESCE(p->>'recommendation_quality','NULL'), count(*) FROM s GROUP BY 2
UNION ALL SELECT 'entry_status', COALESCE(p->>'entry_status','NULL'), count(*) FROM s GROUP BY 2
UNION ALL SELECT 'market_regime', COALESCE(p->>'market_regime','NULL'), count(*) FROM s GROUP BY 2
UNION ALL SELECT 'setup_type', COALESCE(p->>'setup_type','NULL'), count(*) FROM s GROUP BY 2
UNION ALL SELECT 'risk_penalty_bucket', CASE WHEN (p->>'risk_penalty')::numeric>=24 THEN '>=24 (cap SELL)' WHEN (p->>'risk_penalty')::numeric>=18 THEN '18-24 (cap WAIT)' WHEN (p->>'risk_penalty')::numeric>=12 THEN '12-18' ELSE '<12' END, count(*) FROM s WHERE p->>'risk_penalty' ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY 2
UNION ALL SELECT 'final_score_bucket', CASE WHEN (p->>'final_score')::numeric>=80 THEN '>=80' WHEN (p->>'final_score')::numeric>=70 THEN '70-79' WHEN (p->>'final_score')::numeric>=60 THEN '60-69' WHEN (p->>'final_score')::numeric>=52 THEN '52-59' ELSE '<52' END, count(*) FROM s WHERE p->>'final_score' ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY 2
UNION ALL SELECT 'quality_score_bucket', CASE WHEN (p->>'quality_score')::numeric>=75 THEN '>=75 TRADE_READY' WHEN (p->>'quality_score')::numeric>=60 THEN '60-74 WAIT_PULLBACK' WHEN (p->>'quality_score')::numeric>=40 THEN '40-59 LOW_EDGE' ELSE '<40 AVOID' END, count(*) FROM s WHERE p->>'quality_score' ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY 2
UNION ALL SELECT 'quality_if_no_setup_penalty', CASE WHEN (p->>'quality_score')::numeric+25>=75 THEN '>=75 TRADE_READY' WHEN (p->>'quality_score')::numeric+25>=60 THEN '60-74 WAIT_PULLBACK' WHEN (p->>'quality_score')::numeric+25>=40 THEN '40-59 LOW_EDGE' ELSE '<40 AVOID' END, count(*) FROM s WHERE p->>'quality_score' ~ '^-?[0-9]+(\.[0-9]+)?$' AND p->>'setup_type'='AVOID' GROUP BY 2
UNION ALL SELECT 'confidence_bucket', CASE WHEN (p->>'confidence_score')::numeric>=70 THEN '>=70' WHEN (p->>'confidence_score')::numeric>=50 THEN '50-69' ELSE '<50' END, count(*) FROM s WHERE p->>'confidence_score' ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY 2
UNION ALL SELECT 'trend_score_bucket', CASE WHEN (p->>'trend_score')::numeric>=72 THEN '>=72 (cont ok)' WHEN (p->>'trend_score')::numeric>=70 THEN '70-72 (pullback ok)' WHEN (p->>'trend_score')::numeric>=50 THEN '50-69' ELSE '<50' END, count(*) FROM s WHERE p->>'trend_score' ~ '^-?[0-9]+(\.[0-9]+)?$' GROUP BY 2
ORDER BY 1, 3 DESC;
""",
    "code_frequencies": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (SELECT ss.payload AS p FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id)
SELECT 'vetoes' AS field, v AS code, count(*) FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'vetoes')='array' THEN p->'vetoes' ELSE '[]'::jsonb END) v GROUP BY 2
UNION ALL SELECT 'setup_reason_codes', v, count(*) FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'setup_reason_codes')='array' THEN p->'setup_reason_codes' ELSE '[]'::jsonb END) v GROUP BY 2
UNION ALL SELECT 'candidate_reason_codes', v, count(*) FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'candidate_reason_codes')='array' THEN p->'candidate_reason_codes' ELSE '[]'::jsonb END) v GROUP BY 2
UNION ALL SELECT 'candidate_decision', COALESCE(p->>'candidate_decision','NULL'), count(*) FROM s GROUP BY 2
UNION ALL SELECT 'funnel_blocking_gate', COALESCE(p->>'funnel_blocking_gate','NULL'), count(*) FROM s GROUP BY 2
UNION ALL SELECT 'pre_expansion_bucket', CASE WHEN p->>'pre_expansion_score' IS NULL OR p->>'pre_expansion_score' !~ '^-?[0-9]+(\.[0-9]+)?$' THEN 'NULL' WHEN (p->>'pre_expansion_score')::numeric>=45 THEN '>=45' ELSE '<45' END, count(*) FROM s GROUP BY 2
ORDER BY 1, 3 DESC;
""",
    "candidate_avoid_reasons": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (SELECT ss.final_decision AS live, ss.payload AS p FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id)
SELECT COALESCE(p->>'candidate_decision','NULL') AS cand, COALESCE(live,'NULL') AS live,
       COALESCE(p->>'recommendation_quality','NULL') AS quality,
       (p->'candidate_reason_codes')::text AS reasons, count(*) AS rows
FROM s GROUP BY 1,2,3,4 ORDER BY rows DESC LIMIT 25;
""",
    "stale_flags_latest": r"""
WITH r AS (
  SELECT id, created_at FROM scan_runs ORDER BY created_at DESC LIMIT 6
), s AS (
  SELECT r.created_at, ss.payload AS p
  FROM scanner_signals ss JOIN r ON r.id = ss.scan_run_id
)
SELECT to_char(created_at AT TIME ZONE 'UTC','MM-DD HH24:MI') AS run_at,
       count(*) AS rows,
       count(*) FILTER (WHERE p->'vetoes' ? 'STALE_DATA') AS veto_stale,
       count(*) FILTER (WHERE lower(p->>'stale_data')='true') AS flag_stale,
       count(*) FILTER (WHERE lower(p->>'stale_by_market_calendar')='true') AS mcal_stale,
       count(*) FILTER (WHERE lower(p->>'stale_by_wall_clock')='true') AS wallclock_stale,
       count(*) FILTER (WHERE p->>'stale_by_wall_clock' IS NOT NULL) AS wallclock_rows,
       count(*) FILTER (WHERE (p->>'missed_sessions')::int = 0) AS missed_0,
       count(*) FILTER (WHERE (p->>'missed_sessions')::int = 1) AS missed_1,
       count(*) FILTER (WHERE (p->>'missed_sessions')::int > 1) AS missed_2plus,
       count(*) FILTER (WHERE p->'vetoes' ? 'LOW_CONFIDENCE_DATA') AS lowconf,
       count(*) FILTER (WHERE p->'mcal_vetoes' ? 'STALE_DATA') AS mcal_veto_stale,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (p->>'data_quality_score')::numeric))::numeric,1) AS med_dq
FROM s GROUP BY 1 ORDER BY 1 DESC;
""",
    "stale_by_hour": r"""
WITH s AS (
  SELECT sr.created_at, ss.final_decision AS live, ss.payload AS p
  FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
  WHERE sr.created_at > now() - interval '7 days'
)
SELECT extract(hour FROM created_at AT TIME ZONE 'UTC')::int AS utc_hour,
       count(*) AS rows,
       round(100.0*count(*) FILTER (WHERE p->'vetoes' ? 'STALE_DATA')/count(*),1) AS stale_pct,
       round(100.0*count(*) FILTER (WHERE lower(p->>'stale_by_market_calendar')='true')/count(*),1) AS mkt_stale_pct,
       count(*) FILTER (WHERE p->>'stale_by_market_calendar' IS NOT NULL) AS mkt_rows,
       round(100.0*count(*) FILTER (WHERE p->'vetoes' ? 'LOW_CONFIDENCE_DATA')/count(*),1) AS lowconf_pct,
       round(100.0*count(*) FILTER (WHERE p->>'setup_type'='AVOID')/count(*),1) AS setup_avoid_pct,
       count(*) FILTER (WHERE live='ENTER') AS live_enter,
       count(*) FILTER (WHERE p->>'candidate_decision'='ENTER') AS cand_enter,
       count(*) FILTER (WHERE p->>'candidate_decision' IS NOT NULL) AS cand_rows,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (p->>'data_age_minutes')::numeric) FILTER (WHERE p->>'data_age_minutes' ~ '^[0-9.]+$')::numeric/60,1) AS med_age_h
FROM s GROUP BY 1 ORDER BY 1;
""",
    "stale_by_day": r"""
WITH s AS (
  SELECT sr.created_at, ss.final_decision AS live, ss.payload AS p
  FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
  WHERE sr.created_at > now() - interval '14 days'
)
SELECT date(created_at AT TIME ZONE 'UTC') AS day, to_char(created_at AT TIME ZONE 'UTC','Dy') AS dow,
       count(*) AS rows,
       round(100.0*count(*) FILTER (WHERE p->'vetoes' ? 'STALE_DATA')/count(*),1) AS stale_pct,
       round(100.0*count(*) FILTER (WHERE lower(p->>'stale_by_market_calendar')='true')/count(*),1) AS mkt_stale_pct,
       count(*) FILTER (WHERE p->>'stale_by_market_calendar' IS NOT NULL) AS mkt_rows,
       round(100.0*count(*) FILTER (WHERE p->>'setup_type'='AVOID')/count(*),1) AS setup_avoid_pct,
       count(*) FILTER (WHERE live='ENTER') AS live_enter,
       count(*) FILTER (WHERE p->>'candidate_decision'='ENTER') AS cand_enter,
       count(*) FILTER (WHERE p->>'candidate_decision' IS NOT NULL) AS cand_rows,
       string_agg(DISTINCT p->>'data_provider', ',') AS providers
FROM s GROUP BY 1,2 ORDER BY 1;
""",
    "fresh_window_funnel": r"""
WITH s AS (
  SELECT ss.final_decision AS live, ss.payload AS p
  FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
  WHERE sr.created_at > now() - interval '7 days' AND NOT (ss.payload->'vetoes' ? 'STALE_DATA')
)
SELECT 'rows_not_stale' AS metric, count(*)::text AS value FROM s
UNION ALL SELECT 'setup_type='||COALESCE(p->>'setup_type','NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'live='||COALESCE(live,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'candidate='||COALESCE(p->>'candidate_decision','NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'blocking='||COALESCE(p->>'funnel_blocking_gate','NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'veto='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'vetoes')='array' THEN p->'vetoes' ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'confidence>=70', count(*) FILTER (WHERE p->>'confidence_score' ~ '^[0-9.]+$' AND (p->>'confidence_score')::numeric>=70)::text FROM s
ORDER BY 1;
""",
    "fresh_cumulative_gates": r"""
WITH s AS (
  SELECT ss.final_decision AS live,
         COALESCE(x.vetoes ? 'STOP_RISK', false) AS has_stop,
         COALESCE(x.vetoes ? 'EXTREME_VOLATILITY', false) AS has_extreme,
         CASE WHEN x.quality_score ~ '^[0-9.]+$' THEN x.quality_score::numeric END AS qs,
         COALESCE(x.composite_action,'') AS act,
         COALESCE(x.recommendation_quality,'') AS q,
         COALESCE(x.entry_status,'') AS es,
         COALESCE(x.setup_type,'') AS st,
         CASE WHEN x.final_score ~ '^[0-9.]+$' THEN x.final_score::numeric END AS fs,
         CASE WHEN x.confidence_score ~ '^[0-9.]+$' THEN x.confidence_score::numeric END AS cs,
         CASE WHEN x.setup_strength ~ '^[0-9.]+$' THEN x.setup_strength::numeric END AS sst,
         CASE WHEN x.risk_reward ~ '^-?[0-9.]+$' THEN x.risk_reward::numeric END AS rr,
         CASE WHEN jsonb_typeof(x.vetoes)='array' THEN jsonb_array_length(x.vetoes) ELSE 0 END AS nveto
  FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(composite_action text, recommendation_quality text, entry_status text, setup_type text, final_score text, confidence_score text, setup_strength text, risk_reward text, quality_score text, vetoes jsonb)
  WHERE sr.created_at > now() - interval '7 days' AND NOT COALESCE(x.vetoes ? 'STALE_DATA', false)
),

g AS (
  SELECT *,
    (act NOT IN ('SELL','STRONG SELL')) AS g1_not_sell,
    (q IN ('TRADE_READY','WAIT_PULLBACK')) AS g2_quality_ok,
    (q = 'TRADE_READY') AS g3_trade_ready,
    (act IN ('BUY','STRONG BUY')) AS g4_buy,
    (es IN ('GOOD ENTRY','BUY ZONE','NEAR ENTRY')) AS g5_enterable,
    (st <> 'AVOID') AS g6_setup_ok,
    (sst IS NULL OR sst >= 64) AS g7_strength,
    (nveto = 0) AS g8_no_veto,
    (fs IS NULL OR fs >= 80) AS g9_score80,
    (cs IS NULL OR cs >= 70) AS g10_conf70,
    (fs IS NOT NULL AND fs BETWEEN 55 AND 70) AS band_55_70,
    (rr IS NOT NULL AND rr >= 1.2) AS rr_ge_1_2
  FROM s
)
SELECT 'A0 fresh rows' AS stage, count(*) AS n FROM g
UNION ALL SELECT 'A1 action not SELL', count(*) FROM g WHERE g1_not_sell
UNION ALL SELECT 'A2 +quality TRADE_READY|WAIT_PULLBACK', count(*) FROM g WHERE g1_not_sell AND g2_quality_ok
UNION ALL SELECT 'A3 +quality TRADE_READY', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready
UNION ALL SELECT 'A4 +action BUY', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy
UNION ALL SELECT 'A5 +entry enterable', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy AND g5_enterable
UNION ALL SELECT 'A6 +setup_type != AVOID', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy AND g5_enterable AND g6_setup_ok
UNION ALL SELECT 'A7 +setup_strength>=64', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy AND g5_enterable AND g6_setup_ok AND g7_strength
UNION ALL SELECT 'A8 +no vetoes', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy AND g5_enterable AND g6_setup_ok AND g7_strength AND g8_no_veto
UNION ALL SELECT 'A9 +score>=80', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy AND g5_enterable AND g6_setup_ok AND g7_strength AND g8_no_veto AND g9_score80
UNION ALL SELECT 'A10 +confidence>=70', count(*) FROM g WHERE g1_not_sell AND g3_trade_ready AND g4_buy AND g5_enterable AND g6_setup_ok AND g7_strength AND g8_no_veto AND g9_score80 AND g10_conf70
UNION ALL SELECT 'A11 live ENTER actual', count(*) FROM g WHERE live='ENTER'
UNION ALL SELECT 'B1 setup != AVOID (alone)', count(*) FROM g WHERE g6_setup_ok
UNION ALL SELECT 'B2 setup ok + not SELL', count(*) FROM g WHERE g6_setup_ok AND g1_not_sell
UNION ALL SELECT 'B3 setup ok + not SELL + enterable', count(*) FROM g WHERE g6_setup_ok AND g1_not_sell AND g5_enterable
UNION ALL SELECT 'B4 + no severe veto (rr>=1.2, no STOP/EXTREME)', count(*) FROM g WHERE g6_setup_ok AND g1_not_sell AND g5_enterable AND rr_ge_1_2 AND NOT has_stop AND NOT has_extreme
UNION ALL SELECT 'B5 + confidence>=70', count(*) FROM g WHERE g6_setup_ok AND g1_not_sell AND g5_enterable AND rr_ge_1_2 AND NOT has_stop AND NOT has_extreme AND g10_conf70 AND cs IS NOT NULL
UNION ALL SELECT 'B6 + score in 55-70 band', count(*) FROM g WHERE g6_setup_ok AND g1_not_sell AND g5_enterable AND rr_ge_1_2 AND NOT has_stop AND NOT has_extreme AND g10_conf70 AND cs IS NOT NULL AND band_55_70
UNION ALL SELECT 'B7 + score>=80 instead', count(*) FROM g WHERE g6_setup_ok AND g1_not_sell AND g5_enterable AND rr_ge_1_2 AND NOT has_stop AND NOT has_extreme AND g10_conf70 AND cs IS NOT NULL AND fs >= 80
UNION ALL SELECT 'C1 quality TRADE_READY (any)', count(*) FROM g WHERE g3_trade_ready
UNION ALL SELECT 'C2 quality would be TRADE_READY without -25 (setup AVOID rows)', count(*) FROM g WHERE st='AVOID' AND qs + 25 >= 75
UNION ALL SELECT 'C3 confidence>=70 (any)', count(*) FROM g WHERE cs >= 70
UNION ALL SELECT 'C4 score>=80 (any)', count(*) FROM g WHERE fs >= 80
UNION ALL SELECT 'C5 score 55-70 (any)', count(*) FROM g WHERE band_55_70
ORDER BY 1;
""",
    "run_history": r"""
WITH runs AS (SELECT id, created_at, symbols_scored FROM scan_runs ORDER BY created_at DESC LIMIT 40),
s AS (
  SELECT sr.id AS run_id, sr.created_at, ss.final_decision AS live, x.*
  FROM scanner_signals ss JOIN runs sr ON sr.id=ss.scan_run_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(setup_type text, candidate_decision text, candidate_entry_zone text, candidate_stop_loss text, candidate_target_zone text, candidate_confidence_penalty text, confidence_score text, stale_by_market_calendar text, vetoes jsonb, final_score text, risk_reward text, mcal_severe_vetoes jsonb, candidate_v2_decision text, candidate_v2_band_ok text, buy_zone text, stop_loss text, take_profit_zone text, relative_volume_score text, relative_volume_score_completed text, last_bar_partial text, breakout_score_completed text, rows_without_close text, trend_score text)
)
SELECT left(run_id::text,8) AS run, to_char(created_at AT TIME ZONE 'UTC','MM-DD HH24:MI') AS at_utc, count(*) AS rows,
       count(*) FILTER (WHERE live='ENTER') AS l_enter, count(*) FILTER (WHERE live='WAIT_PULLBACK') AS l_wait, count(*) FILTER (WHERE live='WATCH') AS l_watch,
       count(*) FILTER (WHERE live='AVOID') AS l_avoid, count(*) FILTER (WHERE live='EXIT') AS l_exit,
       count(*) FILTER (WHERE setup_type='AVOID') AS st_avoid, count(*) FILTER (WHERE setup_type='PULLBACK') AS st_pull, count(*) FILTER (WHERE setup_type='CONTINUATION') AS st_cont, count(*) FILTER (WHERE setup_type='BREAKOUT') AS st_brk,
       count(*) FILTER (WHERE COALESCE(vetoes ? 'STALE_DATA',false)) AS stale, count(*) FILTER (WHERE lower(stale_by_market_calendar)='true') AS mkt_stale, count(*) FILTER (WHERE stale_by_market_calendar IS NOT NULL) AS mkt_n,
       count(*) FILTER (WHERE COALESCE(vetoes ? 'STOP_RISK',false) OR COALESCE(vetoes ? 'EXTREME_VOLATILITY',false) OR COALESCE(vetoes ? 'POOR_RISK_REWARD',false) OR COALESCE(vetoes ? 'PROVIDER_ERROR',false)) AS other_severe,
       count(*) FILTER (WHERE jsonb_typeof(mcal_severe_vetoes)='array' AND jsonb_array_length(mcal_severe_vetoes)>0) AS mcal_severe, count(*) FILTER (WHERE mcal_severe_vetoes IS NOT NULL) AS mcal_n,
       count(*) FILTER (WHERE candidate_decision IS NOT NULL) AS c_n, count(*) FILTER (WHERE candidate_decision='ENTER') AS c_enter, count(*) FILTER (WHERE candidate_decision='WAIT_PULLBACK') AS c_wait,
       count(*) FILTER (WHERE candidate_decision='WATCH') AS c_watch, count(*) FILTER (WHERE candidate_decision='AVOID') AS c_avoid, count(*) FILTER (WHERE candidate_decision='EXIT') AS c_exit,
       count(*) FILTER (WHERE candidate_decision IN ('ENTER','WAIT_PULLBACK') AND COALESCE(candidate_entry_zone,'') NOT IN ('','-') AND COALESCE(candidate_stop_loss,'') NOT IN ('','-') AND COALESCE(candidate_target_zone,'') NOT IN ('','-')) AS c_where_full,
       count(*) FILTER (WHERE candidate_v2_decision='ENTER') AS v2_enter, count(*) FILTER (WHERE candidate_v2_decision='WAIT_PULLBACK') AS v2_wait, count(*) FILTER (WHERE candidate_v2_decision='WATCH') AS v2_watch, count(*) FILTER (WHERE candidate_v2_decision='AVOID') AS v2_avoid, count(*) FILTER (WHERE lower(candidate_v2_band_ok)='true') AS v2_band_ok,
       count(*) FILTER (WHERE candidate_v2_decision IN ('ENTER','WAIT_PULLBACK') AND COALESCE(buy_zone,'') NOT IN ('','-','N/A') AND COALESCE(stop_loss,'') NOT IN ('','-','N/A') AND COALESCE(take_profit_zone,'') NOT IN ('','-','N/A')) AS v2_where_full,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (confidence_score::numeric - COALESCE(NULLIF(candidate_confidence_penalty,'')::numeric,0))) FILTER (WHERE confidence_score ~ '^[0-9.]+$')::numeric,1) AS c_conf_med,
       count(*) FILTER (WHERE confidence_score ~ '^[0-9.]+$' AND confidence_score::numeric >= 70) AS conf70,
       count(*) FILTER (WHERE lower(last_bar_partial)='true') AS partial_bars,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY relative_volume_score::numeric) FILTER (WHERE relative_volume_score ~ '^[0-9.]+$')::numeric,1) AS relvol_live,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY relative_volume_score_completed::numeric) FILTER (WHERE relative_volume_score_completed ~ '^[0-9.]+$')::numeric,1) AS relvol_done,
       count(*) FILTER (WHERE breakout_score_completed ~ '^[0-9.]+$' AND breakout_score_completed::numeric>=72) AS brk_done72,
       count(*) FILTER (WHERE rows_without_close ~ '^[0-9.]+$' AND rows_without_close::numeric > 0) AS nan_close_rows,
       count(*) FILTER (WHERE trend_score ~ '^[0-9.]+$' AND trend_score::numeric = 0) AS trend_zero
FROM s GROUP BY run_id, created_at ORDER BY created_at DESC;
""",
    "run_snapshot": r"""
WITH lr AS (SELECT id, created_at, symbols_scored, status FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (
  SELECT ss.symbol, ss.final_decision AS live, x.*
  FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(setup_type text, setup_detail text, candidate_decision text, candidate_setup_class text, candidate_reason_codes jsonb, candidate_entry_zone text, candidate_stop_loss text, candidate_target_zone text, candidate_risk_reward text, candidate_confidence_penalty text, confidence_score text, stale_by_market_calendar text, missed_sessions text, vetoes jsonb, final_score text, risk_reward text, entry_status text, composite_action text, recommendation_quality text, breakout_score text, relative_volume_score text, momentum_score text, trend_score text, pre_expansion_score text, funnel_blocking_gate text)
)
SELECT 'run' AS k, left(id::text,8)||' '||to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')||' status='||COALESCE(status,'')||' scored='||COALESCE(symbols_scored::text,'') AS v FROM lr
UNION ALL SELECT 'live='||COALESCE(live,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'candidate='||COALESCE(candidate_decision,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'setup='||COALESCE(setup_type,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'setup_detail='||COALESCE(setup_detail,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'cand_setup_class='||COALESCE(candidate_setup_class,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'blocking='||COALESCE(funnel_blocking_gate,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'veto='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(vetoes)='array' THEN vetoes ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'cand_reason='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(candidate_reason_codes)='array' THEN candidate_reason_codes ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'mkt_stale='||COALESCE(lower(stale_by_market_calendar),'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'missed_sessions='||COALESCE(missed_sessions,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'entry_status='||COALESCE(entry_status,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'action='||COALESCE(composite_action,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'quality='||COALESCE(recommendation_quality,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'conf>=70', count(*) FILTER (WHERE confidence_score ~ '^[0-9.]+$' AND confidence_score::numeric>=70)::text FROM s
UNION ALL SELECT 'conf_median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY confidence_score::numeric) FILTER (WHERE confidence_score ~ '^[0-9.]+$')::numeric,1)::text FROM s
UNION ALL SELECT 'breakout>=72', count(*) FILTER (WHERE breakout_score ~ '^[0-9.]+$' AND breakout_score::numeric>=72)::text FROM s
UNION ALL SELECT 'breakout>=72 & vol>=65 & mom>=68', count(*) FILTER (WHERE breakout_score ~ '^[0-9.]+$' AND breakout_score::numeric>=72 AND relative_volume_score ~ '^[0-9.]+$' AND relative_volume_score::numeric>=65 AND momentum_score ~ '^[0-9.]+$' AND momentum_score::numeric>=68)::text FROM s
UNION ALL SELECT 'breakout_median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY breakout_score::numeric) FILTER (WHERE breakout_score ~ '^[0-9.]+$')::numeric,1)::text FROM s
UNION ALL SELECT 'relvol_median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY relative_volume_score::numeric) FILTER (WHERE relative_volume_score ~ '^[0-9.]+$')::numeric,1)::text FROM s
UNION ALL SELECT 'pre_expansion>=45', count(*) FILTER (WHERE pre_expansion_score ~ '^[0-9.]+$' AND pre_expansion_score::numeric>=45)::text FROM s
UNION ALL SELECT 'cand_where_full', count(*) FILTER (WHERE candidate_decision IN ('ENTER','WAIT_PULLBACK') AND COALESCE(candidate_entry_zone,'') NOT IN ('','-') AND COALESCE(candidate_stop_loss,'') NOT IN ('','-') AND COALESCE(candidate_target_zone,'') NOT IN ('','-'))::text FROM s
UNION ALL SELECT 'cand_enter_or_wait', count(*) FILTER (WHERE candidate_decision IN ('ENTER','WAIT_PULLBACK'))::text FROM s
ORDER BY 1;
""",
    "candidate_actionable_sample": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1)
SELECT symbol, final_decision AS live, payload->>'candidate_decision' AS cand,
       payload->>'candidate_setup_class' AS cls, (payload->'candidate_reason_codes')::text AS reasons,
       payload->>'candidate_entry_zone' AS entry, payload->>'candidate_stop_loss' AS stop, payload->>'candidate_target_zone' AS target,
       payload->>'candidate_risk_reward' AS rr, payload->>'final_score' AS score, payload->>'confidence_score' AS conf,
       payload->>'entry_status' AS entry_status, payload->>'pre_expansion_score' AS pre, left(payload->>'candidate_why', 110) AS why
FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id
WHERE payload->>'candidate_decision' IN ('ENTER','WAIT_PULLBACK')
ORDER BY (CASE WHEN payload->>'candidate_decision'='ENTER' THEN 0 ELSE 1 END), (payload->>'final_score')::numeric DESC NULLS LAST LIMIT 25;
""",
    "volume_by_hour": r"""
WITH s AS (
  SELECT sr.created_at, x.*
  FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(breakout_score text, relative_volume_score text, momentum_score text, setup_type text, vetoes jsonb, asset_type text)
  WHERE sr.created_at > now() - interval '7 days' AND NOT COALESCE(x.vetoes ? 'STALE_DATA', false) AND COALESCE(x.asset_type,'')='EQUITY'
)
SELECT extract(hour FROM created_at AT TIME ZONE 'UTC')::int AS utc_hour, count(*) AS rows,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY relative_volume_score::numeric) FILTER (WHERE relative_volume_score ~ '^[0-9.]+$')::numeric,1) AS relvol_med,
       round(100.0*count(*) FILTER (WHERE relative_volume_score ~ '^[0-9.]+$' AND relative_volume_score::numeric>=65)/count(*),1) AS relvol65_pct,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY breakout_score::numeric) FILTER (WHERE breakout_score ~ '^[0-9.]+$')::numeric,1) AS brk_med,
       round(100.0*count(*) FILTER (WHERE breakout_score ~ '^[0-9.]+$' AND breakout_score::numeric>=72)/count(*),1) AS brk72_pct,
       count(*) FILTER (WHERE breakout_score ~ '^[0-9.]+$' AND breakout_score::numeric>=72 AND relative_volume_score ~ '^[0-9.]+$' AND relative_volume_score::numeric>=65 AND momentum_score ~ '^[0-9.]+$' AND momentum_score::numeric>=68) AS brk_vol_mom,
       count(*) FILTER (WHERE setup_type='BREAKOUT') AS st_breakout
FROM s GROUP BY 1 ORDER BY 1;
""",
    "breakout_candidates_why": r"""
WITH s AS (
  SELECT ss.symbol, sr.created_at, ss.final_decision AS live, x.*
  FROM scanner_signals ss JOIN scan_runs sr ON sr.id=ss.scan_run_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(breakout_score text, relative_volume_score text, momentum_score text, setup_type text, setup_reason_codes jsonb, vetoes jsonb, entry_status text, current_rsi text, setup_detail text, final_score text, candidate_decision text, recommendation_quality text)
  WHERE sr.created_at > now() - interval '7 days' AND NOT COALESCE(x.vetoes ? 'STALE_DATA', false)
    AND x.breakout_score ~ '^[0-9.]+$' AND x.breakout_score::numeric>=72 AND x.relative_volume_score ~ '^[0-9.]+$' AND x.relative_volume_score::numeric>=65 AND x.momentum_score ~ '^[0-9.]+$' AND x.momentum_score::numeric>=68
)
SELECT 'rows' AS k, count(*)::text AS v FROM s
UNION ALL SELECT 'distinct_symbols', count(DISTINCT symbol)::text FROM s
UNION ALL SELECT 'setup='||COALESCE(setup_type,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'reason='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(setup_reason_codes)='array' THEN setup_reason_codes ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'veto='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(vetoes)='array' THEN vetoes ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'entry_status='||COALESCE(entry_status,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'rsi>=74', count(*) FILTER (WHERE current_rsi ~ '^[0-9.]+$' AND current_rsi::numeric>=74)::text FROM s
UNION ALL SELECT 'live='||COALESCE(live,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'candidate='||COALESCE(candidate_decision,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'quality='||COALESCE(recommendation_quality,'NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'symbols', string_agg(DISTINCT symbol, ',') FROM s
ORDER BY 1;
""",
    "replay_cohorts": r"""
WITH j AS (
  SELECT fr.horizon, fr.return_pct::numeric AS r, fr.signal_date, ss.final_decision AS live, x.*
  FROM forward_returns fr JOIN scanner_signals ss ON ss.id=fr.scanner_signal_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(setup_type text, composite_action text, entry_status text, risk_reward text, balanced_risk_reward_low text, confidence_score text, final_score text, vetoes jsonb, breakout_score text, relative_volume_score text, momentum_score text, pre_expansion_score text, candidate_decision text)
  WHERE fr.return_pct IS NOT NULL AND fr.horizon IN ('5D','10D','20D')
),
g AS (
  SELECT *,
    CASE WHEN final_score ~ '^[0-9.]+$' THEN final_score::numeric END AS fs,
    CASE WHEN confidence_score ~ '^[0-9.]+$' THEN confidence_score::numeric END AS cs,
    CASE WHEN risk_reward ~ '^-?[0-9.]+$' THEN risk_reward::numeric END AS rr,
    CASE WHEN balanced_risk_reward_low ~ '^-?[0-9.]+$' THEN balanced_risk_reward_low::numeric END AS brr,
    CASE WHEN pre_expansion_score ~ '^[0-9.]+$' THEN pre_expansion_score::numeric END AS pre,
    COALESCE(vetoes ? 'STALE_DATA',false) AS stale,
    (COALESCE(vetoes ? 'STOP_RISK',false) OR COALESCE(vetoes ? 'EXTREME_VOLATILITY',false) OR COALESCE(vetoes ? 'PROVIDER_ERROR',false)) AS hard_severe,
    (composite_action NOT IN ('SELL','STRONG SELL')) AS not_sell,
    (entry_status IN ('GOOD ENTRY','BUY ZONE','NEAR ENTRY')) AS enterable,
    (setup_type <> 'AVOID') AS setup_ok,
    (breakout_score ~ '^[0-9.]+$' AND breakout_score::numeric>=72 AND relative_volume_score ~ '^[0-9.]+$' AND relative_volume_score::numeric>=65 AND momentum_score ~ '^[0-9.]+$' AND momentum_score::numeric>=68) AS brk_numeric
  FROM j
),
c AS (
  SELECT 'A baseline (all matured)' AS cohort, * FROM g
  UNION ALL SELECT 'B fresh only (no STALE_DATA)', * FROM g WHERE NOT stale
  UNION ALL SELECT 'C live ENTER', * FROM g WHERE live='ENTER'
  UNION ALL SELECT 'D live EXIT (score-to-action SELL)', * FROM g WHERE live='EXIT' AND NOT stale
  UNION ALL SELECT 'E live AVOID', * FROM g WHERE live='AVOID' AND NOT stale
  UNION ALL SELECT 'F band core: setup ok, not sell, enterable, rr>=1.2, no hard severe, conf>=70, 55<=score<=70', * FROM g WHERE NOT stale AND setup_ok AND not_sell AND enterable AND rr>=1.2 AND NOT hard_severe AND cs>=70 AND fs BETWEEN 55 AND 70
  UNION ALL SELECT 'G band core but score>=80', * FROM g WHERE NOT stale AND setup_ok AND not_sell AND enterable AND rr>=1.2 AND NOT hard_severe AND cs>=70 AND fs>=80
  UNION ALL SELECT 'H band core minus setup gate (setup AVOID allowed)', * FROM g WHERE NOT stale AND not_sell AND enterable AND rr>=1.2 AND NOT hard_severe AND cs>=70 AND fs BETWEEN 55 AND 70
  UNION ALL SELECT 'I band core with balanced rr>=1.5 instead of nearest-resistance rr', * FROM g WHERE NOT stale AND setup_ok AND not_sell AND enterable AND brr>=1.5 AND NOT hard_severe AND cs>=70 AND fs BETWEEN 55 AND 70
  UNION ALL SELECT 'J band core + pre_expansion>=45 (only rows with the field)', * FROM g WHERE NOT stale AND setup_ok AND not_sell AND enterable AND rr>=1.2 AND NOT hard_severe AND cs>=70 AND fs BETWEEN 55 AND 70 AND pre>=45
  UNION ALL SELECT 'K breakout numeric triple (brk>=72,vol>=65,mom>=68), fresh', * FROM g WHERE NOT stale AND brk_numeric
  UNION ALL SELECT 'L rr<1.0 (POOR_RISK_REWARD) but enterable, not sell, 55<=score<=70', * FROM g WHERE NOT stale AND rr<1.0 AND enterable AND not_sell AND fs BETWEEN 55 AND 70
  UNION ALL SELECT 'M stale-flagged rows only', * FROM g WHERE stale
)
SELECT cohort, horizon, count(*) AS n, count(DISTINCT signal_date) AS days,
       round(avg(r)*100,2) AS mean_pct, round((percentile_cont(0.5) WITHIN GROUP (ORDER BY r))::numeric*100,2) AS med_pct,
       round(100.0*count(*) FILTER (WHERE r>0)/count(*),1) AS win_pct,
       round((percentile_cont(0.1) WITHIN GROUP (ORDER BY r))::numeric*100,2) AS p10_pct,
       min(signal_date) AS from_date, max(signal_date) AS to_date
FROM c GROUP BY cohort, horizon ORDER BY cohort, horizon;
""",
    "candidate_v2_sample": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1)
SELECT symbol, final_decision AS live, payload->>'candidate_decision' AS v1, payload->>'candidate_v2_decision' AS v2,
       payload->>'candidate_v2_setup_class' AS cls, (payload->'candidate_v2_reason_codes')::text AS reasons,
       payload->>'candidate_v2_risk_reward' AS rr2, payload->>'risk_reward' AS rr1, payload->>'final_score' AS score,
       payload->>'confidence_score' AS conf, payload->>'entry_status' AS entry, payload->>'pre_expansion_score' AS pre,
       payload->>'buy_zone' AS zone, payload->>'stop_loss' AS stop, payload->>'take_profit_zone' AS target
FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id
WHERE payload->>'candidate_v2_decision' IN ('ENTER','WAIT_PULLBACK') OR lower(payload->>'candidate_v2_band_ok')='true'
ORDER BY (CASE payload->>'candidate_v2_decision' WHEN 'ENTER' THEN 0 WHEN 'WAIT_PULLBACK' THEN 1 ELSE 2 END), (payload->>'final_score')::numeric DESC NULLS LAST LIMIT 30;
""",
    "candidate_v2_reasons": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1),
s AS (SELECT ss.final_decision AS live, ss.payload AS p FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id)
SELECT 'v2='||COALESCE(p->>'candidate_v2_decision','NULL') AS k, count(*)::text AS v FROM s GROUP BY 1
UNION ALL SELECT 'v2_class='||COALESCE(p->>'candidate_v2_setup_class','NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'v2_reason='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'candidate_v2_reason_codes')='array' THEN p->'candidate_v2_reason_codes' ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'v1_vs_v2='||COALESCE(p->>'candidate_decision','NULL')||'->'||COALESCE(p->>'candidate_v2_decision','NULL'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'live_vs_v2='||COALESCE(live,'NULL')||'->'||COALESCE(p->>'candidate_v2_decision','NULL'), count(*)::text FROM s GROUP BY 1
ORDER BY 1;
""",
    "analysis_freshness": r"""
SELECT 'forward_returns' AS tbl, date(created_at AT TIME ZONE 'UTC') AS day, count(*) AS rows, max(created_at) AS last_written
FROM forward_returns WHERE created_at > now() - interval '10 days' GROUP BY 2
UNION ALL
SELECT 'performance_summary', date(created_at AT TIME ZONE 'UTC'), count(*), max(created_at)
FROM performance_summary WHERE created_at > now() - interval '10 days' GROUP BY 2
UNION ALL
SELECT 'scan_runs(full>=450 symbols)', date(created_at AT TIME ZONE 'UTC'), count(*), max(created_at)
FROM scan_runs WHERE created_at > now() - interval '10 days' AND COALESCE(symbols_scored,0) >= 450 GROUP BY 2
ORDER BY 1, 2;
""",
    "run_compare": r"""
WITH runs AS (SELECT id, created_at, row_number() OVER (ORDER BY created_at DESC) AS rn FROM scan_runs ORDER BY created_at DESC LIMIT 4),
s AS (
  SELECT r.rn, ss.symbol, ss.final_decision AS live, x.*
  FROM scanner_signals ss JOIN runs r ON r.id=ss.scan_run_id
  CROSS JOIN LATERAL jsonb_to_record(ss.payload) AS x(composite_action text, recommendation_quality text, entry_status text, setup_type text, final_score text, confidence_score text, risk_penalty text, data_provider text, data_timestamp text, price text, market_regime text, vetoes jsonb, trend_score text, momentum_score text, relative_volume_score text, macro_score text, news_score text, technical_score text, short_score text, mid_score text, long_score text, history_days text, price_history_rows text, data_quality_score text)
)
SELECT 'rn'||rn||' action='||COALESCE(composite_action,'?') AS k, count(*)::text AS v FROM s GROUP BY 1
UNION ALL SELECT 'rn'||rn||' live='||COALESCE(live,'?'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'rn'||r.rn||' run_at', to_char(r.created_at AT TIME ZONE 'UTC','MM-DD HH24:MI') FROM runs r
UNION ALL SELECT 'rn'||rn||' med_hist_days_rows', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY history_days::numeric) FILTER (WHERE history_days ~ '^[0-9.]+$')::numeric,0)::text||'/'||round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_history_rows::numeric) FILTER (WHERE price_history_rows ~ '^[0-9.]+$')::numeric,0)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' rows_lt_220', count(*) FILTER (WHERE price_history_rows ~ '^[0-9.]+$' AND price_history_rows::numeric < 220)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' trend_zero', count(*) FILTER (WHERE trend_score ~ '^[0-9.]+$' AND trend_score::numeric = 0)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_dq', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY data_quality_score::numeric) FILTER (WHERE data_quality_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_short_mid_long', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY short_score::numeric) FILTER (WHERE short_score ~ '^[0-9.]+$')::numeric,1)::text||'/'||round(percentile_cont(0.5) WITHIN GROUP (ORDER BY mid_score::numeric) FILTER (WHERE mid_score ~ '^[0-9.]+$')::numeric,1)::text||'/'||round(percentile_cont(0.5) WITHIN GROUP (ORDER BY long_score::numeric) FILTER (WHERE long_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' regime='||COALESCE(market_regime,'?'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'rn'||rn||' provider='||COALESCE(data_provider,'?'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'rn'||rn||' data_ts='||COALESCE(left(data_timestamp,10),'?'), count(*)::text FROM s GROUP BY 1
UNION ALL SELECT 'rn'||rn||' med_final_score', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY final_score::numeric) FILTER (WHERE final_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_confidence', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY confidence_score::numeric) FILTER (WHERE confidence_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_risk_penalty', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY risk_penalty::numeric) FILTER (WHERE risk_penalty ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_macro', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY macro_score::numeric) FILTER (WHERE macro_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_news', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY news_score::numeric) FILTER (WHERE news_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_technical', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY technical_score::numeric) FILTER (WHERE technical_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_trend', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY trend_score::numeric) FILTER (WHERE trend_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' med_relvol', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY relative_volume_score::numeric) FILTER (WHERE relative_volume_score ~ '^[0-9.]+$')::numeric,1)::text FROM s GROUP BY rn
UNION ALL SELECT 'rn'||rn||' veto='||v, count(*)::text FROM s, jsonb_array_elements_text(CASE WHEN jsonb_typeof(vetoes)='array' THEN vetoes ELSE '[]'::jsonb END) v GROUP BY 1
UNION ALL SELECT 'rn'||rn||' entry='||COALESCE(entry_status,'?'), count(*)::text FROM s GROUP BY 1
ORDER BY 1;
""",
    "trend_flip_symbols": r"""
WITH runs AS (SELECT id, created_at, row_number() OVER (ORDER BY created_at DESC) AS rn FROM scan_runs ORDER BY created_at DESC LIMIT 3),
a AS (SELECT ss.symbol, ss.payload AS p FROM scanner_signals ss JOIN runs r ON r.id=ss.scan_run_id WHERE r.rn=1),
b AS (SELECT ss.symbol, ss.payload AS p FROM scanner_signals ss JOIN runs r ON r.id=ss.scan_run_id WHERE r.rn=3)
SELECT a.symbol, b.p->>'trend_score' AS trend_prev, a.p->>'trend_score' AS trend_now,
       b.p->>'price' AS price_prev, a.p->>'price' AS price_now,
       b.p->>'data_timestamp' AS ts_prev, a.p->>'data_timestamp' AS ts_now,
       b.p->>'price_history_rows' AS rows_prev, a.p->>'price_history_rows' AS rows_now,
       b.p->>'supertrend_line' AS st_prev, a.p->>'supertrend_line' AS st_now,
       b.p->>'avwap_ytd' AS avwap_prev, a.p->>'avwap_ytd' AS avwap_now,
       b.p->>'momentum_score' AS mom_prev, a.p->>'momentum_score' AS mom_now,
       b.p->>'current_rsi' AS rsi_prev, a.p->>'current_rsi' AS rsi_now,
       a.p->>'data_provider' AS provider
FROM a JOIN b USING (symbol)
WHERE (a.p->>'trend_score')::numeric < (b.p->>'trend_score')::numeric - 20
ORDER BY (b.p->>'trend_score')::numeric - (a.p->>'trend_score')::numeric DESC LIMIT 12;
""",
    "symbol_run_diff": r"""
WITH runs AS (SELECT id, created_at, row_number() OVER (ORDER BY created_at DESC) AS rn FROM scan_runs ORDER BY created_at DESC LIMIT 3),
a AS (SELECT ss.payload AS p FROM scanner_signals ss JOIN runs r ON r.id=ss.scan_run_id WHERE r.rn=1 AND ss.symbol='IOT'),
b AS (SELECT ss.payload AS p FROM scanner_signals ss JOIN runs r ON r.id=ss.scan_run_id WHERE r.rn=3 AND ss.symbol='IOT'),
keys AS (SELECT DISTINCT k FROM (SELECT jsonb_object_keys(p) AS k FROM a UNION SELECT jsonb_object_keys(p) FROM b) x)
SELECT k, left(COALESCE(b.p->>k,'<null>'),60) AS prev, left(COALESCE(a.p->>k,'<null>'),60) AS now
FROM keys, a, b
WHERE COALESCE(a.p->>k,'<null>') IS DISTINCT FROM COALESCE(b.p->>k,'<null>')
  AND k NOT LIKE 'candidate_%' AND k NOT LIKE 'funnel_%' AND k NOT LIKE 'shadow_%' AND k NOT LIKE '%reason%' AND k NOT LIKE '%narrative%' AND k NOT LIKE '%summary%' AND k NOT LIKE '%_note'
ORDER BY k LIMIT 120;
""",
    "nan_close_check": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1)
SELECT COALESCE(payload->>'rows_without_close','<absent>') AS rows_without_close, payload->>'data_provider' AS provider, count(*) AS n,
       count(*) FILTER (WHERE (payload->>'trend_score')::numeric = 0) AS trend_zero,
       count(*) FILTER (WHERE payload->>'avwap_ytd' IS NULL) AS avwap_null
FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id GROUP BY 1,2 ORDER BY 3 DESC;
""",
    "candidate_enter_sample": r"""
WITH lr AS (SELECT id FROM scan_runs ORDER BY created_at DESC LIMIT 1)
SELECT symbol, final_decision AS live,
       payload->>'funnel_blocking_gate' AS blocking_gate,
       payload->>'candidate_setup_class' AS cand_setup,
       payload->>'candidate_reason_codes' AS cand_reasons,
       payload->>'candidate_entry_zone' AS cand_entry,
       payload->>'candidate_stop_loss' AS cand_stop,
       payload->>'candidate_target_zone' AS cand_target,
       payload->>'candidate_risk_reward' AS cand_rr,
       payload->>'final_score' AS score,
       payload->>'setup_type' AS live_setup
FROM scanner_signals ss JOIN lr ON lr.id=ss.scan_run_id
WHERE payload->>'candidate_decision'='ENTER'
ORDER BY (payload->>'final_score')::numeric DESC NULLS LAST LIMIT 15;
""",
}


ACTIONS: dict[str, Callable[[Path, dict[str, Any]], list[CommandResult]]] = {
    "git_push": action_git_push,
    "git_status": action_git_status,
    "list_actions": action_list_actions,
    "prod_db_read": action_prod_db_read,
    "prod_fast_scan": action_prod_fast_scan,
    "prod_frontend_deploy": action_prod_frontend_deploy,
    "prod_full_scan": action_prod_full_scan,
    "prod_journal_recent": action_prod_journal_recent,
    "prod_logs_recent": action_prod_logs_recent,
    "prod_pull": action_prod_pull,
    "prod_resource_snapshot": action_prod_resource_snapshot,
    "prod_docker_inspect_container": action_prod_docker_inspect_container,
    "prod_watchdog_source": action_prod_watchdog_source,
    "prod_scanner_job_watch": action_prod_scanner_job_watch,
    "prod_scanner_build": action_prod_scanner_build,
    "prod_smoke": action_prod_smoke,
    "prod_ssh_probe": action_prod_ssh_probe,
    "prod_status": action_prod_status,
}


def load_request(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise RelayError(f"invalid json: {exc}") from exc
    if not isinstance(data, dict):
        raise RelayError("request must be an object")
    return data


def write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def handle_request(repo: Path, request_path: Path, result_dir: Path, archive_dir: Path) -> None:
    request_id = request_path.stem
    started = time.monotonic()
    claimed = request_path.with_suffix(".running")
    request_path.rename(claimed)
    payload: dict[str, Any]
    try:
        req = load_request(claimed)
        action = str(req.get("action") or "")
        args = req.get("args") or {}
        if not isinstance(args, dict):
            raise RelayError("args must be an object")
        if action not in ACTIONS:
            raise RelayError(f"action not allowed: {action}")
        results = ACTIONS[action](repo, args)
        exit_code = 0 if all(item.exit_code == 0 for item in results) else max(item.exit_code for item in results)
        payload = {
            "action": action,
            "duration_ms": int((time.monotonic() - started) * 1000),
            "exit_code": exit_code,
            "id": request_id,
            "ok": exit_code == 0,
            "results": [item.__dict__ for item in results],
            "started_at": req.get("created_at"),
        }
    except Exception as exc:  # noqa: BLE001
        payload = {
            "duration_ms": int((time.monotonic() - started) * 1000),
            "error": str(exc),
            "exit_code": 1,
            "id": request_id,
            "ok": False,
            "results": [],
        }
    finally:
        result_path = result_dir / f"{request_id}.json"
        write_json(result_path, payload)
        archive_path = archive_dir / claimed.name
        claimed.replace(archive_path)


def run_once(repo: Path) -> int:
    root = repo / ".agent-relay"
    request_dir = root / "requests"
    result_dir = root / "results"
    archive_dir = root / "archive"
    for directory in (request_dir, result_dir, archive_dir):
        directory.mkdir(parents=True, exist_ok=True)
    requests = sorted(request_dir.glob("*.json"))
    for request_path in requests:
        handle_request(repo, request_path, result_dir, archive_dir)
    return len(requests)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=str(DEFAULT_REPO))
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    repo = Path(args.repo).expanduser().resolve()
    if not (repo / ".git").exists():
        raise SystemExit(f"not a git repo: {repo}")
    if args.once:
        return 0 if run_once(repo) >= 0 else 1
    # Self-reload: the action/query tables are loaded at import time, so a
    # code change would otherwise be invisible until someone restarts the
    # launchd agent. When this file's mtime changes we drain the queue once
    # and exit 0; launchd (KeepAlive=true) relaunches us with the new code.
    self_path = Path(__file__).resolve()
    loaded_mtime = self_path.stat().st_mtime
    print(f"[relay] worker started (source mtime {loaded_mtime:.0f})", flush=True)
    while True:
        try:
            run_once(repo)
        except Exception as exc:  # noqa: BLE001
            print(f"[relay] worker error: {exc}", file=sys.stderr, flush=True)
        try:
            if self_path.stat().st_mtime != loaded_mtime:
                print("[relay] source changed; exiting for launchd relaunch", flush=True)
                return 0
        except OSError:
            pass
        time.sleep(max(0.5, args.poll_seconds))


if __name__ == "__main__":
    raise SystemExit(main())
