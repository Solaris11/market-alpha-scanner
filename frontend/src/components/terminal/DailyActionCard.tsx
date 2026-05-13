import { Activity, AlertTriangle, Eye, Gauge, Scale, ShieldCheck, TimerReset, Waves } from "lucide-react";
import type { DailyAction } from "@/lib/trading/daily-action";
import { dailyActionAllowsTrade, noTradeActionCopy } from "@/lib/trading/daily-action";
import { IconInsightRail, PosterGauge, ScoreFactorStrip } from "@/components/visual/MiniVisuals";
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
    accent: "bg-amber-300 text-amber-300",
    glow: "shadow-[0_0_90px_rgba(245,158,11,0.12)]",
    label: "text-amber-100",
    panel: "border-amber-300/22 bg-amber-400/[0.06]",
  },
};

export function DailyActionCard({
  action,
  dataStatus,
  decisionDistribution = [],
  marketState,
  whyReasons,
}: {
  action: DailyAction;
  dataStatus?: string;
  decisionDistribution?: Array<{ label: string; value: number }>;
  marketState?: string;
  whyReasons?: string[];
}) {
  const tone = TONE_STYLES[action.tone];
  const canTrade = dailyActionAllowsTrade(action);
  const noTradeCopy = canTrade ? null : noTradeActionCopy(action);
  const contextReasons = (whyReasons?.length ? whyReasons : defaultWhyReasons(canTrade)).slice(0, 3);
  const readinessScore = canTrade ? 74 : action.tone === "stay-out" ? 24 : 38;
  const posterTone = canTrade ? "poster-panel" : action.tone === "stay-out" ? "poster-panel-risk" : "poster-panel-wait";
  const decisionTotal = decisionDistribution.reduce((total, item) => total + Math.max(0, item.value), 0);
  const decisionFactors = decisionDistribution.map((item) => ({
    label: item.label,
    tone: decisionTone(item.label),
    value: decisionTotal > 0 ? (Math.max(0, item.value) / decisionTotal) * 100 : null,
  }));

  return (
    <GlassPanel className={`poster-scanline overflow-hidden border p-5 md:p-6 ${posterTone} ${tone.panel} ${tone.glow}`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
            {marketState ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Market state: {marketState}</span> : null}
            {dataStatus ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Data: {dataStatus}</span> : null}
          </div>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${tone.accent} shadow-[0_0_20px_currentColor]`} />
            <div className="text-[10px] font-black uppercase tracking-normal text-slate-400">Today&apos;s Action</div>
          </div>
          <div
            className={`poster-display-title no-bad-breaks mt-3 text-3xl leading-tight sm:text-4xl ${tone.label}`}
            style={{ WebkitBoxOrient: "vertical", WebkitLineClamp: 2, display: "-webkit-box", overflow: "hidden" }}
            title={action.label}
          >
            {action.label}
          </div>
          <p className="mt-2 max-w-3xl text-base font-semibold leading-6 text-slate-200">{action.reason}</p>
          {!canTrade && noTradeCopy ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xl font-black tracking-tight text-slate-50">{noTradeCopy.title}</div>
              <div className="mt-1 text-sm font-semibold text-amber-100">Best next step: monitor patiently</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{noTradeCopy.reason}</div>
              <div className="mt-3 text-[11px] font-semibold text-slate-500">Research only. Not financial advice.</div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <PosterGauge label={canTrade ? "readiness" : "risk review"} score={readinessScore} tone={canTrade ? "emerald" : action.tone === "stay-out" ? "rose" : "amber"} />
          <div className="grid grid-cols-2 gap-2">
            <ContextTile label="Regime" value={marketState ?? "Unknown"} />
            <ContextTile label="Freshness" value={dataStatus ?? "Unknown"} />
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Decision Mix</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(decisionDistribution.length ? decisionDistribution : [{ label: "WATCH", value: 0 }, { label: "WAIT", value: 0 }, { label: "AVOID", value: 0 }]).slice(0, 3).map((item) => (
                <div className="rounded-lg bg-slate-950/45 px-2 py-1.5" key={item.label}>
                  <div className="font-mono text-lg font-black text-slate-50">{item.value}</div>
                  <div className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{canTrade ? "Decision context" : "Why patience now?"}</div>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
              {contextReasons.map((reason) => <li key={reason}>- {reason}</li>)}
            </ul>
          </div>
        </aside>
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <IconInsightRail
          items={[
            { copy: "Regime and breadth.", icon: <Activity className="h-6 w-6" />, label: "Market State", tone: "cyan" },
            { copy: "Risk and volatility.", icon: <Waves className="h-6 w-6" />, label: "Volatility", tone: action.tone === "stay-out" ? "rose" : "amber" },
            { copy: "Reward versus risk.", icon: <Scale className="h-6 w-6" />, label: "Risk / Reward", tone: "amber" },
            { copy: "Patience rules.", icon: <ShieldCheck className="h-6 w-6" />, label: "Protect Capital", tone: canTrade ? "emerald" : "cyan" },
            { copy: "What to monitor.", icon: <Eye className="h-6 w-6" />, label: "Watch", tone: "violet" },
            { copy: "Setup timing.", icon: canTrade ? <Gauge className="h-6 w-6" /> : <TimerReset className="h-6 w-6" />, label: canTrade ? "Readiness" : "Wait", tone: canTrade ? "emerald" : "amber" },
          ]}
        />
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <AlertTriangle className={`h-4 w-4 ${canTrade ? "text-emerald-300" : "text-amber-300"}`} />
            Signal path
          </div>
          <ScoreFactorStrip
            emptyMessage="Decision distribution is hidden or empty in this view."
            factors={decisionFactors}
            label="Decision mix share"
          />
        </div>
      </div>
    </GlassPanel>
  );
}

function decisionTone(label: string): "amber" | "cyan" | "emerald" | "rose" | "violet" {
  const normalized = label.toUpperCase();
  if (normalized.includes("ENTER") || normalized.includes("BUY")) return "emerald";
  if (normalized.includes("AVOID") || normalized.includes("EXIT")) return "rose";
  if (normalized.includes("WAIT")) return "amber";
  if (normalized.includes("WATCH")) return "cyan";
  return "violet";
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function defaultWhyReasons(canTrade: boolean): string[] {
  if (canTrade) {
    return ["Risk filters are not blocking research mode.", "Use the setup panel for confirmation context.", "Research only. Not financial advice."];
  }
  return ["The market is extended, so entry quality matters more than speed.", "Breadth and risk filters are asking for better confirmation.", "TradeVeto is preserving capital until a cleaner setup appears."];
}
