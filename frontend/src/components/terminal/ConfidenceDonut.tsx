import { clampConfidence, confidenceTone } from "@/lib/trading/confidence";

export function ConfidenceDonut({ compact = false, score }: { compact?: boolean; score: number }) {
  const value = clampConfidence(score);
  const tone = confidenceTone(value);
  const sizeClass = compact ? "size-28" : "size-44 sm:size-48";
  const innerClass = compact ? "size-[72px]" : "size-28 sm:size-32";

  return (
    <div
      className={`flex ${sizeClass} max-w-full items-center justify-center rounded-full p-[7px] transition-all duration-500 ${tone.borderClass}`}
      style={{
        background: `conic-gradient(rgb(${tone.rgb}) ${value * 3.6}deg, rgba(148,163,184,0.14) 0deg)`,
        boxShadow: tone.glow,
      }}
      title="Confidence reflects signal strength and data quality. Not a prediction."
    >
      <div
        className="flex size-full items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(${tone.rgb},0.20), rgba(15,23,42,0.92) 56%, rgba(2,6,23,0.98) 100%)`,
        }}
      >
        <div className={`flex ${innerClass} items-center justify-center rounded-full border border-white/10 bg-slate-950/70 text-center shadow-inner`}>
          <div>
            <div className="font-mono text-3xl font-black text-slate-50 sm:text-4xl">{Math.round(value)}</div>
            <div className={`mt-1 text-[9px] font-black uppercase tracking-[0.16em] ${tone.textClass}`}>{tone.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
