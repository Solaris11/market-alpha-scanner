import type { MacroExchangeContext } from "@/lib/trading/macro-regime";
import { macroAlignmentLabel, macroPressureLabel } from "@/lib/trading/macro-regime";
import type { MarketMemorySummary } from "@/lib/trading/market-memory";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { ShockMovePattern } from "@/lib/trading/shock-move";
import { buildVerifiedEventContext, eventReasonLabel, eventTone, type VerifiedEventContextSummary } from "@/lib/trading/verified-event-intelligence";
import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber, formatNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel, readableText } from "@/lib/ui/labels";

export type NarrativeSource = "deterministic" | "llm";

export type NarrativeDrift = {
  deteriorationScore: number;
  label: "strengthening" | "stable" | "deteriorating" | "transitioning";
  momentumScore: number;
  transitionSignals: string[];
};

export type NarrativeIntelligence = {
  bearishNarrative: string;
  bullishNarrative: string;
  conditionalOpportunity: string;
  decisionReasoning: string;
  eventReasoning: string;
  fragilityReasoning: string;
  generatedAt: string;
  liquidityNarrative: string;
  macroNarrative: string;
  moderatorSummary: string;
  narrativeDrift: NarrativeDrift;
  narrativeSummary: string;
  positioningNarrative: string;
  pressureStory: string;
  riskLanguage: string;
  riskNarrative: string;
  sectorNarrative: string;
  source: NarrativeSource;
  symbol: string;
  unsupportedClaimsDetected: boolean;
  volatilityNarrative: string;
  whatCouldBreak: string;
  whatToWatch: string[];
  whySetupMatters: string;
};

export type NarrativeInputPacket = {
  dataFreshness: {
    label: string;
    lastUpdated: string | null;
    status: string;
  };
  decision: {
    baseScore: number | null;
    conviction: number;
    finalDecision: string;
    finalScore: number | null;
    fragility: number;
    setupType: string;
  };
  event: {
    available: boolean;
    label: string;
    recentEventTitles: string[];
    reasonLabels: string[];
    riskScore: number;
    summary: string;
  };
  macro: {
    alignment: string;
    liquidityPressure: number | null;
    macroPressure: number | null;
    regime: string | null;
    sectorScore: number | null;
    supportingForces: string[];
    opposingForces: string[];
    volatilityPressure: number | null;
  };
  marketMemory: {
    available: boolean;
    evidenceLabel: string;
    narrative: string[];
    sampleSize: number;
  } | null;
  shock: {
    available: boolean;
    asymmetryScore: number | null;
    chaseRiskLabel: string | null;
    commonFailureConditions: string[];
    commonPreconditions: string[];
    currentSimilarityScore: number | null;
    opportunityState: string | null;
    reliabilityScore: number | null;
    upsideShockScore: number | null;
  };
  symbol: string;
  timestamp: string;
};

export type NarrativeBuildInput = {
  generatedAt?: string;
  macroContext?: MacroExchangeContext | null;
  marketMemory?: MarketMemorySummary | null;
  row: OpportunityViewModel;
  source?: NarrativeSource;
};

