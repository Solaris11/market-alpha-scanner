import type { SignalLifecycle } from "@/lib/trading/signal-lifecycle";
import { formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";

export function SignalStatusCard({ lifecycle }: { lifecycle: SignalLifecycle }) {
  const tone = statusTone(lifecycle.state);

  return (
    <GlassPanel className={`p-5 ${tone.glow}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Signal Status</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`rounded-full border px-4 py-2 text-sm font-black ${tone.badge}`}>{lifecycle.state}</span>
            <span className="text-base font-semibold text-slate-100">{lifecycle.reason}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Entry Distance</div>
          <div className="mt-1 font-mono text-lg font-bold text-slate-50">{formatPercent(lifecycle.entryDistancePct, 1)}</div>
        </div>
      </div>
    </GlassPanel>
  );
}

function statusTone(state: SignalLifecycle["state"]) {
  if (state === "ACTIVE") {
    return {
      badge: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
      glow: "shadow-[0_0_70px_rgba(16,185,129,0.12)]",
    };
  }
  if (state === "EXPIRED") {
    return {
      badge: "border-amber-300/30 bg-amber-400/10 text-amber-100",
      glow: "shadow-[0_0_70px_rgba(245,158,11,0.12)]",
    };
  }
  return {
    badge: "border-rose-300/30 bg-rose-400/10 text-rose-100",
    glow: "shadow-[0_0_70px_rgba(244,63,94,0.12)]",
  };
}
