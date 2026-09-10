import { Activity, BellRing, Clock3, Crosshair, Eye, TimerReset } from "lucide-react";
import type { TerminalDecisionCounts } from "@/lib/terminal/command-bar-counts";

/**
 * The compact status bar that answers, without scrolling, the four questions a
 * trader opens this page to ask: what is the market doing, how fresh is the
 * scan, is there anything to enter, and is anything on my watchlist urgent.
 *
 * On counting ENTER
 * ----------------
 * `buildDecisionDistribution` in TerminalPremiumView counts only
 * ["WATCH", "WAIT_PULLBACK", "AVOID"] -- ENTER is not in the list, which is
 * why the page could not previously state whether an entry existed at all.
 *
 * This component counts ENTER itself rather than extending that helper on
 * purpose. `DailyActionCard` turns the distribution into percentages of its
 * own total, so adding a fourth category there would silently change three
 * numbers that are already on screen. Counting separately adds information
 * without altering a single displayed value.
 *
 * Nothing here fetches, derives a decision, or re-scores anything. It reads
 * decisions the scanner already made.
 */
export type CommandBarCounts = Pick<TerminalDecisionCounts, "enter" | "watch" | "waitPullback"> & {
  alerts: number;
};

function Stat({
  icon,
  label,
  value,
  tone = "neutral",
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "live" | "muted" | "alert";
  title?: string;
}) {
  const toneClass =
    tone === "live"
      ? "text-emerald-200 border-emerald-300/25 bg-emerald-400/[0.08]"
      : tone === "alert"
        ? "text-amber-100 border-amber-300/25 bg-amber-400/[0.08]"
        : tone === "muted"
          ? "text-slate-400 border-white/10 bg-white/[0.03]"
          : "text-slate-200 border-white/10 bg-white/[0.04]";
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      <span aria-hidden className="opacity-80">
        {icon}
      </span>
      <span className="uppercase tracking-wide opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

export function TerminalCommandBar({
  marketState,
  dataStatus,
  updatedAt,
  counts,
}: {
  marketState: string;
  dataStatus: string;
  updatedAt?: string;
  counts: CommandBarCounts;
}) {
  const hasEntry = counts.enter > 0;
  return (
    <div
      // sticky rather than fixed so it never overlays content on short mobile
      // viewports, and so the page keeps a single scroll context.
      className="tv-scroll-x sticky top-0 z-30 -mx-1 mb-1 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60"
      role="status"
      aria-label="Terminal status"
    >
      <Stat
        icon={<Crosshair size={12} />}
        label="Enter"
        value={String(counts.enter)}
        tone={hasEntry ? "live" : "muted"}
        title={hasEntry ? `${counts.enter} setup(s) currently marked ENTER by the scanner` : "No setup currently passes every entry gate"}
      />
      <Stat icon={<Eye size={12} />} label="Watch" value={String(counts.watch)} title="Symbols the scanner is monitoring" />
      <Stat
        icon={<TimerReset size={12} />}
        label="Wait"
        value={String(counts.waitPullback)}
        title="Symbols where the scanner wants a pullback before entry"
      />
      <span className="mx-1 hidden h-4 w-px shrink-0 bg-white/10 sm:block" aria-hidden />
      <Stat icon={<Activity size={12} />} label="Regime" value={marketState} title="Current market regime" />
      <Stat
        icon={<Clock3 size={12} />}
        label="Scan"
        value={dataStatus}
        tone={dataStatus.toLowerCase().includes("fresh") ? "neutral" : "alert"}
        title={updatedAt ? `Scanner data status. Updated ${updatedAt}` : "Scanner data status"}
      />
      <Stat
        icon={<BellRing size={12} />}
        label="Alerts"
        value={String(counts.alerts)}
        tone={counts.alerts > 0 ? "alert" : "muted"}
        title="Active alert matches on your watchlist"
      />
      {/* Research boundary travels with the status bar: this strip is the first
          thing read on the page, so the framing belongs here too. */}
      <span className="ml-auto hidden shrink-0 pl-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 lg:block">
        Research only
      </span>
    </div>
  );
}
