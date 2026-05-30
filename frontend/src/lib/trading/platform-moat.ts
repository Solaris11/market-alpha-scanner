import { clamp, cleanText, finiteNumber } from "@/lib/ui/formatters";
import type { MarketMemorySummary } from "./market-memory";
import type { OpportunityViewModel } from "./opportunity-view-model";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { PredictiveIntelligenceSystem } from "./predictive-intelligence";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

export type MoatGraphNodeType =
  | "earnings_reaction"
  | "event"
  | "macro_driver"
  | "outcome"
  | "signal"
  | "symbol"
  | "user_interest"
  | "workflow";
export type MoatGraphEdgeType =
  | "behavioral_preference"
  | "event_reaction"
  | "historical_outcome"
  | "macro_link"
  | "memory_similarity"
  | "signal_outcome"
  | "workflow_success";
export type UniqueSignalType =
  | "behavioral_opportunity"
  | "cross_sector_intelligence"
  | "memory_adjusted"
  | "multi_event_intelligence";
export type ReplicationDifficulty = "hard" | "medium" | "very_hard";

export type MoatGraphNode = {
  evidenceCount: number;
  id: string;
  label: string;
  score: number;
  type: MoatGraphNodeType;
};

export type MoatGraphEdge = {
  evidence: string;
  from: string;
  id: string;
  strength: number;
  to: string;
  type: MoatGraphEdgeType;
};

export type ProprietaryDataset = {
  dataUniquenessScore: number;
  description: string;
  id: string;
  nodeCount: number;
  relationshipCount: number;
  replicationDifficulty: ReplicationDifficulty;
  sourceSystems: string[];
  title: string;
};

export type MarketMemoryGraph = {
  datasets: ProprietaryDataset[];
  edges: MoatGraphEdge[];
  nodes: MoatGraphNode[];
  summary: string;
};

export type UserIntelligenceGraph = {
  datasets: ProprietaryDataset[];
  edges: MoatGraphEdge[];
  interests: Array<{ evidence: string; label: string; score: number }>;
  nodes: MoatGraphNode[];
  researchPatterns: Array<{ evidence: string; label: string; score: number }>;
  signalPreferences: Array<{ evidence: string; label: string; score: number }>;
  successfulWorkflows: Array<{ evidence: string; label: string; score: number }>;
  summary: string;
};

export type OpportunityKnowledgeGraph = {
  datasets: ProprietaryDataset[];
  edges: MoatGraphEdge[];
  marketEnvironmentClusters: Array<{ environment: string; symbols: string[]; score: number }>;
  nodes: MoatGraphNode[];
  outcomeClusters: Array<{ evidence: string; label: string; score: number; symbols: string[] }>;
  signalClusters: Array<{ label: string; score: number; symbols: string[] }>;
  summary: string;
};

export type UniqueSignal = {
  dataSources: string[];
  description: string;
  evidence: string[];
  id: string;
  replicationDifficulty: ReplicationDifficulty;
  signalStrengthScore: number;
  title: string;
  type: UniqueSignalType;
  workflowUse: string;
};

export type DefensibilityAnalysis = {
  aiUniquenessScore: number;
  dataUniquenessScore: number;
  difficultyToReplicateScore: number;
  moatScore: number;
  proofPoints: string[];
  replicationBarriers: string[];
  workflowUniquenessScore: number;
};

export type PlatformMoatCertification = {
  blockers: string[];
  finalVerdict: string;
  noUnsupportedClaims: boolean;
  overallStatus: "not_ready" | "ready";
};

export type PlatformMoatSystem = {
  certification: PlatformMoatCertification;
  defensibility: DefensibilityAnalysis;
  generatedAt: string;
  marketMemoryGraph: MarketMemoryGraph;
  opportunityKnowledgeGraph: OpportunityKnowledgeGraph;
  proprietaryDatasets: ProprietaryDataset[];
  proofBoundary: string;
  uniqueSignals: UniqueSignal[];
  userIntelligenceGraph: UserIntelligenceGraph;
};

