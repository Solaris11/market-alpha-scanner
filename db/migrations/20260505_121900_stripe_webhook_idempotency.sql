CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stripe_events_created_at
  ON stripe_events(created_at DESC);

INSERT INTO stripe_events (id, type, created_at)
SELECT stripe_event_id, event_type, created_at
FROM billing_events
WHERE stripe_event_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_last_event_created_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_stripe_last_event_created_at
  ON user_subscriptions(stripe_last_event_created_at);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS stripe_event_id text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_notifications_stripe_event_id
  ON notifications(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;