export const NARRATIVE_FORBIDDEN_LANGUAGE = /\b(buy now|sell now|guaranteed|sure profit|can't lose|cannot lose|will definitely|must buy|must sell)\b/i;

export function buildNarrativeIntelligence(input: NarrativeBuildInput): NarrativeIntelligence {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const row = input.row;
  const event = buildVerifiedEventContext(row.raw);
  const macro = input.macroContext ?? null;
  const memory = input.marketMemory ?? null;
  const shock = row.shockPattern;
  const drift = narrativeDrift(row, macro, event, shock);
  const setup = setupLabel(row.raw);
  const decision = decisionLabel(row.final_decision);
  const macroLabel = macro ? macroAlignmentLabel(macro) : row.macroLabel;
  const evidenceLabel = memory?.evidence.label ?? "Historical evidence still building";
  const shockContext = shock ? `${shock.opportunityState.toLowerCase()} with ${shock.chaseRiskLabel.toLowerCase()}` : "shock-pattern memory is still limited";
  const riskContext = riskContextLabel(row, event, macro);
  const eventPhrase = event.available ? event.compactLabel.toLowerCase() : "limited verified event context";

  const narrativeSummary = enforceSafeText(
    `${row.symbol} is a ${setup.toLowerCase()} research setup. ${decision} remains the core decision because ${coreDecisionReason(row)} Macro context is ${macroLabel.toLowerCase()}, event context shows ${eventPhrase}, and ${shockContext}.`,
  );
  const bullishNarrative = enforceSafeText(bullishNarrativeFor(row, macro, memory, shock, event));
  const bearishNarrative = enforceSafeText(bearishNarrativeFor(row, macro, shock, event));
  const moderatorSummary = enforceSafeText(
    `${row.symbol} matters if ${supportiveCondition(row, macro, event)}. The balanced view is ${decision.toLowerCase()} with ${riskContext.toLowerCase()}; stronger evidence requires cleaner entry quality and improving pressure signals.`,
  );
  const macroNarrative = enforceSafeText(macroNarrativeFor(row, macro));
  const sectorNarrative = enforceSafeText(sectorNarrativeFor(row, macro));
  const liquidityNarrative = enforceSafeText(pressureNarrative("Liquidity", macro?.liquidityPressure ?? finiteNumber(row.raw.liquidity_pressure)));
  const volatilityNarrative = enforceSafeText(pressureNarrative("Volatility", macro?.volatilityPressure ?? finiteNumber(row.raw.volatility_pressure)));
  const positioningNarrative = enforceSafeText(positioningNarrativeFor(row, shock));
  const riskNarrative = enforceSafeText(
    `${riskContext}. ${event.riskScore >= 68 ? "Verified event pressure is elevated." : "Verified event pressure is not the dominant blocker."} ${row.fragility >= 70 ? "Fragility is high enough that late entries need extra caution." : "Fragility is measurable but not extreme."}`,
  );
  const fragilityReasoning = enforceSafeText(fragilityReasoningFor(row, macro, event, shock));
  const decisionReasoning = enforceSafeText(
    `${decision} reflects ${scoreText(row.final_score)} final score, ${row.conviction} conviction, ${row.fragility} fragility, ${evidenceLabel.toLowerCase()}, and ${macroLabel.toLowerCase()} context. The score is context, not prediction.`,
  );
  const eventReasoning = enforceSafeText(eventReasoningFor(event));
  const whySetupMatters = enforceSafeText(
    `${row.symbol} matters because it combines ${setup.toLowerCase()} structure with ${row.sector ? `${row.sector} context` : "current scanner context"} and visible risk controls. ${memory?.narrative[0] ?? "Market memory evidence is still building."}`,
  );
  const whatCouldBreak = enforceSafeText(whatCouldBreakFor(row, macro, event, shock));
  const conditionalOpportunity = enforceSafeText(conditionalOpportunityFor(row, macro, event, shock));
  const pressureStory = enforceSafeText(pressureStoryFor(row, macro, event));
  const whatToWatch = watchItems(row, macro, event, shock);

  return {
    bearishNarrative,
    bullishNarrative,
    conditionalOpportunity,
    decisionReasoning,
    eventReasoning,
    fragilityReasoning,
    generatedAt,
    liquidityNarrative,
    macroNarrative,
    moderatorSummary,
    narrativeDrift: drift,
    narrativeSummary,
    positioningNarrative,
    pressureStory,
    riskLanguage: "Research only. This is not financial advice, not a core action instruction, and not a prediction.",
    riskNarrative,
    sectorNarrative,
    source: input.source ?? "deterministic",
    symbol: row.symbol,
    unsupportedClaimsDetected: false,
    volatilityNarrative,
    whatCouldBreak,
    whatToWatch,
    whySetupMatters,
  };
}

export function buildNarrativeInputPacket(input: NarrativeBuildInput, narrative?: NarrativeIntelligence): NarrativeInputPacket {
  const row = input.row;
  const event = buildVerifiedEventContext(row.raw);
  const macro = input.macroContext ?? null;
  const shock = row.shockPattern;
  const memory = input.marketMemory ?? null;
  return {
    dataFreshness: {
      label: row.dataFreshness.label,
      lastUpdated: row.dataFreshness.lastUpdated,
      status: row.dataFreshness.status,
    },
    decision: {
      baseScore: finiteNumber(row.raw.base_score ?? row.raw.technical_score),
      conviction: row.conviction,
      finalDecision: decisionLabel(row.final_decision),
      finalScore: row.final_score,
      fragility: row.fragility,
      setupType: setupLabel(row.raw),
    },
    event: {
      available: event.available,
      label: event.label,
      recentEventTitles: event.recentEvents.map((item) => item.title).slice(0, 4),
      reasonLabels: event.reasonCodes.map(eventReasonLabel).slice(0, 6),
      riskScore: event.riskScore,
      summary: event.summary,
    },
    macro: {
      alignment: macro ? macroAlignmentLabel(macro) : row.macroLabel,
      liquidityPressure: macro?.liquidityPressure ?? finiteNumber(row.raw.liquidity_pressure),
      macroPressure: macro?.macroPressureScore ?? finiteNumber(row.raw.macro_pressure_score),
      regime: macro?.macroRegime ?? (cleanText(row.raw.market_regime, "") || null),
      sectorScore: macro?.sectorAlignmentScore ?? finiteNumber(row.raw.sector_alignment_score),
      supportingForces: (macro?.supportingForces ?? []).slice(0, 4),
      opposingForces: (macro?.opposingForces ?? []).slice(0, 4),
      volatilityPressure: macro?.volatilityPressure ?? finiteNumber(row.raw.volatility_pressure),
    },
    marketMemory: memory ? {
      available: memory.available,
      evidenceLabel: memory.evidence.label,
      narrative: memory.narrative.slice(0, 3),
      sampleSize: memory.evidence.sampleSize,
    } : null,
    shock: {
      available: Boolean(shock),
      asymmetryScore: shock?.asymmetryScore ?? null,
      chaseRiskLabel: shock?.chaseRiskLabel ?? null,
      commonFailureConditions: shock?.commonFailureConditions.slice(0, 4) ?? [],
      commonPreconditions: shock?.commonPreconditions.slice(0, 4) ?? [],
      currentSimilarityScore: shock?.currentSimilarityScore ?? null,
      opportunityState: shock?.opportunityState ?? null,
      reliabilityScore: shock?.reliabilityScore ?? null,
      upsideShockScore: shock?.upsideShockScore ?? null,
    },
    symbol: row.symbol,
    timestamp: narrative?.generatedAt ?? input.generatedAt ?? new Date().toISOString(),
  };
}

export function narrativeJsonSchema(): Record<string, unknown> {
  const stringSchema = { type: "string", minLength: 1, maxLength: 520 };
  return {
    additionalProperties: false,
    properties: {
      bearishNarrative: stringSchema,
      bullishNarrative: stringSchema,
      conditionalOpportunity: stringSchema,
      decisionReasoning: stringSchema,
      eventReasoning: stringSchema,
      fragilityReasoning: stringSchema,
      liquidityNarrative: stringSchema,
      macroNarrative: stringSchema,
      moderatorSummary: stringSchema,
      narrativeSummary: stringSchema,
      positioningNarrative: stringSchema,
      pressureStory: stringSchema,
      riskLanguage: stringSchema,
      riskNarrative: stringSchema,
      sectorNarrative: stringSchema,
      unsupportedClaimsDetected: { type: "boolean" },
      volatilityNarrative: stringSchema,
      whatCouldBreak: stringSchema,
      whatToWatch: { items: stringSchema, maxItems: 5, minItems: 2, type: "array" },
      whySetupMatters: stringSchema,
    },
    required: [
      "narrativeSummary",
      "bullishNarrative",
      "bearishNarrative",
      "moderatorSummary",
      "riskNarrative",
      "macroNarrative",
      "sectorNarrative",
      "liquidityNarrative",
      "volatilityNarrative",
      "positioningNarrative",
      "decisionReasoning",
      "eventReasoning",
      "fragilityReasoning",
      "whySetupMatters",
      "whatCouldBreak",
      "conditionalOpportunity",
      "pressureStory",
      "whatToWatch",
      "riskLanguage",
      "unsupportedClaimsDetected",
    ],
    type: "object",
  };
}

export function applyValidatedLlmNarrative(base: NarrativeIntelligence, value: unknown): NarrativeIntelligence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.unsupportedClaimsDetected !== false) return null;
  const fields = {
    bearishNarrative: safeNarrativeText(record.bearishNarrative),
    bullishNarrative: safeNarrativeText(record.bullishNarrative),
    conditionalOpportunity: safeNarrativeText(record.conditionalOpportunity),
    decisionReasoning: safeNarrativeText(record.decisionReasoning),
    eventReasoning: safeNarrativeText(record.eventReasoning),
    fragilityReasoning: safeNarrativeText(record.fragilityReasoning),
    liquidityNarrative: safeNarrativeText(record.liquidityNarrative),
    macroNarrative: safeNarrativeText(record.macroNarrative),
    moderatorSummary: safeNarrativeText(record.moderatorSummary),
    narrativeSummary: safeNarrativeText(record.narrativeSummary),
    positioningNarrative: safeNarrativeText(record.positioningNarrative),
    pressureStory: safeNarrativeText(record.pressureStory),
    riskLanguage: safeNarrativeText(record.riskLanguage),
    riskNarrative: safeNarrativeText(record.riskNarrative),
    sectorNarrative: safeNarrativeText(record.sectorNarrative),
    volatilityNarrative: safeNarrativeText(record.volatilityNarrative),
    whatCouldBreak: safeNarrativeText(record.whatCouldBreak),
    whySetupMatters: safeNarrativeText(record.whySetupMatters),
  };
  if (Object.values(fields).some((text) => !text || NARRATIVE_FORBIDDEN_LANGUAGE.test(text))) return null;
  const whatToWatch = safeNarrativeArray(record.whatToWatch, 5);
  if (whatToWatch.length < 2) return null;
  if (!fields.riskLanguage.toLowerCase().includes("not financial advice") && !fields.riskLanguage.toLowerCase().includes("research")) return null;
  return {
    ...base,
    ...fields,
    source: "llm",
    unsupportedClaimsDetected: false,
    whatToWatch,
  };
}

