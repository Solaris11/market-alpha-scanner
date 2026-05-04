CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

UPDATE users
SET role = 'user'
WHERE role IS NULL
   OR role NOT IN ('user', 'admin');

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS ix_users_role
  ON users(role);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_admin_audit_log_created_at
  ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_admin_audit_log_admin_created_at
  ON admin_audit_log(admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_admin_audit_log_target
  ON admin_audit_log(target_type, target_id);
