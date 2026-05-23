CREATE INDEX IF NOT EXISTS ix_request_metrics_route_created_method_latency
  ON request_metrics(route, created_at DESC, method, latency_ms);