function bullishNarrativeFor(row: OpportunityViewModel, macro: MacroExchangeContext | null, memory: MarketMemorySummary | null, shock: ShockMovePattern | null, event: VerifiedEventContextSummary): string {
  const forces = macro?.supportingForces.filter(notMutedForce).slice(0, 2) ?? [];
  const support = forces.length ? forces.join(" ") : "Current setup evidence is the main support.";
  const shockText = shock && shock.upsideShockScore >= 65 ? `Shock memory supports elevated upside-volatility context with ${shock.upsideShockCount} upside shock observations.` : "Shock memory is not the primary support yet.";
  const memoryText = memory?.available ? memory.narrative[0] : "Market memory is still limited.";
  const eventText = eventTone(event) === "support" ? `Verified event context is supportive: ${event.compactLabel}.` : "Verified events are not providing a clean standalone tailwind.";
  return `${support} ${shockText} ${memoryText} ${eventText} Conviction is ${row.conviction}.`;
}

function bearishNarrativeFor(row: OpportunityViewModel, macro: MacroExchangeContext | null, shock: ShockMovePattern | null, event: VerifiedEventContextSummary): string {
  const forces = macro?.opposingForces.filter(notMutedForce).slice(0, 2) ?? [];
  const macroRisk = forces.length ? forces.join(" ") : "Macro headwinds are not dominant in the available proxy set.";
  const chase = shock?.chaseRiskLabel ?? (row.fragility >= 70 ? "Chase risk elevated" : "Chase risk contained");
  const eventRisk = eventTone(event) === "risk" ? `Verified event risk is elevated: ${event.compactLabel}.` : "Event pressure is not the leading risk.";
  return `${macroRisk} ${eventRisk} ${chase}. Fragility is ${row.fragility}, so the setup can weaken if entry quality deteriorates.`;
}

