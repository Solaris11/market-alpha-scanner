CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE user_sessions
ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

-- Existing raw-token sessions are intentionally invalidated. Raw browser
-- session tokens must never remain in durable storage.
DELETE FROM user_sessions;

ALTER TABLE user_sessions
ALTER COLUMN session_token DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_sessions_session_token_key'
    ) THEN
        ALTER TABLE user_sessions
        DROP CONSTRAINT user_sessions_session_token_key;
    END IF;
END $$;

ALTER TABLE user_sessions
ALTER COLUMN session_token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_sessions_session_token_hash
ON user_sessions(session_token_hash);

CREATE INDEX IF NOT EXISTS ix_user_sessions_session_token_hash
ON user_sessions(session_token_hash);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'inactive',
    plan TEXT NOT NULL DEFAULT 'free',
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_subscriptions_status_period
ON user_subscriptions(status, current_period_end);
