CREATE INDEX IF NOT EXISTS ix_analytics_events_occurred_event
  ON analytics_events(event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_analytics_events_occurred_actor
  ON analytics_events(occurred_at DESC, user_id, anonymous_id_hash, session_id_hash);

CREATE INDEX IF NOT EXISTS ix_analytics_events_return_sessions
  ON analytics_events(occurred_at DESC, event_name, page_path)
  WHERE event_name IN (
    'return_session',
    'morning_workflow_start',
    'scanner_return',
    'replay_return',
    'alert_return',
    'watchlist_return',
    'personalized_intelligence_return',
    'notification_usefulness_feedback'
  );
