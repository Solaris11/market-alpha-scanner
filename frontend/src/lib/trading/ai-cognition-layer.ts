import type { DataFreshnessStatus } from "@/lib/data-health";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { WorkflowChangeItem, WorkflowEvolutionSummary } from "./workflow-evolution";

export type CognitionTone = "constructive" | "caution" | "risk" | "neutral" | "intelligence";

export type ReasoningTimelineItem = {
  deltaLabel: string;
  detail: string;
  evidence: string[];
  id: string;
  source: "scanner" | "workflow" | "macro" | "replay" | "freshness";
  symbols: string[];
  title: string;
  tone: CognitionTone;
};

export type ConfidenceDecayItem = {
  ageMinutes: number | null;
  detail: string;
  evidence: string[];
  freshnessLabel: string;
  lastUpdated: string | null;
  status: DataFreshnessStatus;
  symbol: string;
  tone: CognitionTone;
};

export type ContradictionItem = {
  detail: string;
  evidence: string[];
  id: string;
  severity: "high" | "medium" | "low";
  symbol: string;
  title: string;
};

export type NarrativeEvolutionItem = {
  detail: string;
  evidence: string[];
  id: string;
  symbols: string[];
  title: string;
  tone: CognitionTone;
};

export type AICognitionLayerModel = {
  confidenceDecay: ConfidenceDecayItem[];
  contradictions: ContradictionItem[];
  copilotGroundingPrompts: string[];
  generatedAt: string;
  groundingPacket: string[];
  narrativeEvolution: NarrativeEvolutionItem[];
  overview: string;
  posture: "becoming_more_constructive" | "becoming_more_cautious" | "mixed" | "baseline";
  timeline: ReasoningTimelineItem[];
};

