CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_saved_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    filter_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_saved_scans_user_name UNIQUE (user_id, name_key)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_scans_user_updated
    ON user_saved_scans(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_saved_scans_user_last_used
    ON user_saved_scans(user_id, last_used_at DESC NULLS LAST);
