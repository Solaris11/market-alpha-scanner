import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { IntelligenceEcosystemSystem, EcosystemTone } from "./intelligence-ecosystem";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { WorkspacePreferences } from "./workspace-preferences";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type SuperplatformTone = EcosystemTone;

export type InstitutionalWorkspaceId =
  | "ai_momentum"
  | "custom_intelligence"
  | "earnings"
  | "long_term_investment"
  | "macro"
  | "risk_monitoring"
  | "swing_trading"
  | "watchlist_operations";

export type InstitutionalWorkspaceModel = {
  chartFocus: string[];
  compareViews: string[];
  filters: string[];
  headline: string;
  id: InstitutionalWorkspaceId;
  intelligenceModules: string[];
  layout: string;
  overlays: string[];
  preferredTimeframes: string[];
  preservedContext: string[];
  primaryHref: string;
  riskSetting: string;
  score: number | null;
  summary: string;
  symbols: string[];
  title: string;
  tone: SuperplatformTone;
  values: number[];
};

export type PersistentMarketContext = {
  breadthScore: number | null;
  confidenceScore: number | null;
  label: string;
  liquidityScore: number | null;
  macroPressureScore: number | null;
  regimeScore: number | null;
  replayEnvironmentScore: number | null;
  riskAppetiteScore: number | null;
  summary: string;
  tone: SuperplatformTone;
  updatedAt: string | null;
  values: Array<number | null>;
  volatilityScore: number | null;
};

export type IntelligenceMapNode = {
  detail: string;
  id: string;
  score: number | null;
  symbols: string[];
  title: string;
  tone: SuperplatformTone;
  values: number[];
};

export type IntelligenceMapLink = {
  detail: string;
  from: InstitutionalWorkspaceId | "market";
  id: string;
  strength: number | null;
  title: string;
  to: InstitutionalWorkspaceId | "market";
  tone: SuperplatformTone;
};

export type IntelligenceTimelineTrack = {
  detail: string;
  id: string;
  points: number[];
  title: string;
  tone: SuperplatformTone;
};

export type ResearchWorkflowPrompt = {
  detail: string;
  id: string;
  query: string;
  tone: SuperplatformTone;
};

export type CrossWorkspaceCognition = {
  detail: string;
  id: string;
  score: number | null;
  title: string;
  tone: SuperplatformTone;
  workspaces: InstitutionalWorkspaceId[];
};

export type InstitutionalSuperplatformSystem = {
  activeWorkspaceId: InstitutionalWorkspaceId;
  advancedResearch: ResearchWorkflowPrompt[];
  context: PersistentMarketContext;
  crossWorkspaceCognition: CrossWorkspaceCognition[];
  generatedAt: string | null;
  guardrail: string;
  headline: string;
  intelligenceMapLinks: IntelligenceMapLink[];
  intelligenceMapNodes: IntelligenceMapNode[];
  memoryPersistence: ResearchWorkflowPrompt[];
  operatingScore: number;
  operatingState: string;
  summary: string;
  timeline: IntelligenceTimelineTrack[];
  tone: SuperplatformTone;
  workspaces: InstitutionalWorkspaceModel[];
};

export type BuildInstitutionalSuperplatformInput = {
  ecosystem?: IntelligenceEcosystemSystem | null;
  feedItems?: IntelligenceFeedItem[];
  generatedAt?: string | null;
  marketCondition?: string | null;
  personalizationProfile?: UserPersonalizationProfile | null;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  rows: OpportunityViewModel[];
  scanUpdatedAt?: string | null;
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  workspacePreferences?: WorkspacePreferences | null;
};

type SuperplatformMetrics = {
  averageConfidence: number;
  averageEvidence: number;
  averageFragility: number;
  averageMacro: number;
  averageScore: number;
  averageShock: number;
  breadthScore: number | null;
  liquidityScore: number | null;
  memoryScore: number;
  volatilityScore: number | null;
  watchlistHits: number;
};

