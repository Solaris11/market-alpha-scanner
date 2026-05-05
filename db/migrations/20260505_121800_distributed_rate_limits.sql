CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key_hash text PRIMARY KEY,
  scope text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_rate_limit_buckets_scope
  ON rate_limit_buckets(scope);

CREATE INDEX IF NOT EXISTS ix_rate_limit_buckets_expires_at
  ON rate_limit_buckets(expires_at);
