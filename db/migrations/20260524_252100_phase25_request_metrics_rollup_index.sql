CREATE INDEX IF NOT EXISTS idx_request_metrics_created_route_method_latency
  ON request_metrics(created_at DESC, route, method, latency_ms);
