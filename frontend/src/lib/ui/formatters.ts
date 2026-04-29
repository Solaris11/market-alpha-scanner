const NULLISH_STRINGS = new Set(["", "$undefined", "undefined", "nan", "n/a", "na", "none", "null"]);

export function normalizeNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "number" ? "" : String(value).trim();
  if (typeof value !== "number" && NULLISH_STRINGS.has(text.toLowerCase())) return null;
  const parsed = typeof value === "number" ? value : Number(text.replace(/[$,%]/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePercent(value: unknown, { max = 100, min = 0, scaleDecimal = true }: { max?: number; min?: number; scaleDecimal?: boolean } = {}): number | null {
  const parsed = normalizeNumeric(value);
  if (parsed === null) return null;
  const percent = scaleDecimal && Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  if (!Number.isFinite(percent) || percent < min || percent > max) return null;
  return percent;
}

export function finiteNumber(value: unknown): number | null {
  return normalizeNumeric(value);
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
