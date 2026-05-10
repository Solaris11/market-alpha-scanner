import { clamp, cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { LiveIntelligenceSystem } from "./live-intelligence";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { PortfolioIntelligenceSystem } from "./portfolio-intelligence";
import type { RegimeShiftSystem } from "./regime-shift-intelligence";
import type { ScenarioIntelligenceSystem } from "./scenario-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

export type ResearchAgentId =
  | "earnings_event"
  | "macro_event"
  | "narrative"
  | "portfolio_risk"
  | "sector_shift"
  | "shock"
  | "volatility";

export type ResearchAgentSeverity = "critical" | "info" | "risk" | "watch";
export type ResearchAgentStatus = "active" | "quiet" | "watching";
export type ResearchAgentActionType = "opportunity_surface" | "portfolio_review" | "risk_escalation" | "summary" | "watchlist_suggestion";

export type ResearchAgentFinding = {
  detail: string;
  reasonCodes: string[];
  score: number;
  severity: ResearchAgentSeverity;
  sourceIds: string[];
  symbol?: string;
  title: string;
};

export type ResearchAgentAction = {
  actionType: ResearchAgentActionType;
  detail: string;
  label: string;
  priorityScore: number;
  reasonCodes: string[];
  symbol?: string;
};

export type ResearchAgentSummary = {
  agentId: ResearchAgentId;
  confidenceScore: number;
  keyFindings: ResearchAgentFinding[];
  label: string;
  lastCheckedAt: string;
  limitations: string[];
  opportunityCandidates: ResearchAgentAction[];
  recommendedActions: ResearchAgentAction[];
  riskEscalations: ResearchAgentAction[];
  severity: ResearchAgentSeverity;
  sourceIds: string[];
  status: ResearchAgentStatus;
  summary: string;
  watchlistCandidates: ResearchAgentAction[];
};

export type AutomatedResearchAgentsSystem = {
  agentSummaries: ResearchAgentSummary[];
  attentionQueue: ResearchAgentAction[];
  eventSummaries: ResearchAgentFinding[];
  generatedAt: string;
  limitations: string[];
  monitoringQueue: ResearchAgentAction[];
  narrativeShifts: ResearchAgentFinding[];
  opportunityCandidates: ResearchAgentAction[];
  portfolioAlerts: ResearchAgentFinding[];
  riskEscalations: ResearchAgentAction[];
  safetyBoundary: string;
  status: "active" | "limited" | "quiet";
  summary: string;
  watchlistUpdates: ResearchAgentAction[];
};

export type AutomatedResearchAgentsInput = {
  generatedAt?: string;
  liveSystem?: LiveIntelligenceSystem | null;
  portfolioSystem?: PortfolioIntelligenceSystem | null;
  regimeSystem?: RegimeShiftSystem | null;
  rows: OpportunityViewModel[];
  scenarioSystem?: ScenarioIntelligenceSystem | null;
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

type AgentContext = Required<Pick<AutomatedResearchAgentsInput, "rows">> & {
  generatedAt: string;
  liveSystem: LiveIntelligenceSystem | null;
  portfolioSystem: PortfolioIntelligenceSystem | null;
  regimeSystem: RegimeShiftSystem | null;
  scenarioSystem: ScenarioIntelligenceSystem | null;
  watchlist: Set<string>;
  workflowEvolution: WorkflowEvolutionSummary | null;
};

type SectorGroup = {
  averageConviction: number;
  averageFragility: number;
  averageMacro: number;
  averageScore: number;
  count: number;
  sector: string;
  symbols: string[];
};

export function buildAutomatedResearchAgentsSystem(input: AutomatedResearchAgentsInput): AutomatedResearchAgentsSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const context: AgentContext = {
    generatedAt,
    liveSystem: input.liveSystem ?? null,
    portfolioSystem: input.portfolioSystem ?? null,
    regimeSystem: input.regimeSystem ?? null,
    rows: input.rows,
    scenarioSystem: input.scenarioSystem ?? null,
    watchlist: new Set((input.watchlistSymbols ?? []).map((symbol) => cleanSymbol(symbol))),
    workflowEvolution: input.workflowEvolution ?? null,
  };
  const agentSummaries = [
    macroEventAgent(context),
    earningsEventAgent(context),
    sectorShiftAgent(context),
    volatilityAgent(context),
    shockAgent(context),
    narrativeAgent(context),
    portfolioRiskAgent(context),
  ];
  const riskEscalations = uniqueActions(agentSummaries.flatMap((agent) => agent.riskEscalations)).slice(0, 8);
  const opportunityCandidates = uniqueActions(agentSummaries.flatMap((agent) => agent.opportunityCandidates)).slice(0, 10);
  const watchlistUpdates = uniqueActions(agentSummaries.flatMap((agent) => agent.watchlistCandidates)).slice(0, 10);
  const monitoringQueue = uniqueActions(agentSummaries.flatMap((agent) => agent.recommendedActions)).slice(0, 12);
  const attentionQueue = uniqueActions([...riskEscalations, ...opportunityCandidates, ...watchlistUpdates, ...monitoringQueue])
    .sort((left, right) => right.priorityScore - left.priorityScore || left.label.localeCompare(right.label))
    .slice(0, 12);
  const activeAgents = agentSummaries.filter((agent) => agent.status === "active").length;
  const riskAgents = agentSummaries.filter((agent) => agent.severity === "risk" || agent.severity === "critical").length;
  const status = !context.rows.length ? "quiet" : activeAgents >= 2 || riskAgents > 0 ? "active" : "limited";

  return {
    agentSummaries,
    attentionQueue,
    eventSummaries: agentFindings(agentSummaries, ["earnings_event", "macro_event"]),
    generatedAt,
    limitations: [
      "Automated Research Agents monitor deterministic TradeVeto data; they do not place trades or mutate watchlists without user action.",
      "Agent summaries use scanner, macro, event, shock, narrative, live, and portfolio context already available in TradeVeto.",
      "Missing feeds, missing paper positions, or limited history reduce agent confidence and should be shown as limited coverage.",
      "LLM summaries may explain these packets later, but the monitoring logic remains deterministic and bounded.",
    ],
    monitoringQueue,
    narrativeShifts: agentFindings(agentSummaries, ["narrative", "sector_shift"]),
    opportunityCandidates,
    portfolioAlerts: agentFindings(agentSummaries, ["portfolio_risk"]),
    riskEscalations,
    safetyBoundary: "Research only. Not financial advice. Agents surface monitoring priorities, risk escalations, and watchlist suggestions from verified structured data only.",
    status,
    summary: systemSummary(agentSummaries, riskEscalations, opportunityCandidates, watchlistUpdates),
    watchlistUpdates,
  };
}

function macroEventAgent(context: AgentContext): ResearchAgentSummary {
  const regime = context.regimeSystem;
  const live = context.liveSystem;
  const findings: ResearchAgentFinding[] = [];
  if (regime) {
    for (const alert of regime.alerts.slice(0, 3)) {
      findings.push({
        detail: alert.detail,
        reasonCodes: alert.reasonCodes.length ? alert.reasonCodes : ["REGIME_SHIFT"],
        score: alert.score,
        severity: severityFromScore(alert.score, alert.severity === "critical"),
        sourceIds: ["regime_shift"],
        title: alert.title,
      });
    }
    if (regime.transitionRiskScore >= 65 || regime.volatilityPressure >= 68 || regime.liquidityPressure >= 68) {
      findings.push({
        detail: `${regime.currentMarketState}: transition ${regime.transitionRiskScore}/100, volatility ${regime.volatilityPressure}/100, liquidity ${regime.liquidityPressure}/100.`,
        reasonCodes: ["MACRO_MONITOR", "REGIME_PRESSURE"],
        score: Math.max(regime.transitionRiskScore, regime.volatilityPressure, regime.liquidityPressure),
        severity: severityFromScore(Math.max(regime.transitionRiskScore, regime.volatilityPressure, regime.liquidityPressure)),
        sourceIds: ["regime_shift"],
        title: "Macro and regime pressure watch",
      });
    }
  }
  if (live) {
    for (const alert of live.alerts.filter((alert) => alert.reasonCodes.some((code) => /REGIME|EVENT|VOLATILITY|LIQUIDITY/i.test(code))).slice(0, 2)) {
      findings.push({
        detail: alert.detail,
        reasonCodes: alert.reasonCodes,
        score: alert.score,
        severity: severityFromScore(alert.score, alert.severity === "critical"),
        sourceIds: ["live_intelligence"],
        title: alert.title,
      });
    }
  }
  const riskEscalations = findings
    .filter((finding) => finding.severity === "risk" || finding.severity === "critical")
    .map((finding) => actionFromFinding(finding, "risk_escalation"));
  const regimeTransitionRisk = regime?.transitionRiskScore ?? 55;
  const actions = [
    action("summary", "Monitor macro confirmation", "Watch whether volatility, breadth, and liquidity pressure persist into the next agent packet.", scoreFromFindings(findings, 55), ["MACRO_CONFIRMATION"]),
    ...(regime?.whatToMonitor ?? []).slice(0, 2).map((item) => action("summary", "Regime monitor", item, Math.max(55, regimeTransitionRisk), ["REGIME_MONITOR"])),
  ];
  return agentSummary({
    agentId: "macro_event",
    context,
    findings,
    label: "Macro Event Agent",
    recommendedActions: actions,
    riskEscalations,
    sourceIds: ["regime_shift", "live_intelligence", "scanner.latest"],
    summary: findings.length
      ? "Macro agent is watching regime pressure, event reaction, volatility, and liquidity changes."
      : "Macro agent sees no high-priority regime escalation in the latest packet.",
  });
}

function earningsEventAgent(context: AgentContext): ResearchAgentSummary {
  const eventRows = context.rows
    .map((row) => ({ row, score: eventPriority(row) }))
    .filter((item) => item.score >= 50 || eventText(item.row).length > 0)
    .sort((left, right) => right.score - left.score || left.row.symbol.localeCompare(right.row.symbol))
    .slice(0, 8);
  const findings = eventRows.slice(0, 5).map(({ row, score }) => ({
    detail: eventDetail(row, score),
    reasonCodes: eventReasonCodes(row),
    score,
    severity: severityFromScore(score),
    sourceIds: ["verified_event_context", "scanner.latest"],
    symbol: row.symbol,
    title: `${row.symbol} event context`,
  }));
  const watchlistCandidates = eventRows
    .filter(({ row, score }) => score >= 62 && !context.watchlist.has(row.symbol))
    .map(({ row, score }) => action("watchlist_suggestion", `${row.symbol} event watch`, `Add ${row.symbol} to the event watch queue because verified event pressure is ${Math.round(score)}/100.`, score, ["EVENT_WATCH"], row.symbol));
  const riskEscalations = findings
    .filter((finding) => finding.score >= 70)
    .map((finding) => actionFromFinding(finding, "risk_escalation"));
  return agentSummary({
    agentId: "earnings_event",
    context,
    findings,
    label: "Earnings and Event Agent",
    recommendedActions: eventRows.length
      ? eventRows.slice(0, 3).map(({ row, score }) => action("summary", `${row.symbol} event follow-up`, "Check whether the verified event remains fresh and whether price/volume confirms the reaction.", score, ["EVENT_FOLLOW_UP"], row.symbol))
      : [action("summary", "Event coverage limited", "No strong earnings/company-event pressure is confirmed in the latest packet.", 42, ["EVENT_COVERAGE_LIMITED"])],
    riskEscalations,
    sourceIds: ["verified_event_context", "scanner.latest"],
    summary: eventRows.length
      ? "Event agent found symbol-level events worth monitoring. It only uses verified event fields already present in TradeVeto data."
      : "Event agent has limited symbol-level event evidence in the latest packet.",
    watchlistCandidates,
  });
}

function sectorShiftAgent(context: AgentContext): ResearchAgentSummary {
  const groups = sectorGroups(context.rows);
  const leading = groups.filter((group) => group.averageScore >= 62 || group.averageConviction >= 64).slice(0, 3);
  const weakening = groups.filter((group) => group.averageFragility >= 66 || group.averageMacro <= 42).slice(0, 3);
  const findings: ResearchAgentFinding[] = [
    ...leading.map((group) => ({
      detail: `${group.sector} has average conviction ${group.averageConviction}/100 across ${group.count} symbols. Leading names: ${group.symbols.slice(0, 3).join(", ")}.`,
      reasonCodes: ["SECTOR_STRENGTH"],
      score: group.averageConviction,
      severity: severityFromScore(group.averageConviction, false, true),
      sourceIds: ["scanner.latest", "sector_context"],
      title: `${group.sector} strength`,
    })),
    ...weakening.map((group) => ({
      detail: `${group.sector} shows fragility ${group.averageFragility}/100 and macro alignment ${group.averageMacro}/100. Watch for rotation or narrowing breadth.`,
      reasonCodes: ["SECTOR_PRESSURE"],
      score: Math.max(group.averageFragility, 100 - group.averageMacro),
      severity: severityFromScore(Math.max(group.averageFragility, 100 - group.averageMacro)),
      sourceIds: ["scanner.latest", "sector_context"],
      title: `${group.sector} pressure`,
    })),
  ];
  const opportunityCandidates = context.rows
    .filter((row) => leading.some((group) => group.sector === normalizedSector(row)) && row.conviction >= 62 && row.fragility <= 72)
    .sort((left, right) => right.conviction - left.conviction || (right.final_score ?? 0) - (left.final_score ?? 0))
    .slice(0, 5)
    .map((row) => action("opportunity_surface", `${row.symbol} sector support`, `${row.symbol} is in a strengthening sector group. Monitor confirmation and avoid chasing extended entries.`, row.conviction, ["SECTOR_SUPPORT"], row.symbol));
  const watchlistCandidates = opportunityCandidates
    .filter((item) => item.symbol && !context.watchlist.has(item.symbol))
    .map((item) => ({ ...item, actionType: "watchlist_suggestion" as const, label: `${item.symbol} watchlist candidate` }));
  const riskEscalations = findings
    .filter((finding) => finding.reasonCodes.includes("SECTOR_PRESSURE") && finding.score >= 68)
    .map((finding) => actionFromFinding(finding, "risk_escalation"));
  return agentSummary({
    agentId: "sector_shift",
    context,
    findings,
    label: "Sector Shift Agent",
    opportunityCandidates,
    recommendedActions: [
      action("summary", "Track sector confirmation", "Compare leading sector candidates against breadth, macro alignment, and volatility pressure before treating them as actionable.", scoreFromFindings(findings, 55), ["SECTOR_CONFIRMATION"]),
    ],
    riskEscalations,
    sourceIds: ["scanner.latest", "sector_context"],
    summary: findings.length
      ? "Sector agent is monitoring leadership, weakening groups, and rotation pressure."
      : "Sector agent sees a mixed tape without a clear leadership shift.",
    watchlistCandidates,
  });
}

function volatilityAgent(context: AgentContext): ResearchAgentSummary {
  const volatilityScore = Math.max(context.liveSystem?.volatilityPressure ?? 0, context.regimeSystem?.volatilityPressure ?? 0, average(context.rows.map((row) => scoreValue(row.raw.volatility_pressure, row.fragility)), 45));
  const highVolRows = context.rows
    .filter((row) => Math.max(row.fragility, scoreValue(row.raw.volatility_pressure, 45), row.shockPattern?.twoSidedVolatilityScore ?? 45) >= 66)
    .sort((left, right) => Math.max(right.fragility, right.shockPattern?.twoSidedVolatilityScore ?? 0) - Math.max(left.fragility, left.shockPattern?.twoSidedVolatilityScore ?? 0))
    .slice(0, 6);
  const findings: ResearchAgentFinding[] = [];
  if (volatilityScore >= 60) {
    findings.push({
      detail: `Volatility pressure is ${Math.round(volatilityScore)}/100. High-fragility and shock-prone setups need confirmation rather than chase behavior.`,
      reasonCodes: ["VOLATILITY_PRESSURE"],
      score: volatilityScore,
      severity: severityFromScore(volatilityScore),
      sourceIds: ["live_intelligence", "regime_shift", "scanner.latest"],
      title: "Volatility pressure elevated",
    });
  }
  findings.push(...highVolRows.slice(0, 4).map((row) => {
    const score = Math.round(Math.max(row.fragility, scoreValue(row.raw.volatility_pressure, 45), row.shockPattern?.twoSidedVolatilityScore ?? 45));
    return {
      detail: `${row.symbol} has volatility/fragility pressure ${score}/100. Watch whether the move stabilizes or becomes two-sided.`,
      reasonCodes: ["SYMBOL_VOLATILITY", "FRAGILITY_WATCH"],
      score,
      severity: severityFromScore(score),
      sourceIds: ["scanner.latest", "shock_patterns"],
      symbol: row.symbol,
      title: `${row.symbol} volatility watch`,
    };
  }));
  return agentSummary({
    agentId: "volatility",
    context,
    findings,
    label: "Volatility Agent",
    recommendedActions: [
      action("summary", "Confirm volatility persistence", "If volatility pressure fades, opportunity quality can improve; if it expands, chase risk rises.", volatilityScore, ["VOLATILITY_CONFIRMATION"]),
    ],
    riskEscalations: findings.filter((finding) => finding.score >= 68).map((finding) => actionFromFinding(finding, "risk_escalation")),
    sourceIds: ["live_intelligence", "regime_shift", "scanner.latest"],
    summary: volatilityScore >= 60
      ? "Volatility agent is active because pressure is high enough to affect entry quality and fragility."
      : "Volatility agent sees contained pressure in the latest packet.",
  });
}

function shockAgent(context: AgentContext): ResearchAgentSummary {
  const liveEscalations = context.liveSystem?.shockEscalations ?? [];
  const shockRows = context.rows
    .filter((row) => (row.shockPattern?.opportunityScore ?? 0) >= 62 || (row.shockPattern?.upsideShockScore ?? 0) >= 66 || scoreValue(row.raw.event_shock_pressure_score, 0) >= 62)
    .sort((left, right) => shockScore(right) - shockScore(left))
    .slice(0, 8);
  const findings: ResearchAgentFinding[] = [
    ...liveEscalations.slice(0, 3).map((item) => ({
      detail: item.detail,
      reasonCodes: ["LIVE_SHOCK_ESCALATION"],
      score: item.score,
      severity: severityFromScore(item.score),
      sourceIds: ["live_intelligence"],
      symbol: item.symbol,
      title: `${item.symbol} live shock watch`,
    })),
    ...shockRows.slice(0, 5).map((row) => {
      const score = shockScore(row);
      return {
        detail: `${row.symbol} has elevated historical shock support ${score}/100. Treat it as speculative research and check chase risk before entry timing.`,
        reasonCodes: ["SHOCK_SUPPORT", "HIGH_VOLATILITY_RESEARCH"],
        score,
        severity: severityFromScore(score, false, true),
        sourceIds: ["shock_patterns", "scanner.latest"],
        symbol: row.symbol,
        title: `${row.symbol} shock conditions`,
      };
    }),
  ];
  const opportunityCandidates = shockRows.slice(0, 5).map((row) => action("opportunity_surface", `${row.symbol} shock watch`, `${row.symbol} ranks high for shock potential. Monitor pullback/confirmation zones and avoid first-spike chasing.`, shockScore(row), ["SHOCK_WATCH"], row.symbol));
  const watchlistCandidates = opportunityCandidates
    .filter((item) => item.symbol && !context.watchlist.has(item.symbol))
    .map((item) => ({ ...item, actionType: "watchlist_suggestion" as const, label: `${item.symbol} shock watchlist` }));
  return agentSummary({
    agentId: "shock",
    context,
    findings,
    label: "Shock Conditions Agent",
    opportunityCandidates,
    recommendedActions: [
      action("summary", "Avoid weak chase setups", "Use shock candidates as monitoring priorities. Favor confirmation or pullback evidence over late spike entries.", scoreFromFindings(findings, 55), ["CHASE_RISK_CONTROL"]),
    ],
    riskEscalations: findings.filter((finding) => finding.score >= 78).map((finding) => actionFromFinding(finding, "risk_escalation")),
    sourceIds: ["shock_patterns", "live_intelligence", "scanner.latest"],
    summary: findings.length
      ? "Shock agent found high-volatility candidates and escalation risks to monitor."
      : "Shock agent sees no confirmed high-priority shock escalation in the latest packet.",
    watchlistCandidates,
  });
}

function narrativeAgent(context: AgentContext): ResearchAgentSummary {
  const workflow = context.workflowEvolution;
  const rowFindings = context.rows
    .filter((row) => row.narrative?.narrativeDrift && (row.narrative.narrativeDrift.momentumScore >= 62 || row.narrative.narrativeDrift.deteriorationScore >= 58))
    .slice(0, 5)
    .map((row) => {
      const drift = row.narrative?.narrativeDrift;
      const deterioration = drift?.deteriorationScore ?? 0;
      const momentum = drift?.momentumScore ?? 0;
      const score = Math.max(momentum, deterioration);
      return {
        detail: `${row.symbol} narrative is ${drift?.label ?? "changing"}: momentum ${momentum}/100, deterioration ${deterioration}/100.`,
        reasonCodes: deterioration > momentum ? ["NARRATIVE_DETERIORATION"] : ["NARRATIVE_STRENGTHENING"],
        score,
        severity: deterioration > momentum ? severityFromScore(score) : severityFromScore(score, false, true),
        sourceIds: ["narrative_intelligence"],
        symbol: row.symbol,
        title: `${row.symbol} narrative drift`,
      };
    });
  const workflowFindings = [
    ...(workflow?.whatChanged ?? []),
    ...(workflow?.improvingSetups ?? []),
    ...(workflow?.deterioratingSetups ?? []),
  ].slice(0, 6).map((item) => ({
    detail: item.detail,
    reasonCodes: [String(item.changeType ?? "WORKFLOW_CHANGE").toUpperCase()],
    score: scoreFromSeverity(item.severity),
    severity: item.severity === "warning" ? "risk" as const : item.severity === "positive" ? "watch" as const : "info" as const,
    sourceIds: ["workflow_evolution"],
    symbol: item.symbol,
    title: item.title,
  }));
  const findings = [...rowFindings, ...workflowFindings].sort((left, right) => right.score - left.score).slice(0, 8);
  const opportunityCandidates = findings
    .filter((finding) => finding.symbol && finding.reasonCodes.some((code) => /IMPROV|STRENGTH|POSITIVE/i.test(code)))
    .map((finding) => action("opportunity_surface", `${finding.symbol} improving narrative`, finding.detail, finding.score, ["NARRATIVE_IMPROVING"], finding.symbol));
  return agentSummary({
    agentId: "narrative",
    context,
    findings,
    label: "Narrative Agent",
    opportunityCandidates,
    recommendedActions: [
      action("summary", "Track narrative drift", "Focus on changes that are confirmed by score, breadth, event, or volatility context. Ignore unsupported stories.", scoreFromFindings(findings, 50), ["NARRATIVE_DRIFT"]),
    ],
    riskEscalations: findings
      .filter((finding) => finding.severity === "risk" || finding.severity === "critical")
      .map((finding) => actionFromFinding(finding, "risk_escalation")),
    sourceIds: ["narrative_intelligence", "workflow_evolution"],
    summary: findings.length
      ? "Narrative agent is tracking what changed, which stories strengthened, and which setups are deteriorating."
      : "Narrative agent sees no strong narrative drift in the latest packet.",
  });
}

function portfolioRiskAgent(context: AgentContext): ResearchAgentSummary {
  const portfolio = context.portfolioSystem;
  if (!portfolio || portfolio.openPositionCount === 0) {
    return agentSummary({
      agentId: "portfolio_risk",
      context,
      findings: [],
      label: "Portfolio Risk Agent",
      recommendedActions: [
        action("portfolio_review", "Portfolio monitoring inactive", "Add paper or manual positions to activate concentration, correlation, scenario, and fragility monitoring.", 42, ["PORTFOLIO_CONTEXT_MISSING"]),
      ],
      sourceIds: ["portfolio_intelligence"],
      summary: "Portfolio agent is waiting for open paper or manual positions.",
    });
  }
  const findings: ResearchAgentFinding[] = [];
  if (portfolio.hiddenCorrelationWarning) {
    findings.push({
      detail: portfolio.hiddenCorrelationWarning,
      reasonCodes: ["HIDDEN_CORRELATION"],
      score: Math.max(65, portfolio.concentrationScore, portfolio.fragilityScore),
      severity: severityFromScore(Math.max(65, portfolio.concentrationScore, portfolio.fragilityScore)),
      sourceIds: ["portfolio_intelligence"],
      title: "Hidden correlation warning",
    });
  }
  const headlineScores = [
    ["Portfolio fragility", portfolio.fragilityScore, "PORTFOLIO_FRAGILITY"],
    ["Scenario vulnerability", portfolio.scenarioVulnerabilityScore, "SCENARIO_VULNERABILITY"],
    ["Concentration", portfolio.concentrationScore, "CONCENTRATION"],
    ["Shock exposure", portfolio.shockExposureScore, "SHOCK_EXPOSURE"],
  ] as const;
  for (const [label, score, code] of headlineScores) {
    if (score >= 58) {
      findings.push({
        detail: `${label} is ${Math.round(score)}/100. ${portfolio.summary}`,
        reasonCodes: [code],
        score,
        severity: severityFromScore(score),
        sourceIds: ["portfolio_intelligence"],
        title: `${label} watch`,
      });
    }
  }
  for (const cluster of portfolio.correlationClusters.slice(0, 3)) {
    findings.push({
      detail: cluster.reason,
      reasonCodes: [`PORTFOLIO_${cluster.type.toUpperCase()}`],
      score: cluster.score,
      severity: severityFromScore(cluster.score),
      sourceIds: ["portfolio_intelligence"],
      title: cluster.label,
    });
  }
  return agentSummary({
    agentId: "portfolio_risk",
    context,
    findings,
    label: "Portfolio Risk Agent",
    recommendedActions: [
      action("portfolio_review", "Review exposure stack", "Check concentration, hidden correlation, scenario vulnerability, and shock exposure before adding similar risk.", portfolio.fragilityScore, ["PORTFOLIO_REVIEW"]),
    ],
    riskEscalations: findings
      .filter((finding) => finding.score >= 62)
      .map((finding) => actionFromFinding(finding, "risk_escalation")),
    sourceIds: ["portfolio_intelligence", "scenario_intelligence"],
    summary: "Portfolio agent is monitoring concentration, hidden correlation, fragility stacking, and scenario vulnerability.",
  });
}

function agentSummary({
  agentId,
  context,
  findings,
  label,
  opportunityCandidates = [],
  recommendedActions = [],
  riskEscalations = [],
  sourceIds,
  summary,
  watchlistCandidates = [],
}: {
  agentId: ResearchAgentId;
  context: AgentContext;
  findings: ResearchAgentFinding[];
  label: string;
  opportunityCandidates?: ResearchAgentAction[];
  recommendedActions?: ResearchAgentAction[];
  riskEscalations?: ResearchAgentAction[];
  sourceIds: string[];
  summary: string;
  watchlistCandidates?: ResearchAgentAction[];
}): ResearchAgentSummary {
  const maxScore = scoreFromFindings(findings, 45);
  const severity = highestSeverity(findings.map((finding) => finding.severity));
  const status: ResearchAgentStatus = findings.some((finding) => finding.score >= 65) || opportunityCandidates.length || riskEscalations.length
    ? "active"
    : findings.length
      ? "watching"
      : "quiet";
  const confidenceScore = Math.round(clamp(
    (context.rows.length >= 20 ? 24 : context.rows.length >= 8 ? 16 : 9)
    + (findings.length ? 24 : 12)
    + (sourceIds.length >= 3 ? 18 : 12)
    + (maxScore >= 65 ? 18 : 12)
    + (context.liveSystem ? 8 : 0)
    + (context.regimeSystem ? 8 : 0),
  ));
  return {
    agentId,
    confidenceScore,
    keyFindings: dedupeFindings(findings).slice(0, 6),
    label,
    lastCheckedAt: context.generatedAt,
    limitations: [
      "Deterministic monitoring only; no autonomous trading or unsupported macro claims.",
      "Watchlist updates are suggestions unless the user explicitly confirms an action.",
    ],
    opportunityCandidates: uniqueActions(opportunityCandidates),
    recommendedActions: uniqueActions(recommendedActions),
    riskEscalations: uniqueActions(riskEscalations),
    severity,
    sourceIds,
    status,
    summary,
    watchlistCandidates: uniqueActions(watchlistCandidates),
  };
}

function systemSummary(agentSummaries: ResearchAgentSummary[], riskEscalations: ResearchAgentAction[], opportunities: ResearchAgentAction[], watchlistUpdates: ResearchAgentAction[]): string {
  const active = agentSummaries.filter((agent) => agent.status === "active").map((agent) => agent.label.replace(" Agent", ""));
  if (riskEscalations.length) {
    return `Automated agents are active. ${riskEscalations.length} risk escalation${riskEscalations.length === 1 ? "" : "s"} need attention, while ${opportunities.length} opportunity candidate${opportunities.length === 1 ? "" : "s"} remain in research mode.`;
  }
  if (opportunities.length || watchlistUpdates.length) {
    return `Automated agents found ${opportunities.length} opportunity candidate${opportunities.length === 1 ? "" : "s"} and ${watchlistUpdates.length} watchlist suggestion${watchlistUpdates.length === 1 ? "" : "s"}. Confirm evidence before acting.`;
  }
  if (active.length) return `Automated agents are monitoring ${active.join(", ")}. No major escalation is confirmed.`;
  return "Automated agents are quiet in the latest packet. Continue monitoring for verified changes, not forced trades.";
}

function eventPriority(row: OpportunityViewModel): number {
  return Math.round(clamp(weightedAverage([
    [row.eventRisk, 0.34],
    [scoreValue(row.raw.verified_event_pressure_score, row.eventRisk), 0.24],
    [scoreValue(row.raw.event_shock_pressure_score, 45), 0.16],
    [scoreValue(row.raw.event_confidence, 45), 0.14],
    [scoreValue(row.raw.event_source_weight, 40), 0.12],
  ], 35)));
}

function eventText(row: OpportunityViewModel): string {
  const fields = [
    row.eventLabel,
    row.raw.event_context_label,
    row.raw.event_context_summary,
    row.raw.verified_event_signature,
    row.raw.macro_event_regime_signature,
    row.narrative?.eventReasoning,
  ];
  const text = fields.map((field) => cleanText(field, "")).filter(Boolean).join(" ");
  return /\b(earnings?|guidance|revenue|eps|profit|loss|sec|filing|fed|cpi|ppi|nfp|employment|oil|treasury|yield|regulat|launch|product|merger|acquisition|upgrade|downgrade|analyst)\b/i.test(text) ? text : "";
}

function eventDetail(row: OpportunityViewModel, score: number): string {
  const text = eventText(row);
  if (text) return `${row.symbol} has verified event context: ${truncate(text, 170)} Event pressure is ${Math.round(score)}/100.`;
  return `${row.symbol} has event pressure ${Math.round(score)}/100 from structured scanner fields. Verify source freshness before using it in a decision.`;
}

function eventReasonCodes(row: OpportunityViewModel): string[] {
  const text = eventText(row);
  const codes = ["VERIFIED_EVENT_CONTEXT"];
  if (/\bearnings?|guidance|eps|revenue|profit|loss\b/i.test(text)) codes.push("EARNINGS_EVENT");
  if (/\bfed|cpi|ppi|nfp|employment|treasury|yield|oil\b/i.test(text)) codes.push("MACRO_EVENT");
  if (/\bsec|filing|regulat|merger|acquisition|product|launch|upgrade|downgrade|analyst\b/i.test(text)) codes.push("COMPANY_EVENT");
  return codes;
}

function sectorGroups(rows: OpportunityViewModel[]): SectorGroup[] {
  const groups = new Map<string, OpportunityViewModel[]>();
  for (const row of rows) {
    const sector = normalizedSector(row);
    groups.set(sector, [...(groups.get(sector) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([sector, groupRows]) => ({
      averageConviction: Math.round(average(groupRows.map((row) => row.conviction), 50)),
      averageFragility: Math.round(average(groupRows.map((row) => row.fragility), 50)),
      averageMacro: Math.round(average(groupRows.map((row) => scoreValue(row.raw.macro_alignment_score, 50)), 50)),
      averageScore: Math.round(average(groupRows.map((row) => scoreValue(row.final_score, row.conviction)), 50)),
      count: groupRows.length,
      sector,
      symbols: groupRows.sort((left, right) => right.conviction - left.conviction).map((row) => row.symbol),
    }))
    .filter((group) => group.count >= 1)
    .sort((left, right) => right.averageScore - left.averageScore || right.count - left.count);
}

function normalizedSector(row: OpportunityViewModel): string {
  const sector = cleanText(row.sector ?? row.raw.sector, "Unknown");
  return sector.length > 28 ? sector.slice(0, 28) : sector;
}

function shockScore(row: OpportunityViewModel): number {
  return Math.round(clamp(weightedAverage([
    [row.shockPattern?.opportunityScore ?? null, 0.30],
    [row.shockPattern?.upsideShockScore ?? null, 0.22],
    [row.shockPattern?.currentSimilarityScore ?? null, 0.18],
    [scoreValue(row.raw.event_shock_pressure_score, null), 0.14],
    [scoreValue(row.final_score, row.conviction), 0.10],
    [100 - row.fragility, 0.06],
  ], 45)));
}

function agentFindings(agentSummaries: ResearchAgentSummary[], ids: ResearchAgentId[]): ResearchAgentFinding[] {
  const idSet = new Set<ResearchAgentId>(ids);
  return agentSummaries
    .filter((agent) => idSet.has(agent.agentId))
    .flatMap((agent) => agent.keyFindings)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function actionFromFinding(finding: ResearchAgentFinding, actionType: ResearchAgentActionType): ResearchAgentAction {
  return action(actionType, finding.symbol ? `${finding.symbol}: ${finding.title}` : finding.title, finding.detail, finding.score, finding.reasonCodes, finding.symbol);
}

function action(actionType: ResearchAgentActionType, label: string, detail: string, priorityScore: number, reasonCodes: string[], symbol?: string): ResearchAgentAction {
  return {
    actionType,
    detail,
    label,
    priorityScore: Math.round(clamp(priorityScore)),
    reasonCodes,
    ...(symbol ? { symbol } : {}),
  };
}

function severityFromScore(score: number, forceCritical = false, positive = false): ResearchAgentSeverity {
  if (forceCritical || score >= 86) return "critical";
  if (!positive && score >= 68) return "risk";
  if (score >= 56) return "watch";
  return "info";
}

function highestSeverity(severities: ResearchAgentSeverity[]): ResearchAgentSeverity {
  return severities.sort((left, right) => severityRank(right) - severityRank(left))[0] ?? "info";
}

function severityRank(severity: ResearchAgentSeverity): number {
  if (severity === "critical") return 4;
  if (severity === "risk") return 3;
  if (severity === "watch") return 2;
  return 1;
}

function scoreFromSeverity(severity: string): number {
  if (severity === "critical") return 86;
  if (severity === "warning") return 72;
  if (severity === "positive") return 66;
  return 52;
}

function scoreFromFindings(findings: ResearchAgentFinding[], fallback: number): number {
  if (!findings.length) return fallback;
  return Math.round(clamp(Math.max(...findings.map((finding) => finding.score))));
}

function scoreValue(value: unknown, fallback: number | null): number {
  const parsed = finiteNumber(value);
  if (parsed === null || Number.isNaN(parsed)) return fallback ?? 0;
  return clamp(parsed);
}

function weightedAverage(values: Array<[number | null, number]>, fallback: number): number {
  let total = 0;
  let weight = 0;
  for (const [value, valueWeight] of values) {
    if (value === null || !Number.isFinite(value)) continue;
    total += value * valueWeight;
    weight += valueWeight;
  }
  return weight > 0 ? total / weight : fallback;
}

function average(values: number[], fallback: number): number {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) return fallback;
  return cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length;
}

function uniqueActions(actions: ResearchAgentAction[]): ResearchAgentAction[] {
  const seen = new Set<string>();
  const output: ResearchAgentAction[] = [];
  for (const item of actions.sort((left, right) => right.priorityScore - left.priorityScore || left.label.localeCompare(right.label))) {
    const key = `${item.actionType}:${item.symbol ?? ""}:${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function dedupeFindings(findings: ResearchAgentFinding[]): ResearchAgentFinding[] {
  const seen = new Set<string>();
  const output: ResearchAgentFinding[] = [];
  for (const finding of findings.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))) {
    const key = `${finding.symbol ?? ""}:${finding.title}:${finding.reasonCodes.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
}

function cleanSymbol(symbol: string): string {
  return cleanText(symbol, "").toUpperCase();
}

function truncate(value: string, maxLength: number): string {
  const text = cleanText(value, "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
