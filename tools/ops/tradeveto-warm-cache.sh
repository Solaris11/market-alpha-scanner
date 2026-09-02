#!/usr/bin/env bash
# Keep the server-side route caches warm.
#
# Why this exists: the heavy routes cache their rendered surface in process
# (market-memory holds a 2 min TTL plus a 15 min stale window; discovery keeps
# body and response caches). Those windows assume steady traffic. This site has
# a handful of real users, so it sits idle far longer than the window and almost
# every genuine visit lands on a cold render - measured 2026-09-02 at 1661 ms for
# /market-memory and 1412 ms for /discover cold, against ~210 ms warm.
#
# Warming does not change any freshness rule. It only moves the cost of the first
# render off a person and onto a timer.
#
# Run it more often than the shortest stale window (17 min for market-memory);
# every 10 minutes is a safe default, and running it right after a scan is even
# better because that is when the data actually changes.
#
#   */10 * * * * root /opt/apps/market-alpha-scanner/app/tools/ops/tradeveto-warm-cache.sh >> /var/log/market-alpha/warm-cache.log 2>&1

set -uo pipefail

BASE_URL="${TRADEVETO_OPS_BASE_URL:-https://tradeveto.com}"
TIMEOUT="${TRADEVETO_WARM_TIMEOUT_SECONDS:-30}"
ROUTES=("/" "/market-memory" "/discover" "/opportunities" "/terminal" "/symbol/AMD" "/performance" "/feed")

stamp() { date -u +%FT%TZ; }

slow=0
line=""
for route in "${ROUTES[@]}"; do
  # -o /dev/null: the body is irrelevant, only the render cost matters.
  # curl prints a timing even when the request fails, so the exit code decides -
  # appending to the captured value would produce "0.016error" and never match.
  if ! total="$(curl -fo /dev/null -sS --max-time "$TIMEOUT" \
                  -w '%{time_total}' "$BASE_URL$route" 2>/dev/null)"; then
    total="error"
  fi
  if [[ "$total" == "error" ]]; then
    line+="$route=error "
  else
    line+="$route=${total}s "
  fi
  case "$total" in
    error) slow=$((slow + 1)) ;;
    *) awk -v t="$total" 'BEGIN { exit !(t > 1.5) }' && slow=$((slow + 1)) ;;
  esac
done

printf '[%s] warm %s\n' "$(stamp)" "$line"

# A warm run that is still slow means warming is not the whole story - say so
# rather than logging a reassuring line nobody reads.
if (( slow > 0 )); then
  printf '[%s] WARNING: %d route(s) still above 1.5s or failed after warming\n' "$(stamp)" "$slow"
fi
exit 0
