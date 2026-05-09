import { buildInstitutionalPressureSystem, type InstitutionalIntelligence } from "./institutional-intelligence";
import { buildTradeVetoOperatingSystem, type MetaOpportunityPriority } from "./meta-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import { buildRegimeShiftSystem } from "./regime-shift-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";
import { cleanText, finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { humanizeLabel } from "@/lib/ui/labels";

export type InstitutionalDashboardMode = "aggressive" | "conservative" | "institutional" | "macro" | "volatility" | "watchlist";

export type InstitutionalHeatmapKind =
  | "asymmetry"
  | "fragility"
  | "liquidity"
  | "macro"
  | "sector"
  | "shock"
  | "volatility";

export type InstitutionalHeatmapTone = "constructive" | "mixed" | "neutral" | "risk";

export type InstitutionalHeatmapCell = {
  count: number;
  detail: string;
  key: string;
  label: string;
  score: number;
  symbols: string[];
  tone: InstitutionalHeatmapTone;
};

export type InstitutionalHeatmap = {
  description: string;
  kind: InstitutionalHeatmapKind;
  title: string;
  cells: InstitutionalHeatmapCell[];
};

export type InstitutionalDashboardCluster = {
  count: number;
  detail: string;
  key: string;
  label: string;
  leaders: string[];
  score: number;
  type: "macro" | "opportunity" | "risk" | "rotation" | "shock";
};

export type InstitutionalDashboardMetric = {
  detail: string;
  inverse?: boolean;
  key: string;
  label: string;
  score: number;
  tone: InstitutionalHeatmapTone;
};

export type InstitutionalDashboardOpportunityMap = {
  bestAsymmetry: MetaOpportunityPriority[];
  deteriorating: MetaOpportunityPriority[];
  highestFragility: MetaOpportunityPriority[];
  improving: MetaOpportunityPriority[];
  institutionalQuality: MetaOpportunityPriority[];
  shockOpportunities: MetaOpportunityPriority[];
  strongest: MetaOpportunityPriority[];
};

export type InstitutionalDashboard = {
  clusters: InstitutionalDashboardCluster[];
  executiveBriefing: string[];
  generatedAt: string;
  heatmaps: InstitutionalHeatmap[];
  limitations: string[];
  marketState: {
    label: string;
    metrics: InstitutionalDashboardMetric[];
    summary: string;
  };
  mode: InstitutionalDashboardMode;
  opportunityMap: InstitutionalDashboardOpportunityMap;
  universeCount: number;
  visibleCount: number;
};

export type InstitutionalDashboardInput = {
  mode?: InstitutionalDashboardMode;
  personalizationProfile?: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

type GroupAggregate = {
  models: InstitutionalIntelligence[];
  rows: OpportunityViewModel[];
};

type ClusterSpec = {
  detail: string;
  key: string;
  label: string;
  rows: OpportunityViewModel[];
  type: InstitutionalDashboardCluster["type"];
};

export function buildInstitutionalDashboard(input: InstitutionalDashboardInput): InstitutionalDashboard {
  const mode = input.mode ?? "institutional";
  const universeRows = input.rows;
  const visibleRows = visibleRowsForMode(universeRows, mode, input.watchlistSymbols ?? []);
  const baseRows = mode === "watchlist" ? visibleRows : visibleRows.length ? visibleRows : universeRows;
  const institutionalSystem = buildInstitutionalPressureSystem(baseRows);
  const institutionalBySymbol = new Map(institutionalSystem.rows.map((model) => [model.symbol, model]));
  const metaSystem = buildTradeVetoOperatingSystem({
    personalizationProfile: input.personalizationProfile ?? null,
    rows: baseRows,
    workflowEvolution: input.workflowEvolution ?? null,
  });
  const regimeSystem = buildRegimeShiftSystem({ rows: universeRows, workflowEvolution: input.workflowEvolution ?? null });
  const groups = groupsBySector(baseRows, institutionalBySymbol);
  const clusters = opportunityClusters(baseRows, institutionalBySymbol);

  return {
    clusters,
    executiveBriefing: executiveBriefingFor(metaSystem.executiveBriefing, clusters, institutionalSystem.rows),
    generatedAt: metaSystem.generatedAt,
    heatmaps: buildHeatmaps(groups),
    limitations: [
      "Dashboard heatmaps are derived from the latest persisted scanner, macro, event, shock, narrative, and institutional-pressure fields.",
      "Cluster labels describe observed market structure; they do not claim hidden institutional flows or deterministic future moves.",
      "Research context only. Not financial advice.",
    ],
    marketState: {
      label: regimeSystem.currentMarketState,
      metrics: marketMetrics(regimeSystem, baseRows),
      summary: regimeSystem.terminalSummary,
    },
    mode,
    opportunityMap: opportunityMapFor(metaSystem.priorityQueue, institutionalBySymbol),
    universeCount: universeRows.length,
    visibleCount: baseRows.length,
  };
}

function visibleRowsForMode(rows: OpportunityViewModel[], mode: InstitutionalDashboardMode, watchlistSymbols: string[]): OpportunityViewModel[] {
  const watchlist = new Set(watchlistSymbols.map((symbol) => symbol.toUpperCase()));
  if (mode === "watchlist") return rows.filter((row) => watchlist.has(row.symbol));
  if (mode === "conservative") return rows.filter((row) => row.fragility <= 62 && row.conviction >= 50 && (row.final_score ?? 0) >= 45);
  if (mode === "aggressive") return rows.filter((row) => row.conviction >= 48 || (row.shockPattern?.opportunityScore ?? 0) >= 58 || (row.final_score ?? 0) >= 55);
  if (mode === "macro") return rows.filter((row) => scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score, 50) >= 48 || scoreValue(row.raw.macro_pressure_score, 50) >= 60);
  if (mode === "volatility") return rows.filter((row) => row.fragility >= 58 || scoreValue(row.raw.volatility_pressure, 50) >= 58 || (row.shockPattern?.twoSidedVolatilityScore ?? 0) >= 58);
  return rows;
}

function buildHeatmaps(groups: GroupAggregate[]): InstitutionalHeatmap[] {
  return [
    heatmap("sector", "Sector Leadership Heatmap", "Opportunity quality by sector or theme.", groups, sectorLeadershipScore),
    heatmap("fragility", "Fragility Zones", "Higher values mark more fragile market areas.", groups, fragilityScore, true),
    heatmap("asymmetry", "Asymmetry Heatmap", "Where reward/risk and institutional pressure look more favorable.", groups, asymmetryScore),
    heatmap("macro", "Macro Alignment Map", "Broad market and sector alignment by group.", groups, macroScore),
    heatmap("volatility", "Volatility Pressure Map", "Higher values mark more unstable continuation conditions.", groups, volatilityScore, true),
    heatmap("liquidity", "Liquidity Pressure Map", "Higher values mark less supportive liquidity context.", groups, liquidityScore, true),
    heatmap("shock", "Shock Opportunity Map", "Historical shock potential and two-sided volatility context.", groups, shockScore),
  ];
}

function heatmap(
  kind: InstitutionalHeatmapKind,
  title: string,
  description: string,
  groups: GroupAggregate[],
  scorer: (group: GroupAggregate) => number,
  inverse = false,
): InstitutionalHeatmap {
  const cells = groups
    .map((group) => {
      const score = Math.round(clamp(scorer(group)));
      const leaders = group.rows
        .slice()
        .sort((left, right) => scoreValue(right.final_score, 0) - scoreValue(left.final_score, 0))
        .slice(0, 5)
        .map((row) => row.symbol);
      return {
        count: group.rows.length,
        detail: cellDetail(kind, group, score, inverse),
        key: `${kind}:${sectorLabel(group.rows[0])}`,
        label: sectorLabel(group.rows[0]),
        score,
        symbols: leaders,
        tone: toneFor(score, inverse),
      };
    })
    .sort((left, right) => right.score - left.score || right.count - left.count)
    .slice(0, 12);

  return { cells, description, kind, title };
}

function groupsBySector(rows: OpportunityViewModel[], institutionalBySymbol: Map<string, InstitutionalIntelligence>): GroupAggregate[] {
  const grouped = new Map<string, GroupAggregate>();
  for (const row of rows) {
    const key = sectorLabel(row);
    const aggregate = grouped.get(key) ?? { models: [], rows: [] };
    aggregate.rows.push(row);
    const model = institutionalBySymbol.get(row.symbol);
    if (model) aggregate.models.push(model);
    grouped.set(key, aggregate);
  }
  return Array.from(grouped.values()).sort((left, right) => right.rows.length - left.rows.length);
}

function opportunityClusters(rows: OpportunityViewModel[], institutionalBySymbol: Map<string, InstitutionalIntelligence>): InstitutionalDashboardCluster[] {
  const specs: ClusterSpec[] = [
    {
      detail: "Semiconductor and AI-linked momentum rows with improving conviction or shock support.",
      key: "ai_momentum_cluster",
      label: "AI Momentum Cluster",
      rows: rows.filter((row) => isAiOrSemiconductor(row) && (isMomentum(row) || row.conviction >= 62 || (row.shockPattern?.upsideShockScore ?? 0) >= 62)),
      type: "opportunity",
    },
    {
      detail: "Semiconductor-linked setups with sector support and institutional-quality characteristics.",
      key: "semiconductor_expansion",
      label: "Semiconductor Expansion Cluster",
      rows: rows.filter((row) => isSemiconductor(row) && (scoreValue(row.raw.sector_alignment_score, row.conviction) >= 55 || (institutionalBySymbol.get(row.symbol)?.institutionalQualityScore ?? 0) >= 58)),
      type: "opportunity",
    },
    {
      detail: "Defensive sectors or defensive proxies gaining priority while risk pressure stays elevated.",
      key: "defensive_rotation",
      label: "Defensive Rotation Cluster",
      rows: rows.filter((row) => isDefensive(row) && (row.conviction >= 50 || row.fragility <= 58)),
      type: "rotation",
    },
    {
      detail: "Energy, oil, metals, or crypto-linked rows with elevated shock or volatility context.",
      key: "commodity_shock",
      label: "Commodity / Macro Shock Cluster",
      rows: rows.filter((row) => isCommodity(row) && ((row.shockPattern?.twoSidedVolatilityScore ?? 0) >= 55 || scoreValue(row.raw.volatility_pressure, row.fragility) >= 58)),
      type: "shock",
    },
    {
      detail: "Rows where volatility pressure is contained and setup quality is still active.",
      key: "volatility_compression",
      label: "Volatility Compression Cluster",
      rows: rows.filter((row) => scoreValue(row.raw.volatility_pressure, row.fragility) <= 45 && row.conviction >= 52),
      type: "macro",
    },
    {
      detail: "Strong signals that may be late, crowded, or structurally fragile.",
      key: "high_fragility_zone",
      label: "High Fragility Zone",
      rows: rows.filter((row) => row.fragility >= 70 || (institutionalBySymbol.get(row.symbol)?.crowdingRiskScore ?? 0) >= 70),
      type: "risk",
    },
    {
      detail: "Rows with stronger liquidity, macro alignment, position quality, and institutional-style durability.",
      key: "institutional_quality_cluster",
      label: "Institutional Quality Cluster",
      rows: rows.filter((row) => (institutionalBySymbol.get(row.symbol)?.institutionalQualityScore ?? 0) >= 66),
      type: "opportunity",
    },
  ];

  return specs
    .filter((spec) => spec.rows.length > 0)
    .map((spec) => {
      const models = spec.rows.map((row) => institutionalBySymbol.get(row.symbol)).filter((model): model is InstitutionalIntelligence => Boolean(model));
      const score = Math.round(clamp(average([
        average(spec.rows.map((row) => row.conviction), 50),
        average(models.map((model) => model.institutionalQualityScore), 50),
        spec.type === "risk" ? average(models.map((model) => model.institutionalFragility), 50) : average(models.map((model) => model.asymmetryScore), 50),
      ], 50)));
      const leaders = spec.rows
        .slice()
        .sort((left, right) => clusterLeaderScore(right, institutionalBySymbol) - clusterLeaderScore(left, institutionalBySymbol))
        .slice(0, 6)
        .map((row) => row.symbol);
      return { count: spec.rows.length, detail: spec.detail, key: spec.key, label: spec.label, leaders, score, type: spec.type };
    })
    .sort((left, right) => right.score - left.score || right.count - left.count)
    .slice(0, 8);
}

function marketMetrics(regimeSystem: ReturnType<typeof buildRegimeShiftSystem>, rows: OpportunityViewModel[]): InstitutionalDashboardMetric[] {
  return [
    metric("breadth_health", "Breadth Health", regimeSystem.breadthHealthScore, "Participation breadth across the latest scanner universe."),
    metric("exchange_health", "Exchange Health", regimeSystem.exchangeHealthScore, "Exchange and broad-market support for current setups."),
    metric("macro_alignment", "Macro Alignment", average(rows.map((row) => scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score, 50)), 50), "Macro alignment across visible dashboard rows."),
    metric("narrative_momentum", "Narrative Momentum", average(rows.map((row) => row.narrative?.narrativeDrift.momentumScore ?? scoreValue(row.raw.score_change, 50)), 50), "Whether setup narratives are strengthening or fading."),
    metric("volatility_pressure", "Volatility Pressure", regimeSystem.volatilityPressure, "Elevated volatility pressure increases two-sided risk.", true),
    metric("liquidity_pressure", "Liquidity Pressure", regimeSystem.liquidityPressure, "Elevated liquidity pressure can weaken follow-through.", true),
    metric("shock_pressure", "Shock Pressure", average(rows.map((row) => row.shockPattern?.twoSidedVolatilityScore ?? row.shockPattern?.opportunityScore ?? 45), 45), "Historical shock and two-sided volatility context."),
    metric("fragility_pressure", "Fragility Pressure", average(rows.map((row) => row.fragility), 50), "Average fragility across visible dashboard rows.", true),
  ];
}

