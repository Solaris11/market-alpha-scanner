import type { RankingRow } from "@/lib/types";
import { finiteNumber, formatNumber, formatPercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function numericFrom(row: RankingRow, keys: string[]) {
  for (const key of keys) {
    const value = finiteNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function rsiStatus(value: number | null) {
  if (value === null) return "Unavailable";
  if (value >= 70) return "Overbought";
  if (value <= 30) return "Oversold";
  if (value >= 55) return "Constructive";
  if (value <= 45) return "Weak";
  return "Neutral";
}

function macdStatus(value: number | null, raw: unknown) {
  const text = String(raw ?? "").toLowerCase();
  if (value !== null) return value >= 0 ? "Positive" : "Negative";
  if (text.includes("positive") || text.includes("bull")) return "Positive";
  if (text.includes("negative") || text.includes("bear")) return "Negative";
  return "Unavailable";
}

function barPercent(value: number | null, fallback = 50) {
  if (value === null) return fallback;
  return Math.max(0, Math.min(100, value));
}

export function TechnicalSnapshotCard({ row }: { row: RankingRow }) {
  const rsi = numericFrom(row, ["current_rsi", "rsi"]);
  const macd = numericFrom(row, ["macd_histogram", "macd", "macd_score"]);
  const atr = numericFrom(row, ["atr_pct"]);
  const volatility = numericFrom(row, ["annualized_volatility", "volatility"]);
  const drawdown = numericFrom(row, ["max_drawdown"]);
  const trend = numericFrom(row, ["trend_score", "technical_score"]);
  const momentum = numericFrom(row, ["momentum_score", "short_score"]);

  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Technicals" title="Technical Snapshot" />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <TechBar label="RSI" status={rsiStatus(rsi)} value={rsi === null ? "N/A" : formatNumber(rsi, 0)} width={barPercent(rsi)} />
        <TechBar label="MACD" status={macdStatus(macd, row.macd)} value={macd === null ? "N/A" : formatNumber(macd, 2)} width={macd === null ? 50 : macd >= 0 ? 72 : 28} />
        <TechBar label="ATR" status="Volatility range" value={atr === null ? "N/A" : formatPercent(atr, 1)} width={barPercent(atr === null ? null : atr * 100, 35)} />
        <TechBar label="Volatility" status="Annualized" value={volatility === null ? "N/A" : formatPercent(volatility, 1)} width={barPercent(volatility === null ? null : volatility * 100, 40)} />
        <TechBar label="Drawdown" status="Downside pressure" value={drawdown === null ? "N/A" : formatPercent(drawdown, 1)} width={barPercent(drawdown === null ? null : Math.abs(drawdown) * 100, 25)} tone="risk" />
        <TechBar label="Trend" status={trend !== null && trend >= 70 ? "Strong" : trend !== null && trend >= 50 ? "Neutral" : "Weak"} value={trend === null ? "N/A" : formatNumber(trend, 0)} width={barPercent(trend)} />
        <TechBar label="Momentum" status={momentum !== null && momentum >= 70 ? "Strong" : momentum !== null && momentum >= 50 ? "Neutral" : "Weak"} value={momentum === null ? "N/A" : formatNumber(momentum, 0)} width={barPercent(momentum)} />
      </div>
    </GlassPanel>
  );
}

function TechBar({ label, status, value, width, tone = "normal" }: { label: string; status: string; value: string; width: number; tone?: "normal" | "risk" }) {
  const fill = tone === "risk" ? "bg-gradient-to-r from-rose-400 to-amber-300" : "bg-gradient-to-r from-cyan-400 to-emerald-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-1 text-sm text-slate-300">{status}</div>
        </div>
        <div className="font-mono text-lg font-semibold text-slate-50">{value}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/80">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
