import type { IntelligenceFeedItem } from "./intelligence-feed";
import type { InstitutionalSuperplatformSystem } from "./institutional-superplatform";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { EcosystemTone } from "./intelligence-ecosystem";
import type { WorkspacePreferences, WorkspaceModuleId } from "./workspace-preferences";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { WORKSPACE_MODE_LABELS, moduleLabel } from "./workspace-preferences";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type EcosystemContinuityTone = EcosystemTone | "slate";

export type EcosystemContinuationItem = {
  detail: string;
  href: string;
  id: string;
  routeGroup: string;
  score: number | null;
  sourceLabel: string;
  symbol: string | null;
  title: string;
  tone: EcosystemContinuityTone;
};

export type EcosystemThreadLink = {
  href: string;
  label: string;
  system: string;
};

export type EcosystemCrossSystemThread = {
  detail: string;
  evidenceLabel: string;
  id: string;
  links: EcosystemThreadLink[];
  symbols: string[];
  title: string;
  tone: EcosystemContinuityTone;
};

export type EcosystemAdaptivePriority = {
  detail: string;
  href: string;
  id: string;
  score: number | null;
  sourceLabel: string;
  title: string;
  tone: EcosystemContinuityTone;
};

export type EcosystemBreadcrumb = {
  detail: string;
  href: string;
  label: string;
  tone: EcosystemContinuityTone;
};

export type EcosystemRestoreReadiness = {
  detail: string;
  label: string;
  status: "device" | "missing" | "partial" | "ready";
  tone: EcosystemContinuityTone;
  value: string;
};

export type EcosystemSessionPersistence = {
  context: string;
  detail: string;
  sourceLabel: string;
  status: "available" | "device-local" | "limited" | "restored";
  tone: EcosystemContinuityTone;
};

export type EcosystemContinuitySystem = {
  activeWorkspaceLabel: string;
  adaptivePriorities: EcosystemAdaptivePriority[];
  breadcrumbs: EcosystemBreadcrumb[];
  continuationItems: EcosystemContinuationItem[];
  continuityScore: number;
  crossSystemThreads: EcosystemCrossSystemThread[];
  generatedAt: string | null;
  guardrail: string;
  headline: string;
  limitations: string[];
  recentSymbols: string[];
  restoreReadiness: EcosystemRestoreReadiness[];
  sessionPersistence: EcosystemSessionPersistence[];
  summary: string;
  tone: EcosystemContinuityTone;
};

export type BuildEcosystemContinuityInput = {
  feedItems?: IntelligenceFeedItem[];
  generatedAt?: string | null;
  institutionalSuperplatform?: InstitutionalSuperplatformSystem | null;
  marketCondition?: string | null;
  rows: OpportunityViewModel[];
  scanUpdatedAt?: string | null;
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
  workspacePreferences?: WorkspacePreferences | null;
};

type ContinuityMetrics = {
  averageConfidence: number;
  averageEvidence: number;
  averageFragility: number;
  averageMacro: number;
  feedCount: number;
  workflowSignals: number;
  watchlistHits: number;
};

