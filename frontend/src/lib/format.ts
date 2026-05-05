import type { RankingRow } from "./types";
import { normalizedToken } from "./ui/labels";

export function formatNumber(value: unknown, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

export function compact(value: unknown, maxLength = 42) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function actionFor(row: RankingRow | Record<string, unknown>) {
  if (row.stale_data_safety_active === true) return "WAIT";

  const finalDecision = normalizedToken(row.final_decision);
  if (finalDecision) return finalDecision;

  const explicit = String(row.action ?? row.recommended_action ?? row.composite_action ?? row.mid_action ?? row.short_action ?? row.long_action ?? "").trim();
  if (explicit) return explicit;

  const rating = String(row.rating ?? "").toUpperCase();
  if (rating === "TOP" || rating === "ACTIONABLE") return "ACTIONABLE";
  if (rating === "WATCH") return "WATCH";
  if (rating === "PASS") return "PASS";
  return "REVIEW";
}

export function badgeTone(value: unknown) {
  const text = String(value ?? "").toUpperCase();
  if (["TOP", "BUY", "LONG", "ACTIONABLE"].some((token) => text.includes(token))) return "positive";
  if (["WATCH", "REVIEW", "HOLD"].some((token) => text.includes(token))) return "accent";
  if (["PASS", "AVOID", "SELL", "RISK"].some((token) => text.includes(token))) return "negative";
  if (!text || text === "N/A") return "muted";
  return "neutral";
}
