CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS enterprise_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  account_type text NOT NULL DEFAULT 'team',
  plan_tier text NOT NULL DEFAULT 'team',
  primary_domain text,
  sso_required boolean NOT NULL DEFAULT false,
  session_ttl_minutes integer NOT NULL DEFAULT 43200,
  device_tracking_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_organizations_account_type_check CHECK (account_type IN ('individual', 'team', 'enterprise')),
  CONSTRAINT enterprise_organizations_plan_tier_check CHECK (plan_tier IN ('individual', 'team', 'enterprise')),
  CONSTRAINT enterprise_organizations_session_ttl_check CHECK (session_ttl_minutes BETWEEN 15 AND 43200),
  CONSTRAINT enterprise_organizations_slug_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  CONSTRAINT uq_enterprise_organizations_owner_slug UNIQUE (owner_user_id, slug)
);

CREATE TABLE IF NOT EXISTS enterprise_organization_members (
  organization_id uuid NOT NULL REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT enterprise_organization_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  CONSTRAINT enterprise_organization_members_status_check CHECK (status IN ('active', 'invited', 'disabled'))
);

CREATE TABLE IF NOT EXISTS enterprise_sso_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'configured',
  issuer text,
  metadata_url text,
  entity_id text,
  login_url text,
  domain_hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_sso_connections_provider_check CHECK (provider IN ('google', 'microsoft', 'oidc', 'saml')),
  CONSTRAINT enterprise_sso_connections_status_check CHECK (status IN ('configured', 'active', 'disabled', 'missing_config')),
  CONSTRAINT uq_enterprise_sso_provider UNIQUE (organization_id, provider)
);

CREATE TABLE IF NOT EXISTS enterprise_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES team_workspaces(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_audit_log_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE TABLE IF NOT EXISTS enterprise_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES enterprise_organizations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id uuid,
  event_type text NOT NULL,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_security_events_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

ALTER TABLE team_workspaces
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES enterprise_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workspace_type text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS dashboard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shared_scanner_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shared_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opportunity_board_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE team_workspaces
  DROP CONSTRAINT IF EXISTS team_workspaces_workspace_type_check;

ALTER TABLE team_workspaces
  ADD CONSTRAINT team_workspaces_workspace_type_check CHECK (workspace_type IN ('personal', 'shared', 'enterprise'));

ALTER TABLE team_workspace_members
  DROP CONSTRAINT IF EXISTS team_workspace_members_role_check;

UPDATE team_workspace_members
SET role = 'manager'
WHERE role = 'analyst';

ALTER TABLE team_workspace_members
  ADD CONSTRAINT team_workspace_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer'));

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS created_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_enterprise_organizations_owner_updated
  ON enterprise_organizations(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_enterprise_organization_members_user
  ON enterprise_organization_members(user_id, role, status);

CREATE INDEX IF NOT EXISTS ix_enterprise_sso_connections_org_provider
  ON enterprise_sso_connections(organization_id, provider);

CREATE INDEX IF NOT EXISTS ix_enterprise_audit_log_org_created
  ON enterprise_audit_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_enterprise_audit_log_workspace_created
  ON enterprise_audit_log(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_enterprise_audit_log_target
  ON enterprise_audit_log(organization_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS ix_enterprise_security_events_org_created
  ON enterprise_security_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_enterprise_security_events_user_created
  ON enterprise_security_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_team_workspaces_organization_updated
  ON team_workspaces(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_sessions_user_last_seen
  ON user_sessions(user_id, (COALESCE(last_seen_at, created_at)) DESC);