export function buildEcosystemContinuitySystem(input: BuildEcosystemContinuityInput): EcosystemContinuitySystem {
  const metrics = computeContinuityMetrics(input);
  const recentSymbols = recentSymbolsFor(input);
  const activeWorkspaceLabel = activeWorkspaceLabelFor(input);
  const continuationItems = continuationItemsFor(input, recentSymbols, metrics);
  const crossSystemThreads = crossSystemThreadsFor(input, recentSymbols);
  const adaptivePriorities = adaptivePrioritiesFor(input, recentSymbols, metrics);
  const breadcrumbs = breadcrumbsFor(input, recentSymbols);
  const restoreReadiness = restoreReadinessFor(input, metrics, recentSymbols);
  const sessionPersistence = sessionPersistenceFor(input, recentSymbols);
  const continuityScore = continuityScoreFor(input, metrics, recentSymbols);
  const tone = scoreTone(continuityScore);
  const marketLabel = input.marketCondition ? humanizeLabel(input.marketCondition) : "Latest market packet";

  return {
    activeWorkspaceLabel,
    adaptivePriorities,
    breadcrumbs,
    continuationItems,
    continuityScore,
    crossSystemThreads,
    generatedAt: input.generatedAt ?? input.scanUpdatedAt ?? null,
    guardrail:
      "Continuity combines saved workspace preferences, server-side workflow snapshots, watchlist state, feed events, chart/scanner device memory, and current scanner rows. It does not claim broker execution continuity or fabricate unavailable session state.",
    headline: headlineFor(continuityScore, activeWorkspaceLabel),
    limitations: limitationsFor(input, recentSymbols),
    recentSymbols,
    restoreReadiness,
    sessionPersistence,
    summary:
      `${marketLabel} is now linked across Terminal, Feed, Macro, Market Memory, Scanner, Symbol, Paper, and Strategy surfaces. ` +
      `${recentSymbols.length ? `Current continuity anchors: ${recentSymbols.slice(0, 4).join(", ")}.` : "No user-specific symbol continuity anchor is available yet."}`,
    tone,
  };
}

function computeContinuityMetrics(input: BuildEcosystemContinuityInput): ContinuityMetrics {
  const watchlist = new Set((input.watchlistSymbols ?? []).map(cleanSymbol).filter((symbol): symbol is string => Boolean(symbol)));
  return {
    averageConfidence: average(input.rows.map((row) => row.conviction), 48),
    averageEvidence: average(input.rows.map((row) => row.evidence?.score ?? null), 30),
    averageFragility: average(input.rows.map((row) => row.fragility), 50),
    averageMacro: average(input.rows.map((row) => macroScore(row)), 50),
    feedCount: input.feedItems?.length ?? 0,
    workflowSignals: workflowSignals(input.workflowEvolution),
    watchlistHits: input.rows.filter((row) => watchlist.has(row.symbol)).length,
  };
}

function recentSymbolsFor(input: BuildEcosystemContinuityInput): string[] {
  const symbols = [
    input.workspacePreferences?.mobileLastViewedSymbol,
    ...(input.workspacePreferences?.favoriteSymbols ?? []),
    ...(input.watchlistSymbols ?? []),
    ...workflowSymbols(input.workflowEvolution),
    ...(input.feedItems ?? []).map((item) => item.relatedSymbol),
    ...input.rows.slice(0, 8).map((row) => row.symbol),
  ];
  return uniqueSymbols(symbols, 12);
}

