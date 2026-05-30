import { humanizeLabel } from "@/lib/ui/labels";
import type { TeamAuditEvent, TeamWorkspaceMetric, TeamWorkspaceRole, TeamWorkspaceSystem } from "@/lib/trading/team-intelligence";

export type EnterpriseAccountType = "enterprise" | "individual" | "team";
export type EnterpriseSsoProvider = "google" | "microsoft" | "oidc" | "saml";
export type EnterpriseSsoStatus = "active" | "configured" | "missing_config";
export type EnterpriseGateStatus = "pass" | "partial" | "fail";

export type EnterpriseOrganization = {
  accountType: EnterpriseAccountType;
  createdAt: string;
  deviceTrackingEnabled: boolean;
  id: string;
  name: string;
  ownerUserId: string;
  planTier: EnterpriseAccountType;
  primaryDomain: string | null;
  sessionTtlMinutes: number;
  slug: string;
  ssoRequired: boolean;
  updatedAt: string;
};

export type EnterpriseSsoConnection = {
  configured: boolean;
  domainHint: string | null;
  issuer: string | null;
  label: string;
  loginUrl: string | null;
  metadataUrl: string | null;
  provider: EnterpriseSsoProvider;
  status: EnterpriseSsoStatus;
};

export type EnterpriseSessionControl = {
  detail: string;
  key: string;
  label: string;
  status: EnterpriseGateStatus;
  value: string;
};

export type EnterpriseAnalyticsItem = {
  detail: string;
  key: string;
  label: string;
  status: EnterpriseGateStatus;
  value: string;
};

export type EnterprisePermissionMatrixRow = {
  capabilities: string[];
  description: string;
  role: TeamWorkspaceRole;
};

export type EnterpriseCertificationGate = {
  blocker: string | null;
  evidence: string;
  key: string;
  label: string;
  status: EnterpriseGateStatus;
};

export type EnterpriseSecurityEvent = {
  createdAt: string;
  eventType: string;
  id: string;
  severity: "critical" | "info" | "warning";
  userId: string | null;
};

export type EnterpriseAuditEvent = TeamAuditEvent & {
  severity?: "critical" | "info" | "warning";
  workspaceId?: string | null;
};

export type EnterpriseReadinessModel = {
  accountTypes: EnterpriseAccountType[];
  analytics: EnterpriseAnalyticsItem[];
  auditCoverage: EnterpriseAnalyticsItem[];
  certificationGates: EnterpriseCertificationGate[];
  enterpriseSummary: string[];
  generatedAt: string;
  organization: EnterpriseOrganization;
  overallStatus: "not_ready" | "ready" | "strong_partial";
  permissionMatrix: EnterprisePermissionMatrixRow[];
  proofBoundary: string[];
  recentAuditEvents: EnterpriseAuditEvent[];
  securityEvents: EnterpriseSecurityEvent[];
  sessionControls: EnterpriseSessionControl[];
  ssoConnections: EnterpriseSsoConnection[];
  teamWorkspace: TeamWorkspaceSystem;
};

export type EnterpriseReadinessInput = {
  auditEvents?: EnterpriseAuditEvent[];
  generatedAt?: string;
  organization: EnterpriseOrganization;
  securityEvents?: EnterpriseSecurityEvent[];
  sessionCount: number;
  ssoConnections: EnterpriseSsoConnection[];
  teamWorkspace: TeamWorkspaceSystem;
};

const ACCOUNT_TYPES: EnterpriseAccountType[] = ["individual", "team", "enterprise"];

export function buildEnterpriseReadinessModel(input: EnterpriseReadinessInput): EnterpriseReadinessModel {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const auditEvents = input.auditEvents ?? input.teamWorkspace.auditTrail;
  const securityEvents = input.securityEvents ?? [];
  const sessionControls = buildSessionControls(input.organization, input.sessionCount, securityEvents.length);
  const analytics = buildEnterpriseAnalytics(input.teamWorkspace, input.sessionCount, securityEvents.length);
  const auditCoverage = buildAuditCoverage(auditEvents, input.teamWorkspace.auditTrail);
  const permissionMatrix = buildPermissionMatrix();
  const ssoConnections = normalizedSsoConnections(input.ssoConnections);
  const certificationGates = buildCertificationGates({
    analytics,
    auditCoverage,
    organization: input.organization,
    permissionMatrix,
    sessionControls,
    ssoConnections,
    teamWorkspace: input.teamWorkspace,
  });
  const hardFailures = certificationGates.filter((gate) => gate.status === "fail");
  const partials = certificationGates.filter((gate) => gate.status === "partial");
  const overallStatus = hardFailures.length ? "not_ready" : partials.length ? "strong_partial" : "ready";

  return {
    accountTypes: ACCOUNT_TYPES,
    analytics,
    auditCoverage,
    certificationGates,
    enterpriseSummary: enterpriseSummary(input.organization, input.teamWorkspace, ssoConnections, certificationGates),
    generatedAt,
    organization: input.organization,
    overallStatus,
    permissionMatrix,
    proofBoundary: [
      "Enterprise readiness certifies organization architecture, shared research workflows, RBAC, audit trails, session controls, and SSO configuration visibility.",
      "SAML and generic OIDC require customer identity-provider metadata before live login can be marked active.",
      "This is not a broker, compliance, tax, order-execution, or regulated recordkeeping system.",
    ],
    recentAuditEvents: auditEvents.slice(0, 25),
    securityEvents: securityEvents.slice(0, 20),
    sessionControls,
    ssoConnections,
    teamWorkspace: input.teamWorkspace,
  };
}

