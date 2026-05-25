CREATE INDEX IF NOT EXISTS ix_analytics_events_retention_recovery
  ON analytics_events(occurred_at DESC, event_name, page_path)
  WHERE event_name IN (
    'activation_milestone',
    'chart_return',
    'compare_return',
    'history_return',
    'scanner_habit_loop',
    'workflow_dropoff'
  );
