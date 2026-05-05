#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="${MARKET_ALPHA_MIGRATIONS_DIR:-${ROOT_DIR}/db/migrations}"
POSTGRES_CONTAINER="${MARKET_ALPHA_POSTGRES_CONTAINER:-market-alpha-scanner-market-alpha-postgres-1}"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "Migration directory not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

psql_run() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql -v ON_ERROR_STOP=1 "${DATABASE_URL}" "$@"
    return
  fi

  if ! docker inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
    echo "Set DATABASE_URL or start ${POSTGRES_CONTAINER}." >&2
    exit 1
  fi

  docker exec -i "${POSTGRES_CONTAINER}" sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' sh "$@"
}

psql_scalar() {
  local sql="$1"
  printf '%s\n' "${sql}" | psql_run -At
}

sql_literal() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\'}"
}

ensure_ledger() {
  psql_scalar "
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id serial PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    SELECT 1;
  " >/dev/null
}

list_migrations() {
  find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' -print | sort
}

validate_migration_filename() {
  local filename="$1"
  if [[ ! "${filename}" =~ ^[0-9]{8}_[0-9]{6}_[a-z0-9_]+\.sql$ ]]; then
    echo "Invalid migration filename: ${filename}" >&2
    echo "Expected format: YYYYMMDD_HHMMSS_description.sql" >&2
    exit 1
  fi
}

record_existing_baseline() {
  local count=0
  while IFS= read -r migration; do
    local filename
    filename="$(basename "${migration}")"
    validate_migration_filename "${filename}"
    local literal
    literal="$(sql_literal "${filename}")"
    psql_scalar "INSERT INTO schema_migrations (filename) VALUES (${literal}) ON CONFLICT (filename) DO NOTHING RETURNING id;" >/dev/null
    count=$((count + 1))
  done < <(list_migrations)
  echo "Bootstrapped existing schema: recorded ${count} migration files without applying SQL."
}

apply_migration() {
  local migration="$1"
  local filename
  filename="$(basename "${migration}")"
  local literal
  literal="$(sql_literal "${filename}")"

  echo "Applying ${filename}"
  {
    printf 'BEGIN;\n'
    cat "${migration}"
    printf '\nINSERT INTO schema_migrations (filename) VALUES (%s);\n' "${literal}"
    printf 'COMMIT;\n'
  } | psql_run >/dev/null
}

main() {
  ensure_ledger

  local ledger_count user_table_count
  ledger_count="$(psql_scalar "SELECT count(*) FROM schema_migrations;")"
  user_table_count="$(psql_scalar "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations';")"

  if [[ "${ledger_count}" == "0" && "${user_table_count}" != "0" ]]; then
    record_existing_baseline
    echo "No SQL migrations applied because this database already has ${user_table_count} public tables."
    return
  fi

  local applied=0
  local skipped=0
  while IFS= read -r migration; do
    local filename
    filename="$(basename "${migration}")"
    validate_migration_filename "${filename}"
    local literal
    literal="$(sql_literal "${filename}")"
    local exists
    exists="$(psql_scalar "SELECT 1 FROM schema_migrations WHERE filename = ${literal};")"
    if [[ "${exists}" == "1" ]]; then
      skipped=$((skipped + 1))
      continue
    fi
    apply_migration "${migration}"
    applied=$((applied + 1))
  done < <(list_migrations)

  echo "Migration complete: applied=${applied} skipped=${skipped}"
}

main "$@"