function metric(key: string, label: string, value: number, detail: string, inverse = false): InstitutionalDashboardMetric {
  const score = Math.round(clamp(value));
  return { detail, inverse, key, label, score, tone: toneFor(score, inverse) };
}

function opportunityMapFor(priorityQueue: MetaOpportunityPriority[], institutionalBySymbol: Map<string, InstitutionalIntelligence>): InstitutionalDashboardOpportunityMap {
  const byInstitutional = (predicate: (model: InstitutionalIntelligence) => boolean, sorter: (left: InstitutionalIntelligence, right: InstitutionalIntelligence) => number) => {
    const symbols = Array.from(institutionalBySymbol.values()).filter(predicate).sort(sorter).slice(0, 6).map((model) => model.symbol);
    return priorityQueue.filter((item) => symbols.includes(item.symbol)).slice(0, 6);
  };
  return {
    bestAsymmetry: byInstitutional((model) => model.asymmetryScore >= 62, (left, right) => right.asymmetryScore - left.asymmetryScore),
    deteriorating: priorityQueue.filter((item) => item.keyRisks.some((risk) => /deteriorat|fragility|liquidity|volatility|crowding|regime/i.test(risk))).slice(0, 6),
    highestFragility: byInstitutional((model) => model.institutionalFragility >= 62 || model.dangerAlerts.length > 0, (left, right) => right.institutionalFragility - left.institutionalFragility),
    improving: priorityQueue.filter((item) => item.keyReasons.some((reason) => /improv|support|asymmetry|institutional|shock/i.test(reason))).slice(0, 6),
    institutionalQuality: byInstitutional((model) => model.institutionalQualityScore >= 62, (left, right) => right.institutionalQualityScore - left.institutionalQualityScore),
    shockOpportunities: priorityQueue.filter((item) => item.category === "Shock Opportunity" || /shock|volatility/i.test(item.state)).slice(0, 6),
    strongest: priorityQueue.slice(0, 8),
  };
}

