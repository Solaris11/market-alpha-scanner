import type { UserPersonalizationProfile } from "@/lib/trading/personalized-intelligence";
import type { RankingRow } from "@/lib/types";
import { cleanText, finiteNumber } from "@/lib/ui/formatters";
import { decisionLabel, humanizeLabel } from "@/lib/ui/labels";

export const DECISION_JOURNAL_ACTIONS = [
  "watch",
  "wait",
  "enter",
  "exit",
  "avoid",
  "missed_opportunity",
  "shock_watch",
  "pullback_watch",
  "aggressive_entry",
  "defensive_wait",
] as const;

export type DecisionJournalAction = (typeof DECISION_JOURNAL_ACTIONS)[number];
export type DecisionOutcomeStatus = "pending" | "tracking" | "updated" | "resolved";
export type DecisionOutcomeQuality = "helped" | "hurt" | "neutral" | "pending" | "unknown";

export type DecisionJournalEntry = {
  concerns: string | null;
  convictionScore: number | null;
  createdAt: string;
  deterministicSnapshot: Record<string, unknown>;
  emotionalContext: string | null;
  expectedCatalyst: string | null;
  finalDecision: string | null;
  followupReturn1d: number | null;
  followupReturn5d: number | null;
  followupReturn10d: number | null;
  fragilityScore: number | null;
  id: string;
  invalidationReasoning: string | null;
  macroRegime: string | null;
  macroView: string | null;
  outcomeQuality: DecisionOutcomeQuality;
  outcomeStatus: DecisionOutcomeStatus;
  personalityProfile: string | null;
  reason: string | null;
  riskRewardProfile: string | null;
  setupType: string | null;
  shockState: string | null;
  symbol: string;
  thesis: string | null;
  updatedAt: string;
  userAction: DecisionJournalAction;
};

export type DecisionMemorySummary = {
  available: boolean;
  behaviorFlags: string[];
  chaseCount: number;
  coachingNotes: string[];
  journalCount: number;
  lastUpdated: string | null;
  outcomePendingCount: number;
  patientDecisionCount: number;
  preferredActions: Array<{ count: number; label: string }>;
  privacyNote: string;
  strengths: string[];
  symbol: string | null;
  symbolEntryCount: number;
  topSetups: Array<{ count: number; label: string }>;
  weaknesses: string[];
};

export type PersonalizedDecisionCoaching = {
  coachingNotes: string[];
  fitLabel: "Behavioral fit" | "Needs caution" | "Memory still building";
  strengthReason: string;
  warningReason: string;
};

const ACTION_LABELS: Record<DecisionJournalAction, string> = {
  aggressive_entry: "Aggressive Entry",
  avoid: "Avoid",
  defensive_wait: "Defensive Wait",
  enter: "Enter",
  exit: "Exit",
  missed_opportunity: "Missed Opportunity",
  pullback_watch: "Pullback Watch",
  shock_watch: "Shock Watch",
  wait: "Wait",
  watch: "Watch",
};

const CHASE_ACTIONS = new Set<DecisionJournalAction>(["aggressive_entry", "enter", "shock_watch"]);
const PATIENT_ACTIONS = new Set<DecisionJournalAction>(["avoid", "defensive_wait", "pullback_watch", "wait", "watch"]);

export function normalizeDecisionJournalAction(value: unknown): DecisionJournalAction {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return DECISION_JOURNAL_ACTIONS.includes(text as DecisionJournalAction) ? (text as DecisionJournalAction) : "watch";
}

export function decisionJournalActionLabel(action: DecisionJournalAction): string {
  return ACTION_LABELS[action];
}

