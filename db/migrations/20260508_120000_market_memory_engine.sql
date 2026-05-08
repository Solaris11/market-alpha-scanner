CREATE TABLE IF NOT EXISTS market_memory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_signal_id uuid NOT NULL REFERENCES scanner_signals(id) ON DELETE CASCADE,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  signal_ts timestamptz NOT NULL,
  setup_type text NULL,
  sector text NULL,
  market_regime text NULL,
  final_decision text NULL,
  final_score numeric NULL,
  confidence_score numeric NULL,
  readiness_score numeric NULL,
  score_bucket text NULL,
  regime_key text NULL,
  setup_signature text NOT NULL,
  signature jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_market_memory_scanner_signal UNIQUE (scanner_signal_id)
);

CREATE INDEX IF NOT EXISTS idx_market_memory_symbol_ts
  ON market_memory_snapshots(symbol, signal_ts DESC);

CREATE INDEX IF NOT EXISTS idx_market_memory_setup_regime_score
  ON market_memory_snapshots(setup_type, market_regime, score_bucket, signal_ts DESC);

CREATE INDEX IF NOT EXISTS idx_market_memory_sector_ts
  ON market_memory_snapshots(sector, signal_ts DESC);

CREATE INDEX IF NOT EXISTS idx_market_memory_scan_run_id
  ON market_memory_snapshots(scan_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_runs_history_source_file
  ON scan_runs ((metadata->>'source_file'))
  WHERE run_type = 'history_backfill'
    AND metadata ? 'source_file';