export function buildInstitutionalSuperplatformSystem(input: BuildInstitutionalSuperplatformInput): InstitutionalSuperplatformSystem {
  const metrics = computeMetrics(input.rows, input.watchlistSymbols ?? []);
  const context = buildPersistentContext(input, metrics);
  const workspaces = buildWorkspaces(input, metrics);
  const activeWorkspaceId = preferredWorkspaceId(input.workspacePreferences, workspaces);
  const intelligenceMapNodes = buildMapNodes(input, metrics);
  const intelligenceMapLinks = buildMapLinks(input, metrics, workspaces);
  const timeline = buildTimeline(input, metrics);
  const crossWorkspaceCognition = buildCrossWorkspaceCognition(input, metrics);
  const advancedResearch = buildAdvancedResearchPrompts(input, metrics);
  const memoryPersistence = buildMemoryPersistence(input, metrics);
  const operatingScore = Math.round(clamp(average([
    input.ecosystem?.attentionScore ?? null,
    metrics.averageConfidence,
    metrics.averageEvidence,
    100 - metrics.averageFragility,
    metrics.averageMacro,
    metrics.memoryScore,
    metrics.watchlistHits ? 66 : null,
  ], 52)));
  const state = operatingState(operatingScore, metrics);

  return {
    activeWorkspaceId,
    advancedResearch,
    context,
    crossWorkspaceCognition,
    generatedAt: input.generatedAt ?? input.scanUpdatedAt ?? null,
    guardrail:
      "The superplatform layer links existing TradeVeto scanner rows, market context, workflow memory, watchlist data, feed events, and paper portfolio context where available. It does not create broker execution instructions or fabricate unavailable relationships.",
    headline: state.headline,
    intelligenceMapLinks,
    intelligenceMapNodes,
    memoryPersistence,
    operatingScore,
    operatingState: state.label,
    summary: state.summary,
    timeline,
    tone: state.tone,
    workspaces,
  };
}

