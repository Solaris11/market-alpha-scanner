CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_workflow_visits (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surface text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, surface),
  CONSTRAINT user_workflow_visits_surface_check CHECK (surface IN ('terminal', 'opportunities', 'symbol'))
);

CREATE TABLE IF NOT EXISTS user_workflow_symbol_snapshots (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surface text NOT NULL,
  symbol varchar(24) NOT NULL,
  final_score numeric,
  conviction_score numeric,
  fragility_score numeric,
  macro_alignment_score numeric,
  event_pressure_score numeric,
  shock_pressure_score numeric,
  entry_distance_pct numeric,
  return_1d numeric,
  final_decision text,
  setup_type text,
  maturity_state text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, surface, symbol),
  CONSTRAINT user_workflow_symbol_snapshots_surface_check CHECK (surface IN ('terminal', 'opportunities', 'symbol'))
);

CREATE INDEX IF NOT EXISTS ix_user_workflow_symbol_snapshots_user_captured_at
  ON user_workflow_symbol_snapshots (user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_workflow_symbol_snapshots_user_symbol
  ON user_workflow_symbol_snapshots (user_id, symbol);
