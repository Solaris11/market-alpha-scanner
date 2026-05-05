ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url text;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read
  ON notifications(user_id, type, read);
