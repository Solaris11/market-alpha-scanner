const DECISION_LABELS: Record<string, string> = {
  AVOID: "Avoid",
  BUY: "Research Setup",
  ENTER: "Research Setup",
  EXIT: "Exit Risk",
  STRONG_BUY: "Strong Research Setup",
  WAIT: "Wait",
  WAIT_PULLBACK: "Wait Pullback",
  WATCH: "Watch",
};

const GENERAL_LABELS: Record<string, string> = {
  ACTIONABLE: "Elevated Context",
  BUY: "Research Setup",
  BUY_ZONE: "Entry Zone",
  BUY_ZONE_HIT: "Entry Zone Hit",
  GOOD_ENTRY: "Good Entry",
  LOW_EDGE: "Low Edge",
  NEAR_ENTRY: "Near Entry",
  PASS: "Pass",
  STRONG_BUY: "Strong Research Setup",
  STOP_HIT: "Stop Hit",
  STOP_LOSS_BROKEN: "Stop Context Broken",
  STOP_RISK: "Stop Risk",
  TOP: "Top Context",
  TAKE_PROFIT_HIT: "Target Context Hit",
  TP_HIT: "Target Hit",
  TP_NEAR: "Target Near",
  TRADE_READY: "Research Ready",
};

export function normalizedToken(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function humanizeLabel(value: unknown, fallback = "N/A"): string {
  const token = normalizedToken(value);
  if (!token || ["NAN", "NONE", "NULL", "UNDEFINED", "N_A", "NA"].includes(token)) return fallback;
  if (GENERAL_LABELS[token]) return GENERAL_LABELS[token];
  return token
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function decisionLabel(value: unknown, fallback = "Watch"): string {
  const token = normalizedToken(value);
  if (!token) return fallback;
  return DECISION_LABELS[token] ?? humanizeLabel(token, fallback);
}

export function supportStatusLabel(value: unknown): string {
  return humanizeLabel(value, "Unknown");
}

export function dataStatusLabel(value: unknown): string {
  return humanizeLabel(value, "Unknown");
}
