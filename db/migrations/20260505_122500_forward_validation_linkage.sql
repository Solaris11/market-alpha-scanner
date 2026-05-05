ALTER TABLE forward_returns
  ADD COLUMN IF NOT EXISTS scanner_signal_id uuid NULL REFERENCES scanner_signals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forward_returns_scanner_signal_id
  ON forward_returns(scanner_signal_id);

CREATE INDEX IF NOT EXISTS idx_forward_returns_horizon_signal_date
  ON forward_returns(horizon, signal_date DESC);

WITH matched AS (
  SELECT DISTINCT ON (fr.id)
    fr.id AS forward_return_id,
    ss.id AS scanner_signal_id,
    ss.scan_run_id AS scan_run_id
  FROM forward_returns fr
  JOIN scanner_signals ss
    ON ss.symbol = fr.symbol
  JOIN scan_runs sr
    ON sr.id = ss.scan_run_id
  WHERE fr.scanner_signal_id IS NULL
    AND fr.signal_date IS NOT NULL
    AND COALESCE(sr.completed_at, sr.created_at)::date = fr.signal_date
  ORDER BY fr.id, COALESCE(sr.completed_at, sr.created_at) DESC
)
UPDATE forward_returns fr
SET scanner_signal_id = matched.scanner_signal_id,
    scan_run_id = matched.scan_run_id
FROM matched
WHERE fr.id = matched.forward_return_id;