function executiveBriefingFor(metaLines: string[], clusters: InstitutionalDashboardCluster[], models: InstitutionalIntelligence[]): string[] {
  const cluster = clusters[0];
  const danger = models.slice().sort((left, right) => right.institutionalFragility - left.institutionalFragility)[0];
  const quality = models.slice().sort((left, right) => right.institutionalQualityScore - left.institutionalQualityScore)[0];
  const lines = [
    ...metaLines.slice(0, 3),
    cluster ? `${cluster.label} is the leading detected cluster with ${cluster.count} symbols and ${cluster.score}/100 cluster strength.` : "No dominant opportunity cluster is confirmed in the visible universe.",
    quality ? `${quality.symbol} leads institutional quality at ${quality.institutionalQualityScore}/100; use this as research context, not an instruction.` : "Institutional quality leaders are not available yet.",
    danger ? `${danger.symbol} is the highest visible fragility pressure at ${danger.institutionalFragility}/100.` : "No major fragility warning is active.",
  ];
  return dedupe(lines).slice(0, 7);
}

function sectorLeadershipScore(group: GroupAggregate): number {
  return average([
    average(group.rows.map((row) => scoreValue(row.final_score, 50)), 50),
    average(group.rows.map((row) => row.conviction), 50),
    average(group.models.map((model) => model.institutionalQualityScore), 50),
    average(group.models.map((model) => model.netMarketPressureScore), 50),
  ], 50);
}