function computeMetrics(rows: OpportunityViewModel[], watchlistSymbols: string[]): SuperplatformMetrics {
  const watchlist = new Set(watchlistSymbols.map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  return {
    averageConfidence: average(rows.map((row) => row.conviction), 50),
    averageEvidence: average(rows.map((row) => row.evidence?.score ?? null), 25),
    averageFragility: average(rows.map((row) => row.fragility), 50),
    averageMacro: average(rows.map((row) => macroScore(row)), 50),
    averageScore: average(rows.map((row) => row.final_score), 50),
    averageShock: average(rows.map((row) => shockScore(row)), 45),
    breadthScore: metricFromRows(rows, ["market_breadth_score", "breadth_score", "breadth", "market_breadth"]),
    liquidityScore: metricFromRows(rows, ["liquidity_score", "liquidity_conditions_score", "liquidity"]),
    memoryScore: average(rows.map(memoryScore), 20),
    volatilityScore: metricFromRows(rows, ["volatility_score", "unstable_volatility", "vix_score", "vix"]),
    watchlistHits: rows.filter((row) => watchlist.has(row.symbol)).length,
  };
}

function buildPersistentContext(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): PersistentMarketContext {
  const riskAppetiteScore = clamp(100 - average([metrics.averageFragility, metrics.averageShock], 50));
  const volatilityPressure = metrics.volatilityScore ?? metrics.averageShock;
  const liquidityScore = metrics.liquidityScore;
  const breadthScore = metrics.breadthScore;
  const regimeScore = clamp(average([metrics.averageMacro, riskAppetiteScore, breadthScore], metrics.averageMacro));
  const label = input.marketCondition ? humanizeLabel(input.marketCondition) : "Latest market packet";
  const tone = metrics.averageFragility >= 68 || metrics.averageShock >= 70 ? "rose" : metrics.averageMacro >= 60 && riskAppetiteScore >= 56 ? "emerald" : "cyan";
  return {
    breadthScore,
    confidenceScore: Math.round(metrics.averageConfidence),
    label,
    liquidityScore,
    macroPressureScore: Math.round(metrics.averageMacro),
    regimeScore: Math.round(regimeScore),
    replayEnvironmentScore: Math.round(metrics.memoryScore),
    riskAppetiteScore: Math.round(riskAppetiteScore),
    summary: `${label} remains visible across the operating environment. Macro alignment averages ${Math.round(metrics.averageMacro)}/100, confidence ${Math.round(metrics.averageConfidence)}/100, fragility ${Math.round(metrics.averageFragility)}/100, and replay/memory context ${Math.round(metrics.memoryScore)}/100.`,
    tone,
    updatedAt: input.scanUpdatedAt ?? input.generatedAt ?? null,
    values: [regimeScore, volatilityPressure, metrics.averageMacro, metrics.averageConfidence, breadthScore, liquidityScore, riskAppetiteScore, metrics.memoryScore],
    volatilityScore: metrics.volatilityScore,
  };
}

function buildWorkspaces(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): InstitutionalWorkspaceModel[] {
  const rows = input.rows;
  const preferences = input.workspacePreferences;
  const timeframes = preferences?.preferredTimeframes.length ? preferences.preferredTimeframes : ["1M", "6M"];
  const preferredModules = preferences?.favoriteModules.length ? preferences.favoriteModules.map((moduleId) => humanizeLabel(moduleId)) : ["What Matters Now", "Watchlist", "Best Setups"];
  const watchlist = new Set((input.watchlistSymbols ?? []).map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  const macroRows = topRows(rows, (row) => 100 - macroScore(row) + row.fragility * 0.3, 6);
  const aiRows = topRows(rows.filter(isAiMomentumRow), (row) => (row.final_score ?? 0) + row.conviction - row.fragility * 0.15, 6);
  const swingRows = topRows(rows, (row) => (row.final_score ?? 0) + row.conviction + macroScore(row) - row.fragility, 6);
  const earningsRows = topRows(rows.filter((row) => row.eventRisk >= 45 || /earnings|event|catalyst/i.test(row.eventLabel)), (row) => row.eventRisk + shockScore(row), 6);
  const riskRows = topRows(rows, (row) => Math.max(row.fragility, row.eventRisk, shockScore(row)), 6);
  const watchedRows = topRows(rows.filter((row) => watchlist.has(row.symbol)), (row) => Math.max(row.fragility, row.conviction, row.final_score ?? 0), 6);
  const investorRows = topRows(rows, (row) => macroScore(row) + (row.evidence?.score ?? 0) + (row.final_score ?? 0) - row.fragility, 6);
  const customRows = topRows(rows.filter((row) => preferences?.favoriteSymbols.includes(row.symbol) || watchlist.has(row.symbol)), (row) => (row.final_score ?? 0) + row.conviction, 6);

  return [
    workspace({
      chartFocus: ["SPY", "QQQ", "TLT", "UUP"],
      compareViews: ["macro pressure", "risk appetite", "breadth"],
      filters: ["macro deterioration", "risk pressure", "liquidity"],
      id: "macro",
      modules: ["Macro", "Market State", "Risk", "Feed"],
      overlays: ["macro regime", "volatility", "breadth", "liquidity"],
      rows: macroRows,
      score: metrics.averageMacro,
      summary: `Macro workspace tracks regime, volatility, liquidity, and breadth pressure. ${macroRows.length ? `${macroRows[0]?.symbol ?? "Top symbol"} is the current macro-sensitive reference.` : "Macro-sensitive rows are limited."}`,
      title: "Macro Workspace",
      tone: metrics.averageMacro <= 42 ? "rose" : metrics.averageMacro >= 60 ? "emerald" : "amber",
    }, timeframes),
    workspace({
      chartFocus: ["QQQ", "SMH", "SOXX", "NVDA"],
      compareViews: ["AI momentum", "semiconductor pressure", "growth risk"],
      filters: ["technology", "semiconductors", "momentum quality"],
      id: "ai_momentum",
      modules: ["Opportunities", "Replay", "Macro", "Shock"],
      overlays: ["confidence evolution", "sector cluster", "replay analogs"],
      rows: aiRows,
      score: aiRows.length ? average(aiRows.map((row) => row.final_score), 55) : null,
      summary: aiRows.length
        ? `${aiRows.length} AI/growth-adjacent rows are visible. The workspace links momentum quality with macro and fragility context.`
        : "AI/growth workspace is available, but no validated AI momentum cluster is visible in the current scanner packet.",
      title: "AI Momentum Workspace",
      tone: aiRows.some((row) => row.fragility >= 70) ? "amber" : aiRows.length ? "emerald" : "cyan",
    }, timeframes),
    workspace({
      chartFocus: swingRows.slice(0, 3).map((row) => row.symbol),
      compareViews: ["entry quality", "setup freshness", "risk/reward"],
      filters: ["fresh setups", "high confidence", "lower fragility"],
      id: "swing_trading",
      modules: ["Best Setups", "Charts", "Alerts", "Replay"],
      overlays: ["entry zone", "stop/invalidation", "target context"],
      rows: swingRows,
      score: swingRows.length ? average(swingRows.map((row) => row.final_score), 50) : null,
      summary: `${swingRows.length} rows are ranked for swing-research context using score, confidence, macro alignment, and fragility.`,
      title: "Swing Trading Workspace",
      tone: swingRows.length && average(swingRows.map((row) => row.fragility), 50) < 50 ? "emerald" : "cyan",
    }, timeframes),
    workspace({
      chartFocus: earningsRows.slice(0, 4).map((row) => row.symbol),
      compareViews: ["event pressure", "shock context", "post-event drift"],
      filters: ["event risk", "verified catalysts", "shock risk"],
      id: "earnings",
      modules: ["Events", "Shock", "Alerts", "Feed"],
      overlays: ["event markers", "shock zones", "confidence shifts"],
      rows: earningsRows,
      score: earningsRows.length ? average(earningsRows.map((row) => row.eventRisk), 50) : null,
      summary: earningsRows.length
        ? `${earningsRows.length} event-sensitive rows are visible. The workspace prioritizes risk explanation and alert context.`
        : "No validated earnings/event workspace cluster is elevated in the current packet.",
      title: "Earnings Workspace",
      tone: earningsRows.some((row) => row.eventRisk >= 70) ? "rose" : earningsRows.length ? "amber" : "cyan",
    }, timeframes),
    workspace({
      chartFocus: riskRows.slice(0, 4).map((row) => row.symbol),
      compareViews: ["fragility", "shock pressure", "macro headwinds"],
      filters: ["dangerous now", "fragility rising", "shock watch"],
      id: "risk_monitoring",
      modules: ["Dangerous", "Shock Watch", "Alerts", "Macro"],
      overlays: ["risk escalation", "volatility expansion", "breadth deterioration"],
      rows: riskRows,
      score: average([metrics.averageFragility, metrics.averageShock], 50),
      summary: `${riskRows.length} rows are prioritized by fragility, event risk, and shock pressure. This is monitoring context, not a trade instruction.`,
      title: "Risk Monitoring Workspace",
      tone: metrics.averageFragility >= 66 || metrics.averageShock >= 70 ? "rose" : "amber",
    }, timeframes),
    workspace({
      chartFocus: watchedRows.slice(0, 5).map((row) => row.symbol),
      compareViews: ["watchlist changes", "tracked risk", "alert readiness"],
      filters: ["watchlist only", "risk escalation", "score movement"],
      id: "watchlist_operations",
      modules: ["Watchlist", "Alerts", "Feed", "Copilot"],
      overlays: ["watchlist changes", "alert triggers", "freshness decay"],
      rows: watchedRows,
      score: watchedRows.length ? average(watchedRows.map((row) => Math.max(row.conviction, row.final_score ?? 0)), 50) : null,
      summary: watchedRows.length
        ? `${watchedRows.length} tracked symbols are active in the scanner context. Watchlist operations links alerts, feed, and symbol detail.`
        : "Watchlist operations is ready, but no tracked symbol appears in the current scanner packet.",
      title: "Watchlist Operations Workspace",
      tone: watchedRows.some((row) => row.fragility >= 68 || row.eventRisk >= 70) ? "amber" : watchedRows.length ? "emerald" : "cyan",
    }, timeframes),
    workspace({
      chartFocus: investorRows.slice(0, 5).map((row) => row.symbol),
      compareViews: ["macro support", "evidence quality", "fragility"],
      filters: ["evidence quality", "macro aligned", "lower fragility"],
      id: "long_term_investment",
      modules: ["Macro", "Market Memory", "Performance", "Watchlist"],
      overlays: ["regime history", "memory similarity", "drawdown context"],
      rows: investorRows,
      score: investorRows.length ? average(investorRows.map((row) => row.evidence?.score ?? null), 35) : null,
      summary: `${investorRows.length} rows are ranked for longer-horizon research using evidence quality, macro context, and lower fragility.`,
      title: "Long-Term Investment Workspace",
      tone: "violet",
    }, timeframes),
    workspace({
      chartFocus: customRows.slice(0, 5).map((row) => row.symbol),
      compareViews: preferredModules,
      filters: preferences?.favoriteSymbols.length ? preferences.favoriteSymbols : ["favorite symbols", "pinned modules"],
      id: "custom_intelligence",
      modules: preferredModules,
      overlays: ["preferred timeframe", "pinned cards", "risk style"],
      rows: customRows,
      score: customRows.length ? average(customRows.map((row) => row.final_score), 50) : null,
      summary: preferences
        ? `Custom intelligence reflects ${humanizeLabel(preferences.workspaceMode)} mode, ${preferences.preferredRiskStyle} risk style, and ${preferredModules.length} preferred modules.`
        : "Custom intelligence is using default workspace preferences until the user saves a workspace.",
      title: "Custom Intelligence Workspace",
      tone: "cyan",
    }, timeframes, preferences?.preferredRiskStyle ?? "balanced"),
  ];
}

function workspace(
  value: {
    chartFocus: string[];
    compareViews: string[];
    filters: string[];
    id: InstitutionalWorkspaceId;
    modules: string[];
    overlays: string[];
    rows: OpportunityViewModel[];
    score: number | null;
    summary: string;
    title: string;
    tone: SuperplatformTone;
  },
  timeframes: readonly string[],
  riskStyle = "system",
): InstitutionalWorkspaceModel {
  const symbols = value.rows.map((row) => row.symbol).slice(0, 6);
  return {
    chartFocus: value.chartFocus.length ? dedupeStrings(value.chartFocus).slice(0, 6) : symbols,
    compareViews: dedupeStrings(value.compareViews).slice(0, 5),
    filters: dedupeStrings(value.filters).slice(0, 5),
    headline: value.rows.length ? `${value.rows[0]?.symbol ?? value.title} anchors this workspace` : "Workspace is waiting for validated context",
    id: value.id,
    intelligenceModules: dedupeStrings(value.modules).slice(0, 6),
    layout: value.id === "risk_monitoring" || value.id === "macro" ? "command grid" : value.id === "watchlist_operations" ? "operations board" : "research cockpit",
    overlays: dedupeStrings(value.overlays).slice(0, 6),
    preferredTimeframes: dedupeStrings([...timeframes]).slice(0, 4),
    preservedContext: [
      `${value.rows.length} linked scanner rows`,
      `${symbols.length ? symbols.join(", ") : "No active symbols"}`,
      `${value.overlays.length} overlay families`,
      `${value.modules.length} modules`,
    ],
    primaryHref: workspaceHref(value.id, symbols[0]),
    riskSetting: riskStyle,
    score: value.score === null ? null : Math.round(clamp(value.score)),
    summary: value.summary,
    symbols,
    title: value.title,
    tone: value.tone,
    values: value.rows.length
      ? value.rows.slice(0, 8).map((row) => row.final_score ?? row.conviction ?? 0)
      : [],
  };
}

function buildMapNodes(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): IntelligenceMapNode[] {
  const sectorNodes = [...groupRows(input.rows, (row) => cleanText(row.sector, "Unknown")).entries()]
    .map(([sector, rows]) => ({
      detail: `${sector} contains ${rows.length} visible symbols with average confidence ${Math.round(average(rows.map((row) => row.conviction), 50))}/100 and fragility ${Math.round(average(rows.map((row) => row.fragility), 50))}/100.`,
      id: `sector-${sector}`,
      score: Math.round(average(rows.map((row) => row.final_score), 50)),
      symbols: rows.slice(0, 5).map((row) => row.symbol),
      title: sector,
      tone: average(rows.map((row) => row.fragility), 50) >= 66 ? "rose" as const : average(rows.map((row) => row.final_score), 50) >= 60 ? "emerald" as const : "cyan" as const,
      values: rows.slice(0, 8).map((row) => row.final_score ?? row.conviction),
    }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, 5);
  const globalNode: IntelligenceMapNode = {
    detail: `Global market context links macro ${Math.round(metrics.averageMacro)}/100, fragility ${Math.round(metrics.averageFragility)}/100, and replay/memory ${Math.round(metrics.memoryScore)}/100.`,
    id: "global-market-context",
    score: Math.round(average([metrics.averageMacro, 100 - metrics.averageFragility, metrics.memoryScore], 50)),
    symbols: [],
    title: "Global Market Context",
    tone: metrics.averageFragility >= 66 ? "rose" : "violet",
    values: [metrics.averageMacro, metrics.averageFragility, metrics.memoryScore, metrics.averageConfidence],
  };
  return [globalNode, ...sectorNodes];
}

function buildMapLinks(
  input: BuildInstitutionalSuperplatformInput,
  metrics: SuperplatformMetrics,
  workspaces: InstitutionalWorkspaceModel[],
): IntelligenceMapLink[] {
  const links: IntelligenceMapLink[] = [{
    detail: `Market context influences all workspaces through regime, volatility, macro pressure, and risk appetite.`,
    from: "market",
    id: "market-to-macro",
    strength: Math.round(metrics.averageMacro),
    title: "Market context drives macro workspace",
    to: "macro",
    tone: metrics.averageMacro >= 60 ? "emerald" : metrics.averageMacro <= 42 ? "rose" : "amber",
  }];
  const riskWorkspace = workspaces.find((workspaceItem) => workspaceItem.id === "risk_monitoring");
  if (riskWorkspace) {
    links.push({
      detail: `Risk monitoring receives fragility ${Math.round(metrics.averageFragility)}/100 and shock pressure ${Math.round(metrics.averageShock)}/100 from the visible scanner universe.`,
      from: "market",
      id: "market-to-risk",
      strength: Math.round(Math.max(metrics.averageFragility, metrics.averageShock)),
      title: "Risk pressure links into operations",
      to: "risk_monitoring",
      tone: Math.max(metrics.averageFragility, metrics.averageShock) >= 68 ? "rose" : "amber",
    });
  }
  if ((input.watchlistSymbols ?? []).length) {
    links.push({
      detail: `${metrics.watchlistHits} tracked symbols are currently connected to scanner context.`,
      from: "watchlist_operations",
      id: "watchlist-to-risk",
      strength: metrics.watchlistHits ? Math.min(100, metrics.watchlistHits * 18) : null,
      title: "Watchlist operations shares risk context",
      to: "risk_monitoring",
      tone: metrics.watchlistHits ? "cyan" : "amber",
    });
  }
  if (metrics.memoryScore >= 35) {
    links.push({
      detail: `Replay and memory context is ${Math.round(metrics.memoryScore)}/100 and can inform swing, macro, and long-term research workspaces.`,
      from: "long_term_investment",
      id: "memory-to-swing",
      strength: Math.round(metrics.memoryScore),
      title: "Market memory informs research workspaces",
      to: "swing_trading",
      tone: metrics.memoryScore >= 58 ? "violet" : "cyan",
    });
  }
  return links;
}

function buildTimeline(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): IntelligenceTimelineTrack[] {
  const changes = [
    ...(input.workflowEvolution?.whatChanged ?? []),
    ...(input.workflowEvolution?.watchlistEvolution ?? []),
    ...(input.workflowEvolution?.improvingSetups ?? []),
    ...(input.workflowEvolution?.deterioratingSetups ?? []),
  ].slice(0, 6);
  const changeValues = changes.map((change) => metricValue(change.metricLabel)).filter((value): value is number => value !== null);
  return [
    {
      detail: changes.length
        ? `${changes.length} workflow changes are linked into the operating timeline.`
        : "Workflow timeline is building its first baseline. Future sessions will show persistent change history.",
      id: "timeline-workflow",
      points: changeValues.length ? normalizeSeries(changeValues) : [48, Math.round(metrics.averageConfidence), Math.round(metrics.averageScore)],
      title: "Workflow evolution",
      tone: changes.some((change) => change.severity === "warning") ? "amber" : changes.some((change) => change.severity === "positive") ? "emerald" : "cyan",
    },
    {
      detail: `Risk timeline uses fragility, shock pressure, and volatility context from the current scanner packet.`,
      id: "timeline-risk",
      points: normalizeSeries([metrics.averageFragility, metrics.averageShock, metrics.volatilityScore ?? metrics.averageShock]),
      title: "Risk pressure",
      tone: metrics.averageFragility >= 66 || metrics.averageShock >= 70 ? "rose" : "amber",
    },
    {
      detail: `Macro and memory timeline connects macro support, breadth/liquidity where available, and historical analog context.`,
      id: "timeline-macro-memory",
      points: normalizeSeries([metrics.averageMacro, metrics.breadthScore, metrics.liquidityScore, metrics.memoryScore]),
      title: "Macro and memory",
      tone: metrics.memoryScore >= 55 ? "violet" : "cyan",
    },
  ];
}

function buildCrossWorkspaceCognition(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): CrossWorkspaceCognition[] {
  const output: CrossWorkspaceCognition[] = [];
  const aiRows = input.rows.filter(isAiMomentumRow);
  const fragileAiRows = aiRows.filter((row) => row.fragility >= 64 || macroScore(row) <= 42);
  if (aiRows.length && fragileAiRows.length) {
    output.push({
      detail: `${fragileAiRows.length} AI/growth-adjacent rows carry macro or fragility pressure. AI Momentum and Risk Monitoring are no longer independent contexts.`,
      id: "ai-risk-divergence",
      score: Math.round(average(fragileAiRows.map((row) => Math.max(row.fragility, 100 - macroScore(row))), 60)),
      title: "AI momentum and risk monitoring are interacting",
      tone: "amber",
      workspaces: ["ai_momentum", "risk_monitoring"],
    });
  }
  if ((input.watchlistSymbols ?? []).length && metrics.watchlistHits > 0) {
    output.push({
      detail: `${metrics.watchlistHits} tracked symbols are active in scanner context. Watchlist Operations now shares context with Alerts, Feed, and Symbol Detail.`,
      id: "watchlist-operating-context",
      score: Math.min(100, metrics.watchlistHits * 18 + 40),
      title: "Watchlist state follows the user across the environment",
      tone: "cyan",
      workspaces: ["watchlist_operations", "risk_monitoring"],
    });
  }
  if (metrics.averageMacro <= 44 && metrics.averageScore >= 55) {
    output.push({
      detail: `Setup quality is visible while macro support is weak. The platform surfaces this contradiction across Macro, Swing, and Risk workspaces.`,
      id: "macro-setup-contradiction",
      score: Math.round(Math.max(100 - metrics.averageMacro, metrics.averageScore)),
      title: "Macro workspace and setup workspace are diverging",
      tone: "rose",
      workspaces: ["macro", "swing_trading", "risk_monitoring"],
    });
  }
  if (!output.length) {
    output.push({
      detail: "Cross-workspace cognition is available, but no validated divergence or overlap dominates the current packet.",
      id: "cross-workspace-limited",
      score: null,
      title: "Workspace relationships are calm",
      tone: "cyan",
      workspaces: ["macro", "watchlist_operations"],
    });
  }
  return output;
}

function buildAdvancedResearchPrompts(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): ResearchWorkflowPrompt[] {
  const topSector = topSectorName(input.rows);
  return [
    {
      detail: "Links current regime, breadth, volatility, and replay/memory evidence before elevating analog confidence.",
      id: "research-analogs-breadth",
      query: "Show historical replay analogs with deteriorating breadth.",
      tone: metrics.breadthScore !== null && metrics.breadthScore <= 42 ? "rose" : "violet",
    },
    {
      detail: topSector ? `Uses ${topSector} rows, macro alignment, fragility, and shock context from the current scanner packet.` : "Requires a visible leadership cluster before comparison can become specific.",
      id: "research-current-leadership",
      query: topSector ? `Compare current ${topSector} leadership against prior failed continuation environments.` : "Compare current leadership against prior failed continuation environments.",
      tone: topSector ? "cyan" : "amber",
    },
    {
      detail: "Combines volatility expansion, sector outperformance, and market regime context. Limited data remains labelled when proxy values are unavailable.",
      id: "research-vol-sector",
      query: "Show environments where volatility expanded while leadership outperformed.",
      tone: metrics.volatilityScore !== null ? "amber" : "cyan",
    },
    {
      detail: "Highlights setups where macro support improves but memory/replay confidence weakens, without converting that into advice.",
      id: "research-macro-replay",
      query: "Show setups with improving macro support but weakening replay context.",
      tone: metrics.memoryScore >= 45 ? "violet" : "cyan",
    },
  ];
}

function buildMemoryPersistence(input: BuildInstitutionalSuperplatformInput, metrics: SuperplatformMetrics): ResearchWorkflowPrompt[] {
  const changes = input.workflowEvolution?.whatChanged ?? [];
  const lastSeen = input.workflowEvolution?.lastSeenAt ?? null;
  const watchlistSymbols = input.watchlistSymbols ?? [];
  return [
    {
      detail: lastSeen
        ? `Workflow memory baseline is anchored to ${lastSeen}. TradeVeto can compare the current packet against the previous visit.`
        : "Workflow memory is still creating its first baseline for this user.",
      id: "memory-baseline",
      query: "Persistent workflow memory",
      tone: lastSeen ? "emerald" : "cyan",
    },
    {
      detail: changes.length
        ? `${changes.length} changes are linked into the operating context, including score, macro, fragility, or watchlist movement.`
        : "No durable change sequence dominates yet.",
      id: "memory-changes",
      query: "Market evolution timeline",
      tone: changes.some((change) => change.severity === "warning") ? "amber" : "cyan",
    },
    {
      detail: watchlistSymbols.length
        ? `${watchlistSymbols.slice(0, 7).join(", ")} remain part of the tracked relationship layer.`
        : "No watchlist symbols are available for persistent relationship tracking.",
      id: "memory-watchlist",
      query: "User-market relationship memory",
      tone: watchlistSymbols.length ? "violet" : "cyan",
    },
    {
      detail: metrics.memoryScore >= 45
        ? `Validated replay/analog memory averages ${Math.round(metrics.memoryScore)}/100 across visible rows.`
        : "Replay and analog memory are limited in the current packet.",
      id: "memory-analog",
      query: "Market memory confidence",
      tone: metrics.memoryScore >= 55 ? "violet" : "cyan",
    },
  ];
}

function operatingState(score: number, metrics: SuperplatformMetrics): { headline: string; label: string; summary: string; tone: SuperplatformTone } {
  if (metrics.averageFragility >= 68 || metrics.averageShock >= 72) {
    return {
      headline: "TradeVeto is operating as a risk-first market command environment",
      label: "Risk-dominant operating state",
      summary: `The superplatform is linking macro, watchlist, risk, replay, and workspace context because fragility is ${Math.round(metrics.averageFragility)}/100 and shock pressure is ${Math.round(metrics.averageShock)}/100.`,
      tone: "rose",
    };
  }
  if (score >= 68 && metrics.averageMacro >= 58) {
    return {
      headline: "TradeVeto is coordinating multiple research workspaces",
      label: "Connected operating state",
      summary: `The operating environment has enough confidence, macro support, evidence, and workspace context to coordinate daily research without hiding uncertainty.`,
      tone: "emerald",
    };
  }
  return {
    headline: "TradeVeto is building a persistent institutional operating layer",
    label: "Monitoring operating state",
    summary: `The platform is linking workspace, market context, intelligence map, timeline, and watchlist memory while keeping limited evidence clearly labelled.`,
    tone: "cyan",
  };
}

function preferredWorkspaceId(preferences: WorkspacePreferences | null | undefined, workspaces: InstitutionalWorkspaceModel[]): InstitutionalWorkspaceId {
  const preferred = preferences?.workspaceMode;
  const id: InstitutionalWorkspaceId =
    preferred === "macro_first" || preferences?.macroFirstMode ? "macro" :
    preferred === "watchlist_first" || preferences?.watchlistFirstMode ? "watchlist_operations" :
    preferred === "swing_trader" ? "swing_trading" :
    preferred === "investor" ? "long_term_investment" :
    "custom_intelligence";
  return workspaces.some((workspaceItem) => workspaceItem.id === id) ? id : "custom_intelligence";
}

function workspaceHref(id: InstitutionalWorkspaceId, symbol?: string): string {
  if (id === "macro") return "/intelligence/macro-regime";
  if (id === "risk_monitoring") return "/alerts";
  if (id === "watchlist_operations") return "/alerts";
  if (id === "earnings") return "/intelligence/shock-opportunities";
  if (id === "long_term_investment") return "/performance";
  if (id === "swing_trading" || id === "ai_momentum") return symbol ? `/symbol/${symbol}` : "/opportunities";
  return "/terminal";
}

function isAiMomentumRow(row: OpportunityViewModel): boolean {
  const symbol = row.symbol.toUpperCase();
  const sector = cleanText(row.sector, "").toLowerCase();
  const name = cleanText(row.company_name, "").toLowerCase();
  return ["NVDA", "AMD", "TSM", "SMCI", "AVGO", "MU", "MRVL", "ARM", "QQQ", "SOXX", "SMH"].includes(symbol) ||
    /technology|semiconductor|software|communication/.test(sector) ||
    /ai|semiconductor|chip|cloud|data|software/.test(name);
}

function metricFromRows(rows: OpportunityViewModel[], keys: string[]): number | null {
  const values: number[] = [];
  for (const row of rows) {
    for (const key of keys) {
      const rawValue = row.raw[key];
      const numericValue = finiteNumber(rawValue);
      if (numericValue !== null) values.push(clamp(normalizeMetricValue(numericValue, key)));
    }
  }
  return values.length ? Math.round(average(values, 50)) : null;
}

function normalizeMetricValue(value: number, key: string): number {
  if (/vix/i.test(key) && value <= 100) return clamp(100 - value * 2.4);
  if (Math.abs(value) <= 1) return clamp(value * 100);
  return clamp(value);
}

function macroScore(row: OpportunityViewModel): number {
  const adjustment = finiteNumber(row.macroAdjustment);
  if (adjustment !== null) return clamp(50 + adjustment);
  const label = row.macroLabel.toLowerCase();
  if (label.includes("support") || label.includes("positive") || label.includes("tailwind") || label.includes("aligned")) return 68;
  if (label.includes("weak") || label.includes("negative") || label.includes("headwind")) return 34;
  return 50;
}

function memoryScore(row: OpportunityViewModel): number {
  return clamp(
    Math.max(
      finiteNumber(row.shockPattern?.opportunityScore) ?? 0,
      finiteNumber(row.shockPattern?.asymmetryScore) ?? 0,
      finiteNumber(row.raw.large_move_history_score) ?? 0,
      finiteNumber(row.raw.replay_similarity_score) ?? 0,
      finiteNumber(row.raw.market_memory_score) ?? 0,
    ),
  );
}

function shockScore(row: OpportunityViewModel): number {
  return clamp(
    Math.max(
      finiteNumber(row.shockPattern?.downsideRiskScore) ?? 0,
      finiteNumber(row.shockPattern?.twoSidedVolatilityScore) ?? 0,
      finiteNumber(row.raw.event_shock_pressure_score) ?? 0,
      finiteNumber(row.raw.shock_score) ?? 0,
      row.eventRisk,
    ),
  );
}

function topRows(rows: OpportunityViewModel[], scoreFn: (row: OpportunityViewModel) => number, limit: number): OpportunityViewModel[] {
  return [...rows].sort((left, right) => scoreFn(right) - scoreFn(left) || left.symbol.localeCompare(right.symbol)).slice(0, limit);
}

function groupRows(rows: OpportunityViewModel[], keyFn: (row: OpportunityViewModel) => string): Map<string, OpportunityViewModel[]> {
  const groups = new Map<string, OpportunityViewModel[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return groups;
}

function topSectorName(rows: OpportunityViewModel[]): string | null {
  const sectors = [...groupRows(rows, (row) => cleanText(row.sector, "Unknown")).entries()]
    .map(([sector, sectorRows]) => ({ count: sectorRows.length, score: average(sectorRows.map((row) => row.final_score), 50), sector }))
    .sort((left, right) => right.count - left.count || right.score - left.score);
  return sectors[0]?.sector ?? null;
}

function metricValue(label: string): number | null {
  const match = label.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? clamp(Math.abs(parsed) * 10) : null;
}

function normalizeSeries(values: Array<number | null | undefined>): number[] {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numeric.length) return [];
  return numeric.map((value) => Math.round(clamp(value)));
}

function cleanSymbol(symbol: string): string | null {
  const text = symbol.trim().toUpperCase();
  return /^[A-Z0-9.-]{1,12}$/.test(text) ? text : null;
}

function dedupeStrings(values: string[]): string[] {
  const output: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    if (!output.includes(value)) output.push(value);
  }
  return output;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const numericValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!numericValues.length) return fallback;
  return numericValues.reduce((total, value) => total + value, 0) / numericValues.length;
}
