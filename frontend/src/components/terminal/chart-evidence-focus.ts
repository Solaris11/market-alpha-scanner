import type { ChartIndicatorId } from "./chart-intelligence-overlays";

// P2.1 item 5: score -> evidence -> chart. Clicking a score dimension focuses
// the chart on THAT dimension's evidence (overlays already on the chart), instead
// of opening an AI paragraph. Pure mapping so it is trivially testable and the
// chart just applies the plan.
export type EvidenceDimension = "trend" | "volume" | "structure" | "momentum";

export type EvidenceFocusPlan = {
  volume: boolean;
  evidence: boolean;
  indicators: ChartIndicatorId[];
  caption: string;
};

const PLANS: Record<EvidenceDimension, EvidenceFocusPlan> = {
  trend: {
    volume: false,
    evidence: true,
    indicators: [],
    caption: "Trend evidence — AVWAP anchors and the SuperTrend stop drawn on the chart.",
  },
  volume: {
    volume: true,
    evidence: false,
    indicators: [],
    caption: "Volume evidence — histogram and 20-bar average: is the move backed by volume?",
  },
  structure: {
    volume: false,
    evidence: true,
    indicators: [],
    caption: "Structure evidence — support, resistance, and the entry / stop / target levels.",
  },
  momentum: {
    volume: false,
    evidence: false,
    indicators: ["rsi14", "macd"],
    caption: "Momentum evidence — RSI and MACD.",
  },
};

export function evidenceFocusPlan(dimension: EvidenceDimension): EvidenceFocusPlan {
  return PLANS[dimension];
}

export const EVIDENCE_DIMENSIONS: EvidenceDimension[] = ["trend", "volume", "structure", "momentum"];

// The scanner score field each dimension reads, so the chips can show a value.
export const EVIDENCE_DIMENSION_SCORE_FIELD: Record<EvidenceDimension, string> = {
  trend: "trend_score",
  volume: "relative_volume_score",
  structure: "breakout_score",
  momentum: "momentum_score",
};

export const EVIDENCE_DIMENSION_LABEL: Record<EvidenceDimension, string> = {
  trend: "Trend",
  volume: "Volume",
  structure: "Structure",
  momentum: "Momentum",
};