function fragilityScore(group: GroupAggregate): number {
  return average([
    average(group.rows.map((row) => row.fragility), 50),
    average(group.models.map((model) => model.crowdingRiskScore), 50),
    average(group.models.map((model) => model.institutionalFragility), 50),
  ], 50);
}

function asymmetryScore(group: GroupAggregate): number {
  return average(group.models.map((model) => model.asymmetryScore), 50);
}

function macroScore(group: GroupAggregate): number {
  return average(group.rows.map((row) => scoreValue(row.raw.macro_alignment_score ?? row.raw.macro_score, 50)), 50);
}

function volatilityScore(group: GroupAggregate): number {
  return average(group.rows.map((row) => scoreValue(row.raw.volatility_pressure, row.fragility)), 50);
}

function liquidityScore(group: GroupAggregate): number {
  return average(group.rows.map((row) => scoreValue(row.raw.liquidity_pressure, 50)), 50);
}

function shockScore(group: GroupAggregate): number {
  return average(group.rows.map((row) => row.shockPattern ? average([row.shockPattern.opportunityScore, row.shockPattern.upsideShockScore, row.shockPattern.twoSidedVolatilityScore], 50) : 45), 45);
}

function cellDetail(kind: InstitutionalHeatmapKind, group: GroupAggregate, score: number, inverse: boolean): string {
  const leaders = group.rows.slice(0, 3).map((row) => row.symbol).join(", ");
  const posture = inverse ? (score >= 65 ? "elevated pressure" : score <= 44 ? "contained pressure" : "mixed pressure") : (score >= 65 ? "constructive" : score <= 44 ? "weak" : "mixed");
  return `${humanizeLabel(kind)} reads ${posture} at ${score}/100 across ${group.rows.length} symbols${leaders ? `; leaders: ${leaders}` : ""}.`;
}

