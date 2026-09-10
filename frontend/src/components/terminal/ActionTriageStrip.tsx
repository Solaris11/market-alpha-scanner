import Link from "next/link";
import { Crosshair, Eye, TimerReset } from "lucide-react";
import type { ActionTriage, TriageEntry } from "@/lib/terminal/action-triage";

/**
 * The first-screen answer to "what, if anything, do I act on right now".
 *
 * A summary, not a fifth opportunity list. The page already ranks setups in
 * four places; this names a few and links to the symbol pages, leaving those
 * lists where they are. Nothing here re-scores or re-decides: the buckets are
 * the scanner's `final_decision` and the ordering is its `final_score`.
 *
 * Empty states say what is actually true rather than showing a placeholder.
 * "No setup passes every entry gate right now" is a real, useful answer in a
 * WAIT-first product, and inventing a row to fill the column would be worse
 * than an empty column.
 */
function Entry({ entry }: { entry: TriageEntry }) {
  return (
    <Link
      href={`/symbol/${entry.symbol}`}
      className="group flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 motion-safe:transition-colors motion-safe:duration-150 hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
    >
      <span className="font-mono text-xs font-semibold text-slate-100">{entry.symbol}</span>
      <span className="ml-auto shrink-0 tabular-nums text-[11px] text-slate-400">
        {entry.score === null ? "—" : Math.round(entry.score)}
      </span>
      {entry.riskReward === null ? null : (
        <span className="shrink-0 tabular-nums text-[11px] text-slate-500" title="Risk / reward">
          {entry.riskReward.toFixed(1)}R
        </span>
      )}
    </Link>
  );
}

function Column({
  icon,
  title,
  count,
  entries,
  empty,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  entries: TriageEntry[];
  empty: string;
  tone: "live" | "neutral" | "wait";
}) {
  const head =
    tone === "live" && count > 0
      ? "text-emerald-200"
      : tone === "wait"
        ? "text-amber-100"
        : "text-slate-200";
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${head}`}>
        <span aria-hidden className="opacity-80">
          {icon}
        </span>
        <span className="truncate">{title}</span>
        <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 tabular-nums text-slate-300">
          {count}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-slate-500">{empty}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <Entry entry={entry} key={entry.symbol} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ActionTriageStrip({ triage }: { triage: ActionTriage }) {
  return (
    <section aria-label="Today's actionable board" className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Today&apos;s actionable board</h2>
        <span className="text-[11px] text-slate-500">
          Scanner decisions, highest score first. Research only.
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Column
          icon={<Crosshair size={12} />}
          title="Enter now"
          tone="live"
          count={triage.counts.ENTER}
          entries={triage.enter}
          empty="No setup passes every entry gate right now. That is a result, not a gap."
        />
        <Column
          icon={<Eye size={12} />}
          title="Watch"
          tone="neutral"
          count={triage.counts.WATCH}
          entries={triage.watch}
          empty="Nothing is on the monitoring list from the latest scan."
        />
        <Column
          icon={<TimerReset size={12} />}
          title="Wait for pullback"
          tone="wait"
          count={triage.counts.WAIT_PULLBACK}
          entries={triage.waitPullback}
          empty="No setup is waiting on a pullback right now."
        />
      </div>
      {triage.counts.AVOID > 0 || triage.counts.EXIT > 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {triage.counts.AVOID} avoided
          {triage.counts.EXIT > 0 ? `, ${triage.counts.EXIT} on a sell signal` : ""} — kept out of the board on purpose;
          the full breakdown is below.
        </p>
      ) : null}
    </section>
  );
}
