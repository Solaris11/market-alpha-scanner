CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    categories TEXT[] NOT NULL DEFAULT '{"watchlist_risk_escalation","large_score_change","shock_risk","macro_regime_shift","replay_relevant_event","alert_threshold"}',
    channels TEXT[] NOT NULL DEFAULT '{"in_app"}',
    frequency TEXT NOT NULL DEFAULT 'high_signal_only',
    symbol_scope TEXT NOT NULL DEFAULT 'watchlist_and_favorites',
    symbols TEXT[] NOT NULL DEFAULT '{}',
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,
    daily_limit INTEGER NOT NULL DEFAULT 6,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    preferences_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_notification_preferences_updated_at
    ON user_notification_preferences(updated_at DESC);

CREATE TABLE IF NOT EXISTS user_intelligence_feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL,
    item_type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    monitor_next TEXT NOT NULL,
    related_symbol TEXT,
    action_href TEXT NOT NULL,
    evidence_label TEXT NOT NULL,
    data_timestamp TIMESTAMPTZ NOT NULL,
    notification_eligible BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS ix_user_intelligence_feed_items_user_created
    ON user_intelligence_feed_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_intelligence_feed_items_user_data_timestamp
    ON user_intelligence_feed_items(user_id, data_timestamp DESC);

CREATE INDEX IF NOT EXISTS ix_user_intelligence_feed_items_symbol_created
    ON user_intelligence_feed_items(related_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_intelligence_feed_items_notify
    ON user_intelligence_feed_items(user_id, notification_eligible, notified_at, created_at DESC);
