const DECISION_LABELS: Record<string, string> = {
  AVOID: "Risk Review",
  BUY: "Research Setup",
  ENTER: "Research Setup",
  EXIT: "Exit Review",
  STRONG_BUY: "Strong Research Setup",
  WAIT: "Wait",
  WAIT_PULLBACK: "Wait for Pullback",
  WATCH: "Watch",
};

const GENERAL_LABELS: Record<string, string> = {
  ACTIONABLE: "Worth Reviewing",
  AVG_MAX_DRAWDOWN: "Average Drawdown",
  AVG_RETURN: "Average Return",
  CONFIDENCE_SCORE: "Confidence",
  EDGE: "Historical Advantage",
  EDGE_SCORE: "Historical Advantage",
  EXPECTANCY: "Expected Historical Return",
  FX_PROXY: "FX Proxy",
  BUY: "Research Setup",
  BUY_ZONE: "Entry Zone",
  BUY_ZONE_HIT: "Entry Zone Hit",
  GOOD_ENTRY: "Good Entry",
  LOW_EDGE: "Weak Historical Advantage",
  NEAR_ENTRY: "Near Entry",
  PASS: "Pass",
  STRONG_BUY: "Strong Research Setup",
  STOP_HIT: "Stop Hit",
  STOP_LOSS_BROKEN: "Stop Context Broken",
  STOP_RISK: "Stop Risk",
  TOP: "Top Item",
  TAKE_PROFIT_HIT: "Target Context Hit",
  TP_HIT: "Target Hit",
  TP_NEAR: "Target Near",
  TRADE_READY: "Research Ready",
  SCORE_BUCKET: "Score Range",
  SAMPLE_SIZE: "Historical Evidence",
  SUGGESTED_ACTION: "What This Means",
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

export function humanizeInsightText(value: unknown, fallback = "N/A"): string {
  const raw = readableText(value, fallback);
  if (raw === fallback) return raw;
  return raw
    .replace(/\bshock[- ]pattern support visible\b/gi, "historically similar setups produced strong upside moves")
    .replace(/\bshock[- ]pattern evidence\b/gi, "large-move history")
    .replace(/\bshock[- ]pattern memory\b/gi, "large-move history")
    .replace(/\bshock memory supports elevated upside[- ]volatility context\b/gi, "large-move history points to higher upside volatility")
    .replace(/\bshock memory is not the primary support yet\b/gi, "large-move history is not a main support yet")
    .replace(/\bshock memory\b/gi, "large-move history")
    .replace(/\bcurrent shock context\b/gi, "current large-move context")
    .replace(/\bshock context\b/gi, "large-move context")
    .replace(/\bupside shock score\b/gi, "large upside move score")
    .replace(/\bdownside shock score\b/gi, "large downside move score")
    .replace(/\bupside shock\b/gi, "large upside move")
    .replace(/\bdownside shock\b/gi, "large downside move")
    .replace(/\bshock probability\b/gi, "large-move likelihood")
    .replace(/\btwo-sided volatility\b/gi, "big moves in both directions")
    .replace(/\bvolatility compression breakout\b/gi, "quiet-to-active breakout")
    .replace(/\bvolatility compression\b/gi, "quiet trading")
    .replace(/\bvolatility expansion\b/gi, "volatility picked up")
    .replace(/\bmacro alignment\b/gi, "market support")
    .replace(/\bmacro context\b/gi, "broader market context")
    .replace(/\bmacro pressure\b/gi, "market pressure")
    .replace(/\bmacro conflict\b/gi, "market conflict")
    .replace(/\bexchange context\b/gi, "market listing context")
    .replace(/\bliquidity pressure\b/gi, "thin-market pressure")
    .replace(/\bvolatility pressure\b/gi, "unstable volatility")
    .replace(/\bpost[- ]earnings continuation\b/gi, "follow-through after earnings")
    .replace(/\bcontinuation probability\b/gi, "follow-through rate")
    .replace(/\breversal probability\b/gi, "reversal rate")
    .replace(/\bchase risk\b/gi, "risk of entering late")
    .replace(/\bfalse positive\b/gi, "false alarm")
    .replace(/\bsource confidence\b/gi, "source strength")
    .replace(/\bevent decay\b/gi, "event freshness")
    .replace(/\bsource-backed\b/gi, "verified")
    .replace(/\billiquid\b/gi, "thinly traded")
    .replace(/\bthin-volume\b/gi, "thin volume")
    .replace(/\bresearch entry zone\b/gi, "research entry area")
    .replace(/\bhistorical exit zone\b/gi, "historical exit area")
    .replace(/\bdo-not-chase zone\b/gi, "too-extended area")
    .replace(/\binvalidation context\b/gi, "what would break the setup")
    .replace(/\binvalidation area\b/gi, "area that would break the setup")
    .replace(/\binvalidation conditions\b/gi, "what would break the setup")
    .replace(/\bentry quality\b/gi, "entry timing")
    .replace(/\bcurrent similarity\b/gi, "similarity to past setups")
    .replace(/\basymmetric opportunity\b/gi, "favorable upside/downside setup")
    .replace(/\basymmetric setup\b/gi, "favorable upside/downside setup")
    .replace(/\basymmetry score\b/gi, "upside/downside balance")
    .replace(/\basymmetry\b/gi, "upside/downside balance")
    .replace(/\brisk[- ]tolerant\b/gi, "higher-risk")
    .replace(/\bdeterministic structured packet\b/gi, "latest TradeVeto data")
    .replace(/\bstructured packet\b/gi, "latest TradeVeto data")
    .replace(/\bdeterministic packet\b/gi, "latest TradeVeto data")
    .replace(/\bdeterministic engine\b/gi, "scoring engine")
    .replace(/\bdeterministic engines\b/gi, "scoring engines")
    .replace(/\bdeterministic outputs\b/gi, "scored evidence")
    .replace(/\bprobabilistic strategy context\b/gi, "historical strategy context")
    .replace(/\bprobabilistic historical context\b/gi, "historical context")
    .replace(/\brisk remains probabilistic\b/gi, "risk still has uncertainty")
    .replace(/\bbounded adjustments\b/gi, "limited adjustments")
    .replace(/\bevidence maturity\b/gi, "evidence strength")
    .replace(/\bcalibration reliability\b/gi, "score reliability")
    .replace(/\bforward-return evidence\b/gi, "later outcome evidence")
    .replace(/\bforward-return observations\b/gi, "later outcome records")
    .replace(/\bmonotonicity\b/gi, "score consistency")
    .replace(/\bcalibration drift\b/gi, "score reliability is changing")
    .replace(/\bconfidence reliability\b/gi, "confidence strength")
    .replace(/\boutcome coverage\b/gi, "later outcome coverage")
    .replace(/\bregime drift\b/gi, "market state change")
    .replace(/\bmarket regime\b/gi, "market state")
    .replace(/\bsource of truth\b/gi, "primary decision source")
    .replace(/\bnot a direct trade instruction\b/gi, "not trading advice")
    .replace(/\bnot an action instruction\b/gi, "not trading advice")
    .replace(/\bnot a core buy signal\b/gi, "not a main TradeVeto signal")
    .replace(/\bsystem decision blocks new aggressive entries\b/gi, "TradeVeto is keeping this in research mode until conditions improve")
    .replace(/\bpoor risk\/reward or low edge blocks entry\b/gi, "risk/reward or edge is not strong enough yet")
    .replace(/\bno active setup is cleared by the decision system\b/gi, "conditions are not clean enough for an active research plan yet")
    .replace(/\bno high-quality setups right now\b/gi, "no high-quality setup is ready yet")
    .replace(/\bmarket is overheated\b/gi, "market is extended")
    .replace(/\bdo not chase here\b/gi, "wait for a cleaner entry instead of chasing")
    .replace(/\bdo not enter\b/gi, "keep this in research mode")
    .replace(/\bno active trade recommended\b/gi, "research mode")
    .replace(/\bbuy signal\b/gi, "trade signal")
    .replace(/\bescalating\b/gi, "acting on it")
    .replace(/\boverride core TradeVeto risk decisions\b/gi, "override TradeVeto's main risk decision")
    .replace(/\bvisible in the unified priority queue\b/gi, "worth reviewing now")
    .replace(/\s+/g, " ")
    .trim();
}

export function humanizeQuantText(value: unknown, fallback = "N/A"): string {
  const raw = humanizeInsightText(value, fallback);
  return raw
    .replace(/\b([a-z]+)On\b/g, (_match, group: string) => `${humanizeLabel(group)} on`)
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