function macroNarrativeFor(row: OpportunityViewModel, macro: MacroExchangeContext | null): string {
  if (!macro) return `${row.macroLabel} based on scanner-provided context. Macro proxy detail is unavailable for this narrative snapshot.`;
  return `${macroAlignmentLabel(macro)} in a ${macro.macroRegime.toLowerCase()} backdrop. ${macro.regimeExplanation} Supporting forces: ${macro.supportingForces.slice(0, 2).join(" ")}`;
}

function sectorNarrativeFor(row: OpportunityViewModel, macro: MacroExchangeContext | null): string {
  const sector = row.sector ? row.sector : "symbol group";
  if (!macro) return `${sector} context is inferred from scanner metadata and remains limited.`;
  const score = macro.sectorAlignmentScore;
  const state = score >= 65 ? "supportive" : score < 45 ? "under pressure" : "mixed";
  return `${sector} context is ${state}. ${macro.themeContext}`;
}

function pressureNarrative(label: "Liquidity" | "Volatility", value: number | null): string {
  if (value === null) return `${label} pressure is unavailable in the current structured packet.`;
  return `${label} pressure is ${macroPressureLabel(value).toLowerCase()} at ${formatNumber(value, 0)}. This pressure changes fragility context, not certainty.`;
}

function positioningNarrativeFor(row: OpportunityViewModel, shock: ShockMovePattern | null): string {
  if (shock) {
    return `${shock.chaseRiskLabel}. Research entry context is ${shock.researchEntryZone}; do-not-chase context is ${shock.doNotChaseZone}.`;
  }
  const distance = finiteNumber(row.raw.entry_distance_pct ?? row.raw.correction_distance_pct);
  if (distance !== null && distance >= 6) return `Position quality is chase-prone because price is extended from the preferred research area by ${distance.toFixed(1)} points of distance context.`;
  return "Position quality is governed by entry distance, fragility, and whether price holds the current research zone.";
}

