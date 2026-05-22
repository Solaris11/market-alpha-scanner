import type {
  InstitutionalOperatingLane,
  InstitutionalPortfolioOperationsSystem,
  InstitutionalPortfolioOpsTone,
  InstitutionalPositionLifecycle,
  InstitutionalRebalanceCheckpoint,
  InstitutionalStrategyMemoryItem,
  InstitutionalStrategyRevisionItem,
  InstitutionalWorkspaceContinuityItem,
} from "@/lib/trading/institutional-portfolio-operations";
import { formatMoney } from "@/lib/ui/formatters";

export function InstitutionalPortfolioOperationsPanel({ system }: { system: InstitutionalPortfolioOperationsSystem }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/70 shadow-2xl shadow-black/25 ring-1 ring-white/5 backdrop-blur-xl" id="institutional-portfolio-operations">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.12),transparent_32%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Institutional Operations</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Portfolio operating discipline</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{system.headline}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-left sm:min-w-[430px]">
            <ScorePill label="Ops Score" tone={qualityTone(system.operatingScore)} value={`${system.operatingScore}/100`} />
            <ScorePill label="Exposure" tone={system.openPositionCount ? "neutral" : "warn"} value={formatMoney(system.totalExposureValue, 0)} />
            <ScorePill label="Mode" tone="neutral" value={system.activeMode ? titleCase(system.activeMode) : "Limited"} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <div className="space-y-5">
          <LaneGrid lanes={system.operatingLanes} />
          <PositionLifecycleList items={system.positionLifecycle} />
          <RebalanceTimeline items={system.rebalanceHistory} />
        </div>

        <div className="space-y-5">
          <RiskBudgetList items={system.riskBudget.slice(0, 7)} />
          <StrategyMemoryList items={system.strategyMemory} />
          <StrategyRevisionList items={system.strategyRevisions} />
          <WorkspaceContinuityList items={system.workspaceContinuity} />
        </div>
      </div>

      <div className="border-t border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Trust Boundary</div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {system.limitations.map((line) => (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs leading-5 text-slate-400" key={line}>{line}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LaneGrid({ lanes }: { lanes: InstitutionalOperatingLane[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lanes.map((lane) => (
        <div className={`rounded-2xl border p-4 ${panelTone(lane.tone)}`} key={`${lane.type}:${lane.label}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{lane.type.replace("_", " ")}</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-50">{lane.label}</div>
            </div>
            <div className={`font-mono text-sm font-black ${toneText(lane.tone)}`}>{Math.round(lane.score)}</div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-300">{lane.detail}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900">
            <div className={`h-full rounded-full ${barTone(lane.tone)}`} style={{ width: `${Math.max(5, Math.min(100, lane.score))}%` }} />
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-500">{lane.evidence}</div>
          {lane.symbols.length ? <div className="mt-2 break-words text-xs text-cyan-200/80">{lane.symbols.slice(0, 6).join(", ")}</div> : null}
        </div>
      ))}
    </div>
  );
}

function PositionLifecycleList({ items }: { items: InstitutionalPositionLifecycle[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Position Lifecycle</div>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Thesis, invalidation, and sizing context</h3>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3" key={item.symbol}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-50">{item.symbol}</div>
                <div className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${chipTone(item.tone)}`}>{item.status}</div>
              </div>
              <div className="text-right font-mono text-sm text-slate-100">{item.allocationPct}%</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">{item.thesis}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Mini label="Current value" value={formatMoney(item.currentValue, 0)} />
              <Mini label="Open risk" value={formatMoney(item.riskAmount, 0)} />
              <Mini label="Opened" value={dateText(item.openedAt)} />
              <Mini label="Unrealized P/L" tone={item.unrealizedPnl} value={formatMoney(item.unrealizedPnl ?? 0, 0)} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{item.entryReason}</p>
            <p className="mt-2 text-xs leading-5 text-amber-100/85">{item.invalidation}</p>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-400">
            No active position lifecycle is available yet. Add paper positions with entry, stop, target, and thesis context to unlock operating review.
          </div>
        )}
      </div>
    </div>
  );
}

function RebalanceTimeline({ items }: { items: InstitutionalRebalanceCheckpoint[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Rebalance Evidence</div>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Allocation checkpoints</h3>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <div className="relative rounded-2xl border border-white/10 bg-slate-950/45 p-3" key={`${item.date}:${item.label}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-50">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.date}</div>
              </div>
              <div className={`font-mono text-sm font-black ${toneText(item.tone)}`}>{item.deployedPct}%</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Mini label="Deployed" value={`${item.deployedPct}%`} />
              <Mini label="Cash" value={`${item.cashPct}%`} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{item.detail}</p>
            {item.topSymbol ? <div className="mt-2 text-xs text-cyan-200/80">Top symbol: {item.topSymbol}</div> : null}
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-400">
            No allocation checkpoints are available. The system will not invent rebalance history without Strategy Labs evidence.
          </div>
        )}
      </div>
    </div>
  );
}

function RiskBudgetList({ items }: { items: InstitutionalOperatingLane[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-200">Risk Operating Layer</div>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3" key={`risk:${item.label}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100">{item.label}</div>
              <div className={`font-mono text-xs font-black ${toneText(item.tone)}`}>{Math.round(item.score)}/100</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyMemoryList({ items }: { items: InstitutionalStrategyMemoryItem[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200">Strategy Memory</div>
      <div className="mt-3 space-y-3">
        {items.length ? items.slice(0, 5).map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3" key={item.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
              </div>
              <div className={`font-mono text-xs font-black ${toneText(item.tone)}`}>{item.sampleCount}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Mini label="Avg return" value={item.averageReturnPct === null ? "N/A" : `${item.averageReturnPct.toFixed(1)}%`} />
              <Mini label="Worst DD" value={item.worstDrawdownPct === null ? "N/A" : `${item.worstDrawdownPct.toFixed(1)}%`} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{item.latestLesson}</p>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/45 p-3 text-sm leading-6 text-slate-400">
            Strategy memory is evidence-limited until completed simulation samples exist.
          </div>
        )}
      </div>
    </div>
  );
}

function StrategyRevisionList({ items }: { items: InstitutionalStrategyRevisionItem[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Model Revisions</div>
      <div className="mt-3 space-y-3">
        {items.length ? items.slice(0, 4).map((item) => (
          <div className={`rounded-xl border p-3 ${panelTone(item.tone)}`} key={`${item.date}:${item.label}:${item.symbols.join(",")}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.date} · {item.symbols.join(", ")}</div>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.evidence}</p>
            <p className="mt-2 text-xs leading-5 text-cyan-100/80">{item.toPolicy}</p>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/45 p-3 text-sm leading-6 text-slate-400">
            No model revision evidence is available yet; the system will not invent strategy changes.
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceContinuityList({ items }: { items: InstitutionalWorkspaceContinuityItem[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Workflow Continuity</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3" key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100">{item.label}</div>
              <div className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${continuityTone(item.status)}`}>{item.status}</div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorePill({ label, tone, value }: { label: string; tone: InstitutionalPortfolioOpsTone; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.055] p-3">
      <div className="break-words text-[9px] font-black uppercase leading-3 tracking-normal text-slate-500">{label}</div>
      <div className={`mt-1 break-words font-mono text-sm font-black sm:text-base ${toneText(tone)}`}>{value}</div>
    </div>
  );
}

function Mini({ label, tone, value }: { label: string; tone?: number | null; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`mt-1 break-words font-mono text-xs font-semibold ${tone === undefined || tone === null ? "text-slate-100" : tone >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{value}</div>
    </div>
  );
}

function qualityTone(score: number): InstitutionalPortfolioOpsTone {
  if (score >= 70) return "good";
  if (score >= 52) return "neutral";
  if (score >= 38) return "warn";
  return "risk";
}

function toneText(tone: InstitutionalPortfolioOpsTone): string {
  if (tone === "good") return "text-emerald-300";
  if (tone === "warn") return "text-amber-200";
  if (tone === "risk") return "text-rose-300";
  return "text-slate-100";
}

function barTone(tone: InstitutionalPortfolioOpsTone): string {
  if (tone === "good") return "bg-emerald-400";
  if (tone === "warn") return "bg-amber-300";
  if (tone === "risk") return "bg-rose-400";
  return "bg-cyan-300";
}

function panelTone(tone: InstitutionalPortfolioOpsTone): string {
  if (tone === "good") return "border-emerald-300/18 bg-emerald-400/[0.055]";
  if (tone === "warn") return "border-amber-300/22 bg-amber-400/[0.065]";
  if (tone === "risk") return "border-rose-300/24 bg-rose-400/[0.07]";
  return "border-white/10 bg-white/[0.035]";
}

function chipTone(tone: InstitutionalPortfolioOpsTone): string {
  if (tone === "good") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  if (tone === "warn") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  if (tone === "risk") return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  return "border-slate-600 bg-slate-900 text-slate-300";
}

function continuityTone(status: InstitutionalWorkspaceContinuityItem["status"]): string {
  if (status === "available") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  if (status === "limited") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
  return "border-rose-300/30 bg-rose-400/10 text-rose-100";
}

function dateText(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
