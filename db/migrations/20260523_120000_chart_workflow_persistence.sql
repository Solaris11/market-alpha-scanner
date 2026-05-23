ALTER TABLE user_workspace_preferences
    ADD COLUMN IF NOT EXISTS chart_workspaces JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS ix_user_workspace_preferences_chart_workspaces_gin
    ON user_workspace_preferences USING GIN (chart_workspaces);