function clusterLeaderScore(row: OpportunityViewModel, institutionalBySymbol: Map<string, InstitutionalIntelligence>): number {
  const model = institutionalBySymbol.get(row.symbol);
  return average([row.conviction, scoreValue(row.final_score, 50), model?.institutionalQualityScore ?? 50, model?.asymmetryScore ?? 50], 50);
}

function sectorLabel(row: OpportunityViewModel | undefined): string {
  const label = cleanText(row?.sector ?? row?.assetType, "Unclassified");
  return humanizeLabel(label, "Unclassified");
}

function isAiOrSemiconductor(row: OpportunityViewModel): boolean {
  const haystack = rowText(row);
  return isSemiconductor(row) || /\b(ai|artificial intelligence|software|cloud|chip|datacenter|data center)\b/i.test(haystack);
}

function isSemiconductor(row: OpportunityViewModel): boolean {
  const haystack = rowText(row);
  return /\b(semiconductor|chip|nvda|amd|mu|tsm|avgo|asml|amat|lrcx|qcom|smh)\b/i.test(haystack);
}

function isDefensive(row: OpportunityViewModel): boolean {
  const haystack = rowText(row);
  return /\b(health|utilities|utility|staples|consumer defensive|gold|gld|treasury|bond|tlt|defensive)\b/i.test(haystack);
}

function isCommodity(row: OpportunityViewModel): boolean {
  const haystack = rowText(row);
  return /\b(energy|oil|gas|commodity|gold|silver|miner|uso|gld|oxy|xle|btc|ibit|crypto)\b/i.test(haystack);
}

function isMomentum(row: OpportunityViewModel): boolean {
  const setup = cleanText(row.raw.setup_type, "").toLowerCase();
  return setup.includes("momentum") || setup.includes("breakout") || setup.includes("continuation");
}

function rowText(row: OpportunityViewModel): string {
  return [row.symbol, row.company_name, row.sector, row.assetType, row.raw.setup_type, row.narrative?.narrativeSummary].map((value) => cleanText(value, "")).join(" ");
}

function toneFor(score: number, inverse = false): InstitutionalHeatmapTone {
  if (inverse) {
    if (score >= 68) return "risk";
    if (score <= 42) return "constructive";
    return "mixed";
  }
  if (score >= 65) return "constructive";
  if (score < 45) return "risk";
  return "mixed";
}

function scoreValue(value: unknown, fallback: number): number {
  const parsed = finiteNumber(value);
  return Math.round(clamp(parsed === null || Number.isNaN(parsed) ? fallback : parsed));
}

function average(values: Array<number | null | undefined>, fallback: number): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function institutionalDashboardScoreLabel(score: number, inverse = false): string {
  const tone = toneFor(score, inverse);
  if (tone === "constructive") return inverse ? "Contained" : "Constructive";
  if (tone === "risk") return inverse ? "Elevated Risk" : "Weak";
  return "Mixed";
}

export function institutionalDashboardMetricLine(item: MetaOpportunityPriority): string {
  return `${item.symbol}: ${item.category}, opportunity ${formatNumber(item.metaOpportunityScore, 0)}/100, risk ${formatNumber(item.metaRiskScore, 0)}/100.`;
}
