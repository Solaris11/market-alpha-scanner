import type { DecisionMemorySummary } from "./decision-journal";
import type { UserPersonalizationProfile } from "./personalized-intelligence";
import type { UserMemorySettings } from "./user-memory-settings";
import type { WorkflowEvolutionSummary } from "./workflow-evolution";

export type UserMemoryTransparencyItem = {
  detail: string;
  title: string;
};

export type UserMemoryInsight = {
  detail: string;
  evidenceLabel: string;
  title: string;
  tone: "caution" | "info" | "positive";
};

export type WatchlistRevisitInsight = {
  detail: string;
  priority: "high" | "medium" | "low";
  state: string;
  symbol: string;
  title: string;
};

export type PersonalizedDailyBriefing = {
  bullets: string[];
  dataState: "active" | "building" | "disabled";
  headline: string;
  privacyNote: string;
};

export type UserMemoryActivationModel = {
  dailyBriefing: PersonalizedDailyBriefing;
  insights: UserMemoryInsight[];
  privacySummary: string[];
  retentionHypothesis: string[];
  transparency: UserMemoryTransparencyItem[];
  watchlistRevisit: WatchlistRevisitInsight[];
};

export function buildUserMemoryActivation(input: {
  memory: DecisionMemorySummary | null;
  profile: UserPersonalizationProfile | null;
  settings: UserMemorySettings;
  watchlistSymbols: string[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): UserMemoryActivationModel {
  const memory = input.memory;
  const profile = input.profile;
  const settings = input.settings;
  const watchlistSymbols = input.watchlistSymbols.map((symbol) => cleanSymbol(symbol)).filter((symbol): symbol is string => Boolean(symbol)).slice(0, 16);
  const transparency = transparencyItems({ hasJournal: Boolean(memory?.journalCount), settings, watchlistCount: watchlistSymbols.length });
  const insights = insightItems(memory, profile, settings);
  const watchlistRevisit = watchlistRevisitItems(input.workflowEvolution, watchlistSymbols);
  const dailyBriefing = dailyBriefingFor({ insights, memory, profile, settings, watchlistRevisit, workflowEvolution: input.workflowEvolution });
  return {
    dailyBriefing,
    insights,
    privacySummary: privacySummaryFor(settings),
    retentionHypothesis: [
      "Decision memory should increase symbol revisits by showing what changed since the user's last review.",
      "Journaled WAIT, WATCH, AVOID, and missed-opportunity entries create a reason to return after outcomes update.",
      "Behavioral learning stays opt-in-controllable, which supports trust without manipulative urgency.",
    ],
    transparency,
    watchlistRevisit,
  };
}

function transparencyItems(input: { hasJournal: boolean; settings: UserMemorySettings; watchlistCount: number }): UserMemoryTransparencyItem[] {
  return [
    {
      title: "What is remembered",
      detail: input.hasJournal
        ? "Journal actions, optional notes, setup type, macro context, conviction, fragility, shock state, and bounded scanner snapshot fields."
        : "No decision journal entries are stored yet. Watchlist and risk profile settings are saved separately from behavioral memory.",
    },
    {
      title: "Why it is used",
      detail: "TradeVeto uses memory to frame research reminders, revisit watchlist changes, and explain whether a setup fits documented preferences.",
    },
    {
      title: "Behavioral learning",
      detail: input.settings.behavioralLearningEnabled
        ? `Enabled. Recent product interactions and ${input.watchlistCount} saved watchlist symbol${input.watchlistCount === 1 ? "" : "s"} may inform ranking context.`
        : "Disabled. Interaction history is not used for personalization, and workflow visit snapshots are not recorded.",
    },
    {
      title: "User control",
      detail: "You can export memory, clear memory, and disable behavioral learning without deleting your account.",
    },
  ];
}

function insightItems(memory: DecisionMemorySummary | null, profile: UserPersonalizationProfile | null, settings: UserMemorySettings): UserMemoryInsight[] {
  const items: UserMemoryInsight[] = [];
  if (!settings.journalCoachingEnabled) {
    return [{
      detail: "Journal coaching is disabled. Saved entries remain available for export and review.",
      evidenceLabel: "Coaching paused",
      title: "Journal coaching paused",
      tone: "info",
    }];
  }
  if (!memory || !memory.available) {
    items.push({
      detail: "Save WATCH, WAIT, AVOID, missed opportunity, shock watch, or pullback watch decisions before outcomes are known.",
      evidenceLabel: "Memory building",
      title: "Decision memory is starting",
      tone: "info",
    });
  } else {
    const strongestSetup = memory.topSetups[0];
    if (strongestSetup) {
      items.push({
        detail: `${strongestSetup.label} appears most often in your journal. TradeVeto will compare future setups against that documented behavior.`,
        evidenceLabel: `${strongestSetup.count} entries`,
        title: "Strongest setup type",
        tone: "positive",
      });
    }
    if (memory.chaseCount >= 2) {
      items.push({
        detail: "Several entries have chase-like characteristics. Future aggressive entries should keep entry quality and invalidation explicit.",
        evidenceLabel: `${memory.chaseCount} chase-risk notes`,
        title: "Chase tendency check",
        tone: "caution",
      });
    } else {
      items.push({
        detail: "No repeated chase pattern is strong enough to label yet. Continue logging decisions before outcomes are known.",
        evidenceLabel: "No strong chase pattern",
        title: "Chase tendency check",
        tone: "info",
      });
    }
    if (memory.patientDecisionCount >= 2) {
      items.push({
        detail: "Your patient decisions create an evidence base for avoided-loss and missed-opportunity review.",
        evidenceLabel: `${memory.patientDecisionCount} patient entries`,
        title: "Best historical decision pattern",
        tone: "positive",
      });
    }
    if (memory.outcomePendingCount > 0) {
      items.push({
        detail: "Some entries are still pending outcome updates. Do not over-weight them until follow-through is known.",
        evidenceLabel: `${memory.outcomePendingCount} pending`,
        title: "Outcome tracking pending",
        tone: "info",
      });
    }
  }
  if (profile) {
    items.push({
      detail: `${profile.label} framing changes ranking emphasis, not the underlying scanner decision. Risk language remains visible.`,
      evidenceLabel: `${Math.round(profile.personalityConfidence)}/100 profile confidence`,
      title: "Profile fit context",
      tone: "info",
    });
  }
  return items.slice(0, 6);
}

function watchlistRevisitItems(workflowEvolution: WorkflowEvolutionSummary | null, watchlistSymbols: string[]): WatchlistRevisitInsight[] {
  const watchlist = new Set(watchlistSymbols);
  const workflowItems = workflowEvolution?.watchlistEvolution ?? [];
  const triggerItems = workflowEvolution?.triggerMonitors.filter((item) => watchlist.has(item.symbol)) ?? [];
  const changes: WatchlistRevisitInsight[] = [
    ...workflowItems.map((item): WatchlistRevisitInsight => ({
      detail: item.detail,
      priority: item.severity === "warning" ? "high" : item.severity === "positive" ? "medium" : "low",
      state: item.title,
      symbol: item.symbol,
      title: item.changeType === "fragility_rising" ? "Watchlist risk rising" : "Watchlist setup changed",
    })),
    ...triggerItems.map((item): WatchlistRevisitInsight => ({
      detail: item.reason,
      priority: item.priority,
      state: item.condition,
      symbol: item.symbol,
      title: "Setup trigger approaching",
    })),
  ];
  const deduped = new Map<string, WatchlistRevisitInsight>();
  for (const item of changes) {
    const key = `${item.symbol}:${item.title}:${item.state}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }
  if (deduped.size > 0) return [...deduped.values()].sort(compareWatchlist).slice(0, 5);
  return watchlistSymbols.slice(0, 4).map((symbol): WatchlistRevisitInsight => ({
    detail: "No material revisit trigger is available yet. TradeVeto will compare future visits against the current workflow baseline.",
    priority: "low",
    state: "Baseline",
    symbol,
    title: "Watchlist baseline forming",
  }));
}

function dailyBriefingFor(input: {
  insights: UserMemoryInsight[];
  memory: DecisionMemorySummary | null;
  profile: UserPersonalizationProfile | null;
  settings: UserMemorySettings;
  watchlistRevisit: WatchlistRevisitInsight[];
  workflowEvolution: WorkflowEvolutionSummary | null;
}): PersonalizedDailyBriefing {
  if (!input.settings.behavioralLearningEnabled && !input.settings.journalCoachingEnabled) {
    return {
      bullets: ["Memory personalization is paused. Scanner and market intelligence continue without behavioral context."],
      dataState: "disabled",
      headline: "Personalized briefing is paused",
      privacyNote: "You can re-enable learning from Account settings. Existing saved entries remain private to your account.",
    };
  }
  const profileLabel = input.profile?.label ?? "Default";
  const bullets = [
    input.workflowEvolution?.dailyBrief[0],
    input.watchlistRevisit[0] ? `${input.watchlistRevisit[0].symbol}: ${input.watchlistRevisit[0].state}.` : null,
    input.insights[0] ? input.insights[0].detail : null,
    input.memory?.outcomePendingCount ? `${input.memory.outcomePendingCount} journaled outcome${input.memory.outcomePendingCount === 1 ? "" : "s"} still need follow-through evidence.` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);
  return {
    bullets: bullets.length ? bullets : ["No personalized memory signal is strong enough to summarize yet."],
    dataState: input.memory?.available || input.watchlistRevisit.length ? "active" : "building",
    headline: `${profileLabel} daily memory briefing`,
    privacyNote: "This briefing uses account-scoped journal, watchlist, profile, and workflow memory only. It is research context, not financial advice.",
  };
}

function privacySummaryFor(settings: UserMemorySettings): string[] {
  return [
    "Decision journal notes are private to the signed-in account.",
    settings.behavioralLearningEnabled ? "Behavioral learning can use recent product interactions for personalization." : "Behavioral learning is disabled; interactions are not used for personalization.",
    settings.journalCoachingEnabled ? "Journal coaching can summarize repeated strengths and caution patterns." : "Journal coaching is disabled; stored entries remain reviewable.",
    "Memory export and deletion are available from Account settings.",
  ];
}

function compareWatchlist(left: WatchlistRevisitInsight, right: WatchlistRevisitInsight): number {
  return priorityRank(right.priority) - priorityRank(left.priority) || left.symbol.localeCompare(right.symbol);
}

function priorityRank(value: WatchlistRevisitInsight["priority"]): number {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function cleanSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}
