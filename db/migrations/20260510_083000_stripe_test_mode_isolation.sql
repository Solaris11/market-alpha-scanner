ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'live';

ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'live';

ALTER TABLE stripe_events
  ADD COLUMN IF NOT EXISTS stripe_mode text NOT NULL DEFAULT 'live';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_user_subscriptions_stripe_mode'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT ck_user_subscriptions_stripe_mode
      CHECK (stripe_mode IN ('live', 'test'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_billing_events_stripe_mode'
  ) THEN
    ALTER TABLE billing_events
      ADD CONSTRAINT ck_billing_events_stripe_mode
      CHECK (stripe_mode IN ('live', 'test'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_stripe_events_stripe_mode'
  ) THEN
    ALTER TABLE stripe_events
      ADD CONSTRAINT ck_stripe_events_stripe_mode
      CHECK (stripe_mode IN ('live', 'test'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_stripe_mode_customer_id
  ON user_subscriptions(stripe_mode, stripe_customer_id);

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_stripe_mode_subscription_id
  ON user_subscriptions(stripe_mode, stripe_subscription_id);

CREATE INDEX IF NOT EXISTS ix_billing_events_stripe_mode_created_at
  ON billing_events(stripe_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_stripe_events_stripe_mode_created_at
  ON stripe_events(stripe_mode, created_at DESC);

