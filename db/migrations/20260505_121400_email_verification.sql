CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, updated_at, now())
WHERE email_verified = true
  AND email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_verification_tokens_token_hash
  ON email_verification_tokens(token_hash);

CREATE INDEX IF NOT EXISTS ix_email_verification_tokens_user_id
  ON email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS ix_email_verification_tokens_expires_at
  ON email_verification_tokens(expires_at);
