import Link from "next/link";
import type {
  HistoryWorkflowMaturityModel,
  PerformanceWorkflowMaturityModel,
  SymbolTimelineItem,
  SymbolWorkflowAction,
  SymbolWorkflowMaturityModel,
} from "@/lib/trading/symbol-workflow-maturity";

export function SymbolWorkflowMaturityPanel({ model, symbol }: { model: SymbolWorkflowMaturityModel; symbol: string }) {
  return (
    <section className="terminal-panel rounded-2xl p-5" aria-labelledby="symbol-workflow-maturity-heading" data-symbol-workflow-maturity="true" data-symbol-workflow-score={model.maturityScore}>
      <Header eyebrow="Symbol workflow maturity" headingId="symbol-workflow-maturity-heading" score={model.maturityScore} title={`${symbol} continuity cockpit`} />
      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{model.summary}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <TimelineColumn items={model.whatChanged} title="What changed" />
        <TimelineColumn items={model.confidenceHistory.slice(-4)} title="Confidence history" />
        <TimelineColumn items={[...model.catalystTimeline, ...model.riskTimeline]} title="Catalyst and risk" />
        <TimelineColumn items={model.replayContinuity} title="Replay continuity" />
      </div>
      <ActionGrid actions={model.continuityActions} />
    </section>
  );
}

export function HistoryWorkflowMaturityPanel({ model }: { model: HistoryWorkflowMaturityModel }) {
  return (
    <section className="terminal-panel rounded-2xl p-5" aria-labelledby="history-workflow-maturity-heading" data-history-workflow-maturity="true" data-history-workflow-score={model.score}>
      <Header eyebrow="History workflow dominance" headingId="history-workflow-maturity-heading" score={model.score} title="Replay memory and chronology cockpit" />
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-3">
          <TimelineColumn items={model.symbolJourney} title="Symbol journey" />
          <TimelineColumn empty="No source-linked event chronology exists for this symbol yet." items={model.eventChronology} title="Event chronology" />
          <TimelineColumn empty="No macro regime changes are visible in this selected history." items={model.macroChronology} title="Macro chronology" />
        </div>
        <div className="space-y-3">
          <ClusterPanel empty="Replay clusters need more saved observations." title="Replay clusters" tone="violet" clusters={model.replayClusters} />
          <ClusterPanel empty="Historical analogs need more setup, macro, and score-band overlap." title="Historical analogs" tone="cyan" clusters={model.historicalAnalogs} />
        </div>
      </div>
      <ActionGrid actions={[...model.replayCompareActions, ...model.tradeAutopsyContinuity]} />
    </section>
  );
}

export function PerformanceWorkflowMaturityPanel({ model }: { model: PerformanceWorkflowMaturityModel }) {
  return (
    <section className="terminal-panel rounded-2xl p-5" aria-labelledby="performance-workflow-maturity-heading" data-performance-workflow-maturity="true" data-performance-workflow-score={model.score}>
      <Header eyebrow="Performance workflow dominance" headingId="performance-workflow-maturity-heading" score={model.score} title="Intelligence-performance cockpit" />
      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        {[...model.cockpitCards, model.falsePositiveAnalysis].map((card) => (
          <div className={`rounded-xl border p-3 ${card.status === "available" ? "border-cyan-300/20 bg-cyan-400/[0.06]" : "border-amber-300/20 bg-amber-400/[0.06]"}`} key={card.label}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</div>
            <div className="mt-1 font-mono text-lg font-black text-slate-50">{card.value}</div>
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{card.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TimelineColumn items={model.evidenceTimeline} title="Evidence timeline" />
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Confidence calibration</div>
          <div className="mt-3 space-y-2">
            {model.calibration.length ? model.calibration.map((bucket) => (
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5" key={bucket.label}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-100">{bucket.label}</div>
                  <div className="font-mono text-xs text-cyan-100">{bucket.count}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
                  <div>Hit {formatPct(bucket.hitRatePct)}</div>
                  <div>Avg {formatPct(bucket.averageReturnPct)}</div>
                </div>
              </div>
            )) : <div className="rounded-lg border border-dashed border-slate-700/70 p-3 text-xs text-slate-500">Calibration buckets need score and completed return rows.</div>}
          </div>
        </div>
      </div>
      <ActionGrid actions={model.watchlistPortfolioState} />
    </section>
  );
}

function Header({ eyebrow, headingId, score, title }: { eyebrow: string; headingId: string; score: number; title: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{eyebrow}</div>
        <h2 id={headingId} className="mt-1 text-lg font-semibold text-slate-50">{title}</h2>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-right">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Maturity</div>
        <div className="font-mono text-xl font-black text-cyan-100">{score}</div>
      </div>
    </div>
  );
}

function TimelineColumn({ empty = "No evidence is available yet.", items, title }: { empty?: string; items: SymbolTimelineItem[]; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div className={`rounded-lg border p-2.5 ${toneClass(item.tone)}`} key={`${title}:${item.label}:${item.timestamp}:${item.detail}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-slate-100">{item.label}</div>
              <div className="shrink-0 font-mono text-[10px] text-slate-400">{item.timestamp}</div>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-400">{item.detail}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.evidence}</p>
          </div>
        )) : <div className="rounded-lg border border-dashed border-slate-700/70 p-3 text-xs text-slate-500">{empty}</div>}
      </div>
    </div>
  );
}

function ActionGrid({ actions }: { actions: SymbolWorkflowAction[] }) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Link className={`rounded-xl border p-3 transition hover:border-cyan-300/35 hover:bg-white/[0.055] ${action.status === "available" ? "border-white/10 bg-white/[0.035]" : "border-amber-300/20 bg-amber-400/[0.055]"}`} href={action.href} key={action.label}>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{action.label}</div>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{action.detail}</p>
        </Link>
      ))}
    </div>
  );
}

function ClusterPanel({ clusters, empty, title, tone }: { clusters: HistoryWorkflowMaturityModel["replayClusters"]; empty: string; title: string; tone: "cyan" | "violet" }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${tone === "violet" ? "text-violet-200" : "text-cyan-200"}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {clusters.length ? clusters.map((cluster) => (
          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5" key={`${title}:${cluster.label}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 truncate text-sm font-semibold text-slate-100">{cluster.label}</div>
              <div className="font-mono text-xs text-cyan-100">{cluster.count}</div>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{cluster.detail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cluster.symbols.map((symbol) => <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400" key={`${title}:${cluster.label}:${symbol}`}>{symbol}</span>)}
            </div>
          </div>
        )) : <div className="rounded-lg border border-dashed border-slate-700/70 p-3 text-xs text-slate-500">{empty}</div>}
      </div>
    </div>
  );
}

function toneClass(tone: SymbolTimelineItem["tone"]): string {
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-400/[0.06]";
  if (tone === "rose") return "border-rose-300/20 bg-rose-400/[0.06]";
  if (tone === "amber") return "border-amber-300/20 bg-amber-400/[0.06]";
  if (tone === "violet") return "border-violet-300/20 bg-violet-400/[0.06]";
  return "border-cyan-300/20 bg-cyan-400/[0.06]";
}

function formatPct(value: number | null): string {
  return value === null ? "N/A" : `${value.toFixed(1)}%`;
}
