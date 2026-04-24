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
  for (const key of keys) {
    const value = row[key] ?? summary?.[key];
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
              { label: "Entry Zone", value: String(row.entry_zone ?? "N/A"), meta: "planned area" },
              { label: "Invalidation", value: String(row.invalidation_level ?? "N/A"), meta: "risk line" },
              { label: "Technical", value: metricValue(row, "technical_score"), meta: "signal input" },
              { label: "Fundamental", value: metricValue(row, "fundamental_score"), meta: "signal input" },
              { label: "Macro", value: metricValue(row, "macro_score"), meta: "signal input" },
              { label: "News", value: metricValue(row, "news_score"), meta: "signal input" },
              { label: "Risk Penalty", value: metricValue(row, "risk_penalty"), meta: "deduction" },
              { label: "History", value: detail.history.length, meta: "price rows" },
            ]}
          />

          <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="terminal-panel rounded-md p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Trade Plan</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300">
                <div>
                  <span className="text-slate-500">Driver:</span> {String(row.upside_driver ?? "No driver listed")}
                </div>
                <div>
                  <span className="text-slate-500">Risk:</span> {String(row.key_risk ?? "No key risk listed")}
                </div>
                <div>
                  <span className="text-slate-500">Reason:</span> {String(row.selection_reason ?? "No selection reason listed")}
                </div>
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