export function buildDecisionMemorySummary(entries: DecisionJournalEntry[], options: { symbol?: string | null } = {}): DecisionMemorySummary {
  const symbol = cleanSymbol(options.symbol);
  const bounded = entries.slice(0, 200);
  const symbolEntries = symbol ? bounded.filter((entry) => entry.symbol === symbol) : bounded;
  const chaseCount = bounded.filter(isChaseLikeDecision).length;
  const patientDecisionCount = bounded.filter((entry) => PATIENT_ACTIONS.has(entry.userAction)).length;
  const outcomePendingCount = bounded.filter((entry) => entry.outcomeStatus === "pending" || entry.outcomeQuality === "pending").length;
  const topSetups = countLabels(bounded.map((entry) => setupLabel(entry.setupType)).filter(Boolean), 4);
  const preferredActions = countLabels(bounded.map((entry) => decisionJournalActionLabel(entry.userAction)), 4);
  const strengths = strengthNotes(bounded, patientDecisionCount);
  const weaknesses = weaknessNotes(bounded, chaseCount);
  const behaviorFlags = behaviorFlagNotes(bounded, chaseCount, patientDecisionCount);
  const coachingNotes = coachingNotesFor({ bounded, chaseCount, patientDecisionCount, symbol, symbolEntries });

  return {
    available: bounded.length > 0,
    behaviorFlags,
    chaseCount,
    coachingNotes,
    journalCount: bounded.length,
    lastUpdated: bounded[0]?.createdAt ?? null,
    outcomePendingCount,
    patientDecisionCount,
    preferredActions,
    privacyNote: "Decision memory is private to your account. You can clear journal memory at any time.",
    strengths,
    symbol,
    symbolEntryCount: symbolEntries.length,
    topSetups,
    weaknesses,
  };
}

export function buildPersonalizedDecisionCoaching(input: {
  entries: DecisionJournalEntry[];
  memory: DecisionMemorySummary;
  profile: UserPersonalizationProfile | null;
  row: RankingRow;
}): PersonalizedDecisionCoaching {
  const setup = setupLabel(input.row.setup_type);
  const fragility = finiteNumber(input.row.fragility_score ?? input.row.risk_score ?? input.row.event_risk_score) ?? 50;
  const decision = decisionLabel(input.row.final_decision);
  const similar = input.entries.filter((entry) => setupLabel(entry.setupType) === setup).slice(0, 12);
  const chaseRisk = fragility >= 70 || isExtendedSnapshot(input.row);
  const profileLabel = input.profile?.label ?? "Your profile";
  const strengthReason = similar.length
    ? `${input.row.symbol} resembles ${similar.length} journaled ${setup.toLowerCase()} decision${similar.length === 1 ? "" : "s"} in your memory.`
    : `${input.row.symbol} has limited user-memory history, so coaching relies on your current ${profileLabel.toLowerCase()} profile and scanner context.`;
  const warningReason = chaseRisk
    ? `${decision} remains important because this setup has elevated fragility or extension risk. Decision memory should not turn this into a core action.`
    : `${decision} is compatible with measured review. Keep invalidation and entry quality explicit before acting.`;
  const fitLabel = !input.memory.available ? "Memory still building" : chaseRisk || input.memory.chaseCount >= 3 ? "Needs caution" : "Behavioral fit";
  return {
    coachingNotes: [
      ...input.memory.coachingNotes.slice(0, 2),
      "Write the reason before the outcome is known; this keeps the journal useful and reduces hindsight bias.",
      "Outcome tracking is staged, so new entries begin as pending evidence.",
    ].slice(0, 4),
    fitLabel,
    strengthReason,
    warningReason,
  };
}

export function snapshotFromRow(row: RankingRow, profile: UserPersonalizationProfile | null = null): Record<string, unknown> {
  return {
    entry_distance_pct: finiteNumber(row.entry_distance_pct ?? row.correction_distance_pct),
    event_risk_score: finiteNumber(row.event_risk_score),
    final_decision: cleanText(row.final_decision, ""),
    final_score: finiteNumber(row.final_score),
    fragility_score: finiteNumber(row.fragility_score ?? row.risk_score ?? row.event_risk_score),
    macro_regime: cleanText(row.market_regime ?? row.macro_context_label, ""),
    personality_profile: profile?.personality ?? null,
    preferred_reward_level: profile?.preferredRewardLevel ?? null,
    preferred_risk_level: profile?.preferredRiskLevel ?? null,
    price: finiteNumber(row.price),
    return_1d: finiteNumber(row.return_1d),
    setup_type: cleanText(row.setup_type, ""),
    symbol: cleanText(row.symbol, ""),
  };
}

