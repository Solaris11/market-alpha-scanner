CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS team_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_workspaces_slug_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  CONSTRAINT uq_team_workspaces_owner_slug UNIQUE (owner_user_id, slug)
);

CREATE TABLE IF NOT EXISTS team_workspace_members (
  workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT team_workspace_members_role_check CHECK (role IN ('owner', 'admin', 'analyst', 'viewer'))
);

CREATE TABLE IF NOT EXISTS team_workspace_watchlist (
  workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
  symbol varchar(24) NOT NULL,
  note text,
  added_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, symbol)
);

CREATE TABLE IF NOT EXISTS team_research_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
  symbol varchar(24),
  title text NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'team',
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_research_notes_visibility_check CHECK (visibility IN ('team', 'admins'))
);

CREATE TABLE IF NOT EXISTS team_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_team_workspaces_owner_updated_at
  ON team_workspaces(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_team_workspace_members_user
  ON team_workspace_members(user_id, role);

CREATE INDEX IF NOT EXISTS ix_team_workspace_watchlist_workspace_created
  ON team_workspace_watchlist(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_team_research_notes_workspace_created
  ON team_research_notes(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_team_research_notes_workspace_symbol
  ON team_research_notes(workspace_id, symbol);

CREATE INDEX IF NOT EXISTS ix_team_audit_log_workspace_created
  ON team_audit_log(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_team_audit_log_target
  ON team_audit_log(workspace_id, target_type, target_id);
