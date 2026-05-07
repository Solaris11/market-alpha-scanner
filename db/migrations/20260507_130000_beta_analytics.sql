CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id_hash text,
  session_id_hash text,
  event_name text NOT NULL,
  page_path text,
  symbol text,
  source text,
  device_type text,
  browser_family text,
  os_family text,
  country text,
  region text,
  city text,
  timezone text,
  plan text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_analytics_events_created_at
  ON analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_analytics_events_event_created_at
  ON analytics_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_analytics_events_user_created_at
  ON analytics_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_analytics_events_session_created_at
  ON analytics_events(session_id_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_analytics_events_page_created_at
  ON analytics_events(page_path, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_analytics_events_symbol_created_at
  ON analytics_events(symbol, created_at DESC)
  WHERE symbol IS NOT NULL;

CREATE TABLE IF NOT EXISTS beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  anonymous_id_hash text,
  session_id_hash text,
  feedback_type text NOT NULL,
  page_path text,
  symbol text,
  rating text,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_beta_feedback_created_at
  ON beta_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_beta_feedback_type_created_at
  ON beta_feedback(feedback_type, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_beta_feedback_user_created_at
  ON beta_feedback(user_id, created_at DESC);
