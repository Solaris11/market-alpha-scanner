export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "terminal_open",
  "opportunities_open",
  "dashboard_open",
  "performance_open",
  "history_open",
  "strategy_labs_open",
  "replay_open",
  "support_open",
  "account_open",
  "symbol_open",
  "chart_interaction",
  "chart_expand",
  "chart_alert_create",
  "chart_indicator_template_apply",
  "chart_indicator_template_save",
  "chart_symbol_keyboard_navigate",
  "timeframe_change",
  "history_filter_used",
  "detail_expand",
  "modal_open",
  "modal_close",
  "modal_abandon",
  "card_click",
  "feed_item_open",
  "feed_engagement",
  "readiness_expand",
  "veto_explanation_open",
  "watch_add",
  "watchlist_add",
  "watchlist_remove",
  "watchlist_usage",
  "watchlist_retention",
  "activation_milestone",
  "return_session",
  "morning_workflow_start",
  "morning_workflow_complete",
  "scanner_return",
  "scanner_habit_loop",
  "replay_return",
  "chart_return",
  "compare_return",
  "history_return",
  "alert_return",
  "strategy_return",
  "watchlist_return",
  "personalized_intelligence_return",
  "alert_create",
  "alert_delete",
  "strategy_open",
  "strategy_usage",
  "paper_trade_open",
  "paper_trade_create",
  "paper_trade_close",
  "onboarding_step",
  "onboarding_complete",
  "onboarding_skip",
  "first_useful_action",
  "copilot_question",
  "rage_click",
  "duplicate_click",
  "nav_confusion",
  "scroll_abandon",
  "workflow_dropoff",
  "bottom_sheet_close",
  "back_navigation",
  "failed_action",
  "experiment_assigned",
  "experiment_exposed",
  "scanner_run",
  "scanner_usage",
  "analysis_run",
  "calibration_open",
  "signal_drilldown",
  "replay_usage",
  "notification_engagement",
  "notification_usefulness_feedback",
  "support_prompt_click",
  "support_message_submit",
  "support_helpful_feedback",
  "support_unhelpful_feedback",
  "beta_feedback_open",
  "beta_feedback_submit",
  "feedback_modal_open",
  "feedback_modal_submit",
  "bug_report_submit",
  "feature_vote_submit",
  "early_access_signup_start",
  "early_access_signup_complete",
  "founding_member_interest",
  "founding_checkout_start",
  "churn_risk_signal",
  "personalization_update",
  "decision_journal_save",
  "decision_memory_clear",
  "workflow_visit_recorded",
  "workflow_continuity",
  "mobile_engagement",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsMetadata = Record<string, string | number | boolean | null>;

export type SanitizedAnalyticsEvent = {
  eventName: AnalyticsEventName;
  metadata: AnalyticsMetadata;
  occurredAt: string;
  pagePath: string | null;
  sessionId: string | null;
  anonymousId: string | null;
  source: string | null;
  symbol: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
};

export type BetaFeedbackType = "bug_report" | "confusing_signal" | "feature_request" | "feature_vote" | "general" | "helpful" | "issue" | "onboarding_confusion" | "performance_issue";
export type BetaFeedbackRating = "negative" | "neutral" | "positive";

export const ANALYTICS_TIME_RANGES = ["today", "7d", "30d", "90d"] as const;
export type AnalyticsTimeRange = (typeof ANALYTICS_TIME_RANGES)[number];

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);
const SENSITIVE_KEY_PATTERN = /authorization|cookie|csrf|dsn|email|password|secret|session_token|set-cookie|smtp|stripe|token|api[_-]?key/i;
const SENSITIVE_VALUE_PATTERN = /(sk_live_|sk_test_|pk_live_|pk_test_|whsec_|xoxb-|AIza|APCA-API|Bearer\s+[A-Za-z0-9._-]+|(?:password|token|secret)=[^\s.,;!?]+)/i;
const MAX_METADATA_KEYS = 16;
const MAX_METADATA_VALUE_LENGTH = 160;
const MAX_FEEDBACK_LENGTH = 900;

export function normalizeAnalyticsEventName(value: unknown): AnalyticsEventName | null {
  const eventName = String(value ?? "").trim();
  return EVENT_NAME_SET.has(eventName) ? (eventName as AnalyticsEventName) : null;
}