function strengthNotes(entries: DecisionJournalEntry[], patientDecisionCount: number): string[] {
  const notes: string[] = [];
  if (patientDecisionCount >= 3) notes.push("You have a repeated pattern of documenting patient WAIT/WATCH/AVOID decisions.");
  const pullbackCount = entries.filter((entry) => setupLabel(entry.setupType).toLowerCase().includes("pullback")).length;
  if (pullbackCount >= 2) notes.push("Your journal shows recurring attention to pullback-style setups.");
  const helpedCount = entries.filter((entry) => entry.outcomeQuality === "helped").length;
  if (helpedCount >= 2) notes.push("Some logged decisions are already marked as helpful outcomes.");
  return notes.length ? notes : ["Decision memory is beginning to form; more journal entries will make strengths clearer."];
}

function weaknessNotes(entries: DecisionJournalEntry[], chaseCount: number): string[] {
  const notes: string[] = [];
  if (chaseCount >= 3) notes.push("You have multiple journaled decisions with elevated chase or extension characteristics.");
  const highFragilityEntries = entries.filter((entry) => (entry.fragilityScore ?? 0) >= 70 && CHASE_ACTIONS.has(entry.userAction)).length;
  if (highFragilityEntries >= 2) notes.push("High-fragility entries appear repeatedly; review invalidation before increasing exposure.");
  const hurtCount = entries.filter((entry) => entry.outcomeQuality === "hurt").length;
  if (hurtCount >= 2) notes.push("Some decisions are marked as harmful outcomes; compare their setup type and macro context before repeating them.");
  return notes.length ? notes : ["No repeated behavioral weakness is strong enough to label yet."];
}

function behaviorFlagNotes(entries: DecisionJournalEntry[], chaseCount: number, patientDecisionCount: number): string[] {
  const flags: string[] = [];
  if (chaseCount >= 3) flags.push("Elevated chase tendency");
  if (patientDecisionCount >= chaseCount + 2) flags.push("Patient review bias");
  if (entries.some((entry) => entry.emotionalContext)) flags.push("Emotional context logged");
  if (entries.some((entry) => entry.invalidationReasoning)) flags.push("Invalidation reasoning present");
  return flags.length ? flags : ["Memory sample still limited"];
}

function coachingNotesFor(input: { bounded: DecisionJournalEntry[]; chaseCount: number; patientDecisionCount: number; symbol: string | null; symbolEntries: DecisionJournalEntry[] }): string[] {
  if (!input.bounded.length) {
    return [
      "Start by saving WAIT, WATCH, AVOID, or aggressive decisions before the outcome is known.",
      "TradeVeto will compare future setups against your own documented behavior.",
    ];
  }
  const notes: string[] = [];
  if (input.symbol && input.symbolEntries.length > 0) {
    notes.push(`You have ${input.symbolEntries.length} journaled decision${input.symbolEntries.length === 1 ? "" : "s"} for ${input.symbol}.`);
  }
  if (input.chaseCount >= 3) notes.push("Before aggressive entries, check whether the move is already extended versus your research entry zone.");
  if (input.patientDecisionCount >= 3) notes.push("Your patient decisions are becoming a useful baseline for comparing avoided losses and missed opportunities.");
  if (input.bounded.some((entry) => entry.outcomeStatus === "pending")) notes.push("Some outcomes are pending; avoid over-weighting recent entries until follow-through is known.");
  return notes.length ? notes.slice(0, 4) : ["Keep logging the reason, concern, and invalidation area so future coaching has real evidence."];
}

function isChaseLikeDecision(entry: DecisionJournalEntry): boolean {
  const snapshot = entry.deterministicSnapshot;
  const entryDistance = finiteNumber(snapshot["entry_distance_pct"]) ?? 0;
  const return1d = finiteNumber(snapshot["return_1d"]) ?? 0;
  const fragile = (entry.fragilityScore ?? 0) >= 70;
  return CHASE_ACTIONS.has(entry.userAction) && (entryDistance >= 6 || return1d >= 6 || fragile);
}

function isExtendedSnapshot(row: RankingRow): boolean {
  const entryDistance = finiteNumber(row.entry_distance_pct ?? row.correction_distance_pct) ?? 0;
  const return1d = finiteNumber(row.return_1d) ?? 0;
  return entryDistance >= 6 || return1d >= 6;
}

function countLabels(labels: string[], limit: number): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ count, label }));
}

function setupLabel(value: unknown): string {
  const text = cleanText(value, "Unknown setup");
  return humanizeLabel(text);
}

function cleanSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}
