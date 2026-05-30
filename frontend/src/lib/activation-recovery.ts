export type ActivationActionKey =
  | "alert"
  | "chartSave"
  | "compare"
  | "history"
  | "morningBriefing"
  | "replay"
  | "scanner"
  | "symbolInvestigation"
  | "watchlist";

export type ActivationActionState = Partial<Record<ActivationActionKey, boolean>>;

export type ActivationPrompt = {
  action: ActivationActionKey;
  detail: string;
  href: string;
  label: string;
  priority: number;
  telemetryAction: string;
  tone: "amber" | "cyan" | "emerald" | "rose" | "violet";
};

export type ActivationScoreModel = {
  completedActions: ActivationActionKey[];
  level: "activated" | "at_risk" | "partial";
  missingActions: ActivationActionKey[];
  prompts: ActivationPrompt[];
  score: number;
  summary: string;
};

type ActivationDefinition = {
  key: ActivationActionKey;
  prompt: ActivationPrompt;
  weight: number;
};

const ACTION_DEFINITIONS: ActivationDefinition[] = [
  {
    key: "scanner",
    weight: 16,
    prompt: {
      action: "scanner",
      detail: "Open the scanner and inspect one row so the next session has an opportunity trail.",
      href: "/scanner?activation=first-scanner",
      label: "Run your first scanner",
      priority: 2,
      telemetryAction: "prompt_first_scanner",
      tone: "cyan",
    },
  },
  {
    key: "watchlist",
    weight: 16,
    prompt: {
      action: "watchlist",
      detail: "Save one symbol now. Tomorrow's workflow can then show what changed instead of starting cold.",
      href: "/symbol/AMD?activation=watchlist",
      label: "Track your first symbol",
      priority: 1,
      telemetryAction: "prompt_first_watchlist",
      tone: "amber",
    },
  },
  {
    key: "symbolInvestigation",
    weight: 14,
    prompt: {
      action: "symbolInvestigation",
      detail: "Open one symbol intelligence card or page and review price, risk, and evidence context.",
      href: "/symbol/AMD?activation=symbol",
      label: "Investigate one symbol",
      priority: 3,
      telemetryAction: "prompt_first_symbol",
      tone: "violet",
    },
  },
  {
    key: "alert",
    weight: 13,
    prompt: {
      action: "alert",
      detail: "Create one alert so TradeVeto has a reason to bring you back when something changes.",
      href: "/alerts?symbol=AMD&activation=first-alert",
      label: "Create your first alert",
      priority: 4,
      telemetryAction: "prompt_first_alert",
      tone: "rose",
    },
  },
  {
    key: "chartSave",
    weight: 12,
    prompt: {
      action: "chartSave",
      detail: "Save a chart setup so your next visit restores the same decision context.",
      href: "/symbol/AMD?activation=chart-save",
      label: "Save this chart setup",
      priority: 5,
      telemetryAction: "prompt_first_chart_save",
      tone: "emerald",
    },
  },
  {
    key: "morningBriefing",
    weight: 11,
    prompt: {
      action: "morningBriefing",
      detail: "Complete the morning briefing to establish a repeatable daily open.",
      href: "/terminal?activation=morning-briefing#daily-driver-retention",
      label: "Complete your morning briefing",
      priority: 6,
      telemetryAction: "prompt_morning_briefing",
      tone: "cyan",
    },
  },
  {
    key: "compare",
    weight: 7,
    prompt: {
      action: "compare",
      detail: "Compare two symbols from scanner context to build workflow memory.",
      href: "/scanner?activation=compare&tab=compare",
      label: "Compare two symbols",
      priority: 7,
      telemetryAction: "prompt_first_compare",
      tone: "violet",
    },
  },
  {
    key: "history",
    weight: 6,
    prompt: {
      action: "history",
      detail: "Open history to connect today's setup with prior signal behavior.",
      href: "/history?symbol=AMD&activation=history",
      label: "Review symbol history",
      priority: 8,
      telemetryAction: "prompt_first_history",
      tone: "amber",
    },
  },
  {
    key: "replay",
    weight: 5,
    prompt: {
      action: "replay",
      detail: "Use replay or market memory to see how similar setups behaved before.",
      href: "/market-memory?activation=replay",
      label: "Open replay memory",
      priority: 9,
      telemetryAction: "prompt_first_replay",
      tone: "emerald",
    },
  },
];

export function buildActivationScoreModel(actions: ActivationActionState): ActivationScoreModel {
  const completedActions = ACTION_DEFINITIONS.filter((definition) => actions[definition.key] === true).map((definition) => definition.key);
  const missingActions = ACTION_DEFINITIONS.filter((definition) => actions[definition.key] !== true).map((definition) => definition.key);
  const rawScore = ACTION_DEFINITIONS.reduce((score, definition) => score + (actions[definition.key] === true ? definition.weight : 0), 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const level = score >= 72 ? "activated" : score >= 35 ? "partial" : "at_risk";
  const prompts = ACTION_DEFINITIONS
    .filter((definition) => actions[definition.key] !== true)
    .map((definition) => definition.prompt)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 3);
  return {
    completedActions,
    level,
    missingActions,
    prompts,
    score,
    summary: activationSummary(level, score, completedActions.length),
  };
}

export function activationActionFromFirstUsefulAction(value: unknown): ActivationActionKey | null {
  const text = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!text) return null;
  if (text.includes("watchlist") || text === "watch_add") return "watchlist";
  if (text.includes("scanner") || text.includes("shortlist") || text.includes("saved_scan")) return "scanner";
  if (text.includes("alert")) return "alert";
  if (text.includes("chart_save") || text.includes("chart_workspace_save") || text.includes("workspace_save") || text.includes("template_save")) return "chartSave";
  if (text.includes("compare")) return "compare";
  if (text.includes("replay") || text.includes("market_memory")) return "replay";
  if (text.includes("history")) return "history";
  if (text.includes("morning") || text.includes("briefing")) return "morningBriefing";
  if (text.includes("symbol") || text.includes("research_start")) return "symbolInvestigation";
  return null;
}

export function activationActionFromMilestone(value: unknown): ActivationActionKey | null {
  const text = String(value ?? "");
  if (text === "watchlist") return "watchlist";
  if (text === "scanner") return "scanner";
  if (text === "alert") return "alert";
  if (text === "compare") return "compare";
  if (text === "replay") return "replay";
  if (text === "morning_command") return "morningBriefing";
  if (text === "symbol_investigation") return "symbolInvestigation";
  return null;
}

function activationSummary(level: ActivationScoreModel["level"], score: number, completedCount: number): string {
  if (level === "activated") return `Activation score ${score}. User has ${completedCount} durable workflow anchors.`;
  if (level === "partial") return `Activation score ${score}. User has some intent but still needs a return loop.`;
  return `Activation score ${score}. User is at high abandonment risk until one useful workflow is completed.`;
}
