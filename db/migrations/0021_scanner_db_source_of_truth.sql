CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  scan_runs_id_type text;
  symbol_snapshots_scan_run_id_type text;
BEGIN
  SELECT data_type
  INTO scan_runs_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'scan_runs'
    AND column_name = 'id';

  IF scan_runs_id_type IS NOT NULL AND scan_runs_id_type <> 'uuid' THEN
    IF to_regclass('public.scan_runs_legacy_int') IS NULL THEN
      ALTER TABLE scan_runs RENAME TO scan_runs_legacy_int;
    ELSE
      ALTER TABLE scan_runs RENAME TO scan_runs_legacy_int_duplicate;
    END IF;
  END IF;

  SELECT data_type
  INTO symbol_snapshots_scan_run_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'symbol_snapshots'
    AND column_name = 'scan_run_id';

  IF symbol_snapshots_scan_run_id_type IS NOT NULL AND symbol_snapshots_scan_run_id_type <> 'uuid' THEN
    IF to_regclass('public.symbol_snapshots_legacy_int') IS NULL THEN
      ALTER TABLE symbol_snapshots RENAME TO symbol_snapshots_legacy_int;
    ELSE
      ALTER TABLE symbol_snapshots RENAME TO symbol_snapshots_legacy_int_duplicate;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  run_type text NOT NULL DEFAULT 'scan',
  status text NOT NULL DEFAULT 'success',
  universe_count integer NULL,
  symbols_scored integer NULL,
  market_regime text NULL,
  breadth text NULL,
  leadership text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scan_runs
  ADD COLUMN IF NOT EXISTS run_type text NOT NULL DEFAULT 'scan',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS universe_count integer NULL,
  ADD COLUMN IF NOT EXISTS symbols_scored integer NULL,
  ADD COLUMN IF NOT EXISTS market_regime text NULL,
  ADD COLUMN IF NOT EXISTS breadth text NULL,
  ADD COLUMN IF NOT EXISTS leadership text NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_scan_runs_completed_at
  ON scan_runs(completed_at DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_runs_status_completed_at
  ON scan_runs(status, completed_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS scanner_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  rank_position integer NULL,
  symbol text NOT NULL,
  company_name text NULL,
  asset_type text NULL,
  sector text NULL,
  price numeric NULL,
  rating text NULL,
  action text NULL,
  final_decision text NULL,
  final_score numeric NULL,
  final_score_adjusted numeric NULL,
  setup_type text NULL,
  entry_status text NULL,
  recommendation_quality text NULL,
  quality_score numeric NULL,
  suggested_entry text NULL,
  entry_distance_pct numeric NULL,
  entry_zone_low numeric NULL,
  entry_zone_high numeric NULL,
  buy_zone text NULL,
  stop_loss numeric NULL,
  take_profit numeric NULL,
  conservative_target numeric NULL,
  risk_reward numeric NULL,
  market_regime text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_scanner_signals_scan_run_symbol UNIQUE (scan_run_id, symbol)
);

ALTER TABLE scanner_signals
  ADD COLUMN IF NOT EXISTS rank_position integer NULL,
  ADD COLUMN IF NOT EXISTS company_name text NULL,
  ADD COLUMN IF NOT EXISTS asset_type text NULL,
  ADD COLUMN IF NOT EXISTS sector text NULL,
  ADD COLUMN IF NOT EXISTS price numeric NULL,
  ADD COLUMN IF NOT EXISTS rating text NULL,
  ADD COLUMN IF NOT EXISTS action text NULL,
  ADD COLUMN IF NOT EXISTS final_decision text NULL,
  ADD COLUMN IF NOT EXISTS final_score numeric NULL,
  ADD COLUMN IF NOT EXISTS final_score_adjusted numeric NULL,
  ADD COLUMN IF NOT EXISTS setup_type text NULL,
  ADD COLUMN IF NOT EXISTS entry_status text NULL,
  ADD COLUMN IF NOT EXISTS recommendation_quality text NULL,
  ADD COLUMN IF NOT EXISTS quality_score numeric NULL,
  ADD COLUMN IF NOT EXISTS suggested_entry text NULL,
  ADD COLUMN IF NOT EXISTS entry_distance_pct numeric NULL,
  ADD COLUMN IF NOT EXISTS entry_zone_low numeric NULL,
  ADD COLUMN IF NOT EXISTS entry_zone_high numeric NULL,
  ADD COLUMN IF NOT EXISTS buy_zone text NULL,
  ADD COLUMN IF NOT EXISTS stop_loss numeric NULL,
  ADD COLUMN IF NOT EXISTS take_profit numeric NULL,
  ADD COLUMN IF NOT EXISTS conservative_target numeric NULL,
  ADD COLUMN IF NOT EXISTS risk_reward numeric NULL,
  ADD COLUMN IF NOT EXISTS market_regime text NULL,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_scanner_signals_scan_run_id ON scanner_signals(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_scan_run_rank ON scanner_signals(scan_run_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_symbol ON scanner_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_rating ON scanner_signals(rating);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_final_decision ON scanner_signals(final_decision);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_created_at ON scanner_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_scanner_signals_score ON scanner_signals(final_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS symbol_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_symbol_snapshots_run_symbol UNIQUE (scan_run_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_symbol_snapshots_symbol ON symbol_snapshots(symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_snapshots_scan_run_id ON symbol_snapshots(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_symbol_snapshots_created_at ON symbol_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS symbol_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  ts timestamptz NOT NULL,
  open numeric NULL,
  high numeric NULL,
  low numeric NULL,
  close numeric NULL,
  volume numeric NULL,
  source text NOT NULL DEFAULT 'scanner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_symbol_price_history_symbol_ts
  ON symbol_price_history(symbol, ts DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_symbol_price_history_symbol_ts_source
  ON symbol_price_history(symbol, ts, source);

CREATE TABLE IF NOT EXISTS performance_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NULL REFERENCES scan_runs(id) ON DELETE SET NULL,
  grouping_key text NOT NULL,
  grouping_value text NOT NULL,
  horizon text NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_summary_group
  ON performance_summary(grouping_key, grouping_value);

CREATE INDEX IF NOT EXISTS idx_performance_summary_scan_run_id
  ON performance_summary(scan_run_id);

CREATE INDEX IF NOT EXISTS idx_performance_summary_created_at
  ON performance_summary(created_at DESC);

CREATE TABLE IF NOT EXISTS forward_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NULL REFERENCES scan_runs(id) ON DELETE SET NULL,
  symbol text NOT NULL,
  signal_date date NULL,
  horizon text NULL,
  return_pct numeric NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forward_returns_symbol_signal_date
  ON forward_returns(symbol, signal_date DESC);

CREATE INDEX IF NOT EXISTS idx_forward_returns_scan_run_id
  ON forward_returns(scan_run_id);

CREATE INDEX IF NOT EXISTS idx_forward_returns_created_at
  ON forward_returns(created_at DESC);
