CREATE TABLE IF NOT EXISTS narrative_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  scan_run_id uuid NULL REFERENCES scan_runs(id) ON DELETE SET NULL,
  signal_ts timestamptz NULL,
  source text NOT NULL DEFAULT 'deterministic',
  narrative_summary text NOT NULL,
  bullish_narrative text NOT NULL,
  bearish_narrative text NOT NULL,
  moderator_summary text NOT NULL,
  risk_narrative text NOT NULL,
  macro_narrative text NOT NULL,
  sector_narrative text NOT NULL,
  liquidity_narrative text NOT NULL,
  volatility_narrative text NOT NULL,
  positioning_narrative text NOT NULL,
  decision_reasoning text NOT NULL,
  event_reasoning text NOT NULL,
  fragility_reasoning text NOT NULL,
  why_setup_matters text NOT NULL,
  what_could_break text NOT NULL,
  conditional_opportunity text NOT NULL,
  pressure_story text NOT NULL,
  what_to_watch jsonb NOT NULL DEFAULT '[]'::jsonb,
  narrative_drift jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_language text NOT NULL,
  unsupported_claims_detected boolean NOT NULL DEFAULT false,
  llm_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_packet jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_narrative_intelligence_symbol_scan_run UNIQUE (symbol, scan_run_id),
  CONSTRAINT ck_narrative_intelligence_source CHECK (source IN ('deterministic', 'llm'))
);

CREATE INDEX IF NOT EXISTS idx_narrative_intelligence_symbol_generated
  ON narrative_intelligence_snapshots(symbol, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_narrative_intelligence_scan_run
  ON narrative_intelligence_snapshots(scan_run_id, symbol);
