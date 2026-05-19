export const INTERACTIVE_CHART_PERIODS = ["1d", "1wk", "1mo", "3mo", "6mo", "1y", "5y"] as const;

export type InteractiveChartPeriod = (typeof INTERACTIVE_CHART_PERIODS)[number];

export type InteractivePricePoint = {
  close: number | null;
  date: string;
  datetime: string;
  high: number | null;
  low: number | null;
  open: number | null;
  volume: number | null;
};

export type InteractiveChartPacket = {
  dataSource: string;
  endDate: string | null;
  error?: string;
  lastUpdated: string | null;
  pointCount: number;
  rows: InteractivePricePoint[];
  startDate: string | null;
  symbol: string;
};

export type MarketChartHubItem = {
  chart: InteractiveChartPacket;
  interpretation: string;
  label: string;
  symbol: string;
};

export type PriceMoveSummary = {
  absoluteChange: number | null;
  changePct: number | null;
  firstClose: number | null;
  lastClose: number | null;
  tone: "down" | "flat" | "up";
};

const PERIOD_DAY_COUNTS: Record<InteractiveChartPeriod, number> = {
  "1d": 1,
  "1wk": 7,
  "1mo": 31,
  "3mo": 93,
  "6mo": 186,
  "1y": 365,
  "5y": 365 * 5 + 2,
};

export function isInteractiveChartPeriod(value: string): value is InteractiveChartPeriod {
  return INTERACTIVE_CHART_PERIODS.includes(value as InteractiveChartPeriod);
}

export function filterInteractivePricePoints(points: InteractivePricePoint[], period: InteractiveChartPeriod): InteractivePricePoint[] {
  const dated = points
    .map((point) => ({ point, time: pricePointTime(point) }))
    .filter((item): item is { point: InteractivePricePoint; time: number } => item.time !== null)
    .sort((left, right) => left.time - right.time);

  if (!dated.length) return [];
  const latestTime = dated[dated.length - 1]?.time;
  if (latestTime === undefined) return [];
  const cutoff = latestTime - PERIOD_DAY_COUNTS[period] * 24 * 60 * 60 * 1000;
  return dated.filter((item) => item.time >= cutoff).map((item) => item.point);
}

export function validClosePoints(points: InteractivePricePoint[]): Array<InteractivePricePoint & { close: number }> {
  return points.filter((point): point is InteractivePricePoint & { close: number } => typeof point.close === "number" && Number.isFinite(point.close) && point.close > 0);
}

export function summarizePriceMove(points: InteractivePricePoint[]): PriceMoveSummary {
  const valid = validClosePoints(points);
  const firstClose = valid[0]?.close ?? null;
  const lastClose = valid[valid.length - 1]?.close ?? null;
  if (firstClose === null || lastClose === null || firstClose <= 0) {
    return {
      absoluteChange: null,
      changePct: null,
      firstClose,
      lastClose,
      tone: "flat",
    };
  }

  const absoluteChange = lastClose - firstClose;
  const changePct = (absoluteChange / firstClose) * 100;
  return {
    absoluteChange,
    changePct,
    firstClose,
    lastClose,
    tone: Math.abs(changePct) < 0.25 ? "flat" : changePct > 0 ? "up" : "down",
  };
}

export function pricePointTime(point: InteractivePricePoint): number | null {
  const raw = point.datetime || point.date;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pricePointIsoDate(point: InteractivePricePoint): string {
  const parsed = pricePointTime(point);
  if (parsed === null) return point.date || point.datetime || "Unknown";
  return new Date(parsed).toISOString().slice(0, 10);
}
