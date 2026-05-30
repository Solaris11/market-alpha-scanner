import "server-only";

import type { QueryResultRow } from "pg";
import {
  buildEnterpriseReadinessModel,
  configuredSsoConnection,
  type EnterpriseAccountType,
  type EnterpriseAuditEvent,
  type EnterpriseOrganization,
  type EnterpriseReadinessModel,
  type EnterpriseSecurityEvent,
  type EnterpriseSsoConnection,
  type EnterpriseSsoProvider,
} from "@/lib/enterprise-readiness";
import { sanitizeAdminAuditMetadata } from "@/lib/security/admin-policy";
import type { AuthUser } from "./auth";
import { dbQuery, dbTransaction, type DbExecutor } from "./db";
import { requestIp } from "./request-security";
import { loadTeamWorkspaceSystem } from "./team-intelligence";

type OrganizationRow = QueryResultRow & {
  account_type: string;
  created_at: string;
  device_tracking_enabled: boolean;
  id: string;
  name: string;
  owner_user_id: string;
  plan_tier: string;
  primary_domain: string | null;
  session_ttl_minutes: number;
  slug: string;
  sso_required: boolean;
  updated_at: string;
};

type SsoConnectionRow = QueryResultRow & {
  domain_hint: string | null;
  issuer: string | null;
  login_url: string | null;
  metadata_url: string | null;
  provider: string;
  status: string;
};

type EnterpriseAuditRow = QueryResultRow & {
  action: string;
  actor_user_id: string | null;
  created_at: string;
  id: string;
  metadata: Record<string, unknown> | null;
  severity: "critical" | "info" | "warning";
  target_id: string | null;
  target_type: string;
  workspace_id: string | null;
};

type SecurityEventRow = QueryResultRow & {
  created_at: string;
  event_type: string;
  id: string;
  severity: "critical" | "info" | "warning";
  user_id: string | null;
};

type SessionCountRow = QueryResultRow & {
  count: string;
};

type EnterpriseOrganizationPatch = {
  accountType?: unknown;
  name?: unknown;
  primaryDomain?: unknown;
  sessionTtlMinutes?: unknown;
  ssoRequired?: unknown;
};

export async function loadEnterpriseReadiness(user: AuthUser): Promise<EnterpriseReadinessModel> {
  const organization = await getOrCreateEnterpriseOrganization(user);
  await upsertEnvironmentSsoConnections(organization.id).catch(() => undefined);
  const teamWorkspace = await loadTeamWorkspaceSystem(user.id);
  await ensureDefaultWorkspaceOrganization(user.id, organization.id).catch(() => undefined);
  const [auditEvents, securityEvents, sessionCount, ssoConnections] = await Promise.all([
    readEnterpriseAuditEvents(organization.id),
    readEnterpriseSecurityEvents(organization.id, user.id),
    readEnterpriseSessionCount(user.id),
    readEnterpriseSsoConnections(organization.id),
  ]);

  return buildEnterpriseReadinessModel({
    auditEvents,
    organization,
    securityEvents,
    sessionCount,
    ssoConnections,
    teamWorkspace,
  });
}

export async function updateEnterpriseOrganization(input: { patch: EnterpriseOrganizationPatch; request?: Request; user: AuthUser }): Promise<EnterpriseReadinessModel> {
  const organization = await getOrCreateEnterpriseOrganization(input.user);
  const name = cleanText(input.patch.name, 120) || organization.name;
  const accountType = normalizeAccountType(input.patch.accountType) ?? organization.accountType;
  const primaryDomain = cleanNullableDomain(input.patch.primaryDomain);
  const sessionTtlMinutes = normalizeSessionTtl(input.patch.sessionTtlMinutes) ?? organization.sessionTtlMinutes;
  const ssoRequired = typeof input.patch.ssoRequired === "boolean" ? input.patch.ssoRequired : organization.ssoRequired;

  await dbTransaction(async (db) => {
    await db.query(
      `
        UPDATE enterprise_organizations
        SET
          name = $2,
          account_type = $3,
          plan_tier = $3,
          primary_domain = $4,
          session_ttl_minutes = $5,
          sso_required = $6,
          updated_at = now()
        WHERE id = $1::uuid
      `,
      [organization.id, name, accountType, primaryDomain, sessionTtlMinutes, ssoRequired],
    );
    await writeEnterpriseAuditLog(db, {
      action: "organization.update",
      actorUserId: input.user.id,
      metadata: { accountType, primaryDomain, sessionTtlMinutes, ssoRequired },
      organizationId: organization.id,
      request: input.request,
      targetId: organization.id,
      targetType: "enterprise_organization",
    });
  });

  return loadEnterpriseReadiness(input.user);
}

