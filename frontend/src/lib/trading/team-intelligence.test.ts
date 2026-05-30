import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DataFreshness } from "@/lib/data-health";
import type { RankingRow } from "@/lib/types";
import { buildTeamWorkspaceIntelligence, teamRoleCapabilities, type TeamWorkspace, type TeamWorkspaceMember, type TeamWorkspaceWatchSymbol } from "./team-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";

const freshness: DataFreshness = {
  ageMinutes: 2,
  humanAge: "Updated 2 min ago",
  label: "Fresh",
  lastUpdated: "2026-05-09T15:00:00.000Z",
  message: "Fresh - updated 2 min ago",
  status: "fresh",
};

const workspace: TeamWorkspace = {
  createdAt: "2026-05-09T15:00:00.000Z",
  description: "Shared research workspace.",
  id: "workspace-1",
  name: "Team Workspace",
  ownerUserId: "user-1",
  slug: "team-workspace",
  updatedAt: "2026-05-09T15:00:00.000Z",
};

const members: TeamWorkspaceMember[] = [
  { createdAt: "2026-05-09T15:00:00.000Z", displayName: "Owner", email: "owner@example.com", role: "owner", userId: "user-1" },
  { createdAt: "2026-05-09T15:01:00.000Z", displayName: "Manager", email: "manager@example.com", role: "manager", userId: "user-2" },
];

function row(input: Partial<OpportunityViewModel> & { symbol: string }): OpportunityViewModel {
  const raw: RankingRow = {
    final_decision: input.final_decision ?? "WAIT",
    final_score: input.final_score ?? 55,
    macro_alignment_score: 55,
    price: 100,
    symbol: input.symbol,
    volatility_pressure: input.fragility ?? 50,
  };
  return {
    assetType: "equity",
    company_name: input.company_name ?? `${input.symbol} Inc.`,
    confidenceLabel: "Medium",
    conviction: input.conviction ?? 55,
    dataFreshness: freshness,
    decayLabel: "Stable",
    decision_reason: input.decision_reason ?? "Historically similar setups produced improving opportunity quality.",
    entryStatus: "research",
    entryZoneLabel: input.entryZoneLabel ?? "$95-$100",
    eventLabel: input.eventLabel ?? "No verified event catalyst",
    eventRisk: input.eventRisk ?? 35,
    evidence: input.evidence,
    final_decision: input.final_decision ?? "WAIT",
    final_score: input.final_score ?? 55,
    fragility: input.fragility ?? 50,
    fragilityLabel: input.fragilityLabel ?? "Moderate",
    macroAdjustment: 0,
    macroLabel: input.macroLabel ?? "Macro Mixed",
    narrative: null,
    price: 100,
    raw,
    recommendationQuality: "developing",
    recommendationQualityLabel: "Developing",
    sector: input.sector ?? "Technology",
    shockPattern: input.shockPattern ?? null,
    stop_loss: 90,
    structuralLabel: "Improving structure",
    suggested_entry: 98,
    symbol: input.symbol,
    target: 115,
  };
}

describe("team intelligence", () => {
  test("maps workspace roles to edit capabilities", () => {
    assert.equal(teamRoleCapabilities("owner").canAdmin, true);
    assert.equal(teamRoleCapabilities("manager").canManageWatchlist, true);
    assert.equal(teamRoleCapabilities("member").canEditResearch, true);
    assert.equal(teamRoleCapabilities("member").canManageWatchlist, false);
    assert.equal(teamRoleCapabilities("viewer").canManageWatchlist, false);
  });

  test("prioritizes shared watchlist symbols without inventing forbidden advice", () => {
    const sharedWatchlist: TeamWorkspaceWatchSymbol[] = [
      { addedByUserId: "user-1", createdAt: "2026-05-09T15:00:00.000Z", note: null, symbol: "AMD" },
      { addedByUserId: "user-1", createdAt: "2026-05-09T15:00:00.000Z", note: null, symbol: "MU" },
    ];
    const system = buildTeamWorkspaceIntelligence({
      auditTrail: [],
      members,
      notes: [],
      role: "manager",
      rows: [
        row({ conviction: 73, final_score: 78, fragility: 54, macroLabel: "Macro Aligned", symbol: "AMD" }),
        row({ conviction: 60, final_score: 64, fragility: 70, fragilityLabel: "Elevated", symbol: "MU" }),
        row({ conviction: 92, final_score: 91, fragility: 40, symbol: "SPY" }),
      ],
      sharedWatchlist,
      workspace,
    });

    assert.equal(system.topSharedOpportunities[0]?.symbol, "AMD");
    assert.equal(system.topSharedOpportunities.some((item) => item.symbol === "SPY"), false);
    assert.ok(system.watchlistRisks.some((item) => item.symbol === "MU"));
    assert.doesNotMatch(JSON.stringify(system), /buy now|sell now|guaranteed|sure profit/i);
  });
});
