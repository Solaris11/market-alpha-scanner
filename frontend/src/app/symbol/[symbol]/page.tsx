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
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Price History</div>
              <div className="mt-8 h-36 rounded border border-dashed border-slate-700/70 text-center text-xs text-slate-500">
                <div className="pt-14">Chart placeholder · wire to history.csv next</div>
              </div>
            </section>
          </div>

          <section className="terminal-panel rounded-md p-4">
            <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs text-slate-400">
              <span className="text-sky-200">Fundamentals</span>
              <span>News</span>
              <span>Raw Summary</span>
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-slate-950/70 p-3 text-xs text-slate-400">
              {JSON.stringify(detail.summary ?? { status: "summary.json not available" }, null, 2)}
            </pre>
          </section>
        </div>
      )}
    </TerminalShell>
  );
}
