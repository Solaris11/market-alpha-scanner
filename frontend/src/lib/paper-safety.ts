export type PaperAccessScope =
  | { canReadServerData: false; userId: null }
  | { canReadServerData: true; userId: string };

export type PaperErrorKind = "account" | "analytics" | "trade";

export const PAPER_ACCOUNT_UNAVAILABLE = "paper_account_unavailable";
export const PAPER_ANALYTICS_UNAVAILABLE = "paper_analytics_unavailable";
export const PAPER_TRADE_UNAVAILABLE = "paper_trade_unavailable";

const UNSAFE_ERROR_PATTERNS = [
  /\bcolumn\b/i,
  /\brelation\b/i,
  /\bdatabase_url\b/i,
  /\bpassword\b/i,
  /\bstack\b/i,
  /\btrace\b/i,
  /\bcreated_at\b/i,
  /\bsql\b/i,
];

export function paperAccessScope(userId: string | null | undefined): PaperAccessScope {
  const cleaned = String(userId ?? "").trim();
  return cleaned ? { canReadServerData: true, userId: cleaned } : { canReadServerData: false, userId: null };
}

export function safePaperErrorCode(kind: PaperErrorKind): string {
  if (kind === "analytics") return PAPER_ANALYTICS_UNAVAILABLE;
  if (kind === "trade") return PAPER_TRADE_UNAVAILABLE;
  return PAPER_ACCOUNT_UNAVAILABLE;
}

export function containsUnsafePaperErrorText(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return UNSAFE_ERROR_PATTERNS.some((pattern) => pattern.test(value));
  if (typeof value === "number" || typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.some(containsUnsafePaperErrorText);
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, entry]) => containsUnsafePaperErrorText(key) || containsUnsafePaperErrorText(entry));
  }
  return false;
}
