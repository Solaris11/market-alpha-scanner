CREATE TABLE IF NOT EXISTS request_metric_rollups_minute (
  bucket_start TIMESTAMPTZ NOT NULL,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  status_bucket TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  p50_latency_ms INTEGER NOT NULL DEFAULT 0,
  p95_latency_ms INTEGER NOT NULL DEFAULT 0,
  p99_latency_ms INTEGER NOT NULL DEFAULT 0,
  max_latency_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_start, route, method, status_bucket)
);

CREATE INDEX IF NOT EXISTS ix_request_metric_rollups_minute_route_bucket
  ON request_metric_rollups_minute(route, bucket_start DESC, method);

CREATE INDEX IF NOT EXISTS ix_request_metric_rollups_minute_bucket
  ON request_metric_rollups_minute(bucket_start DESC);
