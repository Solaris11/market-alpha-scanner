CREATE TABLE IF NOT EXISTS shock_move_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  lookback_window text NOT NULL,
  upside_shock_count integer NOT NULL DEFAULT 0,
  downside_shock_count integer NOT NULL DEFAULT 0,
  largest_upside_1d numeric NULL,
  largest_downside_1d numeric NULL,
  median_upside_shock numeric NULL,
  median_downside_shock numeric NULL,
  average_followthrough_1d numeric NULL,
  average_followthrough_5d numeric NULL,
  average_reversal_5d numeric NULL,
  chase_success_rate numeric NULL,
  pullback_success_rate numeric NULL,
  reliability_score numeric NOT NULL DEFAULT 0,
  opportunity_score numeric NOT NULL DEFAULT 0,
  downside_risk_score numeric NOT NULL DEFAULT 0,
  upside_shock_score numeric NOT NULL DEFAULT 0,
  two_sided_volatility_score numeric NOT NULL DEFAULT 0,
  current_similarity_score numeric NOT NULL DEFAULT 0,
  asymmetry_score numeric NOT NULL DEFAULT 0,
  chase_risk_score numeric NOT NULL DEFAULT 0,
  opportunity_state text NOT NULL DEFAULT 'High Volatility Watch',
  chase_risk_label text NOT NULL DEFAULT 'Chase risk elevated',
  research_entry_zone text NULL,
  do_not_chase_zone text NULL,
  invalidation_zone text NULL,
  historical_exit_zone text NULL,
  average_profit_potential text NULL,
  average_drawdown_after_entry text NULL,
  common_preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_failure_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sector_macro_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_event_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  latest_event jsonb NULL,
  shock_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  llm_classification_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shock_move_patterns_symbol_window UNIQUE (symbol, lookback_window),
  CONSTRAINT ck_shock_move_patterns_window CHECK (lookback_window IN ('1y', '3y', '5y'))
);

CREATE INDEX IF NOT EXISTS idx_shock_move_patterns_opportunity
  ON shock_move_patterns(lookback_window, opportunity_score DESC, symbol);

CREATE INDEX IF NOT EXISTS idx_shock_move_patterns_symbol
  ON shock_move_patterns(symbol, lookback_window);

CREATE TABLE IF NOT EXISTS shock_move_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  event_date date NOT NULL,
  move_type text NOT NULL,
  return_1d numeric NOT NULL,
  return_2d numeric NULL,
  return_3d numeric NULL,
  return_5d numeric NULL,
  return_10d numeric NULL,
  volume_spike_ratio numeric NULL,
  atr_normalized_move numeric NULL,
  return_zscore numeric NULL,
  gap_pct numeric NULL,
  market_relative_return numeric NULL,
  sector_relative_return numeric NULL,
  max_favorable_excursion_5d numeric NULL,
  max_adverse_excursion_5d numeric NULL,
  preconditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  macro_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shock_move_events_symbol_date_type UNIQUE (symbol, event_date, move_type),
  CONSTRAINT ck_shock_move_events_move_type CHECK (move_type IN ('upside', 'downside', 'two_sided')),
  CONSTRAINT ck_shock_move_events_outcome_status CHECK (outcome_status IN ('complete', 'partial', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_shock_move_events_symbol_date
  ON shock_move_events(symbol, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_shock_move_events_outcome_status
  ON shock_move_events(outcome_status, event_date DESC);
