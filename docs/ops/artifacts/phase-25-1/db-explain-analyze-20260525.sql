\timing on
EXPLAIN (ANALYZE, BUFFERS)
SELECT bucket_start, route, method, status_bucket, request_count, p95_latency_ms, p99_latency_ms
FROM request_metric_rollups_minute
WHERE bucket_start > now() - interval '2 hours'
  AND route IN ('/api/discovery', '/api/live-intelligence', '/api/v1/opportunities', '/api/v1/replay', '/api/paper/positions')
ORDER BY bucket_start DESC
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS)
SELECT ts, open, high, low, close, volume
FROM (
  SELECT ts, open, high, low, close, volume
  FROM symbol_price_history
  WHERE symbol = 'AMD'
  ORDER BY ts DESC
  LIMIT 390
) recent
ORDER BY ts ASC;

EXPLAIN (ANALYZE, BUFFERS)
WITH scoped_account AS (
  SELECT id
  FROM paper_accounts
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT p.id::text, p.symbol, p.status, p.opened_at::text, p.closed_at::text, p.entry_price, p.exit_price, p.quantity
FROM paper_positions p
WHERE p.account_id = (SELECT id FROM scoped_account)
ORDER BY CASE WHEN p.status = 'OPEN' THEN 0 ELSE 1 END, COALESCE(p.closed_at, p.opened_at) DESC
LIMIT 100;