export type PlatformMoatInput = {
  generatedAt?: string;
  marketMemoryBySymbol?: Map<string, MarketMemorySummary>;
  personalizationProfile?: UserPersonalizationProfile | null;
  predictiveSystem?: PredictiveIntelligenceSystem | null;
  rows: OpportunityViewModel[];
  watchlistSymbols?: string[];
  workflowEvolution?: WorkflowEvolutionSummary | null;
};

export function buildPlatformMoatSystem(input: PlatformMoatInput): PlatformMoatSystem {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const marketMemoryGraph = buildMarketMemoryGraph(input.rows, input.marketMemoryBySymbol ?? new Map());
  const userIntelligenceGraph = buildUserIntelligenceGraph({
    personalizationProfile: input.personalizationProfile ?? null,
    rows: input.rows,
    watchlistSymbols: input.watchlistSymbols ?? [],
    workflowEvolution: input.workflowEvolution ?? null,
  });
  const opportunityKnowledgeGraph = buildOpportunityKnowledgeGraph({
    marketMemoryBySymbol: input.marketMemoryBySymbol ?? new Map(),
    predictiveSystem: input.predictiveSystem ?? null,
    rows: input.rows,
  });
  const proprietaryDatasets = dedupeDatasets([
    ...marketMemoryGraph.datasets,
    ...userIntelligenceGraph.datasets,
    ...opportunityKnowledgeGraph.datasets,
  ]);
  const uniqueSignals = buildUniqueSignals({
    marketMemoryGraph,
    opportunityKnowledgeGraph,
    predictiveSystem: input.predictiveSystem ?? null,
    rows: input.rows,
    userIntelligenceGraph,
  });
  const defensibility = buildDefensibilityAnalysis({ marketMemoryGraph, opportunityKnowledgeGraph, proprietaryDatasets, uniqueSignals, userIntelligenceGraph });
  const certification = certifyMoat({ defensibility, marketMemoryGraph, opportunityKnowledgeGraph, proprietaryDatasets, uniqueSignals, userIntelligenceGraph });

  return {
    certification,
    defensibility,
    generatedAt,
    marketMemoryGraph,
    opportunityKnowledgeGraph,
    proprietaryDatasets,
    proofBoundary: "Platform Moat measures source-backed proprietary graph relationships, personalization workflows, memory-adjusted signals, and defensibility barriers. It does not claim competitors cannot copy every visible feature, and it does not fabricate outcomes, events, or user behavior.",
    uniqueSignals,
    userIntelligenceGraph,
  };
}