function continuationItemsFor(
  input: BuildEcosystemContinuityInput,
  recentSymbols: string[],
  metrics: ContinuityMetrics,
): EcosystemContinuationItem[] {
  const primarySymbol = recentSymbols[0] ?? input.rows[0]?.symbol ?? null;
  const workspaceMode = input.workspacePreferences?.workspaceMode ?? null;
  const items: EcosystemContinuationItem[] = [];

  if (primarySymbol) {
    items.push({
      detail: `${primarySymbol} is the strongest current symbol continuity anchor from saved preferences, watchlist state, workflow memory, or current scanner priority.`,
      href: `/symbol/${encodeURIComponent(primarySymbol)}`,
      id: "last-symbol",
      routeGroup: "symbol",
      score: scoreForSymbol(input.rows.find((row) => row.symbol === primarySymbol) ?? null),
      sourceLabel: input.workspacePreferences?.mobileLastViewedSymbol === primarySymbol ? "Saved mobile focus" : "Continuity anchor",
      symbol: primarySymbol,
      title: `Continue ${primarySymbol} research`,
      tone: "cyan",
    });
  }

  items.push({
    detail: workspaceMode ? `${WORKSPACE_MODE_LABELS[workspaceMode]} preferences restore module priority, risk style, pinned mobile cards, and timeframes.` : "No saved workspace mode is available yet; Terminal uses the default balanced operating context.",
    href: "/terminal#workspace-personalization",
    id: "workspace-restore",
    routeGroup: "terminal",
    score: input.workspacePreferences?.updatedAt ? 82 : 46,
    sourceLabel: input.workspacePreferences?.updatedAt ? "Server workspace memory" : "Default workspace",
    symbol: null,
    title: input.workspacePreferences?.updatedAt ? "Restore saved workspace" : "Configure workspace memory",
    tone: input.workspacePreferences?.updatedAt ? "emerald" : "amber",
  });

  items.push({
    detail: `Scanner can resume around ${recentSymbols.slice(0, 4).join(", ") || "today's ranked universe"} while device-local filters and compare sets are restored when present.`,
    href: "/discover",
    id: "scanner-continuity",
    routeGroup: "scanner",
    score: Math.round(average([metrics.averageConfidence, metrics.averageEvidence, 100 - metrics.averageFragility], 55)),
    sourceLabel: "Scanner + device memory",
    symbol: primarySymbol,
    title: "Resume discovery flow",
    tone: "violet",
  });

  items.push({
    detail: input.workflowEvolution?.lastSeenAt
      ? `Workflow snapshots exist from ${input.workflowEvolution.lastSeenAt}, allowing changed symbols and trigger monitors to reconnect with current pages.`
      : "Workflow evolution is creating its first baseline; future visits will gain stronger before/after continuity.",
    href: "/feed",
    id: "feed-continuity",
    routeGroup: "feed",
    score: input.workflowEvolution?.lastSeenAt ? 78 : 42,
    sourceLabel: input.workflowEvolution?.lastSeenAt ? "Workflow snapshots" : "Baseline starting",
    symbol: primarySymbol,
    title: "Review what changed",
    tone: input.workflowEvolution?.lastSeenAt ? "emerald" : "amber",
  });

  items.push({
    detail: "Market Memory, Macro, and Strategy surfaces are linked from the same current market packet so context can follow research instead of restarting.",
    href: "/market-memory",
    id: "memory-continuity",
    routeGroup: "market-memory",
    score: input.institutionalSuperplatform?.context.replayEnvironmentScore ?? null,
    sourceLabel: "Market memory bridge",
    symbol: primarySymbol,
    title: "Open historical context",
    tone: "cyan",
  });

  return items;
}

function crossSystemThreadsFor(input: BuildEcosystemContinuityInput, recentSymbols: string[]): EcosystemCrossSystemThread[] {
  const threads: EcosystemCrossSystemThread[] = [];
  const primaryFeedItems = (input.feedItems ?? []).slice(0, 4);
  for (const item of primaryFeedItems) {
    const symbol = cleanSymbol(item.relatedSymbol);
    const symbols = uniqueSymbols([symbol], 3);
    threads.push({
      detail: `${item.summary} ${item.whyItMatters}`,
      evidenceLabel: item.evidenceLabel,
      id: `feed-${item.sourceKey}`,
      links: threadLinksFor({ actionHref: item.actionHref, symbol, type: item.itemType }),
      symbols,
      title: item.title,
      tone: feedTone(item.severity),
    });
  }

  for (const change of [
    ...(input.workflowEvolution?.whatChanged ?? []),
    ...(input.workflowEvolution?.watchlistEvolution ?? []),
  ].slice(0, 4)) {
    threads.push({
      detail: change.detail,
      evidenceLabel: change.metricLabel,
      id: `workflow-${change.changeType}-${change.symbol}`,
      links: threadLinksFor({ symbol: change.symbol, type: change.changeType }),
      symbols: uniqueSymbols([change.symbol], 3),
      title: change.title,
      tone: change.severity === "warning" ? "rose" : change.severity === "positive" ? "emerald" : "cyan",
    });
  }

  const workspace = input.institutionalSuperplatform?.workspaces.find((item) => item.id === input.institutionalSuperplatform?.activeWorkspaceId);
  if (workspace) {
    threads.push({
      detail: workspace.summary,
      evidenceLabel: workspace.riskSetting,
      id: `workspace-${workspace.id}`,
      links: [
        { href: workspace.primaryHref, label: "Open workspace", system: workspace.title },
        { href: "/macro", label: "Macro context", system: "Macro" },
        { href: "/strategy-labs", label: "Strategy impact", system: "Strategy" },
      ],
      symbols: uniqueSymbols(workspace.symbols.length ? workspace.symbols : recentSymbols, 5),
      title: workspace.title,
      tone: workspace.tone,
    });
  }

  return uniqueThreads(threads).slice(0, 8);
}

