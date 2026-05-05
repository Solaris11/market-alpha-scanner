CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_oauth_accounts_provider_account UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS ix_user_oauth_accounts_user_id ON user_oauth_accounts(user_id);
