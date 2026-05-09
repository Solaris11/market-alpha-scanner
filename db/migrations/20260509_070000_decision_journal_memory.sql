CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_decision_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  user_action text NOT NULL,
  setup_type text,
  macro_regime text,
  final_decision text,
  conviction_score numeric,
  fragility_score numeric,
  shock_state text,
  risk_reward_profile text,
  personality_profile text,
  reason text,
  thesis text,
  concerns text,
  macro_view text,
  emotional_context text,
  expected_catalyst text,
  invalidation_reasoning text,
  deterministic_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome_status text NOT NULL DEFAULT 'pending',
  outcome_quality text NOT NULL DEFAULT 'pending',
  followup_return_1d numeric,
  followup_return_5d numeric,
  followup_return_10d numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_decision_journal_action_check CHECK (user_action IN ('watch', 'wait', 'enter', 'exit', 'avoid', 'missed_opportunity', 'shock_watch', 'pullback_watch', 'aggressive_entry', 'defensive_wait')),
  CONSTRAINT user_decision_journal_outcome_status_check CHECK (outcome_status IN ('pending', 'tracking', 'updated', 'resolved')),
  CONSTRAINT user_decision_journal_outcome_quality_check CHECK (outcome_quality IN ('pending', 'helped', 'hurt', 'neutral', 'unknown'))
);

CREATE INDEX IF NOT EXISTS ix_user_decision_journal_user_created_at
  ON user_decision_journal(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_decision_journal_user_symbol_created_at
  ON user_decision_journal(user_id, symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_decision_journal_user_action_created_at
  ON user_decision_journal(user_id, user_action, created_at DESC);

CREATE TABLE IF NOT EXISTS user_memory_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  behavioral_learning_enabled boolean NOT NULL DEFAULT true,
  journal_coaching_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