function adaptivePrioritiesFor(
  input: BuildEcosystemContinuityInput,
  recentSymbols: string[],
  metrics: ContinuityMetrics,
): EcosystemAdaptivePriority[] {
  const preferences = input.workspacePreferences;
  const priorities: EcosystemAdaptivePriority[] = [];
  const favoriteModules = preferences?.favoriteModules ?? [];
  const primarySymbol = recentSymbols[0] ?? null;

  if (preferences?.watchlistFirstMode || (input.watchlistSymbols?.length ?? 0) > 0) {
    priorities.push({
      detail: `${input.watchlistSymbols?.length ?? 0} watchlist symbols are treated as the first continuity anchor before broad-market discovery.`,
      href: "/terminal#watchlist-intelligence",
      id: "watchlist-first",
      score: Math.min(100, 45 + (metrics.watchlistHits * 10)),
      sourceLabel: "Watchlist behavior",
      title: "Watchlist intelligence first",
      tone: "emerald",
    });
  }

  if (preferences?.macroFirstMode || favoriteModules.includes("macro")) {
    priorities.push({
      detail: `Macro context is elevated because the saved workspace favors ${moduleList(favoriteModules)} and current macro alignment averages ${Math.round(metrics.averageMacro)}/100.`,
      href: "/macro",
      id: "macro-first",
      score: Math.round(metrics.averageMacro),
      sourceLabel: "Workspace preference",
      title: "Macro pressure stays globally visible",
      tone: metrics.averageMacro >= 58 ? "cyan" : "amber",
    });
  }

  if (preferences?.preferredRiskStyle) {
    priorities.push({
      detail: `${humanizeLabel(preferences.preferredRiskStyle)} risk style adjusts attention toward ${riskStyleDetail(preferences.preferredRiskStyle)}.`,
      href: "/terminal#daily-driver-retention",
      id: "risk-style",
      score: Math.round(100 - metrics.averageFragility),
      sourceLabel: "Risk style",
      title: "Risk lens follows the workspace",
      tone: preferences.preferredRiskStyle === "aggressive" ? "violet" : preferences.preferredRiskStyle === "conservative" ? "emerald" : "cyan",
    });
  }

  if (primarySymbol) {
    const row = input.rows.find((item) => item.symbol === primarySymbol);
    priorities.push({
      detail: row ? `${primarySymbol} carries ${Math.round(row.conviction)}/100 conviction, ${Math.round(row.fragility)}/100 fragility, and ${row.macroLabel}.` : `${primarySymbol} is retained as the next symbol research anchor.`,
      href: `/symbol/${encodeURIComponent(primarySymbol)}`,
      id: "primary-symbol",
      score: row ? scoreForSymbol(row) : null,
      sourceLabel: "Recent symbol memory",
      title: `Prioritize ${primarySymbol} continuity`,
      tone: row ? scoreTone(scoreForSymbol(row) ?? 50) : "slate",
    });
  }

  priorities.push({
    detail: "Device-local scanner filters, compare symbols, chart drawings, overlay families, and fullscreen state are read by the client bridge when the browser allows local storage.",
    href: "/discover",
    id: "device-restore",
    score: null,
    sourceLabel: "Device memory",
    title: "Restore scanner and chart state locally",
    tone: "violet",
  });

  return priorities.slice(0, 6);
}

