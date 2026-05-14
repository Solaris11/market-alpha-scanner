import { normalizeWatchlistSymbol } from "@/lib/watchlist-storage";

export const WORKSPACE_MODULES = [
  "what_matters_now",
  "watchlist",
  "dangerous",
  "shock_watch",
  "best_setups",
  "replay",
  "macro",
  "copilot",
  "alerts",
] as const;

export type WorkspaceModuleId = (typeof WORKSPACE_MODULES)[number];

export const WORKSPACE_TIMEFRAMES = ["1D", "1W", "1M", "6M", "1Y", "5Y"] as const;
export type WorkspaceTimeframe = (typeof WORKSPACE_TIMEFRAMES)[number];

export const WORKSPACE_RISK_STYLES = ["conservative", "balanced", "aggressive"] as const;
export type WorkspaceRiskStyle = (typeof WORKSPACE_RISK_STYLES)[number];

export const WORKSPACE_MODES = ["balanced", "watchlist_first", "macro_first", "swing_trader", "investor"] as const;
export type WorkspaceMode = (typeof WORKSPACE_MODES)[number];

export const WORKSPACE_FAVORITE_ACTIONS = [
  "open_terminal",
  "review_opportunities",
  "open_watchlist",
  "open_alerts",
  "open_replay",
  "open_macro",
  "ask_copilot",
] as const;
export type WorkspaceFavoriteAction = (typeof WORKSPACE_FAVORITE_ACTIONS)[number];

export type WorkspacePreferences = {
  favoriteActions: WorkspaceFavoriteAction[];
  favoriteModules: WorkspaceModuleId[];
  favoriteSymbols: string[];
  hiddenModules: WorkspaceModuleId[];
  macroFirstMode: boolean;
  mobileLastViewedSymbol: string | null;
  mobilePreferredOverview: WorkspaceModuleId;
  moduleOrder: WorkspaceModuleId[];
  pinnedMobileCards: WorkspaceModuleId[];
  preferredRiskStyle: WorkspaceRiskStyle;
  preferredTimeframes: WorkspaceTimeframe[];
  updatedAt: string | null;
  watchlistFirstMode: boolean;
  workspaceMode: WorkspaceMode;
};

export const WORKSPACE_MODULE_LABELS: Record<WorkspaceModuleId, string> = {
  alerts: "Alerts",
  best_setups: "Best Setups",
  copilot: "Copilot",
  dangerous: "Dangerous",
  macro: "Macro",
  replay: "Replay",
  shock_watch: "Shock Watch",
  watchlist: "Watchlist",
  what_matters_now: "What Matters Now",
};

export const WORKSPACE_MODE_LABELS: Record<WorkspaceMode, string> = {
  balanced: "Balanced",
  investor: "Investor",
  macro_first: "Macro-first",
  swing_trader: "Swing trader",
  watchlist_first: "Watchlist-first",
};

export const DEFAULT_WORKSPACE_MODULE_ORDER: WorkspaceModuleId[] = [
  "what_matters_now",
  "watchlist",
  "best_setups",
  "dangerous",
  "shock_watch",
  "macro",
  "replay",
  "alerts",
  "copilot",
];

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  favoriteActions: ["open_terminal", "review_opportunities", "open_watchlist"],
  favoriteModules: ["what_matters_now", "watchlist", "best_setups"],
  favoriteSymbols: [],
  hiddenModules: [],
  macroFirstMode: false,
  mobileLastViewedSymbol: null,
  mobilePreferredOverview: "what_matters_now",
  moduleOrder: DEFAULT_WORKSPACE_MODULE_ORDER,
  pinnedMobileCards: ["what_matters_now", "watchlist", "best_setups"],
  preferredRiskStyle: "balanced",
  preferredTimeframes: ["1M", "6M"],
  updatedAt: null,
  watchlistFirstMode: false,
  workspaceMode: "balanced",
};

