CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS alert_user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    defaults_seeded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_rule_id TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'symbol',
    symbol TEXT,
    alert_type TEXT NOT NULL,
    condition_operator TEXT,
    threshold NUMERIC,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, client_rule_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_active ON alert_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_symbol ON alert_rules(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(alert_type);

CREATE TABLE IF NOT EXISTS alert_rule_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state_key TEXT NOT NULL,
    rule_client_id TEXT,
    symbol TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_sent_at TIMESTAMPTZ,
    last_skipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, state_key)
);

CREATE INDEX IF NOT EXISTS idx_alert_rule_state_user ON alert_rule_state(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_state_user_rule ON alert_rule_state(user_id, rule_client_id);
CREATE INDEX IF NOT EXISTS idx_alert_rule_state_user_updated ON alert_rule_state(user_id, updated_at DESC);
