export type ConfidenceBand = "low" | "medium" | "high";

export type ConfidenceTone = {
  band: ConfidenceBand;
  barClass: string;
  borderClass: string;
  glow: string;
  label: "LOW CONFIDENCE" | "MEDIUM CONFIDENCE" | "HIGH CONFIDENCE";
  rgb: string;
  softRgb: string;
  textClass: string;
};

export function clampConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

export function confidenceTone(value: unknown): ConfidenceTone {
  const score = clampConfidence(value);
  if (score < 50) {
    return {
      band: "low",
      barClass: "bg-rose-300",
      borderClass: "border-rose-300/30",
      glow: "0 0 38px rgba(251, 113, 133, 0.22)",
      label: "LOW CONFIDENCE",
      rgb: "251, 113, 133",
      softRgb: "244, 63, 94",
      textClass: "text-rose-200",
    };
  }
  if (score < 70) {
    return {
      band: "medium",
      barClass: "bg-amber-300",
      borderClass: "border-amber-300/30",
      glow: "0 0 38px rgba(252, 211, 77, 0.20)",
      label: "MEDIUM CONFIDENCE",
      rgb: "252, 211, 77",
      softRgb: "245, 158, 11",
      textClass: "text-amber-100",
    };
  }
  return {
    band: "high",
    barClass: "bg-emerald-300",
    borderClass: "border-emerald-300/30",
    glow: "0 0 38px rgba(52, 211, 153, 0.22)",
    label: "HIGH CONFIDENCE",
    rgb: "52, 211, 153",
    softRgb: "16, 185, 129",
    textClass: "text-emerald-200",
  };
}