const MODULE_SET = new Set<WorkspaceModuleId>(WORKSPACE_MODULES);
const TIMEFRAME_SET = new Set<WorkspaceTimeframe>(WORKSPACE_TIMEFRAMES);
const RISK_STYLE_SET = new Set<WorkspaceRiskStyle>(WORKSPACE_RISK_STYLES);
const WORKSPACE_MODE_SET = new Set<WorkspaceMode>(WORKSPACE_MODES);
const FAVORITE_ACTION_SET = new Set<WorkspaceFavoriteAction>(WORKSPACE_FAVORITE_ACTIONS);

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences {
  const source = objectValue(value);
  const workspaceMode = workspaceModeValue(source.workspaceMode ?? source.workspace_mode, DEFAULT_WORKSPACE_PREFERENCES.workspaceMode);
  const modeDefaults = defaultsForMode(workspaceMode);
  const moduleOrder = normalizeModules(source.moduleOrder ?? source.module_order, modeDefaults.moduleOrder, WORKSPACE_MODULES.length);
  const hiddenModules = normalizeModules(source.hiddenModules ?? source.hidden_modules, DEFAULT_WORKSPACE_PREFERENCES.hiddenModules, WORKSPACE_MODULES.length);
  const favoriteModules = normalizeModules(source.favoriteModules ?? source.favorite_modules, modeDefaults.favoriteModules, 5);
  const pinnedMobileCards = normalizeModules(source.pinnedMobileCards ?? source.pinned_mobile_cards, modeDefaults.pinnedMobileCards, 6);
  const mobilePreferredOverview = moduleValue(source.mobilePreferredOverview ?? source.mobile_preferred_overview, modeDefaults.mobilePreferredOverview) ?? modeDefaults.mobilePreferredOverview;

  return {
    favoriteActions: normalizeFavoriteActions(source.favoriteActions ?? source.favorite_actions, DEFAULT_WORKSPACE_PREFERENCES.favoriteActions),
    favoriteModules,
    favoriteSymbols: normalizeSymbols(source.favoriteSymbols ?? source.favorite_symbols, 16),
    hiddenModules,
    macroFirstMode: booleanValue(source.macroFirstMode ?? source.macro_first_mode, workspaceMode === "macro_first"),
    mobileLastViewedSymbol: nullableSymbol(source.mobileLastViewedSymbol ?? source.mobile_last_viewed_symbol),
    mobilePreferredOverview,
    moduleOrder,
    pinnedMobileCards,
    preferredRiskStyle: riskStyleValue(source.preferredRiskStyle ?? source.preferred_risk_style, DEFAULT_WORKSPACE_PREFERENCES.preferredRiskStyle),
    preferredTimeframes: normalizeTimeframes(source.preferredTimeframes ?? source.preferred_timeframes, DEFAULT_WORKSPACE_PREFERENCES.preferredTimeframes),
    updatedAt: stringOrNull(source.updatedAt ?? source.updated_at ?? source.preferencesUpdatedAt ?? source.preferences_updated_at),
    watchlistFirstMode: booleanValue(source.watchlistFirstMode ?? source.watchlist_first_mode, workspaceMode === "watchlist_first"),
    workspaceMode,
  };
}

export function applyWorkspaceMode(preferences: WorkspacePreferences, workspaceMode: WorkspaceMode): WorkspacePreferences {
  const modeDefaults = defaultsForMode(workspaceMode);
  return normalizeWorkspacePreferences({
    ...preferences,
    favoriteModules: modeDefaults.favoriteModules,
    macroFirstMode: workspaceMode === "macro_first",
    mobilePreferredOverview: modeDefaults.mobilePreferredOverview,
    moduleOrder: modeDefaults.moduleOrder,
    pinnedMobileCards: modeDefaults.pinnedMobileCards,
    watchlistFirstMode: workspaceMode === "watchlist_first",
    workspaceMode,
  });
}

export function moduleLabel(moduleId: WorkspaceModuleId): string {
  return WORKSPACE_MODULE_LABELS[moduleId];
}