function fragilityReasoningFor(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary, shock: ShockMovePattern | null): string {
  const drivers = [
    row.fragility >= 70 ? "structural fragility is elevated" : "structural fragility is controlled but still visible",
    event.fragilityAdjustment > 0 ? "verified events add fragility" : "verified events do not add major fragility",
    macro && macro.volatilityPressure >= 65 ? "volatility pressure is elevated" : "volatility pressure is not extreme",
    shock && shock.downsideRiskScore >= 70 ? "shock memory shows elevated downside behavior" : "shock downside memory is not dominant",
  ];
  return `${row.symbol} fragility comes from ${drivers.join(", ")}.`;
}

function eventReasoningFor(event: VerifiedEventContextSummary): string {
  if (!event.available) return "No verified event catalyst is available in the structured packet, so event narrative remains muted.";
  const reasons = event.reasonCodes.map(eventReasonLabel).slice(0, 3);
  const sourceText = event.sourcesUsed.length ? ` Sources used: ${event.sourcesUsed.slice(0, 3).join(", ")}.` : "";
  return `${event.summary} Reason context: ${reasons.length ? reasons.join(", ") : event.compactLabel}.${sourceText}`;
}

function whatCouldBreakFor(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary, shock: ShockMovePattern | null): string {
  const parts = [
    macro && macro.alignmentState === "conflict" ? "macro conflict persists" : "macro context turns less supportive",
    event.riskScore >= 68 ? "event pressure escalates" : "verified event context worsens",
    shock?.commonFailureConditions[0] ?? "entry quality fails near the research zone",
  ];
  return `${row.symbol} weakens if ${parts.join(", ")}. Invalidation context: ${shock?.invalidationZone ?? row.stop_loss ?? "not available"}.`;
}

function conditionalOpportunityFor(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary, shock: ShockMovePattern | null): string {
  const conditions = [
    macro && macro.alignmentState !== "conflict" ? "macro alignment stays constructive" : "macro conflict eases",
    row.fragility < 65 ? "fragility remains contained" : "fragility declines",
    event.riskScore < 68 ? "event pressure stays manageable" : "event pressure cools",
    shock ? `price respects ${shock.researchEntryZone}` : "price respects the research entry area",
  ];
  return `${row.symbol} becomes more attractive as a research setup if ${conditions.join(", ")}.`;
}

function pressureStoryFor(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary): string {
  const macroPressure = macro?.macroPressureScore ?? finiteNumber(row.raw.macro_pressure_score);
  const sectorScore = macro?.sectorAlignmentScore ?? finiteNumber(row.raw.sector_alignment_score);
  const macroText = macroPressure === null ? "macro pressure is unavailable" : `macro pressure is ${macroPressure >= 65 ? "elevated" : macroPressure < 45 ? "contained" : "mixed"}`;
  const sectorText = sectorScore === null ? "sector pressure is unavailable" : `sector alignment is ${sectorScore >= 65 ? "supportive" : sectorScore < 45 ? "weak" : "mixed"}`;
  return `${row.symbol} pressure map: ${macroText}, ${sectorText}, event pressure is ${event.riskScore >= 68 ? "elevated" : "manageable"}, and fragility is ${row.fragility}.`;
}

