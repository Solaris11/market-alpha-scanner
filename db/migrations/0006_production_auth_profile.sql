CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS risk_experience_level TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