export async function recordEnterpriseSecurityEvent(input: {
  authMethod?: string;
  eventType: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
  severity?: "critical" | "info" | "warning";
  sessionId?: string | null;
  userId: string;
}): Promise<void> {
  await dbQuery(
    `
      INSERT INTO enterprise_security_events (organization_id, user_id, session_id, event_type, ip, user_agent, metadata, severity, created_at)
      SELECT m.organization_id, $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, now()
      FROM enterprise_organization_members m
      WHERE m.user_id = $1::uuid
        AND m.status = 'active'
      ORDER BY m.created_at ASC
      LIMIT 1
    `,
    [
      input.userId,
      input.sessionId ?? null,
      cleanText(input.eventType, 80) || "security.event",
      input.ip ?? (input.request ? requestIp(input.request) : null),
      input.request ? cleanText(input.request.headers.get("user-agent") ?? "", 240) : null,
      JSON.stringify(sanitizeAdminAuditMetadata({ authMethod: input.authMethod ?? null, ...(input.metadata ?? {}) })),
      input.severity ?? "info",
    ],
  ).catch(() => undefined);
}

export function enterpriseSsoConnectionsFromEnv(env: NodeJS.ProcessEnv = process.env): EnterpriseSsoConnection[] {
  return [
    configuredSsoConnection("google", Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim() && env.GOOGLE_REDIRECT_URI?.trim()), {
      issuer: "https://accounts.google.com",
      loginUrl: "/api/auth/google/start",
    }),
    configuredSsoConnection("microsoft", Boolean(env.MICROSOFT_CLIENT_ID?.trim() && env.MICROSOFT_CLIENT_SECRET?.trim() && env.MICROSOFT_REDIRECT_URI?.trim()), {
      domainHint: env.MICROSOFT_TENANT_ID?.trim() || "common",
      issuer: microsoftIssuer(env),
      loginUrl: "/api/auth/enterprise/microsoft/start",
    }),
    configuredSsoConnection("oidc", Boolean(env.TRADEVETO_OIDC_ISSUER?.trim() && env.TRADEVETO_OIDC_CLIENT_ID?.trim() && env.TRADEVETO_OIDC_CLIENT_SECRET?.trim()), {
      issuer: env.TRADEVETO_OIDC_ISSUER?.trim() || null,
      loginUrl: "/api/auth/enterprise/oidc/start",
      metadataUrl: env.TRADEVETO_OIDC_METADATA_URL?.trim() || oidcMetadataUrl(env.TRADEVETO_OIDC_ISSUER),
    }),
    configuredSsoConnection("saml", Boolean((env.TRADEVETO_SAML_METADATA_URL?.trim() || env.TRADEVETO_SAML_ENTRYPOINT?.trim()) && env.TRADEVETO_SAML_ISSUER?.trim()), {
      issuer: env.TRADEVETO_SAML_ISSUER?.trim() || null,
      loginUrl: env.TRADEVETO_SAML_ENTRYPOINT?.trim() || null,
      metadataUrl: env.TRADEVETO_SAML_METADATA_URL?.trim() || null,
    }),
  ];
}

