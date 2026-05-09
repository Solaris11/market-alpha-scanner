#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${TRADEVETO_APP_DIR:-/opt/apps/market-alpha-scanner/app}"
FRONTEND_DIR="${TRADEVETO_FRONTEND_DIR:-${APP_DIR}/frontend}"
ENV_FILE="${TRADEVETO_ENV_FILE:-${APP_DIR}/.env}"
DOCKER_NETWORK="${TRADEVETO_DOCKER_NETWORK:-market-alpha-scanner-private}"
NODE_IMAGE="${TRADEVETO_NODE_REFRESH_IMAGE:-node:22-bookworm-slim}"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "Frontend directory not found: ${FRONTEND_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Environment file not found: ${ENV_FILE}" >&2
  exit 1
fi

docker run --rm \
  --network "${DOCKER_NETWORK}" \
  --env-file "${ENV_FILE}" \
  -v "${FRONTEND_DIR}:/work" \
  -w /work \
  "${NODE_IMAGE}" \
  sh -lc 'export DATABASE_URL="${FRONTEND_DATABASE_URL:-postgresql://${POSTGRES_USER:-market_alpha}:${POSTGRES_PASSWORD:?missing}@market-alpha-postgres:5432/${POSTGRES_DB:-market_alpha}}"; npm run shock:refresh'
