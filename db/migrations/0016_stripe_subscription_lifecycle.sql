ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_cancel_at_period_end
  ON user_subscriptions(cancel_at_period_end);