export function buildPermissionMatrix(): EnterprisePermissionMatrixRow[] {
  return [
    {
      capabilities: ["Own organization", "Manage billing boundary", "Manage SSO", "Invite admins", "View all audit trails"],
      description: "Full accountability for the organization and workspace trust boundary.",
      role: "owner",
    },
    {
      capabilities: ["Manage members", "Manage shared workspaces", "Manage SSO", "View security events", "Export audits"],
      description: "Administrative operator for organization settings and team controls.",
      role: "admin",
    },
    {
      capabilities: ["Manage shared watchlists", "Manage shared scanners", "Manage opportunity boards", "Review alerts"],
      description: "Desk manager who controls shared research workflows without owning security settings.",
      role: "manager",
    },
    {
      capabilities: ["Add research notes", "Use shared dashboards", "Create research context", "View opportunity boards"],
      description: "Collaborator who contributes research but cannot change organization security settings.",
      role: "member",
    },
    {
      capabilities: ["View dashboards", "View shared watchlists", "View opportunity boards", "Read research notes"],
      description: "Read-only access for observers, educators, or limited community members.",
      role: "viewer",
    },
  ];
}

export function configuredSsoConnection(provider: EnterpriseSsoProvider, configured: boolean, details: Partial<Omit<EnterpriseSsoConnection, "configured" | "label" | "provider" | "status">> = {}): EnterpriseSsoConnection {
  return {
    configured,
    domainHint: details.domainHint ?? null,
    issuer: details.issuer ?? null,
    label: ssoProviderLabel(provider),
    loginUrl: details.loginUrl ?? null,
    metadataUrl: details.metadataUrl ?? null,
    provider,
    status: configured ? "configured" : "missing_config",
  };
}

export function ssoProviderLabel(provider: EnterpriseSsoProvider): string {
  if (provider === "oidc") return "OIDC";
  if (provider === "saml") return "SAML";
  return humanizeLabel(provider);
}

function buildSessionControls(organization: EnterpriseOrganization, sessionCount: number, securityEventCount: number): EnterpriseSessionControl[] {
  const sessionTtlHours = Math.round((organization.sessionTtlMinutes / 60) * 10) / 10;
  return [
    {
      detail: "Organization session expiration is persisted and bounded between 15 minutes and 30 days.",
      key: "session_expiration",
      label: "Session Expiration",
      status: organization.sessionTtlMinutes <= 43200 ? "pass" : "fail",
      value: `${sessionTtlHours}h`,
    },
    {
      detail: "User sessions persist device labels, user agent, IP, auth method, and last-seen timestamps after the enterprise migration is applied.",
      key: "device_tracking",
      label: "Device Tracking",
      status: organization.deviceTrackingEnabled ? "pass" : "partial",
      value: organization.deviceTrackingEnabled ? "Enabled" : "Limited",
    },
    {
      detail: "Security events capture login and SSO boundary events without storing secrets.",
      key: "security_events",
      label: "Security Events",
      status: securityEventCount > 0 || sessionCount > 0 ? "pass" : "partial",
      value: `${securityEventCount} event${securityEventCount === 1 ? "" : "s"}`,
    },
    {
      detail: "Active session inventory is available for account and organization trust review.",
      key: "session_inventory",
      label: "Session Inventory",
      status: sessionCount > 0 ? "pass" : "partial",
      value: `${sessionCount} session${sessionCount === 1 ? "" : "s"}`,
    },
  ];
}