function defaultsForMode(workspaceMode: WorkspaceMode): Pick<WorkspacePreferences, "favoriteModules" | "mobilePreferredOverview" | "moduleOrder" | "pinnedMobileCards"> {
  if (workspaceMode === "watchlist_first") {
    return {
      favoriteModules: ["watchlist", "alerts", "what_matters_now"],
      mobilePreferredOverview: "watchlist",
      moduleOrder: ["watchlist", "alerts", "what_matters_now", "dangerous", "best_setups", "shock_watch", "replay", "macro", "copilot"],
      pinnedMobileCards: ["watchlist", "alerts", "what_matters_now", "dangerous"],
    };
  }
  if (workspaceMode === "macro_first") {
    return {
      favoriteModules: ["macro", "what_matters_now", "dangerous"],
      mobilePreferredOverview: "macro",
      moduleOrder: ["macro", "what_matters_now", "dangerous", "shock_watch", "watchlist", "best_setups", "replay", "alerts", "copilot"],
      pinnedMobileCards: ["macro", "what_matters_now", "dangerous", "shock_watch"],
    };
  }
  if (workspaceMode === "swing_trader") {
    return {
      favoriteModules: ["best_setups", "shock_watch", "replay"],
      mobilePreferredOverview: "best_setups",
      moduleOrder: ["best_setups", "shock_watch", "dangerous", "replay", "what_matters_now", "watchlist", "macro", "alerts", "copilot"],
      pinnedMobileCards: ["best_setups", "shock_watch", "dangerous", "replay"],
    };
  }
  if (workspaceMode === "investor") {
    return {
      favoriteModules: ["macro", "watchlist", "replay"],
      mobilePreferredOverview: "macro",
      moduleOrder: ["macro", "watchlist", "what_matters_now", "replay", "dangerous", "best_setups", "shock_watch", "alerts", "copilot"],
      pinnedMobileCards: ["macro", "watchlist", "replay", "what_matters_now"],
    };
  }
  return {
    favoriteModules: DEFAULT_WORKSPACE_PREFERENCES.favoriteModules,
    mobilePreferredOverview: DEFAULT_WORKSPACE_PREFERENCES.mobilePreferredOverview,
    moduleOrder: DEFAULT_WORKSPACE_MODULE_ORDER,
    pinnedMobileCards: DEFAULT_WORKSPACE_PREFERENCES.pinnedMobileCards,
  };
}

function normalizeModules(value: unknown, fallback: readonly WorkspaceModuleId[], limit: number): WorkspaceModuleId[] {
  const raw = Array.isArray(value) ? value : fallback;
  const modules: WorkspaceModuleId[] = [];
  for (const item of raw) {
    const moduleId = moduleValue(item, null);
    if (moduleId && !modules.includes(moduleId)) modules.push(moduleId);
    if (modules.length >= limit) break;
  }
  if (!modules.length) return [...fallback].slice(0, limit);
  return modules;
}

function normalizeFavoriteActions(value: unknown, fallback: readonly WorkspaceFavoriteAction[]): WorkspaceFavoriteAction[] {
  const raw = Array.isArray(value) ? value : fallback;
  const actions: WorkspaceFavoriteAction[] = [];
  for (const item of raw) {
    const action = typeof item === "string" && FAVORITE_ACTION_SET.has(item as WorkspaceFavoriteAction) ? item as WorkspaceFavoriteAction : null;
    if (action && !actions.includes(action)) actions.push(action);
    if (actions.length >= 6) break;
  }
  return actions.length ? actions : [...fallback];
}

function normalizeTimeframes(value: unknown, fallback: readonly WorkspaceTimeframe[]): WorkspaceTimeframe[] {
  const raw = Array.isArray(value) ? value : fallback;
  const timeframes: WorkspaceTimeframe[] = [];
  for (const item of raw) {
    const timeframe = typeof item === "string" && TIMEFRAME_SET.has(item as WorkspaceTimeframe) ? item as WorkspaceTimeframe : null;
    if (timeframe && !timeframes.includes(timeframe)) timeframes.push(timeframe);
    if (timeframes.length >= 4) break;
  }
  return timeframes.length ? timeframes : [...fallback];
}

function normalizeSymbols(value: unknown, limit: number): string[] {
  const raw = Array.isArray(value) ? value : [];
  const symbols: string[] = [];
  for (const item of raw) {
    const symbol = normalizeWatchlistSymbol(String(item ?? ""));
    if (symbol && !symbols.includes(symbol)) symbols.push(symbol);
    if (symbols.length >= limit) break;
  }
  return symbols;
}

function nullableSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = normalizeWatchlistSymbol(value);
  return symbol || null;
}

function moduleValue(value: unknown, fallback: WorkspaceModuleId | null): WorkspaceModuleId | null {
  if (typeof value !== "string") return fallback;
  return MODULE_SET.has(value as WorkspaceModuleId) ? value as WorkspaceModuleId : fallback;
}

function riskStyleValue(value: unknown, fallback: WorkspaceRiskStyle): WorkspaceRiskStyle {
  if (typeof value !== "string") return fallback;
  return RISK_STYLE_SET.has(value as WorkspaceRiskStyle) ? value as WorkspaceRiskStyle : fallback;
}

function workspaceModeValue(value: unknown, fallback: WorkspaceMode): WorkspaceMode {
  if (typeof value !== "string") return fallback;
  return WORKSPACE_MODE_SET.has(value as WorkspaceMode) ? value as WorkspaceMode : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
