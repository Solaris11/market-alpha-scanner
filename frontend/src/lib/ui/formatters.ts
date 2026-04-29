export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoney(value: unknown, digits = 2) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

export function formatNumber(value: unknown, digits = 2) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return parsed.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatPercent(value: unknown, digits = 1) {
  const parsed = finiteNumber(value);
  if (parsed === null) return "N/A";
  return `${(parsed * 100).toFixed(digits)}%`;
}

export function cleanText(value: unknown, fallback = "N/A") {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return fallback;
  return text;
}

export function firstNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  if (numeric !== null) return numeric;
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  return finiteNumber(match[0]);
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
