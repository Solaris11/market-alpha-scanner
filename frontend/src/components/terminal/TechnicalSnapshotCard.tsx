import type { RankingRow } from "@/lib/types";
import { formatNumber, formatPercent, normalizeNumeric, normalizePercent } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

function numericFrom(row: RankingRow, keys: string[]) {
  for (const key of keys) {
    const value = normalizeNumeric(row[key]);
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

function macdStatus(value: number | null) {
  if (value !== null && value > 0) return "Bullish momentum";
  if (value !== null && value < 0) return "Bearish momentum";
  if (value !== null) return "Neutral momentum";
  return "Unavailable";
}

function barPercent(value: number | null, fallback = 50) {
  if (value === null) return fallback;
  return Math.max(0, Math.min(100, value));
}

function normalizeDrawdownPercent(value: number | null): number | null {
  const percentValue = normalizePercent(value, { max: 100, min: -100 });
  if (percentValue === null) return null;
  return Math.min(0, Math.max(-100, percentValue));
}

function formatDrawdownPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${formatNumber(value, 1)}%`;
}

function formatMacd(value: number | null): string {
  if (value === null) return "N/A";
  const formatted = value.toFixed(4);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatNormalizedPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(2)}%`;
}

export function TechnicalSnapshotCard({ row }: { row: RankingRow }) {
  const rsi = numericFrom(row, ["current_rsi", "rsi"]);
  const macd = normalizeNumeric(row.current_macd_hist);
  const atr = normalizePercent(row.atr_pct, { max: 100, min: 0 });
  const volatility = numericFrom(row, ["annualized_volatility", "volatility"]);
  const drawdown = normalizeDrawdownPercent(numericFrom(row, ["max_drawdown"]));
  const trend = numericFrom(row, ["trend_score", "technical_score"]);
  const momentum = numericFrom(row, ["momentum_score", "short_score"]);

  return (
    <GlassPanel className="p-6">
      <SectionTitle eyebrow="Technicals" title="Technical Snapshot" />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <TechBar label="RSI" status={rsiStatus(rsi)} value={rsi === null ? "N/A" : formatNumber(rsi, 0)} width={barPercent(rsi)} />
        <TechBar label="MACD" status={macdStatus(macd)} value={formatMacd(macd)} width={macd === null ? 50 : macd > 0 ? 72 : macd < 0 ? 28 : 50} />
        <TechBar label="ATR" status="Volatility range" value={formatNormalizedPercent(atr)} width={barPercent(atr, 0)} />
        <TechBar label="Volatility" status="Annualized" value={volatility === null ? "N/A" : formatPercent(volatility, 1)} width={barPercent(volatility === null ? null : volatility * 100, 40)} />
        <TechBar label="Max Drawdown" value={formatDrawdownPercent(drawdown)} width={barPercent(drawdown === null ? null : Math.abs(drawdown), 0)} tone="risk" />
        <TechBar label="Trend" status={trend !== null && trend >= 70 ? "Strong" : trend !== null && trend >= 50 ? "Neutral" : "Weak"} value={trend === null ? "N/A" : formatNumber(trend, 0)} width={barPercent(trend)} />
        <TechBar label="Momentum" status={momentum !== null && momentum >= 70 ? "Strong" : momentum !== null && momentum >= 50 ? "Neutral" : "Weak"} value={momentum === null ? "N/A" : formatNumber(momentum, 0)} width={barPercent(momentum)} />
      </div>
    </GlassPanel>
  );
}

function TechBar({ label, status, value, width, tone = "normal" }: { label: string; status?: string; value: string; width: number; tone?: "normal" | "risk" }) {
  const fill = tone === "risk" ? "bg-gradient-to-r from-rose-400 to-amber-300" : "bg-gradient-to-r from-cyan-400 to-emerald-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          {status ? <div className="mt-1 text-sm text-slate-300">{status}</div> : null}
        </div>
        <div className="font-mono text-lg font-semibold text-slate-50">{value}</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/80">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