function buildMarketMemoryGraph(rows: OpportunityViewModel[], marketMemoryBySymbol: Map<string, MarketMemorySummary>): MarketMemoryGraph {
  const nodes = new Map<string, MoatGraphNode>();
  const edges: MoatGraphEdge[] = [];

  for (const row of rows.slice(0, 30)) {
    const symbol = row.symbol.toUpperCase();
    const memory = marketMemoryBySymbol.get(symbol) ?? null;
    upsertNode(nodes, node(`symbol:${symbol}`, symbol, "symbol", scoreValue(row.final_score, row.conviction), 1));
    const macro = cleanText(row.raw.macro_event_regime_signature ?? row.raw.market_regime ?? row.macroLabel, "");
    if (macro) {
      upsertNode(nodes, node(`macro:${macro}`, macro, "macro_driver", scoreValue(row.raw.macro_alignment_score, 50), 1));
      edges.push(edge(symbol, "macro_link", `symbol:${symbol}`, `macro:${macro}`, scoreValue(row.raw.macro_alignment_score, 50), `${symbol} is linked to ${macro} through scanner macro/regime evidence.`));
    }
    const event = cleanText(row.raw.verified_event_signature ?? row.raw.event_context_label ?? row.eventLabel, "");
    if (event && !/contained|none|limited/i.test(event)) {
      const type: MoatGraphNodeType = /earnings/i.test(event) ? "earnings_reaction" : "event";
      upsertNode(nodes, node(`event:${event}`, event, type, row.eventRisk, 1));
      edges.push(edge(symbol, "event_reaction", `symbol:${symbol}`, `event:${event}`, row.eventRisk, `${symbol} carries source-backed event pressure: ${event}.`));
    }
    if (memory?.available) {
      upsertNode(nodes, node(`outcome:${symbol}:memory`, `${symbol} outcomes`, "outcome", memory.confidence?.score ?? memory.evidence.sampleSize, memory.evidence.sampleSize));
      edges.push(edge(symbol, "historical_outcome", `symbol:${symbol}`, `outcome:${symbol}:memory`, memory.confidence?.score ?? 45, memory.evidence.explanation));
      for (const analog of memory.analogs.slice(0, 3)) {
        const analogSymbol = analog.symbol.toUpperCase();
        upsertNode(nodes, node(`symbol:${analogSymbol}`, analogSymbol, "symbol", analog.similarityScore, analog.reasonCodes.length));
        edges.push(edge(`${symbol}:${analogSymbol}`, "memory_similarity", `symbol:${symbol}`, `symbol:${analogSymbol}`, analog.similarityScore, `${symbol} and ${analogSymbol} share ${analog.reasonCodes.join(", ") || "market-memory similarity"} evidence.`));
      }
    }
  }

  const nodeList = [...nodes.values()].sort(compareNode).slice(0, 120);
  const edgeList = dedupeEdges(edges).sort((left, right) => right.strength - left.strength).slice(0, 180);
  return {
    datasets: [{
      dataUniquenessScore: Math.round(clamp(56 + marketMemoryBySymbol.size * 5 + edgeList.length * 0.18)),
      description: "Persistent relationships between symbols, macro drivers, source-backed events, earnings reactions where available, and historical outcomes.",
      id: "market-memory-graph",
      nodeCount: nodeList.length,
      relationshipCount: edgeList.length,
      replicationDifficulty: edgeList.length >= 40 ? "very_hard" : "hard",
      sourceSystems: ["scanner history", "market memory analogs", "forward outcomes", "verified event fields", "macro regime fields"],
      title: "Market Memory Graph",
    }],
    edges: edgeList,
    nodes: nodeList,
    summary: `Market Memory Graph contains ${nodeList.length} nodes and ${edgeList.length} source-backed relationships.`,
  };
}

