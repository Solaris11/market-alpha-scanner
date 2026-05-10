import Link from "next/link";
import type { ReactNode } from "react";
import type {
  PublicStrategyExplanation,
  PublicStrategyPerformanceSystem,
  PublicStrategyProofMode,
  PublicStrategyReplayTrade,
} from "@/lib/trading/public-strategy-performance";
import type { SimulatedPortfolioEquityPoint } from "@/lib/trading/simulated-ai-portfolio";

export function PublicStrategyPerformanceView({ system }: { system: PublicStrategyPerformanceSystem }) {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/18 bg-slate-950/78 shadow-2xl shadow-black/30 ring-1 ring-white/5">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Public Proof Layer</div>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Simulated strategy performance, with the uncomfortable parts left in.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
                TradeVeto publishes public, replayable proof from completed simulated strategy evidence: benchmark comparison, drawdown, win/loss history, and why trades worked or failed. Research only. Not financial advice.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {system.transparencyNotes.map((note) => (
                  <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-bold text-slate-200" key={note}>
                    {note}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <HeroMetric label="Best Proof Sleeve" value={system.headline.bestModeLabel} />
              <HeroMetric label="Trust Score" value={`${system.headline.bestTrustScore}/100`} />
              <HeroMetric label="Sim Return" tone={system.headline.simulatedReturnPct} value={formatSignedPct(system.headline.simulatedReturnPct)} />
              <HeroMetric label="Vs Benchmark" tone={system.headline.benchmarkDeltaPct} value={formatSignedPct(system.headline.benchmarkDeltaPct)} />
              <HeroMetric label="Max Drawdown" tone={system.headline.maxDrawdownPct === null ? null : -system.headline.maxDrawdownPct} value={formatPct(system.headline.maxDrawdownPct)} />
              <HeroMetric label="Replay Samples" value={system.headline.replayTradeCount.toLocaleString()} />
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
            <p className="text-sm leading-7 text-slate-300">{system.summary}</p>
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-4 text-sm leading-6 text-amber-50">
              Public proof is historical simulation. It does not publish current premium opportunities or place real-money trades.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {system.modes.map((mode) => <ModeProofCard key={mode.mode} mode={mode} />)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <Panel eyebrow="Replayable Evidence" title="Trade History With Wins, Losses, And Drawdowns">
            <ReplayTradeList trades={system.replayTrades} />
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel eyebrow="Strategy Explanations" title="What The Simulation Is Testing">
            <StrategyExplanationList rows={system.strategyExplanations} />
          </Panel>
          <Panel eyebrow="Trust Boundary" title="What This Page Does Not Prove">
            <ul className="space-y-2 text-sm leading-6 text-slate-400">
              {system.limitations.map((line) => <li key={line}>- {line}</li>)}
            </ul>
          </Panel>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Public Transparency</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Use this proof layer before trusting the private scanner.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Strategy Labs inside the app adds current model sleeves and premium context. This public page only publishes historical closed simulation evidence so users can evaluate process quality first.
            </p>
          </div>
          <Link className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/12 px-5 py-3 text-sm font-black text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/20" href="/performance">
            Open Performance
          </Link>
        </div>
      </section>
    </div>
  );
}

function ModeProofCard({ mode }: { mode: PublicStrategyProofMode }) {
  const stats = [
    { label: "Return", tone: mode.simulatedReturnPct, value: formatSignedPct(mode.simulatedReturnPct) },
    { label: "Benchmark Delta", tone: mode.benchmarkDeltaPct, value: formatSignedPct(mode.benchmarkDeltaPct) },
    { label: "Drawdown", tone: mode.maxDrawdownPct === null ? null : -mode.maxDrawdownPct, value: formatPct(mode.maxDrawdownPct) },
    { label: "Win Rate", value: formatPct(mode.winRatePct) },
    { label: "Closed Trades", value: mode.closedTradeCount.toLocaleString() },
    { label: "Trust", value: `${mode.trustScore}/100` },
  ];

  return (
    <article className="min-w-0 rounded-3xl border border-white/10 bg-slate-950/68 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{mode.evidenceLabel}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{mode.label}</h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs font-black text-slate-200">
          {mode.mode}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{mode.summary}</p>
      <MiniCurve mode={mode.mode} points={mode.equityCurve} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((stat) => <SmallMetric key={stat.label} label={stat.label} tone={stat.tone} value={stat.value} />)}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{mode.riskPolicy}</p>
    </article>
  );
}

function ReplayTradeList({ trades }: { trades: PublicStrategyReplayTrade[] }) {
  if (!trades.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm leading-6 text-slate-400">
        No public replay trades are available yet. The proof layer needs completed forward-return evidence before showing examples.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <details className="group rounded-2xl border border-white/10 bg-white/[0.035] p-4 open:border-cyan-300/25 open:bg-cyan-300/[0.045]" key={trade.id}>
          <summary className="flex cursor-pointer list-none flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-black text-white">{trade.symbol}</span>
                <OutcomeBadge outcome={trade.outcomeLabel} />
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-1 text-xs font-semibold text-slate-300">{trade.modeLabel}</span>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {trade.strategyLabel} | {trade.entryDate} to {trade.exitDate} | {trade.horizonDays}D evidence window
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[410px]">
              <SmallMetric label="Return" tone={trade.realizedReturnPct} value={formatSignedPct(trade.realizedReturnPct)} />
              <SmallMetric label="PnL" tone={trade.realizedPnl} value={formatMoney(trade.realizedPnl)} />
              <SmallMetric label="Allocation" value={`${trade.allocationPct.toFixed(1)}%`} />
              <SmallMetric label="Score" value={`${trade.modeScore}/100`} />
            </div>
          </summary>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-sm leading-6 text-slate-300">{trade.whyWorkedOrFailed}</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <ReasonList title="Why entered" items={trade.whyEntered} />
              <ReasonList title="Why exited" items={trade.whyExited} />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <ContextBox label="Macro" value={trade.macroReason} />
              <ContextBox label="Event" value={trade.eventReason} />
              <ContextBox label="Risk/Reward" value={trade.riskRewardReason} />
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function StrategyExplanationList({ rows }: { rows: PublicStrategyExplanation[] }) {
  if (!rows.length) {
    return <p className="text-sm leading-6 text-slate-400">Strategy-family proof is limited until more completed evidence is available.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={row.title}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-100">{row.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{row.summary}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${toneBadge(row.tone)}`}>
              {row.evidenceLabel}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <SmallMetric label="Quality" value={`${row.qualityScore}/100`} />
            <SmallMetric label="Alpha" value={`${row.alphaScore}/100`} />
            <SmallMetric label="Sample" value={row.sampleCount.toLocaleString()} />
            <SmallMetric label="Avg Return" tone={row.averageReturnPct} value={formatSignedPct(row.averageReturnPct)} />
          </div>
        </article>
      ))}
    </div>
  );
}

function MiniCurve({ mode, points }: { mode: string; points: SimulatedPortfolioEquityPoint[] }) {
  if (points.length < 2) return null;
  const width = 320;
  const height = 86;
  const values = points.flatMap((point) => [point.value, point.benchmarkValue]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const xFor = (index: number) => (index / Math.max(1, points.length - 1)) * width;
  const yFor = (value: number) => height - ((value - min) / range) * (height - 10) - 5;
  const pathFor = (field: "benchmarkValue" | "value") => points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${yFor(point[field]).toFixed(2)}`).join(" ");
  const fillId = `public-strategy-${mode}-fill`;
  return (
    <svg aria-label={`${mode} simulated portfolio curve`} className="mt-4 h-24 w-full overflow-visible" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,211,238,0.20)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </linearGradient>
      </defs>
      <path d={`${pathFor("value")} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${fillId})`} opacity="0.8" />
      <path d={pathFor("benchmarkValue")} fill="none" stroke="rgba(148,163,184,0.58)" strokeDasharray="5 5" strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={pathFor("value")} fill="none" stroke="rgb(34,211,238)" strokeLinecap="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Panel({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="min-w-0 rounded-3xl border border-white/10 bg-slate-950/65 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 sm:p-6">
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold text-slate-50">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function HeroMetric({ label, tone, value }: { label: string; tone?: number | null; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
      <div className="truncate text-[10px] font-black uppercase tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-2 truncate font-mono text-xl font-black ${toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function SmallMetric({ label, tone, value }: { label: string; tone?: number | null; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/55 p-3">
      <div className="truncate text-[10px] font-semibold uppercase leading-4 tracking-normal text-slate-500" title={label}>{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-bold ${toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function ReasonList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-300">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function ContextBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm leading-5 text-slate-300">{value}</div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: PublicStrategyReplayTrade["outcomeLabel"] }) {
  const className = outcome === "Worked"
    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
    : outcome === "Failed"
      ? "border-rose-300/30 bg-rose-400/10 text-rose-100"
      : "border-slate-400/25 bg-slate-400/10 text-slate-200";
  return <span className={`rounded-full border px-2 py-1 text-xs font-bold ${className}`}>{outcome}</span>;
}

function toneBadge(tone: PublicStrategyExplanation["tone"]): string {
  if (tone === "positive") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (tone === "caution") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-slate-400/25 bg-slate-400/10 text-slate-200";
}

function toneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-slate-100";
  return value > 0 ? "text-emerald-300" : "text-rose-300";
}

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatSignedPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" });
}
