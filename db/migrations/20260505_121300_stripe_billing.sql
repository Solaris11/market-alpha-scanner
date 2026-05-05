CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_stripe_customer_id
  ON user_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_stripe_subscription_id
  ON user_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_status_current_period_end
  ON user_subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE NOT NULL,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_billing_events_user_created_at
  ON billing_events(user_id, created_at DESC);
