CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS community_shared_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  symbols text[] NOT NULL DEFAULT ARRAY[]::text[],
  visibility text NOT NULL DEFAULT 'community',
  moderation_status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_shared_watchlists_visibility_check CHECK (visibility IN ('community', 'unlisted')),
  CONSTRAINT community_shared_watchlists_moderation_check CHECK (moderation_status IN ('approved', 'pending', 'hidden'))
);

CREATE INDEX IF NOT EXISTS ix_community_shared_watchlists_visible
  ON community_shared_watchlists(moderation_status, visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_community_shared_watchlists_user_created
  ON community_shared_watchlists(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_replay_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  replay_timestamp timestamptz,
  title text NOT NULL,
  summary text NOT NULL,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  visibility text NOT NULL DEFAULT 'community',
  moderation_status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_replay_studies_visibility_check CHECK (visibility IN ('community', 'unlisted')),
  CONSTRAINT community_replay_studies_moderation_check CHECK (moderation_status IN ('approved', 'pending', 'hidden'))
);

CREATE INDEX IF NOT EXISTS ix_community_replay_studies_visible
  ON community_replay_studies(moderation_status, visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_community_replay_studies_symbol_created
  ON community_replay_studies(symbol, created_at DESC);

CREATE TABLE IF NOT EXISTS community_opportunity_follows (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  interest text NOT NULL DEFAULT 'monitoring',
  source text NOT NULL DEFAULT 'community',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol),
  CONSTRAINT community_opportunity_follows_interest_check CHECK (interest IN ('monitoring', 'learning', 'cautious'))
);

CREATE INDEX IF NOT EXISTS ix_community_opportunity_follows_symbol_interest
  ON community_opportunity_follows(symbol, interest, updated_at DESC);
