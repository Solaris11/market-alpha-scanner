ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_signal_context
  ON notifications(user_id, (metadata->>'feedCategory'), created_at DESC)
  WHERE type = 'signal';

CREATE INDEX IF NOT EXISTS idx_notification_feedback_user_feed_category
  ON notification_feedback(user_id, (metadata->>'feedCategory'), feedback, updated_at DESC)
  WHERE metadata ? 'feedCategory';