async function getOrCreateEnterpriseOrganization(user: AuthUser): Promise<EnterpriseOrganization> {
  const slug = defaultOrganizationSlug(user);
  const name = cleanText(user.displayName, 80) ? `${cleanText(user.displayName, 80)} Workspace` : `${user.email.split("@")[0] ?? "TradeVeto"} Workspace`;
  const row = await dbTransaction(async (db) => {
    const result = await db.query<OrganizationRow>(
      `
        INSERT INTO enterprise_organizations (owner_user_id, name, slug, account_type, plan_tier, primary_domain, created_at, updated_at)
        VALUES ($1::uuid, $2, $3, 'team', 'team', $4, now(), now())
        ON CONFLICT (owner_user_id, slug)
        DO UPDATE SET updated_at = enterprise_organizations.updated_at
        RETURNING id::text, owner_user_id::text, name, slug, account_type, plan_tier, primary_domain, sso_required, session_ttl_minutes, device_tracking_enabled, created_at::text, updated_at::text
      `,
      [user.id, name, slug, emailDomain(user.email)],
    );
    const organization = result.rows[0];
    await db.query(
      `
        INSERT INTO enterprise_organization_members (organization_id, user_id, role, status, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, 'owner', 'active', now(), now())
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET role = CASE WHEN enterprise_organization_members.role = 'owner' THEN 'owner' ELSE EXCLUDED.role END, status = 'active', updated_at = now()
      `,
      [organization.id, user.id],
    );
    return organization;
  });
  return organizationFromRow(row);
}

async function ensureDefaultWorkspaceOrganization(userId: string, organizationId: string): Promise<void> {
  await dbQuery(
    `
      UPDATE team_workspaces
      SET organization_id = $2::uuid, workspace_type = CASE WHEN workspace_type = 'personal' THEN 'shared' ELSE workspace_type END, updated_at = now()
      WHERE owner_user_id = $1::uuid
        AND organization_id IS NULL
    `,
    [userId, organizationId],
  );
}

async function upsertEnvironmentSsoConnections(organizationId: string): Promise<void> {
  const connections = enterpriseSsoConnectionsFromEnv().filter((connection) => connection.configured);
  if (!connections.length) return;
  await dbTransaction(async (db) => {
    for (const connection of connections) {
      await db.query(
        `
          INSERT INTO enterprise_sso_connections (organization_id, provider, status, issuer, metadata_url, login_url, domain_hint, created_at, updated_at)
          VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, now(), now())
          ON CONFLICT (organization_id, provider)
          DO UPDATE SET status = EXCLUDED.status, issuer = EXCLUDED.issuer, metadata_url = EXCLUDED.metadata_url, login_url = EXCLUDED.login_url, domain_hint = EXCLUDED.domain_hint, updated_at = now()
        `,
        [organizationId, connection.provider, connection.status, connection.issuer, connection.metadataUrl, connection.loginUrl, connection.domainHint],
      );
    }
  });
}

async function readEnterpriseSsoConnections(organizationId: string): Promise<EnterpriseSsoConnection[]> {
  const rows = await dbQuery<SsoConnectionRow>(
    `
      SELECT provider, status, issuer, metadata_url, login_url, domain_hint
      FROM enterprise_sso_connections
      WHERE organization_id = $1::uuid
      ORDER BY provider ASC
    `,
    [organizationId],
  );
  const persisted = rows.rows.map((row) => ({
    configured: row.status !== "missing_config" && row.status !== "disabled",
    domainHint: row.domain_hint,
    issuer: row.issuer,
    label: providerLabel(row.provider),
    loginUrl: row.login_url,
    metadataUrl: row.metadata_url,
    provider: normalizeSsoProvider(row.provider),
    status: row.status === "active" ? "active" as const : row.status === "configured" ? "configured" as const : "missing_config" as const,
  }));
  const envConnections = enterpriseSsoConnectionsFromEnv();
  const byProvider = new Map(envConnections.map((connection) => [connection.provider, connection]));
  for (const connection of persisted) byProvider.set(connection.provider, connection);
  return Array.from(byProvider.values());
}

