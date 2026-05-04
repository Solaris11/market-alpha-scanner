#!/usr/bin/env bash
set -euo pipefail

LOG_PREFIX="[$(date -Is)] market-alpha-stripe-reconcile"
APP_DIR="/opt/apps/market-alpha-scanner/app"
FRONTEND_DIR="$APP_DIR/frontend"
ENV_FILE="$APP_DIR/.env"
NETWORK="market-alpha-scanner-private"
IMAGE="node:22-bookworm-slim"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$LOG_PREFIX ERROR env file missing" >&2
  exit 1
fi

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "$LOG_PREFIX ERROR docker network missing: $NETWORK" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "$LOG_PREFIX ERROR frontend dir missing" >&2
  exit 1
fi

echo "$LOG_PREFIX start args=$*"
cd "$FRONTEND_DIR"
docker run --rm \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  -e NPM_CONFIG_UPDATE_NOTIFIER=false \
  -v "$FRONTEND_DIR":/app \
  -w /app \
  "$IMAGE" \
  npm run stripe:reconcile -- "$@"
echo "$LOG_PREFIX done"
