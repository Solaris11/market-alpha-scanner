ALTER TABLE user_risk_profile
  ADD COLUMN IF NOT EXISTS personality_profile text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS preferred_risk_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS preferred_reward_level text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS volatility_tolerance numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS drawdown_tolerance numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS momentum_preference numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pullback_preference numeric NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS asymmetry_preference numeric NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS event_preference numeric NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS continuation_preference numeric NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS personality_confidence numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS personality_source text NOT NULL DEFAULT 'explicit',
  ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_user_risk_profile_personality
  ON user_risk_profile(personality_profile, preferred_risk_level, preferred_reward_level);
