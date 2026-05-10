CREATE TABLE IF NOT EXISTS developer_api_usage_hourly (
  hour_start timestamptz NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_bucket text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  last_status integer,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hour_start, user_id, api_key_id, endpoint, method, status_bucket),
  CONSTRAINT developer_api_usage_hourly_status_bucket_check CHECK (status_bucket IN ('2xx', '3xx', '4xx', '5xx', 'unknown'))
);

CREATE INDEX IF NOT EXISTS ix_developer_api_usage_hourly_user_recent
  ON developer_api_usage_hourly(user_id, hour_start DESC);

CREATE INDEX IF NOT EXISTS ix_developer_api_usage_hourly_key_recent
  ON developer_api_usage_hourly(api_key_id, hour_start DESC);

ALTER TABLE developer_webhook_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_developer_webhook_deliveries_retry
  ON developer_webhook_deliveries(status, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;
