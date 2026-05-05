export type ResearchCandle = {
  close: number;
  high: number;
  low: number;
  open: number;
  time: string;
};

export type ResearchTradeLevels = {
  entry: number | null;
  entryHigh: number | null;
  entryLow: number | null;
  stop: number | null;
  target: number | null;
};

export type ResearchContextLevel = {
  color: string;
  label: "Support" | "Resistance" | "Entry zone" | "Stop" | "Target";
  lineKind: "dashed" | "solid";
  price: number;
  priority: number;
};

export function buildResearchContextLevels(candles: ResearchCandle[], tradeLevels?: ResearchTradeLevels, maxLevels = 7): ResearchContextLevel[] {
  const normalized = normalizeCandles(candles);
  const candidates: ResearchContextLevel[] = [];
  const recent = normalized.slice(-12);
  const last20 = normalized.slice(-20);
  const last50 = normalized.slice(-50);

  addHighLowLevels(candidates, recent, 1);
  addHighLowLevels(candidates, last20, 2);
  addHighLowLevels(candidates, last50, 3);

  if (tradeLevels) {
    const entry = tradeLevels.entry ?? middleLevel(tradeLevels.entryLow, tradeLevels.entryHigh);
    if (entry !== null) candidates.push({ color: "#f59e0b", label: "Entry zone", lineKind: "dashed", price: entry, priority: 0 });
    if (tradeLevels.stop !== null) candidates.push({ color: "#ef4444", label: "Stop", lineKind: "solid", price: tradeLevels.stop, priority: 0 });
    if (tradeLevels.target !== null) candidates.push({ color: "#38bdf8", label: "Target", lineKind: "solid", price: tradeLevels.target, priority: 0 });
  }

  const selected: ResearchContextLevel[] = [];
  for (const level of candidates
    .filter((candidate) => Number.isFinite(candidate.price) && candidate.price > 0)
    .sort((left, right) => left.priority - right.priority || labelPriority(left.label) - labelPriority(right.label))) {
    if (selected.some((existing) => levelsAreClose(existing.price, level.price))) continue;
    selected.push(level);
    if (selected.length >= maxLevels) break;
  }
  return selected;
}

function normalizeCandles(candles: ResearchCandle[]): ResearchCandle[] {
  return candles
    .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    .filter((candle) => candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close))
    .sort((left, right) => left.time.localeCompare(right.time));
}

function addHighLowLevels(levels: ResearchContextLevel[], candles: ResearchCandle[], priority: number): void {
  if (candles.length < 3) return;
  const high = Math.max(...candles.map((candle) => candle.high));
  const low = Math.min(...candles.map((candle) => candle.low));
  levels.push({ color: "#a78bfa", label: "Resistance", lineKind: "dashed", price: high, priority });
  levels.push({ color: "#34d399", label: "Support", lineKind: "dashed", price: low, priority });
}

function middleLevel(low: number | null, high: number | null): number | null {
  if (low === null && high === null) return null;
  if (low === null) return high;
  if (high === null) return low;
  return (low + high) / 2;
}

function levelsAreClose(left: number, right: number): boolean {
  const base = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) / base < 0.0035;
}

function labelPriority(label: ResearchContextLevel["label"]): number {
  if (label === "Entry zone") return 0;
  if (label === "Stop") return 1;
  if (label === "Target") return 2;
  if (label === "Support") return 3;
  return 4;
}
