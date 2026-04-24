import Link from "next/link";
import { Badge } from "@/components/badge";
import { MetricStrip } from "@/components/metric-strip";
import { TerminalShell } from "@/components/shell";
import { actionFor, formatNumber } from "@/lib/format";
import { displayName, getSymbolDetail } from "@/lib/scanner-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

function metricValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "number" ? formatNumber(value) : String(value ?? "N/A");
}

function valueFrom(row: Record<string, unknown>, summary: Record<string, unknown> | null, keys: string[]) {
  const nestedSummary = summary?.summary && typeof summary.summary === "object" ? (summary.summary as Record<string, unknown>) : null;
  for (const key of keys) {
    const value = row[key] ?? summary?.[key] ?? nestedSummary?.[key];
    if (value === null || value === undefined || value === "") continue;
    return value;
  }
  return null;
}

function displayValue(value: unknown) {
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string" && value.trim()) return value;
  return "N/A";
}

function displayReason(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  if (!text || ["nan", "none", "n/a", "null"].includes(text.toLowerCase())) return fallback;
  return text;
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRiskReward(low: number, high: number) {
  return `${low.toFixed(1)}R–${high.toFixed(1)}R`;
}

function formatRiskRewardPoint(value: number | null) {
  return value !== null && value > 0 ? `${value.toFixed(1)}R` : "N/A";
}

function parseTradeLevel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return { low: value, high: value };
  const text = String(value ?? "").trim();
  if (!text || ["N/A", "-", "nan", "none", "null"].includes(text.toLowerCase())) return null;
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  const numbers = matches.map(Number).filter((item) => Number.isFinite(item));
  if (!numbers.length) return null;
  return { low: Math.min(...numbers), high: Math.max(...numbers) };
}

function takeProfitValue(row: Record<string, unknown>, summary: Record<string, unknown> | null) {
  const currentPrice = typeof row.price === "number" ? row.price : null;
  const value = valueFrom(row, summary, ["take_profit_zone", "take_profit", "upside_target", "target_price", "target"]);
  const zone = parseTradeLevel(value);
  if (currentPrice === null || !zone || zone.low <= currentPrice || zone.high <= currentPrice) return "N/A";
  return displayValue(value);
}

function resolvedTakeProfitValue(row: Record<string, unknown>, summary: Record<string, unknown> | null) {
  const explicitTarget = takeProfitValue(row, summary);
  if (explicitTarget !== "N/A") return explicitTarget;

  const currentPrice = typeof row.price === "number" ? row.price : null;
  const stopValue = valueFrom(row, summary, ["stop_loss", "invalidation_level"]);
  const stopZone = parseTradeLevel(stopValue);
  if (currentPrice === null || !stopZone || stopZone.low >= currentPrice) return "N/A";

  const risk = currentPrice - stopZone.low;
  const targetLow = currentPrice + 2 * risk;
  const targetHigh = currentPrice + 3 * risk;
  return `${formatNumber(targetLow)}-${formatNumber(targetHigh)}`;
}

function riskContext(row: Record<string, unknown>, summary: Record<string, unknown> | null) {
  const currentPrice = typeof row.price === "number" ? row.price : null;
  const stopZone = parseTradeLevel(valueFrom(row, summary, ["stop_loss", "invalidation_level"]));
  if (currentPrice === null || !stopZone || stopZone.low >= currentPrice) return null;
  return { currentPrice, stopLoss: stopZone.low, risk: currentPrice - stopZone.low };
}

function riskTargetRange(row: Record<string, unknown>, summary: Record<string, unknown> | null, lowMultiple: number, highMultiple: number) {
  const context = riskContext(row, summary);
  if (!context || context.risk <= 0) return "N/A";
  return `${formatNumber(context.currentPrice + lowMultiple * context.risk)}-${formatNumber(context.currentPrice + highMultiple * context.risk)}`;
}

function resolvedTarget(row: Record<string, unknown>, summary: Record<string, unknown> | null, keys: string[], fallback: string) {
  const value = valueFrom(row, summary, keys);
  const text = displayValue(value);
  return text !== "N/A" ? text : fallback;
}

function resolvedRiskRewardValue(row: Record<string, unknown>, summary: Record<string, unknown> | null, takeProfit: string) {
  const explicitLabel = valueFrom(row, summary, ["risk_reward_label"]);
  const labelText = String(explicitLabel ?? "").trim();
  if (labelText && !["nan", "none", "n/a", "null"].includes(labelText.toLowerCase())) return labelText;

  const low = numericValue(valueFrom(row, summary, ["risk_reward_low"]));
  const high = numericValue(valueFrom(row, summary, ["risk_reward_high"]));
  if (low !== null && high !== null && low > 0 && high > 0) return formatRiskReward(low, high);

  const currentPrice = typeof row.price === "number" ? row.price : null;
  const stopZone = parseTradeLevel(valueFrom(row, summary, ["stop_loss", "invalidation_level"]));
  const targetZone = parseTradeLevel(takeProfit);
  if (currentPrice === null || !stopZone || !targetZone || stopZone.low >= currentPrice || targetZone.low <= currentPrice) return "N/A";

  const risk = currentPrice - stopZone.low;
  if (risk <= 0) return "N/A";
  return formatRiskReward((targetZone.low - currentPrice) / risk, (targetZone.high - currentPrice) / risk);
}

