#!/usr/bin/env bash
# Detect a scanner-job container image that is older than the code it is
# supposed to be running.
#
# WHY THIS LIVES OUTSIDE THE IMAGE
# --------------------------------
# On 2026-08-06 SNDK was added to the scanner universe. It did not appear in a
# single production scan for the 35 days that followed, because the scheduled
# scanner runs `docker compose run market-alpha-scanner-job`, which resolves
# whatever :latest already exists on the host and never builds -- and the
# Dockerfile bakes the universe data in with `COPY . /app`. The image was 57
# days older than the data it carried.
#
# A guard for that failure was written and wired into every scan on 2026-09-03
# (`warn_missing_required_symbols`). It never ran, because it shipped *inside*
# the same image that was not being rebuilt. That is the whole lesson:
#
#     a guard that ships inside the artifact it validates
#     cannot detect a stale artifact.
#
# So this check runs on the host, against the image, from the checkout. It
# never imports scanner code and never enters the container to decide anything.
#
# It reads nothing sensitive: docker image metadata, git log, and (when
# present) a build stamp file. It never touches .env or prints environment.
#
# Usage:
#   scanner-image-freshness.sh                      # report, always exit 0
#   scanner-image-freshness.sh --warn-days 7        # WARN line above 7 days
#   scanner-image-freshness.sh --fail-days 30       # exit 1 above 30 days
#   scanner-image-freshness.sh --json               # machine-readable
#
# Test hooks (so the comparison can be exercised without docker):
#   --image-created <iso8601>   pretend the image was built then
#   --image-commit  <sha>       pretend the image was built from that commit
set -uo pipefail

IMAGE="${SCANNER_IMAGE:-market-alpha-scanner-market-alpha-scanner-job:latest}"
REPO_DIR="${SCANNER_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Paths whose contents end up inside the image and change what a scan does.
# The universe CSV is first because it is the one that caused the incident.
WATCHED_PATHS=(
  "scanner/data/opportunity_universe_1000.csv"
  "scanner/"
  "investment_scanner_mvp.py"
  "database.py"
  "requirements.txt"
  "Dockerfile"
)

warn_days=""
fail_days=""
as_json=0
image_created_override=""
image_commit_override=""

while [ $# -gt 0 ]; do
  case "$1" in
    --warn-days) warn_days="${2:-}"; shift 2 ;;
    --fail-days) fail_days="${2:-}"; shift 2 ;;
    --json) as_json=1; shift ;;
    --image-created) image_created_override="${2:-}"; shift 2 ;;
    --image-commit) image_commit_override="${2:-}"; shift 2 ;;
    -h|--help) sed -n '1,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "[freshness] unknown argument: $1" >&2; exit 2 ;;
  esac
done

epoch_of() { date -u -d "$1" +%s 2>/dev/null || echo ""; }

# --- what the image is -----------------------------------------------------
image_created="$image_created_override"
image_commit="$image_commit_override"

if [ -z "$image_created" ]; then
  image_created="$(docker inspect "$IMAGE" --format '{{.Created}}' 2>/dev/null || true)"
fi
if [ -z "$image_created" ]; then
  echo "[freshness] ERROR image not found: $IMAGE"
  exit 2
fi

# Built after the stamp was introduced? Then we can compare commit to commit
# instead of guessing from timestamps. Older images simply lack the file, which
# is itself a signal that the image predates this check.
if [ -z "$image_commit" ]; then
  image_commit="$(docker run --rm --no-deps --entrypoint cat "$IMAGE" /app/.build-stamp 2>/dev/null | sed -n 's/^commit=//p' || true)"
fi
[ -z "$image_commit" ] && image_commit="unknown"

# --- what the checkout is --------------------------------------------------
cd "$REPO_DIR" || { echo "[freshness] ERROR cannot enter $REPO_DIR"; exit 2; }
head_commit="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
head_date="$(git log -1 --format=%cI 2>/dev/null || echo "")"

