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
  AVG_MAX_DRAWDOWN: "Average Drawdown",
  AVG_RETURN: "Average Return",
  CONFIDENCE_SCORE: "Confidence Score",
  EDGE: "Historical Advantage",
  EDGE_SCORE: "Historical Advantage Score",
  EXPECTANCY: "Expected Historical Return",
  FX_PROXY: "FX Proxy",
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
  SCORE_BUCKET: "Score Range",
  SAMPLE_SIZE: "Historical Evidence",
  SUGGESTED_ACTION: "Suggested Interpretation",
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

export function readableText(value: unknown, fallback = "N/A"): string {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return fallback;
  return text.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, (match) => humanizeLabel(match, match));
}

export function humanizeQuantText(value: unknown, fallback = "N/A"): string {
  const raw = readableText(value, fallback);
  return raw
    .replace(/\bscore_bucket\b/g, "Score Range")
    .replace(/\bscore bucket(s)?\b/gi, "score range$1")
    .replace(/\bbucket(s)?\b/gi, "range$1")
    .replace(/\bedge\b/gi, "historical advantage")
    .replace(/\bunderperforms?\b/gi, "is weaker than expected")
    .replace(/\boutperforms?\b/gi, "is stronger than expected")
    .replace(/\blow sample size\b/gi, "early/low evidence")
    .replace(/\blow sample\b/gi, "early/low evidence")
    .replace(/\bsample size\b/gi, "amount of historical evidence")
    .replace(/\bexpectancy\b/gi, "expected historical return")
    .replace(/\bACTIONABLE\b/g, "Watch");
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