function resolvedTargetRiskRewardValue(
  row: Record<string, unknown>,
  summary: Record<string, unknown> | null,
  conservativeTarget: string,
  balancedTarget: string,
  aggressiveTarget: string,
) {
  const explicitLabel = String(valueFrom(row, summary, ["target_risk_reward_label"]) ?? "").trim();
  if (explicitLabel && !["nan", "none", "n/a", "null"].includes(explicitLabel.toLowerCase())) return explicitLabel;

  const context = riskContext(row, summary);
  if (!context || context.risk <= 0) return "N/A";
  const conservativeZone = parseTradeLevel(conservativeTarget);
  const balancedZone = parseTradeLevel(balancedTarget);
  const aggressiveZone = parseTradeLevel(aggressiveTarget);
  const conservativeRr = numericValue(valueFrom(row, summary, ["conservative_risk_reward"])) ?? (conservativeZone && conservativeZone.low > context.currentPrice ? (conservativeZone.low - context.currentPrice) / context.risk : null);
  const balancedLow = numericValue(valueFrom(row, summary, ["balanced_risk_reward_low"])) ?? (balancedZone && balancedZone.low > context.currentPrice ? (balancedZone.low - context.currentPrice) / context.risk : null);
  const balancedHigh = numericValue(valueFrom(row, summary, ["balanced_risk_reward_high"])) ?? (balancedZone && balancedZone.high > context.currentPrice ? (balancedZone.high - context.currentPrice) / context.risk : null);
  const aggressiveLow = numericValue(valueFrom(row, summary, ["aggressive_risk_reward_low"])) ?? (aggressiveZone && aggressiveZone.low > context.currentPrice ? (aggressiveZone.low - context.currentPrice) / context.risk : null);
  const aggressiveHigh = numericValue(valueFrom(row, summary, ["aggressive_risk_reward_high"])) ?? (aggressiveZone && aggressiveZone.high > context.currentPrice ? (aggressiveZone.high - context.currentPrice) / context.risk : null);
  const balancedMid = balancedLow !== null && balancedHigh !== null ? (balancedLow + balancedHigh) / 2 : null;
  const aggressiveMid = aggressiveLow !== null && aggressiveHigh !== null ? (aggressiveLow + aggressiveHigh) / 2 : null;
  return `${formatRiskRewardPoint(conservativeRr)} / ${formatRiskRewardPoint(balancedMid)} / ${formatRiskRewardPoint(aggressiveMid)}`;
}

function resolvedTradeQuality(
  row: Record<string, unknown>,
  summary: Record<string, unknown> | null,
  conservativeTarget: string,
  balancedTarget: string,
) {
  const explicit = String(valueFrom(row, summary, ["trade_quality_note"]) ?? "").trim();
  if (explicit) return explicit;

  const context = riskContext(row, summary);
  if (!context || context.risk <= 0) return "LOW EDGE — trade plan unavailable";
  const conservativeZone = parseTradeLevel(conservativeTarget);
  const balancedZone = parseTradeLevel(balancedTarget);
  const conservativeRr = numericValue(valueFrom(row, summary, ["conservative_risk_reward"])) ?? (conservativeZone && conservativeZone.low > context.currentPrice ? (conservativeZone.low - context.currentPrice) / context.risk : null);
  if (conservativeRr !== null && conservativeRr < 1) return "LOW EDGE — Entry too extended. Wait for pullback.";
  const qualityRr = conservativeRr ?? (balancedZone && balancedZone.low > context.currentPrice ? (balancedZone.low - context.currentPrice) / context.risk : null);
  if (qualityRr !== null && qualityRr >= 2) return "GOOD — target reward clears 2R.";
  if (qualityRr !== null && qualityRr >= 1.5) return "ACCEPTABLE — balanced target offers reasonable reward.";
  return "LOW EDGE — wait for better entry.";
}

