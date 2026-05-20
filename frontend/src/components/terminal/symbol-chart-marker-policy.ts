import type { ChartSignalMarkerType } from "./SymbolChart";

export type ChartMarkerVisualPolicy = {
  color: string;
  fallbackText: string;
  position: "aboveBar" | "belowBar";
  shape: "arrowDown" | "arrowUp" | "circle" | "square";
};

export function markerVisualPolicy(type: ChartSignalMarkerType): ChartMarkerVisualPolicy {
  if (type === "ALERT") return { color: "#facc15", fallbackText: "ALERT", position: "aboveBar", shape: "circle" };
  if (type === "BREAKOUT") return { color: "#22c55e", fallbackText: "BREAKOUT", position: "belowBar", shape: "arrowUp" };
  if (type === "CONFIDENCE") return { color: "#22d3ee", fallbackText: "SCORE", position: "belowBar", shape: "circle" };
  if (type === "CONTRADICTION") return { color: "#fb923c", fallbackText: "CONFLICT", position: "aboveBar", shape: "circle" };
  if (type === "ENTER") return { color: "#22c55e", fallbackText: "ENTER", position: "belowBar", shape: "arrowUp" };
  if (type === "EVENT") return { color: "#f43f5e", fallbackText: "EVENT", position: "aboveBar", shape: "square" };
  if (type === "EXIT") return { color: "#ef4444", fallbackText: "EXIT", position: "aboveBar", shape: "arrowDown" };
  if (type === "FAILURE") return { color: "#ef4444", fallbackText: "FAILURE", position: "aboveBar", shape: "arrowDown" };
  if (type === "FRESHNESS") return { color: "#67e8f9", fallbackText: "FRESH", position: "belowBar", shape: "square" };
  if (type === "MACRO") return { color: "#a78bfa", fallbackText: "MACRO", position: "aboveBar", shape: "square" };
  if (type === "MEMORY") return { color: "#34d399", fallbackText: "MEMORY", position: "belowBar", shape: "square" };
  if (type === "REPLAY") return { color: "#c084fc", fallbackText: "REPLAY", position: "belowBar", shape: "square" };
  if (type === "RISK") return { color: "#fb7185", fallbackText: "RISK", position: "aboveBar", shape: "circle" };
  if (type === "SHOCK") return { color: "#fb7185", fallbackText: "SHOCK", position: "aboveBar", shape: "square" };
  if (type === "STALE") return { color: "#fbbf24", fallbackText: "STALE", position: "aboveBar", shape: "circle" };
  if (type === "STOP") return { color: "#dc2626", fallbackText: "STOP", position: "aboveBar", shape: "arrowDown" };
  if (type === "TARGET") return { color: "#38bdf8", fallbackText: "TARGET", position: "aboveBar", shape: "arrowDown" };
  if (type === "VOLATILITY") return { color: "#f97316", fallbackText: "VOL", position: "aboveBar", shape: "circle" };
  return { color: "#f59e0b", fallbackText: "WAIT", position: "belowBar", shape: "circle" };
}
