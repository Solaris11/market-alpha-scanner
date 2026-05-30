import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildEnterpriseReadinessModel, buildPermissionMatrix, configuredSsoConnection, type EnterpriseOrganization } from "./enterprise-readiness";
import type { TeamWorkspaceSystem } from "./trading/team-intelligence";

const organization: EnterpriseOrganization = {
  accountType: "enterprise",
  createdAt: "2026-05-30T12:00:00.000Z",
  deviceTrackingEnabled: true,
  id: "org-1",
  name: "North Star Research",
  ownerUserId: "user-1",
  planTier: "enterprise",
  primaryDomain: "northstar.example",
  sessionTtlMinutes: 720,
  slug: "north-star-research",
  ssoRequired: true,
  updatedAt: "2026-05-30T12:00:00.000Z",
};

const teamWorkspace: TeamWorkspaceSystem = {
  auditTrail: [
    {
      action: "shared_watchlist.add_symbols",
      actorUserId: "user-1",
      createdAt: "2026-05-30T12:03:00.000Z",
      id: "audit-1",
      metadata: { symbols: ["AMD"] },
      targetId: "workspace-1",
      targetType: "team_workspace",
    },
  ],
  generatedAt: "2026-05-30T12:05:00.000Z",
  limitations: ["Research only."],
  members: [
    { createdAt: "2026-05-30T12:00:00.000Z", displayName: "Owner", email: "owner@example.com", role: "owner", userId: "user-1" },
    { createdAt: "2026-05-30T12:01:00.000Z", displayName: "Manager", email: "manager@example.com", role: "manager", userId: "user-2" },
    { createdAt: "2026-05-30T12:02:00.000Z", displayName: "Viewer", email: "viewer@example.com", role: "viewer", userId: "user-3" },
  ],
  metrics: [
    { detail: "Workspace ready.", key: "workspace_health", label: "Workspace Health", tone: "constructive", value: "82" },
    { detail: "Shared symbols.", key: "shared_watchlist", label: "Shared Watchlist", tone: "constructive", value: "1" },
    { detail: "Opportunity board rows.", key: "team_priorities", label: "Team Priorities", tone: "constructive", value: "1" },
    { detail: "Research notes.", key: "research_activity", label: "Research Activity", tone: "constructive", value: "1 notes" },
  ],
  researchNotes: [
    { body: "Watch the risk boundary.", createdAt: "2026-05-30T12:04:00.000Z", createdByUserId: "user-2", id: "note-1", symbol: "AMD", title: "AMD review", visibility: "team" },
  ],
  role: "owner",
  roleCapabilities: {
    canAdmin: true,
    canEditResearch: true,
    canInvite: true,
    canManageWatchlist: true,
    canView: true,
    label: "Owner",
  },
  sharedWatchlist: [{ addedByUserId: "user-1", createdAt: "2026-05-30T12:03:00.000Z", note: null, symbol: "AMD" }],
  teamBriefing: ["AMD is the highest team attention candidate."],
  topSharedOpportunities: [
    {
      attentionScore: 78,
      companyName: "Advanced Micro Devices",
      currentDecision: "Watch",
      entryContext: "Research context only.",
      eventContext: "No verified event catalyst",
      keyReason: "Strong scanner context.",
      keyRisk: "Macro risk.",
      macroContext: "Macro mixed",
      opportunityScore: 76,
      riskScore: 42,
      symbol: "AMD",
      tags: ["High team priority"],
    },
  ],
  watchlistRisks: [],
  workspace: {
    createdAt: "2026-05-30T12:00:00.000Z",
    description: "Enterprise workspace.",
    id: "workspace-1",
    name: "Research Desk",
    ownerUserId: "user-1",
    slug: "research-desk",
    updatedAt: "2026-05-30T12:04:00.000Z",
  },
  workspaceHealthScore: 82,
};

describe("enterprise readiness", () => {
  test("publishes the complete enterprise role matrix", () => {
    const matrix = buildPermissionMatrix();
    assert.deepEqual(matrix.map((row) => row.role), ["owner", "admin", "manager", "member", "viewer"]);
    assert.ok(matrix.find((row) => row.role === "viewer")?.capabilities.every((capability) => /view|read/i.test(capability)));
  });

  test("certifies organization architecture while keeping SSO claims bounded", () => {
    const model = buildEnterpriseReadinessModel({
      auditEvents: teamWorkspace.auditTrail,
      organization,
      securityEvents: [{ createdAt: "2026-05-30T12:02:00.000Z", eventType: "login", id: "security-1", severity: "info", userId: "user-1" }],
      sessionCount: 2,
      ssoConnections: [
        configuredSsoConnection("google", true, { issuer: "https://accounts.google.com" }),
        configuredSsoConnection("microsoft", true, { issuer: "https://login.microsoftonline.com/common/v2.0" }),
        configuredSsoConnection("oidc", true, { issuer: "https://idp.example.com" }),
        configuredSsoConnection("saml", false),
      ],
      teamWorkspace,
    });

    assert.equal(model.organization.accountType, "enterprise");
    assert.equal(model.permissionMatrix.length, 5);
    assert.equal(model.certificationGates.find((gate) => gate.key === "permissions")?.status, "pass");
    assert.equal(model.certificationGates.find((gate) => gate.key === "enterprise_authentication")?.status, "partial");
    assert.equal(model.overallStatus, "strong_partial");
    assert.doesNotMatch(JSON.stringify(model), /broker statement|compliance certified|guaranteed/i);
  });

  test("refuses readiness when workspace data is unavailable", () => {
    const model = buildEnterpriseReadinessModel({
      organization,
      sessionCount: 0,
      ssoConnections: [],
      teamWorkspace: {
        ...teamWorkspace,
        workspace: { ...teamWorkspace.workspace, id: "" },
      },
    });

    assert.equal(model.overallStatus, "not_ready");
    assert.equal(model.certificationGates.find((gate) => gate.key === "workspace_system")?.status, "fail");
  });
});