function resolvedTargetWarning(row: Record<string, unknown>, summary: Record<string, unknown> | null, takeProfit: string) {
  const explicit = String(valueFrom(row, summary, ["target_warning", "trade_plan_warning"]) ?? "").trim();
  if (explicit) return explicit;

  const currentPrice = typeof row.price === "number" ? row.price : null;
  const stopZone = parseTradeLevel(valueFrom(row, summary, ["stop_loss", "invalidation_level"]));
  const targetZone = parseTradeLevel(takeProfit);
  if (currentPrice === null || !stopZone || !targetZone || stopZone.low >= currentPrice) return "";

  const stopDistancePct = (currentPrice - stopZone.low) / currentPrice;
  const targetHighPct = (targetZone.high - currentPrice) / currentPrice;
  if (stopDistancePct > 0.12 || targetHighPct > 0.35) return "Target is wide due to large stop distance";
  return "";
}

function InfoTable({ rows }: { rows: { label: string; value: unknown }[] }) {
  return (
    <div className="divide-y divide-slate-800/90 rounded border border-slate-800/90">
      {rows.map((item) => (
        <div className="grid grid-cols-[160px_1fr] gap-3 px-3 py-2 text-xs" key={item.label}>
          <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</div>
          <div className="min-w-0 truncate text-slate-200" title={String(displayValue(item.value))}>
            {displayValue(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: unknown }) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="grid grid-cols-[145px_70px_1fr] items-center gap-3 text-xs">
      <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="text-right font-mono text-slate-200">{displayValue(value)}</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-sky-300/80" style={{ width: `${numeric}%` }} />
      </div>
    </div>
  );
}

export default async function SymbolDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const detail = await getSymbolDetail(symbol);
  const row = detail.row;
  const name = row ? displayName(row) : "";

  return (
    <TerminalShell>
      <div className="mb-3">
        <Link className="text-xs text-sky-300 hover:text-sky-200" href="/">
          ← Back to overview
        </Link>
      </div>

      {!row ? (
        <section className="terminal-panel rounded-md p-6 text-sm text-slate-400">
          Symbol <span className="font-mono text-slate-100">{symbol.toUpperCase()}</span> was not found in the current scanner output.
        </section>
      ) : (
        <div className="space-y-3">
          {(() => {
            const summary = detail.summary;
            const fundamentals = [
              { label: "Market Cap", value: valueFrom(row, summary, ["market_cap"]) },
              { label: "PE", value: valueFrom(row, summary, ["trailing_pe", "pe_ratio"]) },
              { label: "Forward PE", value: valueFrom(row, summary, ["forward_pe"]) },
              { label: "Revenue Growth", value: valueFrom(row, summary, ["revenue_growth"]) },
              { label: "Earnings Growth", value: valueFrom(row, summary, ["earnings_growth"]) },
              { label: "Gross Margin", value: valueFrom(row, summary, ["gross_margin"]) },
              { label: "Operating Margin", value: valueFrom(row, summary, ["operating_margin"]) },
              { label: "Profit Margin", value: valueFrom(row, summary, ["profit_margin"]) },
              { label: "Debt / Equity", value: valueFrom(row, summary, ["debt_to_equity"]) },
              { label: "ROE", value: valueFrom(row, summary, ["return_on_equity"]) },
            ];
            const newsItems = [
              { label: "Headline Bias", value: valueFrom(row, summary, ["headline_bias"]) },
              { label: "News Summary", value: valueFrom(row, summary, ["news_summary", "news"]) },
              { label: "Key Risk", value: valueFrom(row, summary, ["key_risk"]) },
            ];
            const buyZone = displayValue(valueFrom(row, summary, ["buy_zone", "entry_zone"]));
            const stopLoss = displayValue(valueFrom(row, summary, ["stop_loss", "invalidation_level"]));
            const takeProfit = resolvedTakeProfitValue(row, summary);
            const conservativeTarget = resolvedTarget(row, summary, ["conservative_target"], "N/A");
            const balancedTarget = resolvedTarget(row, summary, ["balanced_target"], riskTargetRange(row, summary, 1.5, 2.0));
            const aggressiveTarget = resolvedTarget(row, summary, ["aggressive_target"], riskTargetRange(row, summary, 2.0, 3.0));
            const riskReward = resolvedTargetRiskRewardValue(row, summary, conservativeTarget, balancedTarget, aggressiveTarget);
            const tradeQuality = resolvedTradeQuality(row, summary, conservativeTarget, balancedTarget);
            const targetWarning = resolvedTargetWarning(row, summary, takeProfit);
            const tradePlanReasons = [
              { label: "Buy Zone Reason", value: displayReason(valueFrom(row, summary, ["buy_zone_reason"]), "near current technical support") },
              { label: "Stop Loss Reason", value: displayReason(valueFrom(row, summary, ["stop_loss_reason"]), "below support with ATR buffer") },
              { label: "Take Profit Reason", value: displayReason(valueFrom(row, summary, ["take_profit_reason"]), takeProfit !== "N/A" ? "risk-based fallback (no resistance)" : "Take profit unavailable because stop loss or price is missing") },
              { label: "Risk/Reward Reason", value: displayReason(valueFrom(row, summary, ["risk_reward_reason"]), riskReward !== "N/A" ? "computed from current price, stop, and target" : "Risk/reward unavailable because stop loss or target is missing") },
              { label: "Conservative Reason", value: displayReason(valueFrom(row, summary, ["conservative_target_reason"]), "nearest resistance above current price") },
              { label: "Balanced Reason", value: displayReason(valueFrom(row, summary, ["balanced_target_reason"]), "1.5R–2R target from current risk") },
              { label: "Aggressive Reason", value: displayReason(valueFrom(row, summary, ["aggressive_target_reason"]), "2R–3R target from current risk") },
            ];

            return (
              <>
          <section className="terminal-panel rounded-md p-4">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div className="min-w-0">
                <div className="font-mono text-4xl font-semibold tracking-tight text-slate-50">{row.symbol}</div>
                <div className="mt-1 truncate text-sm text-slate-400">{name || row.symbol}</div>
                <div className="mt-2 truncate text-xs text-slate-500">
                  {row.asset_type || "N/A"} · {row.sector || "N/A"} · {row.setup_type || "N/A"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Price</div>
                  <div className="font-mono text-lg text-slate-100">{formatNumber(row.price)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Score</div>
                  <div className="font-mono text-lg text-emerald-200">{formatNumber(row.final_score)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Rating</div>
                  <div className="mt-1">
                    <Badge value={row.rating || "N/A"} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Action</div>
                  <div className="mt-1">
                    <Badge value={actionFor(row)} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <MetricStrip
            metrics={[
              { label: "Buy Zone", value: buyZone, meta: "support area" },
              { label: "Stop Loss", value: stopLoss, meta: "risk line" },
              { label: "Balanced Target", value: balancedTarget, meta: "1.5R-2R" },
              { label: "Risk / Reward", value: riskReward, meta: "conservative / balanced / aggressive" },
              { label: "Trade Quality", value: tradeQuality, meta: "edge check" },
              { label: "Technical", value: metricValue(row, "technical_score"), meta: "signal input" },
              { label: "Fundamental", value: metricValue(row, "fundamental_score"), meta: "signal input" },
              { label: "Macro", value: metricValue(row, "macro_score"), meta: "signal input" },
            ]}
          />

          <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Trade Plan</div>
              <div className="mt-3">
                {targetWarning ? (
                  <div className="mb-3 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
                    {targetWarning}
                  </div>
                ) : null}
                <InfoTable
                  rows={[
                    { label: "Current Price", value: row.price },
                    { label: "Buy Zone", value: buyZone },
                    { label: "Stop Loss", value: stopLoss },
                    { label: "Conservative Target", value: conservativeTarget },
                    { label: "Balanced Target", value: balancedTarget },
                    { label: "Aggressive Target", value: aggressiveTarget },
                    { label: "Risk / Reward", value: riskReward },
                    { label: "Trade Quality", value: tradeQuality },
                    ...tradePlanReasons,
                    { label: "Driver", value: row.upside_driver ?? "No driver listed" },
                    { label: "Risk", value: row.key_risk ?? "No key risk listed" },
                  ]}
                />
              </div>
            </section>

            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Signal Scores</div>
              <div className="mt-3 space-y-3">
                <SignalRow label="Technical" value={row.technical_score} />
                <SignalRow label="Fundamental" value={row.fundamental_score} />
                <SignalRow label="Macro" value={row.macro_score} />
                <SignalRow label="News" value={row.news_score} />
                <SignalRow label="Risk Penalty" value={row.risk_penalty} />
                <SignalRow label="Final Score" value={row.final_score} />
              </div>
            </section>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Overview / Summary</div>
              <InfoTable
                rows={[
                  { label: "Setup", value: row.setup_type },
                  { label: "Selection", value: row.selection_reason },
                  { label: "Driver", value: row.upside_driver },
                  { label: "Risk", value: row.key_risk },
                ]}
              />
            </section>

            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Price History</div>
              <div className="mt-8 h-36 rounded border border-dashed border-slate-700/70 text-center text-xs text-slate-500">
                <div className="pt-14">Chart placeholder · wire to history.csv next</div>
              </div>
            </section>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_0.85fr]">
            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Fundamentals</div>
              <div className="mt-3">
                <InfoTable rows={fundamentals} />
              </div>
            </section>

            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">News</div>
              <div className="mt-3">
                <InfoTable rows={newsItems} />
              </div>
            </section>
          </div>

          <details className="terminal-panel rounded-md p-4 text-xs text-slate-400">
            <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-slate-500">Raw Data</summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-slate-950/70 p-3">
              {JSON.stringify({ row, summary: detail.summary ?? { status: "summary.json not available" } }, null, 2)}
            </pre>
          </details>
              </>
            );
          })()}
        </div>
      )}
    </TerminalShell>
  );
}