export type BuildAICognitionLayerInput = {
  generatedAt?: string;
  marketCondition: string;
  rows: OpportunityViewModel[];
  scanUpdatedAt?: string | null;
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export function buildAICognitionLayer(input: BuildAICognitionLayerInput): AICognitionLayerModel {
  const rows = input.rows.slice(0, 80);
  const workflow = input.workflowEvolution ?? null;
  const timeline = buildReasoningTimeline({ marketCondition: input.marketCondition, rows, workflow });
  const confidenceDecay = buildConfidenceDecay(rows);
  const contradictions = buildContradictions(rows);
  const narrativeEvolution = buildNarrativeEvolution({ marketCondition: input.marketCondition, rows, workflow });
  const posture = postureFor({ contradictions, timeline, workflow });
  const overview = overviewFor({ confidenceDecay, contradictions, marketCondition: input.marketCondition, posture, timeline });
  const groundingPacket = [
    `${rows.length} scanner opportunity rows evaluated.`,
    workflow ? `${workflow.whatChanged.length} workflow changes, ${workflow.improvingSetups.length} improving setups, ${workflow.deterioratingSetups.length} deteriorating setups.` : "No prior workflow snapshot is available yet.",
    input.scanUpdatedAt ? `Latest scan timestamp: ${input.scanUpdatedAt}.` : "Latest scan timestamp is unavailable.",
    `${contradictions.length} contradiction checks surfaced from deterministic row fields.`,
  ];

  return {
    confidenceDecay,
    contradictions,
    copilotGroundingPrompts: [
      "Why did this change?",
      "What is contradicting this setup?",
      "What is stale?",
      "What needs confirmation?",
      "What changed since yesterday?",
    ],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    groundingPacket,
    narrativeEvolution,
    overview,
    posture,
    timeline,
  };
}

function buildReasoningTimeline(input: {
  marketCondition: string;
  rows: OpportunityViewModel[];
  workflow: WorkflowEvolutionSummary | null;
}): ReasoningTimelineItem[] {
  const timeline: ReasoningTimelineItem[] = [{
    deltaLabel: input.workflow ? "Compared with prior workflow snapshot" : "Baseline snapshot",
    detail: `${input.marketCondition} is the current market-state label. TradeVeto is using scanner rows, workflow drift, freshness, and risk pressure as research context.`,
    evidence: [
      `${input.rows.length} latest scanner rows available.`,
      input.workflow?.dailyBrief[0] ?? "No previous workflow visit is available, so this is the baseline view.",
    ],
    id: "market-state-baseline",
    source: "macro",
    symbols: [],
    title: "Market view established",
    tone: "intelligence",
  }];

  for (const change of (input.workflow?.whatChanged ?? []).slice(0, 4)) {
    timeline.push(changeToTimeline(change, "workflow"));
  }
  for (const change of (input.workflow?.improvingSetups ?? []).slice(0, 3)) {
    timeline.push(changeToTimeline(change, "workflow"));
  }
  for (const change of (input.workflow?.deterioratingSetups ?? []).slice(0, 3)) {
    timeline.push(changeToTimeline(change, "workflow"));
  }

  const staleRows = input.rows.filter((row) => row.dataFreshness.status === "stale" || row.dataFreshness.status === "slightly_stale").slice(0, 3);
  if (staleRows.length) {
    timeline.push({
      deltaLabel: `${staleRows.length} aging signal${staleRows.length === 1 ? "" : "s"}`,
      detail: `${staleRows.map((row) => row.symbol).join(", ")} need freshness confirmation before confidence should be treated as current.`,
      evidence: staleRows.map((row) => `${row.symbol}: ${row.dataFreshness.message}`),
      id: "freshness-decay",
      source: "freshness",
      symbols: staleRows.map((row) => row.symbol),
      title: "Some signals are aging",
      tone: "caution",
    });
  }

  return timeline.slice(0, 9);
}

function changeToTimeline(change: WorkflowChangeItem, source: ReasoningTimelineItem["source"]): ReasoningTimelineItem {
  return {
    deltaLabel: change.metricLabel,
    detail: change.detail,
    evidence: [`${change.symbol}: ${change.title}`, change.metricLabel],
    id: `${source}:${change.symbol}:${change.changeType}:${change.title}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-"),
    source,
    symbols: change.symbol === "WORKFLOW" ? [] : [change.symbol],
    title: change.title,
    tone: change.severity === "positive" ? "constructive" : change.severity === "warning" ? "caution" : "neutral",
  };
}

function buildConfidenceDecay(rows: OpportunityViewModel[]): ConfidenceDecayItem[] {
  const selected = [...rows]
    .sort((left, right) => freshnessRank(right.dataFreshness.status) - freshnessRank(left.dataFreshness.status) || right.fragility - left.fragility)
    .slice(0, 6);
  return selected.map((row) => {
    const evidence = [
      row.dataFreshness.message,
      `${row.evidence?.label ?? "Evidence maturity unavailable"}; ${row.evidence?.evidenceSampleSize ?? 0} samples.`,
      `Current conviction ${row.conviction}/100; fragility ${row.fragility}/100.`,
    ];
    return {
      ageMinutes: row.dataFreshness.ageMinutes,
      detail: confidenceDecayDetail(row),
      evidence,
      freshnessLabel: row.dataFreshness.label,
      lastUpdated: row.dataFreshness.lastUpdated,
      status: row.dataFreshness.status,
      symbol: row.symbol,
      tone: row.dataFreshness.status === "fresh" ? "constructive" : row.dataFreshness.status === "slightly_stale" ? "caution" : "risk",
    };
  });
}

function confidenceDecayDetail(row: OpportunityViewModel): string {
  if (row.dataFreshness.status === "fresh") {
    return `${row.symbol} is fresh. Confidence still depends on evidence maturity and whether risk stays controlled.`;
  }
  if (row.dataFreshness.status === "slightly_stale") {
    return `${row.symbol} is slightly stale. Treat the setup as monitor-only until a newer scan confirms the same state.`;
  }
  if (row.dataFreshness.status === "stale") {
    return `${row.symbol} is stale. The prior setup may no longer represent the current market.`;
  }
  return `${row.symbol} does not have enough timestamp evidence to treat confidence as current.`;
}

function buildContradictions(rows: OpportunityViewModel[]): ContradictionItem[] {
  const contradictions: ContradictionItem[] = [];
  for (const row of rows.slice(0, 40)) {
    const finalScore = row.final_score ?? 0;
    const macroScore = numberField(row.raw.macro_alignment_score ?? row.raw.macro_score);
    const momentumScore = numberField(row.raw.momentum_score ?? row.raw.technical_score ?? row.raw.quality_score);
    const breadthScore = numberField(row.raw.breadth_score ?? row.raw.exchange_health_score);
    const riskReward = numberField(row.raw.risk_reward ?? row.raw.conservative_risk_reward);
    const volatilityPressure = numberField(row.raw.volatility_pressure);

    if (finalScore >= 70 && (row.evidence?.tier === "limited" || (row.evidence?.evidenceSampleSize ?? 0) < 20)) {
      contradictions.push({
        detail: "The scanner score is high, but the historical evidence packet is still limited. This should be framed as attention-worthy, not proven.",
        evidence: [`Score ${Math.round(finalScore)}/100`, `${row.evidence?.label ?? "Limited evidence"}; ${row.evidence?.evidenceSampleSize ?? 0} samples`],
        id: `${row.symbol}:high-score-low-evidence`,
        severity: "medium",
        symbol: row.symbol,
        title: "High score, low evidence",
      });
    }

    if ((momentumScore ?? 0) >= 70 && (breadthScore ?? 100) <= 45) {
      contradictions.push({
        detail: "Momentum is constructive, but breadth or exchange health is weak. The setup may be more isolated than it looks.",
        evidence: [`Momentum/technical ${Math.round(momentumScore ?? 0)}/100`, `Breadth/exchange ${Math.round(breadthScore ?? 0)}/100`],
        id: `${row.symbol}:momentum-breadth-conflict`,
        severity: "high",
        symbol: row.symbol,
        title: "Momentum conflicts with breadth",
      });
    }

    if ((macroScore ?? 100) <= 45 && finalScore >= 60) {
      contradictions.push({
        detail: "Symbol-level quality is visible, but macro alignment is weak. Market context may reduce follow-through quality.",
        evidence: [`Score ${Math.round(finalScore)}/100`, `Macro alignment ${Math.round(macroScore ?? 0)}/100`, row.macroLabel],
        id: `${row.symbol}:macro-conflict`,
        severity: "medium",
        symbol: row.symbol,
        title: "Setup quality with macro pressure",
      });
    }

    if (row.shockPattern && row.shockPattern.downsideRiskScore >= 65 && finalScore >= 55) {
      contradictions.push({
        detail: "A setup can look interesting while downside shock risk is elevated. Late entries need extra confirmation.",
        evidence: [`Downside shock ${row.shockPattern.downsideRiskScore}/100`, `Current score ${Math.round(finalScore)}/100`],
        id: `${row.symbol}:shock-risk-setup`,
        severity: "high",
        symbol: row.symbol,
        title: "Setup visible, shock risk elevated",
      });
    }

    if ((riskReward ?? 2) < 1 && finalScore >= 55) {
      contradictions.push({
        detail: "The symbol is still in the attention set, but the reward/risk relationship is not attractive enough for clean execution context.",
        evidence: [`Risk/reward ${riskReward?.toFixed(2) ?? "unavailable"}`, `Score ${Math.round(finalScore)}/100`],
        id: `${row.symbol}:poor-risk-reward`,
        severity: "medium",
        symbol: row.symbol,
        title: "Attention with poor risk/reward",
      });
    }

    if ((volatilityPressure ?? 0) >= 70 && row.conviction >= 60) {
      contradictions.push({
        detail: "Readiness is present, but volatility pressure is high. Confirmation quality matters more than the headline score.",
        evidence: [`Conviction ${row.conviction}/100`, `Volatility pressure ${Math.round(volatilityPressure ?? 0)}/100`],
        id: `${row.symbol}:confidence-volatility-conflict`,
        severity: "medium",
        symbol: row.symbol,
        title: "Confidence with volatility pressure",
      });
    }
  }
  return uniqueContradictions(contradictions).slice(0, 8);
}

function buildNarrativeEvolution(input: {
  marketCondition: string;
  rows: OpportunityViewModel[];
  workflow: WorkflowEvolutionSummary | null;
}): NarrativeEvolutionItem[] {
  const items: NarrativeEvolutionItem[] = [];
  const workflow = input.workflow;
  if (workflow?.dailyBrief.length) {
    items.push({
      detail: workflow.dailyBrief[0],
      evidence: workflow.dailyBrief.slice(0, 3),
      id: "workflow-daily-brief",
      symbols: symbolsFromText(workflow.dailyBrief.join(" "), input.rows),
      title: "Story changed since the prior workflow",
      tone: "intelligence",
    });
  } else {
    items.push({
      detail: `This is the current baseline story: market condition is ${input.marketCondition}, and narrative evolution will deepen after repeated user workflow snapshots.`,
      evidence: [`${input.rows.length} scanner rows in current packet`, "No prior workflow snapshot available"],
      id: "baseline-story",
      symbols: [],
      title: "Baseline story established",
      tone: "neutral",
    });
  }

  const improved = workflow?.improvingSetups.slice(0, 3) ?? [];
  if (improved.length) {
    items.push({
      detail: improved.map((item) => `${item.symbol}: ${item.detail}`).join(" "),
      evidence: improved.map((item) => `${item.symbol}: ${item.metricLabel}`),
      id: "what-improved",
      symbols: improved.map((item) => item.symbol),
      title: "What improved",
      tone: "constructive",
    });
  }

  const weakened = workflow?.deterioratingSetups.slice(0, 3) ?? [];
  if (weakened.length) {
    items.push({
      detail: weakened.map((item) => `${item.symbol}: ${item.detail}`).join(" "),
      evidence: weakened.map((item) => `${item.symbol}: ${item.metricLabel}`),
      id: "what-weakened",
      symbols: weakened.map((item) => item.symbol),
      title: "What weakened",
      tone: "caution",
    });
  }

  const uncertain = input.rows
    .filter((row) => row.confidenceLabel === "Weak" || row.confidenceLabel === "Avoid" || row.evidence?.tier === "limited")
    .slice(0, 4);
  if (uncertain.length) {
    items.push({
      detail: `${uncertain.map((row) => row.symbol).join(", ")} still need confirmation because confidence, evidence maturity, or current decision quality is not strong enough.`,
      evidence: uncertain.map((row) => `${row.symbol}: ${row.confidenceLabel}, ${row.evidence?.label ?? "evidence unavailable"}`),
      id: "what-remains-uncertain",
      symbols: uncertain.map((row) => row.symbol),
      title: "What remains uncertain",
      tone: "caution",
    });
  }

  return items.slice(0, 5);
}

function postureFor(input: {
  contradictions: ContradictionItem[];
  timeline: ReasoningTimelineItem[];
  workflow: WorkflowEvolutionSummary | null;
}): AICognitionLayerModel["posture"] {
  const positiveChanges = input.timeline.filter((item) => item.tone === "constructive").length + (input.workflow?.improvingSetups.length ?? 0);
  const cautionChanges = input.timeline.filter((item) => item.tone === "caution" || item.tone === "risk").length + (input.workflow?.deterioratingSetups.length ?? 0) + input.contradictions.filter((item) => item.severity === "high").length;
  if (!input.workflow) return "baseline";
  if (cautionChanges > positiveChanges + 1) return "becoming_more_cautious";
  if (positiveChanges > cautionChanges + 1) return "becoming_more_constructive";
  return "mixed";
}

function overviewFor(input: {
  confidenceDecay: ConfidenceDecayItem[];
  contradictions: ContradictionItem[];
  marketCondition: string;
  posture: AICognitionLayerModel["posture"];
  timeline: ReasoningTimelineItem[];
}): string {
  const staleCount = input.confidenceDecay.filter((item) => item.status === "stale" || item.status === "slightly_stale").length;
  const contradictionCount = input.contradictions.length;
  const postureCopy = input.posture === "becoming_more_cautious"
    ? "the system is becoming more cautious"
    : input.posture === "becoming_more_constructive"
      ? "the system is becoming more constructive"
      : input.posture === "baseline"
        ? "this is the baseline cognition snapshot"
        : "the system view is mixed";
  return `${input.marketCondition}: ${postureCopy}. ${input.timeline.length} reasoning steps, ${contradictionCount} contradiction checks, and ${staleCount} aging signal checks are visible. Research context only.`;
}

function freshnessRank(status: DataFreshnessStatus): number {
  if (status === "stale") return 4;
  if (status === "slightly_stale") return 3;
  if (status === "missing" || status === "schema_mismatch") return 2;
  return 1;
}

function numberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueContradictions(items: ContradictionItem[]): ContradictionItem[] {
  const seen = new Set<string>();
  const unique: ContradictionItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}

function severityRank(value: ContradictionItem["severity"]): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function symbolsFromText(text: string, rows: OpportunityViewModel[]): string[] {
  const upper = text.toUpperCase();
  return rows
    .map((row) => row.symbol)
    .filter((symbol) => new RegExp(`(^|[^A-Z0-9.])${escapeRegExp(symbol)}([^A-Z0-9.]|$)`).test(upper))
    .slice(0, 8);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
