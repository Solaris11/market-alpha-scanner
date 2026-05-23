CREATE TABLE IF NOT EXISTS notification_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feedback TEXT NOT NULL CHECK (feedback IN ('useful', 'not_useful')),
    notification_type TEXT NOT NULL,
    action_url TEXT,
    source TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_feedback_user_updated
    ON notification_feedback(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_feedback_type_feedback_updated
    ON notification_feedback(notification_type, feedback, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_feedback_notification
    ON notification_feedback(notification_id);
