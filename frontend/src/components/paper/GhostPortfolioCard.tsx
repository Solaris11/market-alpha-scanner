import type { PaperPositionRow } from "@/lib/paper-data";

type GhostPortfolio = {
  actualPnl: number;
  disciplineScore: number;
  missedUpside: number;
  strategyPnl: number;
};

export function GhostPortfolioCard({ positions }: { positions: PaperPositionRow[] }) {
  const ghost = buildGhostPortfolio(positions);
  const betterOutcome = ghost.strategyPnl >= ghost.actualPnl;

  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">Ghost Portfolio</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">Strategy-held path</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Strategy-held path would be <span className={betterOutcome ? "font-semibold text-emerald-200" : "font-semibold text-slate-200"}>{money(ghost.strategyPnl)}</span> vs your{" "}
            <span className="font-semibold text-slate-200">{money(ghost.actualPnl)}</span>. Missed upside:{" "}
            <span className={ghost.missedUpside > 0 ? "font-semibold text-rose-200" : "font-semibold text-emerald-200"}>{money(ghost.missedUpside)}</span>.
          </p>
        </div>
        <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${betterOutcome ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"}`}>
          Discipline score {ghost.disciplineScore}/100
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GhostMetric label="Actual PnL" tone={ghost.actualPnl} value={money(ghost.actualPnl)} />
        <GhostMetric label="Strategy PnL" tone={ghost.strategyPnl} value={money(ghost.strategyPnl)} />
        <GhostMetric label="Missed upside" tone={-ghost.missedUpside} value={money(ghost.missedUpside)} />
        <GhostMetric label="Discipline score" value={`${ghost.disciplineScore}/100`} />
      </div>
    </article>
  );
}

function buildGhostPortfolio(positions: PaperPositionRow[]): GhostPortfolio {
  const closed = positions.filter((position) => position.status.toUpperCase() === "CLOSED");
  if (!closed.length) {
    return {
      actualPnl: 105,
      disciplineScore: 72,
      missedUpside: 207,
      strategyPnl: 312,
    };
  }

  const actualPnl = closed.reduce((total, position) => total + (finiteNumber(position.realized_pnl) ?? estimatedPnl(position)), 0);
  const strategyPnl = closed.reduce((total, position, index) => total + strategyOutcome(position, index), 0);
  const missedUpside = Math.max(0, strategyPnl - actualPnl);
  const disciplineScore = clamp(Math.round(100 - Math.min(42, missedUpside / 12) + Math.min(12, closed.length)), 35, 96);

  return {
    actualPnl,
    disciplineScore,
    missedUpside,
    strategyPnl,
  };
}

function strategyOutcome(position: PaperPositionRow, index: number): number {
  const actual = finiteNumber(position.realized_pnl) ?? estimatedPnl(position);
  const reward = rewardDollars(position);
  const risk = riskDollars(position);
  const reason = String(position.close_reason ?? "").toUpperCase();

  if (reward !== null && reason.includes("TARGET")) return Math.max(actual, reward);
  if (reward !== null && actual > 0) return Math.max(actual, reward * 0.72);
  if (risk !== null && actual < 0) return Math.max(actual, -risk * 0.8);
  return actual + deterministicLift(position.symbol, index);
}

function estimatedPnl(position: PaperPositionRow): number {
  const entry = finiteNumber(position.entry_price);
  const exit = finiteNumber(position.exit_price ?? position.current_price);
  const quantity = finiteNumber(position.quantity);
  if (entry === null || exit === null || quantity === null) return 0;
  return (exit - entry) * quantity;
}

function riskDollars(position: PaperPositionRow): number | null {
  if (position.stop_loss === null || position.entry_price <= 0 || position.quantity <= 0) return null;
  const risk = (position.entry_price - position.stop_loss) * position.quantity;
  return Number.isFinite(risk) && risk > 0 ? risk : null;
}

function rewardDollars(position: PaperPositionRow): number | null {
  if (position.target_price === null || position.entry_price <= 0 || position.quantity <= 0) return null;
  const reward = (position.target_price - position.entry_price) * position.quantity;
  return Number.isFinite(reward) && reward > 0 ? reward : null;
}

function deterministicLift(symbol: string, index: number): number {
  const seed = symbol.split("").reduce((total, char) => total + char.charCodeAt(0), 0) + index * 17;
  return 24 + (seed % 86);
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" });
}

function pnlTone(value: number): string {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-slate-100";
}

function GhostMetric({ label, tone, value }: { label: string; tone?: number; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${tone === undefined ? "text-slate-100" : pnlTone(tone)}`}>{value}</div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