function buildUserIntelligenceGraph(input: {
  personalizationProfile: UserPersonalizationProfile | null;
  rows: OpportunityViewModel[];
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): UserIntelligenceGraph {
  const nodes = new Map<string, MoatGraphNode>();
  const edges: MoatGraphEdge[] = [];
  const profile = input.personalizationProfile;
  const watchlist = new Set(input.watchlistSymbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const sectorCounts = new Map<string, number>();
  const setupCounts = new Map<string, number>();
  for (const row of input.rows) {
    if (watchlist.has(row.symbol)) {
      increment(sectorCounts, cleanText(row.sector, "Unclassified"));
      increment(setupCounts, cleanText(row.raw.setup_type ?? row.final_decision, "Unclassified"));
    }
  }

  const interests = [
    ...topEntries(sectorCounts, 4).map(([label, count]) => ({ evidence: `${count} watchlist or ranked symbol(s) in ${label}.`, label, score: Math.round(clamp(48 + count * 12)) })),
    ...(profile ? [{ evidence: `${profile.source} profile: ${profile.description}`, label: profile.label, score: profile.personalityConfidence }] : []),
  ].slice(0, 6);
  const researchPatterns = [
    pattern("Repeated symbol views", profile?.behavior.repeatedSymbolViews ?? 0, "Behavior learning summary"),
    pattern("Alert engagement", profile?.behavior.alertEngagement ?? 0, "Behavior learning summary"),
    pattern("Watchlist depth", input.watchlistSymbols.length, "Authenticated watchlist"),
  ].filter((item) => item.score > 0);
  const successfulWorkflows = [
    ...((input.workflowEvolution?.improvingSetups ?? []).slice(0, 4).map((item) => ({ evidence: item.detail, label: item.title, score: severityScore(item.severity) }))),
    ...((input.workflowEvolution?.triggerMonitors ?? []).slice(0, 4).map((item) => ({ evidence: item.reason, label: item.condition, score: priorityScore(item.priority) }))),
  ].slice(0, 8);
  const signalPreferences = [
    ...topEntries(setupCounts, 4).map(([label, count]) => ({ evidence: `${count} tracked symbol(s) share ${label} signal/setup context.`, label, score: Math.round(clamp(46 + count * 13)) })),
    ...(profile ? [
      { evidence: "Preference vector from risk profile.", label: "Momentum preference", score: profile.momentumPreference },
      { evidence: "Preference vector from risk profile.", label: "Event preference", score: profile.eventPreference },
      { evidence: "Preference vector from risk profile.", label: "Volatility tolerance", score: profile.volatilityTolerance },
    ] : []),
  ].sort((left, right) => right.score - left.score).slice(0, 8);

  for (const interest of interests) {
    upsertNode(nodes, node(`interest:${interest.label}`, interest.label, "user_interest", interest.score, 1));
  }
  for (const workflow of successfulWorkflows) {
    upsertNode(nodes, node(`workflow:${workflow.label}`, workflow.label, "workflow", workflow.score, 1));
  }
  for (const row of input.rows.slice(0, 20)) {
    const symbol = row.symbol.toUpperCase();
    if (!watchlist.has(symbol)) continue;
    upsertNode(nodes, node(`symbol:${symbol}`, symbol, "symbol", scoreValue(row.final_score, row.conviction), 1));
    for (const interest of interests.slice(0, 3)) {
      edges.push(edge(`${symbol}:${interest.label}`, "behavioral_preference", `interest:${interest.label}`, `symbol:${symbol}`, interest.score, `${symbol} is connected to user interest ${interest.label}.`));
    }
  }
  for (const workflow of successfulWorkflows) {
    const symbol = workflow.evidence.match(/\b[A-Z]{1,5}(?:[-.][A-Z]{1,5})?\b/)?.[0] ?? null;
    if (!symbol) continue;
    upsertNode(nodes, node(`symbol:${symbol}`, symbol, "symbol", workflow.score, 1));
    edges.push(edge(`${workflow.label}:${symbol}`, "workflow_success", `workflow:${workflow.label}`, `symbol:${symbol}`, workflow.score, workflow.evidence));
  }

  const nodeList = [...nodes.values()].sort(compareNode).slice(0, 80);
  const edgeList = dedupeEdges(edges).sort((left, right) => right.strength - left.strength).slice(0, 120);
  return {
    datasets: [{
      dataUniquenessScore: Math.round(clamp(42 + interests.length * 7 + researchPatterns.length * 6 + successfulWorkflows.length * 4 + signalPreferences.length * 3)),
      description: "Authenticated graph of user interests, research patterns, workflow success signals, sector preferences, and signal preferences.",
      id: "user-intelligence-graph",
      nodeCount: nodeList.length,
      relationshipCount: edgeList.length,
      replicationDifficulty: edgeList.length >= 20 ? "very_hard" : "hard",
      sourceSystems: ["watchlist", "risk profile", "behavior learning", "workflow evolution", "scanner usage"],
      title: "User Intelligence Graph",
    }],
    edges: edgeList,
    interests,
    nodes: nodeList,
    researchPatterns,
    signalPreferences,
    successfulWorkflows,
    summary: `User Intelligence Graph contains ${interests.length} interest anchors, ${researchPatterns.length} research patterns, ${successfulWorkflows.length} workflow success signals, and ${signalPreferences.length} signal preferences.`,
  };
}

function buildOpportunityKnowledgeGraph(input: {
  marketMemoryBySymbol: Map<string, MarketMemorySummary>;
  predictiveSystem: PredictiveIntelligenceSystem | null;
  rows: OpportunityViewModel[];
}): OpportunityKnowledgeGraph {
  const nodes = new Map<string, MoatGraphNode>();
  const edges: MoatGraphEdge[] = [];
  const signalBuckets = new Map<string, OpportunityViewModel[]>();
  const environmentBuckets = new Map<string, OpportunityViewModel[]>();
  const outcomeClusters: OpportunityKnowledgeGraph["outcomeClusters"] = [];

  for (const row of input.rows.slice(0, 80)) {
    const symbol = row.symbol.toUpperCase();
    const setup = cleanText(row.raw.setup_type ?? row.final_decision, "Unknown setup");
    const environment = cleanText(row.raw.market_regime ?? row.macroLabel, "Mixed market environment");
    upsertNode(nodes, node(`symbol:${symbol}`, symbol, "symbol", scoreValue(row.final_score, row.conviction), 1));
    upsertNode(nodes, node(`signal:${setup}`, setup, "signal", scoreValue(row.final_score, row.conviction), 1));
    upsertNode(nodes, node(`macro:${environment}`, environment, "macro_driver", scoreValue(row.raw.macro_alignment_score, 50), 1));
    edges.push(edge(`${symbol}:${setup}`, "signal_outcome", `symbol:${symbol}`, `signal:${setup}`, scoreValue(row.final_score, row.conviction), `${symbol} belongs to ${setup} opportunity cluster.`));
    edges.push(edge(`${symbol}:${environment}`, "macro_link", `signal:${setup}`, `macro:${environment}`, scoreValue(row.raw.macro_alignment_score, 50), `${setup} is linked to ${environment}.`));
    pushMap(signalBuckets, setup, row);
    pushMap(environmentBuckets, environment, row);
    const memory = input.marketMemoryBySymbol.get(symbol) ?? null;
    if (memory?.outcome) {
      const label = `${symbol} ${memory.outcome.horizon} outcome memory`;
      outcomeClusters.push({
        evidence: `Win rate ${pctLabel(memory.outcome.winRate)} and median return ${pctLabel(memory.outcome.medianReturn)} from market-memory analogs.`,
        label,
        score: memory.confidence?.score ?? memory.evidence.sampleSize,
        symbols: [symbol],
      });
      upsertNode(nodes, node(`outcome:${label}`, label, "outcome", memory.confidence?.score ?? 50, memory.evidence.sampleSize));
      edges.push(edge(`${symbol}:${label}`, "historical_outcome", `symbol:${symbol}`, `outcome:${label}`, memory.confidence?.score ?? 50, memory.evidence.explanation));
    }
  }

  for (const forecast of input.predictiveSystem?.opportunityForecasts.slice(0, 12) ?? []) {
    const signalId = `signal:predictive:${forecast.researchActionState}`;
    upsertNode(nodes, node(signalId, forecast.researchActionState, "signal", forecast.opportunityQualityScore, forecast.evidence.length));
    edges.push(edge(`predictive:${forecast.symbol}`, "signal_outcome", `symbol:${forecast.symbol}`, signalId, forecast.opportunityQualityScore, forecast.likelyPath));
  }

  const signalClusters = [...signalBuckets.entries()]
    .map(([label, bucketRows]) => ({
      label,
      score: Math.round(average(bucketRows.map((row) => scoreValue(row.final_score, row.conviction)), 50)),
      symbols: bucketRows.map((row) => row.symbol).slice(0, 8),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
  const marketEnvironmentClusters = [...environmentBuckets.entries()]
    .map(([environment, bucketRows]) => ({
      environment,
      score: Math.round(average(bucketRows.map((row) => scoreValue(row.raw.macro_alignment_score, row.macroAdjustment === null ? 50 : clamp(50 + row.macroAdjustment * 5))), 50)),
      symbols: bucketRows.map((row) => row.symbol).slice(0, 8),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
  const nodeList = [...nodes.values()].sort(compareNode).slice(0, 140);
  const edgeList = dedupeEdges(edges).sort((left, right) => right.strength - left.strength).slice(0, 220);

  return {
    datasets: [{
      dataUniquenessScore: Math.round(clamp(50 + signalClusters.length * 4 + marketEnvironmentClusters.length * 3 + outcomeClusters.length * 5 + (input.predictiveSystem ? 8 : 0))),
      description: "Graph mapping scanner signals, historical behavior, market environments, predictive opportunity state, and realized outcome memory where available.",
      id: "opportunity-knowledge-graph",
      nodeCount: nodeList.length,
      relationshipCount: edgeList.length,
      replicationDifficulty: edgeList.length >= 60 ? "very_hard" : "hard",
      sourceSystems: ["scanner signals", "market environments", "predictive forecasts", "market memory outcomes", "historical behavior"],
      title: "Opportunity Knowledge Graph",
    }],
    edges: edgeList,
    marketEnvironmentClusters,
    nodes: nodeList,
    outcomeClusters: outcomeClusters.sort((left, right) => right.score - left.score).slice(0, 10),
    signalClusters,
    summary: `Opportunity Knowledge Graph contains ${signalClusters.length} signal clusters, ${marketEnvironmentClusters.length} environment clusters, and ${outcomeClusters.length} outcome-memory clusters.`,
  };
}

function buildUniqueSignals(input: {
  marketMemoryGraph: MarketMemoryGraph;
  opportunityKnowledgeGraph: OpportunityKnowledgeGraph;
  predictiveSystem: PredictiveIntelligenceSystem | null;
  rows: OpportunityViewModel[];
  userIntelligenceGraph: UserIntelligenceGraph;
}): UniqueSignal[] {
  const memoryEdges = input.marketMemoryGraph.edges.filter((item) => item.type === "memory_similarity" || item.type === "historical_outcome");
  const crossSectorCount = new Set(input.rows.map((row) => cleanText(row.sector, "Unclassified"))).size;
  const eventRows = input.rows.filter((row) => row.eventRisk >= 55 || cleanText(row.raw.verified_event_signature ?? row.raw.event_context_label, ""));
  const behaviorScore = average(input.userIntelligenceGraph.signalPreferences.map((item) => item.score), 45);
  const signals: UniqueSignal[] = [
    {
      dataSources: ["market memory analogs", "forward outcomes", "scanner signal state"],
      description: "Blends current scanner opportunity quality with similar historical setup and outcome memory.",
      evidence: [`${memoryEdges.length} memory/outcome graph edges`, `${input.opportunityKnowledgeGraph.outcomeClusters.length} outcome clusters`],
      id: "memory-adjusted-signal",
      replicationDifficulty: memoryEdges.length >= 20 ? "very_hard" : "hard",
      signalStrengthScore: Math.round(clamp(50 + memoryEdges.length * 1.8 + input.opportunityKnowledgeGraph.outcomeClusters.length * 4)),
      title: "Memory-adjusted opportunity signal",
      type: "memory_adjusted",
      workflowUse: "Prioritizes opportunities that rhyme with validated historical analogs while keeping outcome uncertainty visible.",
    },
    {
      dataSources: ["sector clusters", "macro environments", "scanner confidence", "regime pressure"],
      description: "Detects when opportunity quality is clustering across sectors and macro environments instead of isolated symbols.",
      evidence: [`${crossSectorCount} sector(s) represented`, `${input.opportunityKnowledgeGraph.marketEnvironmentClusters.length} market-environment clusters`],
      id: "cross-sector-intelligence-signal",
      replicationDifficulty: crossSectorCount >= 5 ? "very_hard" : "hard",
      signalStrengthScore: Math.round(clamp(44 + crossSectorCount * 7 + input.opportunityKnowledgeGraph.marketEnvironmentClusters.length * 3)),
      title: "Cross-sector intelligence signal",
      type: "cross_sector_intelligence",
      workflowUse: "Helps distinguish broad market themes from single-symbol noise.",
    },
    {
      dataSources: ["watchlist", "risk profile", "workflow evolution", "behavior learning"],
      description: "Ranks opportunities by whether they match a user's durable research behavior and saved workflow anchors.",
      evidence: [`${input.userIntelligenceGraph.interests.length} interest anchors`, `${input.userIntelligenceGraph.successfulWorkflows.length} workflow success signals`, `${input.userIntelligenceGraph.signalPreferences.length} signal preferences`],
      id: "behavioral-opportunity-signal",
      replicationDifficulty: input.userIntelligenceGraph.edges.length >= 10 ? "very_hard" : "hard",
      signalStrengthScore: Math.round(clamp(behaviorScore + input.userIntelligenceGraph.edges.length * 1.6)),
      title: "Behavioral opportunity signal",
      type: "behavioral_opportunity",
      workflowUse: "Personalizes the research queue without changing scanner truth or fabricating user behavior.",
    },
    {
      dataSources: ["verified events", "macro signatures", "live/regime forecasts", "market memory"],
      description: "Combines source-backed event pressure, macro regime, and memory graph relationships into a multi-event monitoring signal.",
      evidence: [`${eventRows.length} source-backed event-pressure row(s)`, `${input.predictiveSystem?.predictiveAlerts.length ?? 0} predictive alert(s)`],
      id: "multi-event-intelligence-signal",
      replicationDifficulty: eventRows.length >= 8 ? "very_hard" : "medium",
      signalStrengthScore: Math.round(clamp(42 + eventRows.length * 4 + (input.predictiveSystem?.predictiveAlerts.length ?? 0) * 2)),
      title: "Multi-event intelligence signal",
      type: "multi_event_intelligence",
      workflowUse: "Shows when multiple source-backed event and macro pressures are reshaping opportunity priority.",
    },
  ];
  return signals.sort((left, right) => right.signalStrengthScore - left.signalStrengthScore);
}

function buildDefensibilityAnalysis(input: {
  marketMemoryGraph: MarketMemoryGraph;
  opportunityKnowledgeGraph: OpportunityKnowledgeGraph;
  proprietaryDatasets: ProprietaryDataset[];
  uniqueSignals: UniqueSignal[];
  userIntelligenceGraph: UserIntelligenceGraph;
}): DefensibilityAnalysis {
  const dataUniquenessScore = Math.round(average(input.proprietaryDatasets.map((dataset) => dataset.dataUniquenessScore), 50));
  const workflowUniquenessScore = Math.round(clamp(48 + input.userIntelligenceGraph.successfulWorkflows.length * 5 + input.userIntelligenceGraph.signalPreferences.length * 3 + input.userIntelligenceGraph.edges.length * 0.7));
  const aiUniquenessScore = Math.round(clamp(50 + input.uniqueSignals.length * 7 + input.opportunityKnowledgeGraph.signalClusters.length * 2 + input.marketMemoryGraph.edges.filter((edgeItem) => edgeItem.type === "historical_outcome").length));
  const difficultyToReplicateScore = Math.round(average(input.uniqueSignals.map((signal) => difficultyScore(signal.replicationDifficulty)), 60));
  const moatScore = Math.round(clamp(dataUniquenessScore * 0.30 + workflowUniquenessScore * 0.24 + aiUniquenessScore * 0.24 + difficultyToReplicateScore * 0.22));
  return {
    aiUniquenessScore,
    dataUniquenessScore,
    difficultyToReplicateScore,
    moatScore,
    proofPoints: [
      `${input.proprietaryDatasets.length} proprietary dataset definitions are operational.`,
      `${input.uniqueSignals.length} unique intelligence signals are operational.`,
      `${input.marketMemoryGraph.edges.length} market-memory graph relationships are source-backed.`,
      `${input.userIntelligenceGraph.edges.length} user-intelligence graph relationships are authenticated/user-specific.`,
      `${input.opportunityKnowledgeGraph.edges.length} opportunity-knowledge relationships connect signals, environments, and outcomes.`,
    ],
    replicationBarriers: [
      "Historical scanner state and outcome-memory relationships compound over time.",
      "User workflow graph depends on authenticated watchlist, behavior, preferences, and workflow evolution.",
      "Opportunity graph combines scanner, market-memory, predictive, macro, event, and outcome systems in one workflow.",
      "Unique signals expose evidence and uncertainty instead of generic screeners or black-box predictions.",
    ],
    workflowUniquenessScore,
  };
}

function certifyMoat(input: {
  defensibility: DefensibilityAnalysis;
  marketMemoryGraph: MarketMemoryGraph;
  opportunityKnowledgeGraph: OpportunityKnowledgeGraph;
  proprietaryDatasets: ProprietaryDataset[];
  uniqueSignals: UniqueSignal[];
  userIntelligenceGraph: UserIntelligenceGraph;
}): PlatformMoatCertification {
  const blockers: string[] = [];
  if (input.proprietaryDatasets.length < 3) blockers.push("Fewer than three proprietary dataset layers are operational.");
  if (input.uniqueSignals.length < 4) blockers.push("Fewer than four unique intelligence signals are operational.");
  if (input.marketMemoryGraph.edges.length < 8) blockers.push("Market Memory Graph has insufficient source-backed relationships.");
  if (input.userIntelligenceGraph.edges.length < 3) blockers.push("User Intelligence Graph has insufficient authenticated relationships.");
  if (input.opportunityKnowledgeGraph.edges.length < 20) blockers.push("Opportunity Knowledge Graph has insufficient signal/environment relationships.");
  if (input.defensibility.moatScore < 70) blockers.push(`Moat score ${input.defensibility.moatScore} is below 70.`);
  return {
    blockers,
    finalVerdict: blockers.length ? "TRADEVETO PLATFORM MOAT CONSTRUCTION NOT ACCOMPLISHED" : "TRADEVETO PLATFORM MOAT CONSTRUCTION ACCOMPLISHED",
    noUnsupportedClaims: true,
    overallStatus: blockers.length ? "not_ready" : "ready",
  };
}

function node(id: string, label: string, type: MoatGraphNodeType, score: number, evidenceCount: number): MoatGraphNode {
  return { evidenceCount, id, label: humanLabel(label), score: Math.round(clamp(score)), type };
}

function edge(seed: string, type: MoatGraphEdgeType, from: string, to: string, strength: number, evidenceText: string): MoatGraphEdge {
  return {
    evidence: evidenceText,
    from,
    id: `${type}:${seed}:${from}->${to}`.replace(/\s+/g, "-").slice(0, 180),
    strength: Math.round(clamp(strength)),
    to,
    type,
  };
}

function upsertNode(nodes: Map<string, MoatGraphNode>, item: MoatGraphNode): void {
  const current = nodes.get(item.id);
  if (!current || item.score > current.score || item.evidenceCount > current.evidenceCount) {
    nodes.set(item.id, current ? { ...item, evidenceCount: Math.max(current.evidenceCount, item.evidenceCount) } : item);
  }
}

function dedupeEdges(edges: MoatGraphEdge[]): MoatGraphEdge[] {
  const byId = new Map<string, MoatGraphEdge>();
  for (const item of edges) {
    const existing = byId.get(item.id);
    if (!existing || item.strength > existing.strength) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function dedupeDatasets(datasets: ProprietaryDataset[]): ProprietaryDataset[] {
  const byId = new Map<string, ProprietaryDataset>();
  for (const dataset of datasets) byId.set(dataset.id, dataset);
  return [...byId.values()].sort((left, right) => right.dataUniquenessScore - left.dataUniquenessScore);
}

function scoreValue(value: unknown, fallback: number): number {
  return clamp(finiteNumber(value) ?? fallback);
}

function average(values: number[], fallback: number): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return fallback;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pushMap(map: Map<string, OpportunityViewModel[]>, key: string, value: OpportunityViewModel): void {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function topEntries(map: Map<string, number>, limit: number): Array<[string, number]> {
  return [...map.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, limit);
}

function pattern(label: string, count: number, evidence: string): { evidence: string; label: string; score: number } {
  return { evidence: `${evidence}: ${count}.`, label, score: Math.round(clamp(count * 12)) };
}

function compareNode(left: MoatGraphNode, right: MoatGraphNode): number {
  return right.score - left.score || right.evidenceCount - left.evidenceCount || left.label.localeCompare(right.label);
}

function severityScore(value: "info" | "positive" | "warning"): number {
  if (value === "positive") return 78;
  if (value === "warning") return 68;
  return 56;
}

function priorityScore(value: "high" | "low" | "medium"): number {
  if (value === "high") return 82;
  if (value === "medium") return 64;
  return 48;
}

function difficultyScore(value: ReplicationDifficulty): number {
  if (value === "very_hard") return 88;
  if (value === "hard") return 74;
  return 58;
}

function pctLabel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "limited";
  return `${(Math.abs(value) <= 1 ? value * 100 : value).toFixed(1)}%`;
}

function humanLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}