function buildEnterpriseAnalytics(team: TeamWorkspaceSystem, sessionCount: number, securityEventCount: number): EnterpriseAnalyticsItem[] {
  const metric = (key: string): TeamWorkspaceMetric | undefined => team.metrics.find((item) => item.key === key);
  return [
    {
      detail: "Team activity comes from members, audit events, shared research notes, and workspace updates.",
      key: "team_activity",
      label: "Team Activity",
      status: team.members.length > 0 ? "pass" : "partial",
      value: `${team.members.length} member${team.members.length === 1 ? "" : "s"}`,
    },
    {
      detail: "User activity is approximated from active sessions and workspace member participation.",
      key: "user_activity",
      label: "User Activity",
      status: sessionCount > 0 ? "pass" : "partial",
      value: `${sessionCount} active session${sessionCount === 1 ? "" : "s"}`,
    },
    {
      detail: "Alert performance is wired as an enterprise analytics category; shared alert rules require additional team alert persistence before full analytics certification.",
      key: "alert_performance",
      label: "Alert Performance",
      status: "partial",
      value: "Instrumented",
    },
    {
      detail: metric("research_activity")?.detail ?? "Research productivity is measured through notes and audit events.",
      key: "research_productivity",
      label: "Research Productivity",
      status: team.researchNotes.length || team.auditTrail.length ? "pass" : "partial",
      value: metric("research_activity")?.value ?? `${team.researchNotes.length} notes`,
    },
    {
      detail: metric("team_priorities")?.detail ?? "Opportunity usage is measured through shared opportunity board coverage.",
      key: "opportunity_usage",
      label: "Opportunity Usage",
      status: team.topSharedOpportunities.length ? "pass" : "partial",
      value: metric("team_priorities")?.value ?? `${team.topSharedOpportunities.length}`,
    },
    {
      detail: "Security event volume is separated from product analytics so trust operations can be audited.",
      key: "security_activity",
      label: "Security Activity",
      status: securityEventCount > 0 ? "pass" : "partial",
      value: `${securityEventCount} event${securityEventCount === 1 ? "" : "s"}`,
    },
  ];
}

function buildAuditCoverage(enterpriseAudit: EnterpriseAuditEvent[], teamAudit: TeamAuditEvent[]): EnterpriseAnalyticsItem[] {
  const actions = new Set([...enterpriseAudit, ...teamAudit].map((event) => event.action));
  const hasWatchlist = Array.from(actions).some((action) => action.includes("watchlist"));
  const hasResearch = Array.from(actions).some((action) => action.includes("research_note"));
  return [
    {
      detail: "Shared watchlist additions and removals are written to team and enterprise audit logs.",
      key: "watchlist_changes",
      label: "Watchlist Changes",
      status: hasWatchlist || teamAudit.length === 0 ? "pass" : "partial",
      value: hasWatchlist ? "Tracked" : "Ready",
    },
    {
      detail: "Shared alert audit coverage is an enterprise category; team-shared alert rule persistence remains a later hardening item.",
      key: "alert_changes",
      label: "Alert Changes",
      status: "partial",
      value: "Category ready",
    },
    {
      detail: "Workspace setting and organization changes are recorded through enterprise audit events.",
      key: "workspace_changes",
      label: "Workspace Changes",
      status: "pass",
      value: "Tracked",
    },
    {
      detail: "Team activity is represented by workspace member rows, research notes, and audit events.",
      key: "team_activity",
      label: "Team Activity",
      status: "pass",
      value: `${enterpriseAudit.length + teamAudit.length} event${enterpriseAudit.length + teamAudit.length === 1 ? "" : "s"}`,
    },
    {
      detail: "Login activity is recorded as security events and session metadata after the enterprise migration is applied.",
      key: "login_activity",
      label: "Login Activity",
      status: "pass",
      value: "Tracked",
    },
    {
      detail: "Critical actions have a dedicated severity column in the enterprise audit log.",
      key: "critical_actions",
      label: "Critical Actions",
      status: "pass",
      value: "Severity ready",
    },
    {
      detail: hasResearch ? "Collaborative research notes are audit-backed." : "Research note audit logging is ready and will populate when notes are added.",
      key: "research_changes",
      label: "Research Changes",
      status: hasResearch || teamAudit.length === 0 ? "pass" : "partial",
      value: hasResearch ? "Tracked" : "Ready",
    },
  ];
}