async function readEnterpriseAuditEvents(organizationId: string): Promise<EnterpriseAuditEvent[]> {
  const rows = await dbQuery<EnterpriseAuditRow>(
    `
      SELECT id::text, workspace_id::text, actor_user_id::text, action, target_type, target_id, metadata, severity, created_at::text
      FROM enterprise_audit_log
      WHERE organization_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [organizationId],
  );
  return rows.rows.map((row) => ({
    action: row.action,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
    id: row.id,
    metadata: row.metadata ?? {},
    severity: row.severity,
    targetId: row.target_id,
    targetType: row.target_type,
    workspaceId: row.workspace_id,
  }));
}

async function readEnterpriseSecurityEvents(organizationId: string, userId: string): Promise<EnterpriseSecurityEvent[]> {
  const rows = await dbQuery<SecurityEventRow>(
    `
      SELECT id::text, user_id::text, event_type, severity, created_at::text
      FROM enterprise_security_events
      WHERE organization_id = $1::uuid OR user_id = $2::uuid
      ORDER BY created_at DESC
      LIMIT 30
    `,
    [organizationId, userId],
  );
  return rows.rows.map((row) => ({
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    severity: row.severity,
    userId: row.user_id,
  }));
}

async function readEnterpriseSessionCount(userId: string): Promise<number> {
  const rows = await dbQuery<SessionCountRow>(
    `
      SELECT count(*)::text
      FROM user_sessions
      WHERE user_id = $1::uuid
        AND expires_at > now()
        AND revoked_at IS NULL
    `,
    [userId],
  );
  return Number.parseInt(rows.rows[0]?.count ?? "0", 10) || 0;
}

async function writeEnterpriseAuditLog(
  db: DbExecutor,
  input: {
    action: string;
    actorUserId: string;
    metadata?: Record<string, unknown>;
    organizationId: string;
    request?: Request;
    severity?: "critical" | "info" | "warning";
    targetId?: string | null;
    targetType: string;
    workspaceId?: string | null;
  },
): Promise<void> {
  const metadata = sanitizeAdminAuditMetadata(input.metadata ?? {});
  await db.query(
    `
      INSERT INTO enterprise_audit_log (organization_id, workspace_id, actor_user_id, action, target_type, target_id, metadata, ip, user_agent, severity, created_at)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb, $8, $9, $10, now())
    `,
    [
      input.organizationId,
      input.workspaceId ?? null,
      input.actorUserId,
      cleanText(input.action, 120) || "enterprise.update",
      cleanText(input.targetType, 80) || "enterprise_organization",
      input.targetId ? cleanText(input.targetId, 180) : null,
      JSON.stringify(metadata),
      input.request ? requestIp(input.request) : null,
      input.request ? cleanText(input.request.headers.get("user-agent") ?? "", 240) : null,
      input.severity ?? "info",
    ],
  );
}

function organizationFromRow(row: OrganizationRow): EnterpriseOrganization {
  return {
    accountType: normalizeAccountType(row.account_type) ?? "team",
    createdAt: row.created_at,
    deviceTrackingEnabled: row.device_tracking_enabled,
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    planTier: normalizeAccountType(row.plan_tier) ?? "team",
    primaryDomain: row.primary_domain,
    sessionTtlMinutes: Number(row.session_ttl_minutes) || 43200,
    slug: row.slug,
    ssoRequired: row.sso_required,
    updatedAt: row.updated_at,
  };
}

function normalizeAccountType(value: unknown): EnterpriseAccountType | null {
  return value === "individual" || value === "team" || value === "enterprise" ? value : null;
}

function normalizeSsoProvider(value: unknown): EnterpriseSsoProvider {
  return value === "google" || value === "microsoft" || value === "oidc" || value === "saml" ? value : "oidc";
}

function providerLabel(value: unknown): string {
  const provider = normalizeSsoProvider(value);
  if (provider === "oidc") return "OIDC";
  if (provider === "saml") return "SAML";
  return provider === "google" ? "Google" : "Microsoft";
}

function normalizeSessionTtl(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(15, Math.min(43200, Math.trunc(parsed)));
}

function cleanNullableDomain(value: unknown): string | null {
  const text = cleanText(value, 180).toLowerCase();
  if (!text) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(text)) return null;
  return text;
}

function defaultOrganizationSlug(user: AuthUser): string {
  const domain = emailDomain(user.email)?.split(".")[0] ?? "";
  const local = user.email.split("@")[0] ?? "workspace";
  const base = cleanSlug(domain || local);
  return `${base || "workspace"}-org`.slice(0, 63).replace(/-+$/g, "") || "workspace-org";
}

function emailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : null;
}

function cleanSlug(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length >= 3 ? slug : "workspace";
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function microsoftIssuer(env: NodeJS.ProcessEnv): string {
  const tenant = env.MICROSOFT_TENANT_ID?.trim() || "common";
  return `https://login.microsoftonline.com/${tenant}/v2.0`;
}

function oidcMetadataUrl(issuer: string | undefined): string | null {
  const normalized = issuer?.trim().replace(/\/+$/g, "");
  return normalized ? `${normalized}/.well-known/openid-configuration` : null;
}
