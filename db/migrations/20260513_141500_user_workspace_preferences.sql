CREATE TABLE IF NOT EXISTS user_workspace_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    favorite_symbols TEXT[] NOT NULL DEFAULT '{}',
    favorite_modules TEXT[] NOT NULL DEFAULT '{}',
    hidden_modules TEXT[] NOT NULL DEFAULT '{}',
    module_order TEXT[] NOT NULL DEFAULT '{}',
    pinned_mobile_cards TEXT[] NOT NULL DEFAULT '{}',
    preferred_timeframes TEXT[] NOT NULL DEFAULT '{"1M","6M"}',
    preferred_risk_style TEXT NOT NULL DEFAULT 'balanced',
    workspace_mode TEXT NOT NULL DEFAULT 'balanced',
    watchlist_first_mode BOOLEAN NOT NULL DEFAULT false,
    macro_first_mode BOOLEAN NOT NULL DEFAULT false,
    mobile_preferred_overview TEXT NOT NULL DEFAULT 'what_matters_now',
    mobile_last_viewed_symbol TEXT,
    favorite_actions TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    preferences_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_workspace_preferences_updated_at
    ON user_workspace_preferences(updated_at DESC);