function breadcrumbsFor(input: BuildEcosystemContinuityInput, recentSymbols: string[]): EcosystemBreadcrumb[] {
  const primarySymbol = recentSymbols[0] ?? null;
  const breadcrumbs: EcosystemBreadcrumb[] = [
    {
      detail: "Start from the daily command center and current market state.",
      href: "/terminal",
      label: "Terminal",
      tone: "cyan",
    },
    {
      detail: "Scan the ranked universe with saved filters and compare context where available.",
      href: "/discover",
      label: "Discover",
      tone: "violet",
    },
  ];
  if (primarySymbol) {
    breadcrumbs.push({
      detail: `Continue the current symbol research thread for ${primarySymbol}.`,
      href: `/symbol/${encodeURIComponent(primarySymbol)}`,
      label: primarySymbol,
      tone: "emerald",
    });
  }
  if (input.workspacePreferences?.macroFirstMode || input.institutionalSuperplatform?.activeWorkspaceId === "macro") {
    breadcrumbs.push({
      detail: "Keep the macro workspace attached to symbol and strategy interpretation.",
      href: "/macro",
      label: "Macro",
      tone: "cyan",
    });
  }
  breadcrumbs.push(
    {
      detail: "Compare the current environment against historical analog context.",
      href: "/market-memory",
      label: "Market Memory",
      tone: "amber",
    },
    {
      detail: "Translate continuity into portfolio and strategy implications.",
      href: "/strategy-labs",
      label: "Strategy",
      tone: "emerald",
    },
  );
  return breadcrumbs;
}

function restoreReadinessFor(
  input: BuildEcosystemContinuityInput,
  metrics: ContinuityMetrics,
  recentSymbols: string[],
): EcosystemRestoreReadiness[] {
  return [
    {
      detail: input.workspacePreferences?.updatedAt
        ? `Workspace preferences were saved at ${input.workspacePreferences.updatedAt}.`
        : "No authenticated workspace preference timestamp is available yet.",
      label: "Workspace restore",
      status: input.workspacePreferences?.updatedAt ? "ready" : "partial",
      tone: input.workspacePreferences?.updatedAt ? "emerald" : "amber",
      value: input.workspacePreferences ? WORKSPACE_MODE_LABELS[input.workspacePreferences.workspaceMode] : "Default",
    },
    {
      detail: input.workflowEvolution?.lastSeenAt
        ? `Workflow evolution has a previous snapshot from ${input.workflowEvolution.lastSeenAt}.`
        : "Workflow evolution is collecting its first baseline snapshot.",
      label: "Workflow memory",
      status: input.workflowEvolution?.lastSeenAt ? "ready" : "partial",
      tone: input.workflowEvolution?.lastSeenAt ? "emerald" : "amber",
      value: metrics.workflowSignals ? `${metrics.workflowSignals} signals` : "Baseline",
    },
    {
      detail: recentSymbols.length
        ? `${recentSymbols.slice(0, 5).join(", ")} can anchor cross-system navigation.`
        : "No recent/favorite/watchlist symbol anchor is available yet.",
      label: "Symbol continuity",
      status: recentSymbols.length ? "ready" : "missing",
      tone: recentSymbols.length ? "cyan" : "rose",
      value: recentSymbols.length ? `${recentSymbols.length} symbols` : "None",
    },
    {
      detail: "Scanner filters, compare sets, chart drawings, overlay selections, and route history are restored from device storage only when the current browser has captured them.",
      label: "Device session",
      status: "device",
      tone: "violet",
      value: "Browser-local",
    },
  ];
}

function sessionPersistenceFor(input: BuildEcosystemContinuityInput, recentSymbols: string[]): EcosystemSessionPersistence[] {
  const modules = input.workspacePreferences?.favoriteModules ?? [];
  return [
    {
      context: "Workspace layout",
      detail: modules.length ? `Pinned modules restore as ${moduleList(modules)}.` : "Default module order is used until the user saves a workspace.",
      sourceLabel: input.workspacePreferences?.updatedAt ? "Server preference" : "Default preference",
      status: input.workspacePreferences?.updatedAt ? "restored" : "limited",
      tone: input.workspacePreferences?.updatedAt ? "emerald" : "amber",
    },
    {
      context: "Scanner and compare",
      detail: "Discovery dense mode, quick filter, sort, shortlist, and compare symbols persist locally from the discovery workflow store.",
      sourceLabel: "Device storage",
      status: "device-local",
      tone: "violet",
    },
    {
      context: "Chart workspace",
      detail: recentSymbols.length ? `Chart period, drawings, indicators, overlays, and layout restore per symbol for ${recentSymbols.slice(0, 4).join(", ")} when present.` : "Chart restoration starts after a symbol workspace is opened.",
      sourceLabel: "Per-symbol chart storage",
      status: recentSymbols.length ? "device-local" : "limited",
      tone: recentSymbols.length ? "cyan" : "amber",
    },
    {
      context: "Cross-system links",
      detail: "Feed items, workflow changes, Market Memory, Macro, Paper, and Strategy links are generated from the same current scanner and workflow packet.",
      sourceLabel: "Server model",
      status: "available",
      tone: "emerald",
    },
    {
      context: "Overlay and fullscreen state",
      detail: "The continuity panel exposes where this state should resume, but complete server-side overlay/fullscreen restoration remains intentionally limited.",
      sourceLabel: "Trust boundary",
      status: "limited",
      tone: "amber",
    },
  ];
}

