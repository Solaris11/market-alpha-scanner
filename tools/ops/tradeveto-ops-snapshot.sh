#!/usr/bin/env bash
# TradeVeto ops snapshot
#
# Writes ONE json + ONE html file describing the real current state of
# production, so the operator (and anyone helping) can read the numbers without
# an SSH session, an admin login, or a running browser.
#
# Design notes:
#   - It does NOT reimplement retention/revenue/provider logic. Those already
#     have canonical probes under frontend/scripts; this runs them and merges
#     their JSON. One source of truth, not two.
#   - Every section is failure-tolerant: a broken section records an error and
#     the rest still produces output. A snapshot that dies on one bad query is
#     a snapshot nobody runs.
#   - No secrets are read or printed. Values come from git, docker, curl and
#     psql-over-docker only.
#
# Usage:
#   tools/ops/tradeveto-ops-snapshot.sh                     # fast infra snapshot (~20s)
#   tools/ops/tradeveto-ops-snapshot.sh --with-probes       # + phase34 probes (slow, minutes)
#   tools/ops/tradeveto-ops-snapshot.sh --out-dir /some/dir

set -uo pipefail

APP_DIR="${TRADEVETO_APP_DIR:-/opt/apps/market-alpha-scanner/app}"
BASE_URL="${TRADEVETO_OPS_BASE_URL:-https://tradeveto.com}"
OUT_DIR="${TRADEVETO_SNAPSHOT_OUT_DIR:-$APP_DIR}"
WITH_PROBES=0
PG_SERVICE="${TRADEVETO_PG_SERVICE:-market-alpha-postgres}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-probes) WITH_PROBES=1; shift ;;
    --out-dir) OUT_DIR="${2:-}"; shift 2 ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

cd "$APP_DIR" || { echo "FATAL: app dir not found: $APP_DIR" >&2; exit 1; }
mkdir -p "$OUT_DIR"

JSON_OUT="$OUT_DIR/ops-snapshot.json"
HTML_OUT="$OUT_DIR/ops-snapshot.html"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

say() { printf '[snapshot] %s\n' "$*" >&2; }

# Capture a command's stdout to a file, never failing the script.
grab() {
  local name="$1"; shift
  if "$@" >"$WORK/$name" 2>"$WORK/$name.err"; then
    return 0
  fi
  say "section '$name' failed (continuing)"
  return 0
}

say "collecting deploy state"
grab deploy_commit  git rev-parse --short HEAD
grab deploy_subject git log -1 --format=%s
grab deploy_date    git log -1 --format=%cI
grab deploy_dirty   git status --porcelain
grab containers     docker compose ps --format json

say "collecting health"
curl -fsS --max-time 15 "$BASE_URL/api/health"      -o "$WORK/health" 2>/dev/null || say "app health unreachable"
curl -fsS --max-time 25 "$BASE_URL/api/health/deep" -o "$WORK/health_deep" 2>/dev/null || say "deep health non-200 (recorded)"
curl -sS  --max-time 25 -o /dev/null -w '%{http_code}' "$BASE_URL/api/health/deep" >"$WORK/health_deep_code" 2>/dev/null

say "timing routes"
: >"$WORK/routes"
for r in / /pricing /terminal /discover /opportunities /symbol/AMD /market-memory /strategy-labs /performance /feed; do
  code_time="$(curl -o /dev/null -sS --max-time 30 -w '%{http_code} %{time_total}' "$BASE_URL$r" 2>/dev/null || echo "000 0")"
  printf '%s %s\n' "$r" "$code_time" >>"$WORK/routes"
done

say "querying scanner + user state"
# Credentials come from the container's own POSTGRES_USER/POSTGRES_DB, the same
# way the other ops scripts do it. Hardcoding a user here silently breaks the
# DB section on any deployment that does not use that exact role.
psql_q() {
  local sql="$1"
  docker compose exec -T "$PG_SERVICE" \
    sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "|" -c "$1"' -- "$sql" 2>/dev/null
}
# scan_runs.id is a UUID, so the latest run is found by started_at, not max(id).
# Each group is a separate query: one failing table must not lose the others.
LATEST_RUN="(SELECT id FROM scan_runs ORDER BY started_at DESC LIMIT 1)"

psql_q "
  SELECT
    (SELECT count(*) FROM scanner_signals WHERE scan_run_id = $LATEST_RUN),
    (SELECT count(DISTINCT symbol) FROM scanner_signals WHERE scan_run_id = $LATEST_RUN),
    (SELECT round(extract(epoch FROM (now() - max(started_at)))/60) FROM scan_runs)
" >"$WORK/db_scanner" 2>/dev/null || say "scanner query failed"

psql_q "SELECT count(*) FROM users" >"$WORK/db_users" 2>/dev/null || say "users query failed"
psql_q "SELECT count(*) FROM user_subscriptions WHERE status IN ('active','trialing')" \
  >"$WORK/db_paid" 2>/dev/null || say "subscriptions query failed"

# The decision mix is the single most diagnostic scanner number: a run that is
# entirely AVOID/EXIT means users are shown nothing actionable, whatever the
# ranking looks like.
psql_q "
  SELECT coalesce(final_decision,'(null)') || '=' || count(*)
  FROM scanner_signals WHERE scan_run_id = $LATEST_RUN
  GROUP BY final_decision ORDER BY count(*) DESC
" >"$WORK/db_decisions" 2>/dev/null || say "decision mix query failed"

say "collecting backup state"
grab backup_pg      bash -c "ls -t /opt/backups/market-alpha/postgres/*.sql.gz 2>/dev/null | head -1"
grab backup_scanner bash -c "ls -t /opt/backups/market-alpha/scanner/*.tar.gz  2>/dev/null | head -1"
grab r2_pg          bash -c "rclone lsf r2:market-alpha-backups/postgres/ 2>/dev/null | sort | tail -1"
grab r2_scanner     bash -c "rclone lsf r2:market-alpha-backups/scanner/  2>/dev/null | sort | tail -1"

say "collecting resources"
grab docker_stats bash -c "docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null"
grab disk         bash -c "df -h / | tail -1"

if (( WITH_PROBES )); then
  say "running phase34 probes (this takes minutes)"
  npm --prefix frontend run probe:phase34:retention-crisis:docker   >"$WORK/probe_retention.log" 2>&1 || say "retention probe failed"
  npm --prefix frontend run probe:phase34:revenue-validation:docker >"$WORK/probe_revenue.log"   2>&1 || say "revenue probe failed"
  npm --prefix frontend run probe:phase34:provider-freshness:docker >"$WORK/probe_provider.log"  2>&1 || say "provider probe failed"
fi

say "building $JSON_OUT and $HTML_OUT"
WORK="$WORK" APP_DIR="$APP_DIR" BASE_URL="$BASE_URL" \
JSON_OUT="$JSON_OUT" HTML_OUT="$HTML_OUT" WITH_PROBES="$WITH_PROBES" \
python3 "$APP_DIR/tools/ops/tradeveto_ops_snapshot_render.py"

say "done"
say "  $JSON_OUT"
say "  $HTML_OUT"
