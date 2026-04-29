import type { RankingRow } from "@/lib/types";
import { formatNumber } from "@/lib/ui/formatters";
import { ConfidenceGauge } from "./ConfidenceGauge";

const ITEMS: Array<[keyof RankingRow, string, string]> = [
  ["current_rsi", "RSI", "Momentum temperature; extreme values can indicate stretch."],
  ["atr_pct", "ATR %", "Average true range as a volatility proxy."],
  ["annualized_volatility", "Volatility", "How noisy this symbol has been recently."],
  ["max_drawdown", "Max Drawdown", "Peak-to-trough loss from recent highs."],
  ["technical_score", "Trend", "Composite trend, momentum, and setup quality."],
  ["macro_score", "Macro", "Regime and market sensitivity context."],
];

export function TechnicalExplainer({ row }: { row: RankingRow }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ITEMS.map(([key, label, help]) => (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={String(key)}>
          <ConfidenceGauge label={label} value={row[key]} />
          <div className="mt-2 text-xs text-slate-400">{help}</div>
          <div className="mt-2 font-mono text-sm text-slate-200">{formatNumber(row[key])}</div>
        </div>
      ))}
    </div>
  );
}