function continuityScoreFor(input: BuildEcosystemContinuityInput, metrics: ContinuityMetrics, recentSymbols: string[]): number {
  const factors = [
    input.workspacePreferences?.updatedAt ? 84 : input.workspacePreferences ? 62 : 38,
    input.workflowEvolution?.lastSeenAt ? 82 : metrics.workflowSignals ? 58 : 35,
    recentSymbols.length ? Math.min(90, 46 + recentSymbols.length * 5) : 25,
    input.institutionalSuperplatform?.operatingScore ?? null,
    metrics.feedCount ? Math.min(88, 45 + metrics.feedCount * 4) : 30,
    metrics.watchlistHits ? Math.min(86, 48 + metrics.watchlistHits * 8) : null,
  ];
  return Math.round(clamp(average(factors, 48)));
}

function limitationsFor(input: BuildEcosystemContinuityInput, recentSymbols: string[]): string[] {
  const limitations: string[] = [];
  if (!input.workspacePreferences?.updatedAt) limitations.push("Workspace layout restore is partial until authenticated preferences are saved.");
  if (!input.workflowEvolution?.lastSeenAt) limitations.push("Workflow evolution has not yet accumulated a previous visit baseline.");
  if (!recentSymbols.length) limitations.push("No recent, favorite, or watchlist symbol anchor is available for personalized continuity.");
  limitations.push("Scanner/chart/overlay/fullscreen restoration uses browser-local state and cannot be proven on a new device until that device captures state.");
  limitations.push("No broker execution context is restored or inferred.");
  return limitations.slice(0, 5);
}

function activeWorkspaceLabelFor(input: BuildEcosystemContinuityInput): string {
  const superplatform = input.institutionalSuperplatform;
  const active = superplatform?.workspaces.find((workspace) => workspace.id === superplatform.activeWorkspaceId);
  if (active) return active.title;
  const mode = input.workspacePreferences?.workspaceMode;
  return mode ? `${WORKSPACE_MODE_LABELS[mode]} Workspace` : "Balanced Workspace";
}

function headlineFor(score: number, activeWorkspaceLabel: string): string {
  if (score >= 82) return `${activeWorkspaceLabel} is strongly continuous`;
  if (score >= 65) return `${activeWorkspaceLabel} has usable continuity`;
  if (score >= 48) return `${activeWorkspaceLabel} is rebuilding continuity`;
  return "Continuity memory needs more user context";
}

function threadLinksFor(input: { actionHref?: string | null; symbol?: string | null; type?: string | null }): EcosystemThreadLink[] {
  const symbol = cleanSymbol(input.symbol);
  const links: EcosystemThreadLink[] = [];
  const actionHref = cleanHref(input.actionHref);
  if (actionHref) links.push({ href: actionHref, label: "Open source item", system: "Feed" });
  if (symbol) links.push({ href: `/symbol/${encodeURIComponent(symbol)}`, label: symbol, system: "Symbol" });
  if (isMacroType(input.type)) links.push({ href: "/macro", label: "Macro context", system: "Macro" });
  if (isReplayType(input.type)) links.push({ href: "/market-memory", label: "Historical analog", system: "Market Memory" });
  links.push({ href: "/discover", label: "Scan related symbols", system: "Discover" });
  if (!links.some((link) => link.href === "/strategy-labs")) links.push({ href: "/strategy-labs", label: "Strategy impact", system: "Strategy" });
  return uniqueLinks(links).slice(0, 4);
}