export function sanitizeAnalyticsMetadata(value: unknown): AnalyticsMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata: AnalyticsMetadata = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = sanitizeMetadataKey(rawKey);
    if (!key || SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (Object.keys(metadata).length >= MAX_METADATA_KEYS) break;
    const safeValue = sanitizeMetadataValue(rawValue);
    if (safeValue !== undefined) metadata[key] = safeValue;
  }
  return metadata;
}

export function sanitizeAnalyticsPath(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text || !text.startsWith("/")) return null;
  const withoutHash = text.split("#")[0] ?? "";
  const [path, query = ""] = withoutHash.split("?", 2);
  const safePath = path.replace(/[^A-Za-z0-9/_\-.]/g, "").replace(/\/{2,}/g, "/").slice(0, 180) || "/";
  if (!query) return safePath;
  const params = new URLSearchParams(query);
  const safeParams = new URLSearchParams();
  for (const key of ["range", "symbol", "tab"]) {
    const raw = params.get(key);
    if (raw) safeParams.set(key, raw.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40));
  }
  const rendered = safeParams.toString();
  return rendered ? `${safePath}?${rendered}` : safePath;
}

export function sanitizeAnalyticsSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
  return symbol || null;
}

export function sanitizeAnalyticsSource(value: unknown): string | null {
  const source = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
  return source || null;
}

export function normalizeAnalyticsDevice(value: unknown): SanitizedAnalyticsEvent["deviceType"] {
  return value === "desktop" || value === "mobile" || value === "tablet" ? value : "unknown";
}

export function normalizeAnalyticsRange(value: unknown): AnalyticsTimeRange {
  if (value === "24h") return "today";
  return ANALYTICS_TIME_RANGES.includes(value as AnalyticsTimeRange) ? (value as AnalyticsTimeRange) : "30d";
}

export function normalizeFeedbackType(value: unknown): BetaFeedbackType {
  const text = String(value ?? "").trim();
  return text === "bug_report" || text === "confusing_signal" || text === "feature_request" || text === "feature_vote" || text === "helpful" || text === "issue" || text === "onboarding_confusion" || text === "performance_issue" ? text : "general";
}

export function normalizeFeedbackRating(value: unknown): BetaFeedbackRating {
  const text = String(value ?? "").trim();
  return text === "negative" || text === "positive" ? text : "neutral";
}

export function sanitizeFeedbackMessage(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const redacted = text
    .replace(SENSITIVE_VALUE_PATTERN, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, MAX_FEEDBACK_LENGTH);
  return redacted || null;
}

export function pageOpenEventForPath(pathname: string): AnalyticsEventName | null {
  if (pathname === "/terminal" || pathname.startsWith("/terminal/")) return "terminal_open";
  if (pathname === "/discover" || pathname.startsWith("/discover/")) return "opportunities_open";
  if (pathname === "/opportunities" || pathname.startsWith("/opportunities/")) return "opportunities_open";
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "dashboard_open";
  if (pathname === "/performance" || pathname.startsWith("/performance/")) return "performance_open";
  if (pathname === "/history" || pathname.startsWith("/history/")) return "history_open";
  if (pathname === "/strategy-labs" || pathname.startsWith("/strategy-labs/")) return "strategy_labs_open";
  if (pathname === "/paper" || pathname.startsWith("/paper/")) return "paper_trade_open";
  if (pathname === "/support" || pathname.startsWith("/support/")) return "support_open";
  if (pathname === "/account" || pathname.startsWith("/account/")) return "account_open";
  if (pathname.startsWith("/symbol/")) return "symbol_open";
  if (pathname === "/admin/calibration" || pathname.startsWith("/admin/calibration/")) return "calibration_open";
  return null;
}

export function symbolFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/symbol\/([^/?#]+)/);
  return match ? sanitizeAnalyticsSymbol(match[1]) : null;
}

function sanitizeMetadataKey(value: string): string | null {
  const key = value.trim().replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 48);
  return key || null;
}

function sanitizeMetadataValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    if (SENSITIVE_VALUE_PATTERN.test(value)) return "[redacted]";
    return value.trim().slice(0, MAX_METADATA_VALUE_LENGTH);
  }
  return undefined;
}