# The newest commit touching anything that ends up in the image. This is the
# number that matters: an image older than THIS is running stale scan inputs,
# regardless of how old the image is in absolute terms.
newest_relevant_commit="$(git log -1 --format=%h -- "${WATCHED_PATHS[@]}" 2>/dev/null || echo unknown)"
newest_relevant_date="$(git log -1 --format=%cI -- "${WATCHED_PATHS[@]}" 2>/dev/null || echo "")"
newest_relevant_subject="$(git log -1 --format=%s -- "${WATCHED_PATHS[@]}" 2>/dev/null || echo "")"

img_epoch="$(epoch_of "$image_created")"
rel_epoch="$(epoch_of "$newest_relevant_date")"
now_epoch="$(date -u +%s)"

if [ -z "$img_epoch" ] || [ -z "$rel_epoch" ]; then
  echo "[freshness] ERROR could not parse timestamps (image=$image_created relevant=$newest_relevant_date)"
  exit 2
fi

stale_seconds=$(( rel_epoch - img_epoch ))
[ "$stale_seconds" -lt 0 ] && stale_seconds=0
stale_days=$(( stale_seconds / 86400 ))
image_age_days=$(( (now_epoch - img_epoch) / 86400 ))

# When the image carries a stamp, a commit mismatch is proof rather than
# inference -- timestamps can coincide, commit ids cannot.
commit_verdict="unverifiable (image predates build stamping)"
if [ "$image_commit" != "unknown" ]; then
  if [ "$image_commit" = "$head_commit" ]; then
    commit_verdict="match"
  else
    commit_verdict="MISMATCH image=$image_commit checkout=$head_commit"
  fi
fi

status="ok"
[ -n "$warn_days" ] && [ "$stale_days" -ge "$warn_days" ] && status="warn"
[ -n "$fail_days" ] && [ "$stale_days" -ge "$fail_days" ] && status="fail"
[ "$commit_verdict" != "match" ] && [ "$commit_verdict" != "unverifiable (image predates build stamping)" ] && [ "$status" = "ok" ] && status="warn"

if [ "$as_json" = "1" ]; then
  printf '{"status":"%s","image":"%s","image_created":"%s","image_age_days":%d,"image_commit":"%s","checkout_commit":"%s","checkout_date":"%s","newest_relevant_commit":"%s","newest_relevant_date":"%s","stale_days":%d,"commit_verdict":"%s"}\n' \
    "$status" "$IMAGE" "$image_created" "$image_age_days" "$image_commit" "$head_commit" "$head_date" \
    "$newest_relevant_commit" "$newest_relevant_date" "$stale_days" "$commit_verdict"
else
  echo "[freshness] image            $IMAGE"
  echo "[freshness] image built      $image_created  (${image_age_days}d ago)"
  echo "[freshness] image commit     $image_commit"
  echo "[freshness] checkout HEAD    $head_commit  $head_date"
  echo "[freshness] newest scan-relevant commit"
  echo "[freshness]                  $newest_relevant_commit  $newest_relevant_date"
  echo "[freshness]                  $newest_relevant_subject"
  echo "[freshness] commit verdict   $commit_verdict"
  if [ "$stale_days" -gt 0 ]; then
    echo "[freshness] STALE BY         ${stale_days} day(s) -- the image predates scan inputs it should carry"
  else
    echo "[freshness] image is not older than any scan-relevant commit"
  fi
  echo "[freshness] status           $status"
fi

case "$status" in
  fail)
    echo "[freshness] FAIL scanner-job image is ${stale_days}d behind scan-relevant code. Rebuild:" >&2
    echo "[freshness]   docker compose --profile scanner-job build market-alpha-scanner-job" >&2
    exit 1 ;;
  warn)
    # Say which of the two things is actually wrong. A commit mismatch at 0
    # days stale is a different fault from a genuinely old image, and reporting
    # it as "behind by 0d" is how a real signal gets dismissed as noise.
    if [ "$stale_days" -gt 0 ]; then
      echo "[freshness] WARNING scanner-job image is ${stale_days}d behind scan-relevant code. Rebuild recommended." >&2
    else
      echo "[freshness] WARNING scanner-job image was built from a different commit than the checkout ($commit_verdict). Rebuild recommended." >&2
    fi
    exit 0 ;;
  *) exit 0 ;;
esac