function workflowSymbols(workflow: WorkflowEvolutionSummary | null | undefined): string[] {
  if (!workflow) return [];
  return uniqueSymbols([
    ...workflow.whatChanged.map((item) => item.symbol),
    ...workflow.watchlistEvolution.map((item) => item.symbol),
    ...workflow.improvingSetups.map((item) => item.symbol),
    ...workflow.deterioratingSetups.map((item) => item.symbol),
    ...workflow.triggerMonitors.map((item) => item.symbol),
    ...workflow.opportunityMaturity.map((item) => item.symbol),
  ], 16);
}

function workflowSignals(workflow: WorkflowEvolutionSummary | null | undefined): number {
  if (!workflow) return 0;
  return workflow.whatChanged.length + workflow.watchlistEvolution.length + workflow.improvingSetups.length + workflow.deterioratingSetups.length + workflow.triggerMonitors.length;
}

function moduleList(modules: WorkspaceModuleId[]): string {
  if (!modules.length) return "default modules";
  return modules.slice(0, 3).map(moduleLabel).join(", ");
}

function riskStyleDetail(style: NonNullable<WorkspacePreferences["preferredRiskStyle"]>): string {
  if (style === "conservative") return "lower fragility, stronger evidence, and macro confirmation";
  if (style === "aggressive") return "momentum, expansion pressure, and faster opportunity review";
  return "balanced opportunity, macro context, and risk review";
}

function uniqueThreads(threads: EcosystemCrossSystemThread[]): EcosystemCrossSystemThread[] {
  const seen = new Set<string>();
  const output: EcosystemCrossSystemThread[] = [];
  for (const thread of threads) {
    const key = thread.id;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(thread);
  }
  return output;
}

function uniqueLinks(links: EcosystemThreadLink[]): EcosystemThreadLink[] {
  const seen = new Set<string>();
  const output: EcosystemThreadLink[] = [];
  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    output.push(link);
  }
  return output;
}

function uniqueSymbols(values: unknown[], limit: number): string[] {
  const output: string[] = [];
  for (const value of values) {
    const symbol = cleanSymbol(value);
    if (!symbol || output.includes(symbol)) continue;
    output.push(symbol);
    if (output.length >= limit) break;
  }
  return output;
}

function scoreForSymbol(row: OpportunityViewModel | null): number | null {
  if (!row) return null;
  return Math.round(clamp(average([row.final_score, row.conviction, row.evidence?.score ?? null, 100 - row.fragility, macroScore(row)], row.final_score ?? row.conviction)));
}

function macroScore(row: OpportunityViewModel): number | null {
  const raw = finiteNumber(row.raw.macro_alignment_score ?? row.raw.macro_score ?? row.raw.macro_context_score);
  if (raw !== null) return clamp(raw);
  if (row.macroAdjustment !== null) return clamp(50 + row.macroAdjustment);
  const label = row.macroLabel.toLowerCase();
  if (label.includes("support")) return 66;
  if (label.includes("weak") || label.includes("pressure")) return 38;
  return 50;
}

function isMacroType(value: unknown): boolean {
  const text = cleanText(value, "").toLowerCase();
  return text.includes("macro") || text.includes("breadth") || text.includes("sector") || text.includes("volatility");
}

function isReplayType(value: unknown): boolean {
  const text = cleanText(value, "").toLowerCase();
  return text.includes("replay") || text.includes("memory") || text.includes("similarity");
}

function cleanHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed.slice(0, 160);
}

function cleanSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 16);
  return symbol || null;
}

function feedTone(severity: IntelligenceFeedItem["severity"]): EcosystemContinuityTone {
  if (severity === "critical" || severity === "high" || severity === "warning") return "rose";
  if (severity === "positive") return "emerald";
  if (severity === "medium") return "amber";
  return "cyan";
}

function scoreTone(score: number): EcosystemContinuityTone {
  if (score >= 78) return "emerald";
  if (score >= 62) return "cyan";
  if (score >= 45) return "amber";
  return "rose";
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finiteValues.length) return fallback;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
