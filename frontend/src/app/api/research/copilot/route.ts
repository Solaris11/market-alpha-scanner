import { NextResponse } from "next/server";
import { ScannerDataAdapter } from "@/lib/adapters/ScannerDataAdapter";
import { getPerformanceData, getRecentIntradaySignalDriftSummary } from "@/lib/scanner-data";
import { requirePremium } from "@/lib/server/access-control";
import { getDecisionMemoryForUser } from "@/lib/server/decision-journal";
import { getMarketMemoryForSignal } from "@/lib/server/market-memory";
import { withRequestMetrics } from "@/lib/server/monitoring";
import { getNarrativeMap } from "@/lib/server/narrative-intelligence";
import { getPersonalizationProfileForUser } from "@/lib/server/personalized-intelligence";
import { rateLimitRequest, requireCsrf, validateMutationRequest } from "@/lib/server/request-security";
import { answerResearchCopilot } from "@/lib/server/research-copilot-llm";
import { getShockMovePatternMap } from "@/lib/server/shock-move-patterns";
import { readUserWatchlist } from "@/lib/server/user-watchlist";
import { getWorkflowEvolutionForUser } from "@/lib/server/workflow-evolution";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import { buildTradeVetoOperatingSystem, type TradeVetoOperatingSystem } from "@/lib/trading/meta-intelligence";
import { buildIntradayRegimeDriftSystem } from "@/lib/trading/intraday-regime-drift";
import { buildOpportunitiesPageModel, type OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import { buildRegimeShiftSystem } from "@/lib/trading/regime-shift-intelligence";
import { buildResearchCopilotContext, normalizeResearchQuestion } from "@/lib/trading/research-copilot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CopilotPayload = {
  history?: unknown;
  question?: unknown;
};

export async function POST(request: Request) {
  return withRequestMetrics(request, "/api/research/copilot", async () => {
    const rateLimited = await rateLimitRequest(request, "research:copilot", { limit: 30, windowMs: 60 * 60 * 1000 });
    if (rateLimited) return rateLimited;

    const invalidOrigin = validateMutationRequest(request);
    if (invalidOrigin) return invalidOrigin;

    const access = await requirePremium();
    if (!access.ok) return access.response;

    const csrf = requireCsrf(request);
    if (csrf) return csrf;

    const payload = (await request.json().catch(() => null)) as CopilotPayload | null;
    const question = normalizeResearchQuestion(payload?.question);
    const conversation = normalizeHistory(payload?.history);

    try {
      const adapter = new ScannerDataAdapter();
      const [snapshot, performance, personalizationProfile, decisionMemory] = await Promise.all([
        adapter.getTerminalSnapshot(),
        getPerformanceData({ forwardTailRows: 5000 }).catch(() => null),
        getPersonalizationProfileForUser(access.user.id).catch(() => null),
        getDecisionMemoryForUser(access.user.id, { limit: 100 }).then((context) => context.memory).catch(() => null),
      ]);

      const symbols = uniqueSymbols(snapshot.signals.map((row) => row.symbol));
      const [shockPatterns, narratives, watchlistSymbols] = await Promise.all([
        getShockMovePatternMap(symbols).catch(() => new Map()),
        getNarrativeMap(symbols).catch(() => new Map()),
        readUserWatchlist(access.user.id).catch(() => []),
      ]);

      const workflowEvolution = await getWorkflowEvolutionForUser(access.user.id, snapshot.signals, {
        surface: "terminal",
        watchlistSymbols,
      }).catch(() => null);
      const intradayDriftRows = await getRecentIntradaySignalDriftSummary({ hours: 8, maxRuns: 18, minRuns: 2 }).catch(() => []);

      const opportunityModel = buildOpportunitiesPageModel(snapshot.signals, performance, shockPatterns, narratives);
      const metaSystem = buildTradeVetoOperatingSystem({
        personalizationProfile,
        rows: opportunityModel.rows,
        workflowEvolution,
      });
      const regimeSystem = buildRegimeShiftSystem({ rows: opportunityModel.rows, workflowEvolution });
      const intradaySystem = buildIntradayRegimeDriftSystem({ driftRows: intradayDriftRows, rows: opportunityModel.rows });
      const marketMemoryBySymbol = await memoryMapForQuestion(question, opportunityModel.rows, metaSystem);
      const context = buildResearchCopilotContext({
        conversation,
        decisionMemory,
        marketMemoryBySymbol,
        metaSystem,
        personalizationProfile,
        question,
        regimeSystem,
        intradaySystem,
        rows: opportunityModel.rows,
        workflowEvolution,
      });
      const answer = await answerResearchCopilot(context);

      return NextResponse.json({
        answer,
        context: {
          generatedAt: context.generatedAt,
          intent: context.intent,
          marketState: context.marketState.currentMarketState,
          referencedSymbols: context.referencedSymbols,
          source: answer.source,
        },
        ok: true,
      });
    } catch {
      return NextResponse.json({ ok: false, message: "Research copilot is unavailable." }, { status: 500 });
    }
  });
}

function normalizeHistory(value: unknown): Array<{ content: string; role: "assistant" | "user" }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
      const content = String(record.content ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
      return role && content ? { content, role } : null;
    })
    .filter((item): item is { content: string; role: "assistant" | "user" } => item !== null)
    .slice(-6);
}

async function memoryMapForQuestion(
  question: string,
  rows: OpportunityViewModel[],
  metaSystem: TradeVetoOperatingSystem,
): Promise<Map<string, MarketMemorySummary>> {
  const bySymbol = new Map(rows.map((row) => [row.symbol.toUpperCase(), row]));
  const symbols = symbolsForMemory(question, rows, metaSystem);
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      const row = bySymbol.get(symbol);
      if (!row) return null;
      const memory = await getMarketMemoryForSignal(row.raw).catch(() => null);
      return memory ? ([symbol, memory] as const) : null;
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, MarketMemorySummary] => entry !== null));
}

function symbolsForMemory(question: string, rows: OpportunityViewModel[], metaSystem: TradeVetoOperatingSystem): string[] {
  const available = uniqueSymbols(rows.map((row) => row.symbol));
  const mentioned = symbolsMentionedInQuestion(question, available);
  if (mentioned.length) return mentioned.slice(0, 4);
  const priority = uniqueSymbols(metaSystem.priorityQueue.map((item) => item.symbol));
  return priority.slice(0, 4);
}

function symbolsMentionedInQuestion(question: string, availableSymbols: string[]): string[] {
  const upper = question.toUpperCase();
  return availableSymbols
    .filter((symbol) => new RegExp(`(^|[^A-Z0-9.])${escapeRegExp(symbol)}([^A-Z0-9.]|$)`).test(upper))
    .slice(0, 8);
}

function uniqueSymbols(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim().toUpperCase()).filter(Boolean)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
