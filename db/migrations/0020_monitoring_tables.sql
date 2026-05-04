CREATE TABLE IF NOT EXISTS monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_monitoring_events_created_at
  ON monitoring_events(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_monitoring_events_type_severity
  ON monitoring_events(event_type, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS request_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer NOT NULL,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_request_metrics_route_created_at
  ON request_metrics(route, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_request_metrics_status_created_at
  ON request_metrics(status_code, created_at DESC);

CREATE TABLE IF NOT EXISTS synthetic_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  status text NOT NULL,
  latency_ms integer NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_synthetic_check_results_name_created_at
  ON synthetic_check_results(check_name, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_synthetic_check_results_status_created_at
  ON synthetic_check_results(status, created_at DESC);

CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpu_percent numeric NULL,
  memory_percent numeric NULL,
  disk_percent numeric NULL,
  disk_free_bytes bigint NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_system_metrics_created_at
  ON system_metrics(created_at DESC);
