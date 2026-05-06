import { findSupportAnswer, SUPPORT_DISCLAIMER } from "@/lib/support/content";

export type SupportTicketCategory = "billing" | "account" | "scanner" | "alerts" | "technical" | "feedback" | "other";
export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export type SupportChatClassification = "allowed_product_support" | "blocked_financial_advice" | "blocked_personal_portfolio" | "blocked_unsafe_or_irrelevant";

const CATEGORIES = new Set<SupportTicketCategory>(["billing", "account", "scanner", "alerts", "technical", "feedback", "other"]);
const STATUSES = new Set<SupportTicketStatus>(["open", "pending", "resolved", "closed"]);
const PRIORITIES = new Set<SupportTicketPriority>(["low", "normal", "high", "urgent"]);

const BLOCKED_RESPONSE = "I can help explain how Market Alpha Scanner works, but I can't provide financial advice or personalized buy/sell recommendations.";

export function normalizeSupportCategory(value: unknown): SupportTicketCategory {
  const category = String(value ?? "").trim().toLowerCase();
  return CATEGORIES.has(category as SupportTicketCategory) ? (category as SupportTicketCategory) : "other";
}

export function normalizeSupportStatus(value: unknown): SupportTicketStatus {
  const status = String(value ?? "").trim().toLowerCase();
  return STATUSES.has(status as SupportTicketStatus) ? (status as SupportTicketStatus) : "open";
}

export function normalizeSupportPriority(value: unknown): SupportTicketPriority {
  const priority = String(value ?? "").trim().toLowerCase();
  return PRIORITIES.has(priority as SupportTicketPriority) ? (priority as SupportTicketPriority) : "normal";
}

export function cleanSupportText(value: unknown, maxLength = 4000): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function classifySupportMessage(message: unknown): SupportChatClassification {
  const text = cleanSupportText(message, 1000).toLowerCase();
  if (!text) return "blocked_unsafe_or_irrelevant";
  if (/\b(ignore|override|bypass)\b.*\b(rules|guardrails|instructions)\b.*\b(buy|sell|trade|entry|stop|target)\b/.test(text)) {
    return "blocked_financial_advice";
  }
  if (/\b(refresh failed|analysis refresh failed|scanner running|already running|stale data|outdated data|no buy signals|no active trade|no trade today)\b/.test(text)) {
    return "allowed_product_support";
  }
  if (/\b(my|our)\s+(portfolio|holdings|positions|account|shares)\b/.test(text) || /\$\s?\d+/.test(text) || /\bwhat should i do with\b/.test(text)) {
    return "blocked_personal_portfolio";
  }
  if (/\bshould\s+i\s+(buy|sell|hold|short|trade|enter|exit)\b/.test(text)) return "blocked_financial_advice";
  if (/\bwhat\s+(stock|etf|crypto|coin|asset)\s+should\s+i\s+(buy|sell|trade)\b/.test(text)) return "blocked_financial_advice";
  if (/\b(give|show|tell)\s+me\b.*\b(entry|stop|target|trade setup|setup)\b/.test(text)) return "blocked_financial_advice";
  if (/\bis\s+[a-z]{1,8}\s+(a\s+)?(good|bad)\s+(buy|sell|trade|investment)\b/.test(text)) return "blocked_financial_advice";
  if (/\b(buy|sell|hold)\s+(nvda|tsla|aapl|ibit|spy|qqq|btc|eth)\b/.test(text)) return "blocked_financial_advice";
  if (/\bwhat does\s+(buy|wait|watch|avoid)\s+mean\b/.test(text)) return "allowed_product_support";
  if (/\b(cancel|renew|billing|premium|alert|alerts|paper|terminal|scanner|support|ticket|tickets|wait|watch|avoid|feature|features|account|login|verify|stale|data|refresh|running|failed|failure|no trade|no buy|veto|vetoes|readiness|confidence|regime|calibration|history|filters|range|tooltip|onboarding|how do i use)\b/.test(text)) {
    return "allowed_product_support";
  }
  return "blocked_unsafe_or_irrelevant";
}

export function supportChatResponse(message: unknown): { classification: SupportChatClassification; message: string; ok: boolean } {
  const classification = classifySupportMessage(message);
  if (classification === "allowed_product_support") {
    return {
      classification,
      message: `${findSupportAnswer(cleanSupportText(message, 1000))}\n\n${SUPPORT_DISCLAIMER}`,
      ok: true,
    };
  }
  return {
    classification,
    message: classification === "blocked_unsafe_or_irrelevant" ? `I can help with Market Alpha Scanner product support, billing navigation, and troubleshooting.\n\n${SUPPORT_DISCLAIMER}` : BLOCKED_RESPONSE,
    ok: false,
  };
}

export function userCanAccessTicket(ticketUserId: string | null, viewerUserId: string): boolean {
  return Boolean(ticketUserId && ticketUserId === viewerUserId);
}
