import type { DailyAction } from "@/lib/trading/daily-action";
import { dailyActionAllowsTrade, noTradeActionCopy } from "@/lib/trading/daily-action";
import { GlassPanel } from "./ui/GlassPanel";

const TONE_STYLES: Record<DailyAction["tone"], { accent: string; glow: string; label: string; panel: string }> = {
  buy: {
    accent: "bg-emerald-300 text-emerald-300",
    glow: "shadow-[0_0_90px_rgba(16,185,129,0.18)]",
    label: "text-emerald-200",
    panel: "border-emerald-300/25 bg-emerald-400/[0.08]",
  },
  wait: {
    accent: "bg-amber-300 text-amber-300",
    glow: "shadow-[0_0_90px_rgba(245,158,11,0.16)]",
    label: "text-amber-100",
    panel: "border-amber-300/25 bg-amber-400/[0.08]",
  },
  "stay-out": {
    accent: "bg-rose-300 text-rose-300",
    glow: "shadow-[0_0_90px_rgba(244,63,94,0.14)]",
    label: "text-rose-100",
    panel: "border-rose-300/25 bg-rose-400/[0.07]",
  },
};

export function DailyActionCard({ action, dataStatus, marketState }: { action: DailyAction; dataStatus?: string; marketState?: string }) {
  const tone = TONE_STYLES[action.tone];
  const canTrade = dailyActionAllowsTrade(action);
  const noTradeCopy = canTrade ? null : noTradeActionCopy(action);

  return (
    <GlassPanel className={`overflow-hidden border p-5 md:p-6 ${tone.panel} ${tone.glow}`}>
      <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
        {marketState ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Market state: {marketState}</span> : null}
        {dataStatus ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Data: {dataStatus}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${tone.accent} shadow-[0_0_20px_currentColor]`} />
        <div className="text-[10px] font-black uppercase tracking-normal text-slate-400">Today&apos;s Action</div>
      </div>
      <div
        className={`mt-3 break-words text-3xl font-black leading-tight tracking-normal ${tone.label}`}
        style={{ WebkitBoxOrient: "vertical", WebkitLineClamp: 2, display: "-webkit-box", overflow: "hidden" }}
        title={action.label}
      >
        {action.label}
      </div>
      <p className="mt-2 max-w-3xl truncate text-base font-semibold text-slate-200">{action.reason}</p>
      {!canTrade && noTradeCopy ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xl font-black tracking-tight text-slate-50">{noTradeCopy.title}</div>
          <div className="mt-1 text-sm font-semibold text-amber-100">Correct action: do nothing</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{noTradeCopy.reason}</div>
        </div>
      ) : null}
    </GlassPanel>
  );
}