function watchItems(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary, shock: ShockMovePattern | null): string[] {
  const items = [
    macro && macro.alignmentState === "conflict" ? "Whether macro alignment improves from conflict toward mixed or aligned." : "Whether macro alignment stays supportive.",
    event.available ? `Whether verified event pressure changes from ${event.compactLabel}.` : "Whether a verified event catalyst appears.",
    shock ? `Whether price respects ${shock.researchEntryZone} instead of extending into ${shock.doNotChaseZone}.` : "Whether price respects the current research entry zone.",
    row.fragility >= 65 ? "Whether fragility falls before exposure is considered." : "Whether fragility remains contained.",
    "Whether fresh scan data confirms or weakens this narrative.",
  ];
  return unique(items.map(enforceSafeText)).slice(0, 5);
}

function narrativeDrift(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary, shock: ShockMovePattern | null): NarrativeDrift {
  const scoreChange = finiteNumber(row.raw.score_change ?? row.raw.readiness_change ?? row.raw.confidence_change);
  const momentumScore = clamp(50 + (scoreChange ?? 0) * 6 + Math.max(0, row.conviction - 60) * 0.4 + Math.max(0, (shock?.currentSimilarityScore ?? 50) - 55) * 0.18);
  const deteriorationScore = clamp(50 + Math.max(0, row.fragility - 58) * 0.55 + Math.max(0, event.riskScore - 58) * 0.34 + Math.max(0, (macro?.macroPressureScore ?? 50) - 58) * 0.3 + Math.max(0, (shock?.chaseRiskScore ?? 50) - 58) * 0.24);
  const transitionSignals: string[] = [];
  if (scoreChange !== null && Math.abs(scoreChange) >= 2) transitionSignals.push(`${scoreChange > 0 ? "positive" : "negative"} score drift`);
  if (macro && macro.alignmentState === "conflict") transitionSignals.push("macro conflict");
  if (event.riskScore >= 68) transitionSignals.push("event pressure rising");
  if (shock && shock.chaseRiskScore >= 70) transitionSignals.push("chase risk elevated");
  const label = deteriorationScore >= 70 && momentumScore >= 60 ? "transitioning" : deteriorationScore >= 68 ? "deteriorating" : momentumScore >= 65 ? "strengthening" : "stable";
  return {
    deteriorationScore: Math.round(deteriorationScore),
    label,
    momentumScore: Math.round(momentumScore),
    transitionSignals: transitionSignals.length ? transitionSignals.slice(0, 4) : ["no major narrative transition detected"],
  };
}

function riskContextLabel(row: OpportunityViewModel, event: VerifiedEventContextSummary, macro: MacroExchangeContext | null): string {
  if (row.fragility >= 75 || event.riskScore >= 75 || (macro?.macroPressureScore ?? 0) >= 75) return "High fragility context";
  if (row.fragility >= 62 || event.riskScore >= 65 || (macro?.macroPressureScore ?? 0) >= 65) return "Elevated risk context";
  return "Measured risk context";
}

function coreDecisionReason(row: OpportunityViewModel): string {
  const reason = readableText(row.decision_reason, "");
  if (reason) return `${reason}.`;
  return `${row.conviction} conviction and ${row.fragility} fragility are balanced against the latest risk filters.`;
}

function setupLabel(row: RankingRow): string {
  return humanizeLabel(cleanText(row.setup_type, "setup"));
}

function supportiveCondition(row: OpportunityViewModel, macro: MacroExchangeContext | null, event: VerifiedEventContextSummary): string {
  if (macro && macro.alignmentState === "aligned" && event.riskScore < 65) return "macro alignment and event pressure remain supportive";
  if (row.conviction >= 70) return "current structure keeps confirming and fragility does not rise";
  return "fresh evidence improves beyond the current WAIT or WATCH state";
}

function scoreText(value: number | null): string {
  return value === null ? "unavailable" : formatNumber(value, 0);
}

function notMutedForce(value: string): boolean {
  return !value.toLowerCase().includes("no major");
}

function safeNarrativeText(value: unknown): string {
  const text = cleanText(value, "").replace(/\s+/g, " ").trim();
  if (!text || NARRATIVE_FORBIDDEN_LANGUAGE.test(text)) return "";
  return text.length > 520 ? text.slice(0, 520).trim() : text;
}

function safeNarrativeArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(safeNarrativeText).filter(Boolean).slice(0, limit);
}

function enforceSafeText(value: string): string {
  const safe = safeNarrativeText(value);
  return safe || "Narrative context is unavailable from the current structured packet.";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
