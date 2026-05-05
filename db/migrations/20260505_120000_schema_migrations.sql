CREATE TABLE IF NOT EXISTS schema_migrations (
  id serial PRIMARY KEY,
  filename text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now()
);
