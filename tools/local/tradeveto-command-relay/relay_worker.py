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
    return [ssh_script(script, timeout=120)]


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
echo "== previous boot: warning+ (last 80) =="; sudo journalctl -b -1 -p warning -n 80 --no-pager 2>&1 | tail -80
echo "== previous boot: final 25 lines =="; sudo journalctl -b -1 -n 25 --no-pager 2>&1
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
    "prod_journal_recent": action_prod_journal_recent,
    "prod_logs_recent": action_prod_logs_recent,
    "prod_pull": action_prod_pull,
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
