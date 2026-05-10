CREATE TABLE IF NOT EXISTS llm_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  surface text NOT NULL,
  route text NOT NULL DEFAULT 'background',
  model text NOT NULL,
  status text NOT NULL,
  cache_status text NOT NULL,
  prompt_hash text,
  estimated_input_tokens integer NOT NULL DEFAULT 0,
  estimated_output_tokens integer NOT NULL DEFAULT 0,
  usage_input_tokens integer,
  usage_output_tokens integer,
  estimated_cost_usd numeric(14, 6) NOT NULL DEFAULT 0,
  duration_ms integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT llm_usage_events_status_check CHECK (status IN ('blocked', 'cache_hit', 'failed', 'success', 'validation_failed')),
  CONSTRAINT llm_usage_events_cache_status_check CHECK (cache_status IN ('bypass', 'hit', 'miss', 'write_failed'))
);

CREATE INDEX IF NOT EXISTS ix_llm_usage_events_created_at
  ON llm_usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_llm_usage_events_user_created_at
  ON llm_usage_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_llm_usage_events_surface_created_at
  ON llm_usage_events(surface, created_at DESC);

CREATE TABLE IF NOT EXISTS llm_usage_daily (
  day date NOT NULL,
  scope text NOT NULL,
  subject text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  cache_hit_count integer NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  estimated_input_tokens integer NOT NULL DEFAULT 0,
  estimated_output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(14, 6) NOT NULL DEFAULT 0,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, scope, subject),
  CONSTRAINT llm_usage_daily_scope_check CHECK (scope IN ('global', 'route', 'surface', 'user'))
);

CREATE INDEX IF NOT EXISTS ix_llm_usage_daily_scope_day
  ON llm_usage_daily(scope, day DESC);

CREATE TABLE IF NOT EXISTS llm_response_cache (
  cache_key text PRIMARY KEY,
  surface text NOT NULL,
  model text NOT NULL,
  response_json jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_llm_response_cache_surface_expires
  ON llm_response_cache(surface, expires_at DESC);

CREATE INDEX IF NOT EXISTS ix_llm_response_cache_expires
  ON llm_response_cache(expires_at);