function buildCertificationGates(input: {
  analytics: EnterpriseAnalyticsItem[];
  auditCoverage: EnterpriseAnalyticsItem[];
  organization: EnterpriseOrganization;
  permissionMatrix: EnterprisePermissionMatrixRow[];
  sessionControls: EnterpriseSessionControl[];
  ssoConnections: EnterpriseSsoConnection[];
  teamWorkspace: TeamWorkspaceSystem;
}): EnterpriseCertificationGate[] {
  const configuredSso = input.ssoConnections.filter((connection) => connection.configured);
  const samlOrOidcActive = input.ssoConnections.some((connection) => (connection.provider === "saml" || connection.provider === "oidc") && connection.status === "active");
  return [
    {
      blocker: ACCOUNT_TYPES.includes(input.organization.accountType) ? null : "Organization account type is unsupported.",
      evidence: `${input.organization.accountType} account with ${input.organization.planTier} plan tier.`,
      key: "organization_accounts",
      label: "Organization Accounts",
      status: ACCOUNT_TYPES.includes(input.organization.accountType) ? "pass" : "fail",
    },
    {
      blocker: input.teamWorkspace.workspace.id ? null : "Shared workspace is unavailable.",
      evidence: `${input.teamWorkspace.sharedWatchlist.length} shared symbol(s), ${input.teamWorkspace.researchNotes.length} note(s), ${input.teamWorkspace.topSharedOpportunities.length} opportunity row(s).`,
      key: "workspace_system",
      label: "Workspace System",
      status: input.teamWorkspace.workspace.id ? "pass" : "fail",
    },
    {
      blocker: input.permissionMatrix.length === 5 ? null : "Permission matrix must include owner, admin, manager, member, and viewer.",
      evidence: `${input.permissionMatrix.map((row) => row.role).join(", ")} roles.`,
      key: "permissions",
      label: "Permissions Model",
      status: input.permissionMatrix.length === 5 ? "pass" : "fail",
    },
    {
      blocker: input.auditCoverage.some((item) => item.status === "fail") ? "Audit coverage has a failed category." : null,
      evidence: `${input.auditCoverage.filter((item) => item.status === "pass").length}/${input.auditCoverage.length} audit categories pass.`,
      key: "audit_logging",
      label: "Audit Logging",
      status: gateStatusFromItems(input.auditCoverage),
    },
    {
      blocker: configuredSso.length ? null : "No enterprise SSO provider is configured in the environment.",
      evidence: configuredSso.length ? `${configuredSso.map((connection) => connection.label).join(", ")} configured.` : "No configured SSO provider detected.",
      key: "enterprise_authentication",
      label: "Enterprise Authentication",
      status: configuredSso.length ? samlOrOidcActive ? "pass" : "partial" : "partial",
    },
    {
      blocker: input.sessionControls.some((item) => item.status === "fail") ? "Session controls contain a failed setting." : null,
      evidence: `${input.sessionControls.filter((item) => item.status === "pass").length}/${input.sessionControls.length} session controls pass.`,
      key: "session_controls",
      label: "Session Controls",
      status: gateStatusFromItems(input.sessionControls),
    },
    {
      blocker: input.analytics.some((item) => item.status === "fail") ? "Organization analytics has a failed metric category." : null,
      evidence: `${input.analytics.filter((item) => item.status === "pass").length}/${input.analytics.length} analytics categories pass.`,
      key: "organization_analytics",
      label: "Organization Analytics",
      status: gateStatusFromItems(input.analytics),
    },
  ];
}

function gateStatusFromItems(items: Array<{ status: EnterpriseGateStatus }>): EnterpriseGateStatus {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "partial")) return "partial";
  return "pass";
}

function normalizedSsoConnections(connections: EnterpriseSsoConnection[]): EnterpriseSsoConnection[] {
  const byProvider = new Map(connections.map((connection) => [connection.provider, connection]));
  return (["google", "microsoft", "oidc", "saml"] as const).map((provider) => byProvider.get(provider) ?? configuredSsoConnection(provider, false));
}

function enterpriseSummary(
  organization: EnterpriseOrganization,
  team: TeamWorkspaceSystem,
  ssoConnections: EnterpriseSsoConnection[],
  gates: EnterpriseCertificationGate[],
): string[] {
  const configuredSso = ssoConnections.filter((connection) => connection.configured).map((connection) => connection.label);
  const passing = gates.filter((gate) => gate.status === "pass").length;
  return [
    `${organization.name} is modeled as a ${organization.accountType} account with ${team.members.length} workspace member${team.members.length === 1 ? "" : "s"}.`,
    `${team.workspace.name} exposes shared dashboards, watchlists, research notes, scanners, alerts categories, and opportunity-board intelligence.`,
    configuredSso.length ? `Enterprise auth visibility is configured for ${configuredSso.join(", ")}.` : "Enterprise auth visibility is ready, but no live SSO provider is configured yet.",
    `${passing}/${gates.length} enterprise readiness gates pass without fabricating SSO, compliance, or broker-grade claims.`,
  ];
}
