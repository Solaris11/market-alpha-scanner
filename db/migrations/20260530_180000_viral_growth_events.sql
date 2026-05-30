CREATE INDEX IF NOT EXISTS ix_analytics_events_viral_growth
  ON analytics_events(occurred_at DESC, event_name, source)
  WHERE event_name IN (
    'invite_link_created',
    'invite_sent',
    'invite_opened',
    'share_asset_click',
    'share_asset_copy',
    'share_asset_opened',
    'referral_signup',
    'referral_paid_conversion',
    'organic_growth_visit'
  );

CREATE INDEX IF NOT EXISTS ix_analytics_events_viral_referral_code
  ON analytics_events((metadata->>'referralCode'), occurred_at DESC)
  WHERE metadata ? 'referralCode';

CREATE INDEX IF NOT EXISTS ix_analytics_events_viral_share_id
  ON analytics_events((metadata->>'shareId'), occurred_at DESC)
  WHERE metadata ? 'shareId';
