import type { PaperPositionRow, PaperTradeEventRow } from "@/lib/paper-data";
import type { ReactNode } from "react";
import { formatMoney, formatNumber, formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function timeText(value: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function lastClosed(positions: PaperPositionRow[]) {
  return positions
    .filter((position) => position.status === "CLOSED")
    .sort((left, right) => String(right.closed_at ?? "").localeCompare(String(left.closed_at ?? "")))[0];
}

export function PaperContextCard({
  events,
  openPositions,
  positions,
  symbol,
}: {
  events: PaperTradeEventRow[];
  openPositions: PaperPositionRow[];
  positions: PaperPositionRow[];
  symbol: string;
}) {
  const latestClosed = lastClosed(positions);
  const recentEvents = events.slice(0, 3);
  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Paper Context" title="Simulation Memory" />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <PaperBox title="Open Position">
          {openPositions.length ? (
            <div className="space-y-1">
              <div className="font-mono text-lg text-slate-50">{symbol}</div>
              <div className="text-slate-400">Qty {formatNumber(openPositions[0].quantity)} at {formatMoney(openPositions[0].entry_price)}</div>
              <div className="text-emerald-200">Unrealized {formatMoney(openPositions[0].unrealized_pnl)}</div>
            </div>
          ) : (
            <div className="text-slate-500">No open paper position.</div>
          )}
        </PaperBox>
        <PaperBox title="Last Trade">
          {latestClosed ? (
            <div className="space-y-1">
              <div className="text-slate-50">{latestClosed.close_reason ?? "Closed"}</div>
              <div className={(latestClosed.realized_pnl ?? 0) >= 0 ? "text-emerald-200" : "text-rose-200"}>{formatMoney(latestClosed.realized_pnl)}</div>
              <div className="text-slate-400">Return {formatPercent(latestClosed.return_pct)}</div>
            </div>
          ) : (
            <div className="text-slate-500">No closed paper trade yet.</div>
          )}
        </PaperBox>
        <PaperBox title="Recent Events">
          {recentEvents.length ? (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div className="flex items-center justify-between gap-3" key={event.id}>
                  <span className="text-slate-200">{event.event_type}</span>
                  <span className="text-slate-500">{timeText(event.created_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500">No recent paper events.</div>
          )}
        </PaperBox>
      </div>
    </GlassPanel>
  );
}

function PaperBox({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      {children}
    </div>
  );
}
