import { NextResponse } from "next/server";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData } from "@/lib/scanner-data";
import { analyzeRiskTolerantOpportunity } from "@/lib/server/opportunity-llm";
import { getEntitlement, hasPremiumAccess } from "@/lib/server/entitlements";
import { getMarketMemoryForSignal } from "@/lib/server/market-memory";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { rateLimitRequest } from "@/lib/server/request-security";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { buildPersonalizedOpportunities } from "@/lib/trading/personalized-intelligence";
import { buildOpportunitiesPageModel } from "@/lib/trading/opportunity-view-model";
import {
  buildRiskTolerantOpportunityPacket,
  riskRewardProfile,
  type RewardLevel,
  type RiskLevel,
} from "@/lib/trading/risk-tolerant-opportunities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RISK_LEVELS = new Set<RiskLevel>(["low", "medium", "high"]);
const REWARD_LEVELS = new Set<RewardLevel>(["low", "medium", "high"]);

export async function GET(request: Request) {
  return withRequestMetrics(request, "/api/opportunities/risk-tolerant-analysis", async () => {
    const rateLimited = await rateLimitRequest(request, "opportunity:llm-analysis", { limit: 20, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const entitlement = await getEntitlement();
    if (!hasPremiumAccess(entitlement)) {
      return NextResponse.json({ ok: false, error: "premium_required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const riskLevel = parseRiskLevel(url.searchParams.get("risk"));
    const rewardLevel = parseRewardLevel(url.searchParams.get("reward"));
    const requestedSymbol = cleanSymbol(url.searchParams.get("symbol"));
    const preference = { riskLevel, rewardLevel };
    const profile = riskRewardProfile(preference);
    const userProfile = await getPersonalizationProfileForUser(entitlement.user?.id ?? null);
    const activePersonalization = {
      ...userProfile,
      preferredRewardLevel: rewardLevel,
      preferredRiskLevel: riskLevel,
    };

    const adapter = new ScannerDataAdapter();
    const [rows, performance] = await Promise.all([
      adapter.getOverviewSignals(),
      getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
    ]);
    const shockPatterns = await getShockMovePatternMap(rows.map((row) => row.symbol)).catch(() => new Map());
    const model = buildOpportunitiesPageModel(rows, performance, shockPatterns);
    const personalized = buildPersonalizedOpportunities(model.rows, activePersonalization, { includeProfileMismatches: true, limit: 25 });
    const candidates = personalized.map((item) => item.candidate);
    const selected = requestedSymbol
      ? candidates.find((candidate) => candidate.symbol === requestedSymbol)
      : candidates.find((candidate) => candidate.profileMatched) ?? candidates[0];
    if (!selected) {
      return NextResponse.json({
        ok: false,
        error: "no_candidate",
        message: "No risk-tolerant candidate is available for the selected profile.",
      }, { status: 404 });
    }

    const memory = await getMarketMemoryForSignal(selected.row.raw).catch(() => null);
    const packet = buildRiskTolerantOpportunityPacket(selected, profile, memory, {
      behaviorSummary: {
        repeatedSymbolViews: userProfile.behavior.repeatedSymbolViews,
        topSymbols: userProfile.behavior.topSymbols,
        watchlistCount: userProfile.behavior.watchlistCount,
      },
      drawdownTolerance: activePersonalization.drawdownTolerance,
      label: activePersonalization.label,
      personality: activePersonalization.personality,
      personalityConfidence: activePersonalization.personalityConfidence,
      preferredRewardLevel: activePersonalization.preferredRewardLevel,
      preferredRiskLevel: activePersonalization.preferredRiskLevel,
      volatilityTolerance: activePersonalization.volatilityTolerance,
    });
    const analysis = await analyzeRiskTolerantOpportunity(packet);
    return NextResponse.json({
      ok: true,
      analysis,
      candidate: {
        opportunityType: selected.opportunityType,
        profileMatched: selected.profileMatched,
        rank: selected.riskTolerantRank,
        symbol: selected.symbol,
      },
      packet,
    });
  });
}

function parseRiskLevel(value: string | null): RiskLevel {
  const normalized = String(value ?? "high").trim().toLowerCase();
  return RISK_LEVELS.has(normalized as RiskLevel) ? normalized as RiskLevel : "high";
}

function parseRewardLevel(value: string | null): RewardLevel {
  const normalized = String(value ?? "high").trim().toLowerCase();
  return REWARD_LEVELS.has(normalized as RewardLevel) ? normalized as RewardLevel : "high";
}

function cleanSymbol(value: string | null): string | null {
  const symbol = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9.-]{1,12}$/.test(symbol) ? symbol : null;
}
