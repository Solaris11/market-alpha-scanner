#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE="${1:?remote is required, for example r2:market-alpha-backups}"
shift

if [[ "$#" -lt 2 || $(( $# % 2 )) -ne 0 ]]; then
  printf "usage: %s REMOTE LOCAL_FILE REMOTE_PREFIX [LOCAL_FILE REMOTE_PREFIX...]\n" "$0" >&2
  exit 2
fi

CHUNK_MB="${TRADEVETO_R2_CHUNK_MB:-32}"
TRANSFERS="${TRADEVETO_R2_CHUNK_TRANSFERS:-24}"
WORK_ROOT="${TRADEVETO_R2_CHUNK_WORK_ROOT:-/tmp/tradeveto-r2-chunked-sync}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
RUN_DIR="$WORK_ROOT/$RUN_ID"

cleanup() {
  rm -rf "$RUN_DIR"
}
trap cleanup EXIT

mkdir -p "$RUN_DIR"

log() {
  printf "[%s] %s\n" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

json_manifest() {
  local local_file="$1"
  local remote_prefix="$2"
  local chunk_dir="$3"
  local manifest_path="$4"
  python3 - "$local_file" "$remote_prefix" "$chunk_dir" "$CHUNK_MB" > "$manifest_path" <<'PY'
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

local_file = Path(sys.argv[1])
remote_prefix = sys.argv[2].strip("/")
chunk_dir = Path(sys.argv[3])
chunk_mb = int(sys.argv[4])

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

chunks = []
for chunk in sorted(chunk_dir.iterdir()):
    if not chunk.is_file():
        continue
    chunks.append({
        "name": chunk.name,
        "size_bytes": chunk.stat().st_size,
        "sha256": sha256_file(chunk),
    })

payload = {
    "format": "tradeveto-r2-chunked-backup-v1",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "source_basename": local_file.name,
    "source_size_bytes": local_file.stat().st_size,
    "source_sha256": sha256_file(local_file),
    "chunk_size_mb": chunk_mb,
    "remote_prefix": remote_prefix,
    "chunk_count": len(chunks),
    "chunks": chunks,
    "restore": "Download every chunk listed here in order, concatenate them byte-for-byte, then verify source_sha256.",
}
print(json.dumps(payload, sort_keys=True, indent=2))
PY
}

upload_one() {
  local local_file="$1"
  local remote_prefix="$2"
  local base
  local chunk_dir
  local manifest_path
  local remote_dir

  if [[ ! -f "$local_file" ]]; then
    log "ERROR: local file does not exist: $local_file"
    return 1
  fi

  base="$(basename "$local_file")"
  chunk_dir="$RUN_DIR/${base}.chunks"
  manifest_path="$RUN_DIR/${base}.manifest.json"
  remote_dir="${REMOTE%/}/${remote_prefix%/}/${base}.chunks"

  mkdir -p "$chunk_dir"
  log "Splitting $base into ${CHUNK_MB}MiB chunks"
  split -b "${CHUNK_MB}M" -d -a 5 "$local_file" "$chunk_dir/part-"
  json_manifest "$local_file" "$remote_prefix/${base}.chunks" "$chunk_dir" "$manifest_path"

  log "Uploading chunks for $base to ${remote_prefix%/}/${base}.chunks"
  rclone copy "$chunk_dir" "$remote_dir" \
    --s3-upload-cutoff "$(( CHUNK_MB * 2 ))M" \
    --transfers "$TRANSFERS" \
    --checkers "$TRANSFERS" \
    --stats-one-line \
    --stats 30s

  log "Uploading manifest for $base"
  rclone copyto "$manifest_path" "${remote_dir%/}/manifest.json" \
    --s3-upload-cutoff "$(( CHUNK_MB * 2 ))M" \
    --stats-one-line \
    --stats 30s

  log "Verifying remote chunk count for $base"
  local expected_count
  local remote_count
  expected_count="$(find "$chunk_dir" -type f | wc -l | tr -d " ")"
  remote_count="$(rclone lsf "${remote_dir%/}/" | grep -c '^part-' || true)"
  if [[ "$remote_count" != "$expected_count" ]]; then
    log "ERROR: remote chunk count mismatch for $base: expected=$expected_count remote=$remote_count"
    return 1
  fi
  rclone lsf "${remote_dir%/}/manifest.json" >/dev/null
  log "Chunked upload complete for $base chunks=$expected_count"
}

while [[ "$#" -gt 0 ]]; do
  upload_one "$1" "$2"
  shift 2
done

log "All chunked uploads complete"
