"use client";

import { useMemo, useState } from "react";
import type { PaperPositionRow } from "@/lib/paper-data";
import { buildPortfolioIntelligenceSystem } from "@/lib/trading/portfolio-intelligence";
import type { OpportunityViewModel } from "@/lib/trading/opportunity-view-model";
import type { ScenarioIntelligenceSystem } from "@/lib/trading/scenario-intelligence";
import { formatMoney, formatNumber } from "@/lib/ui/formatters";
import { PortfolioIntelligencePanel } from "./PortfolioIntelligencePanel";

type ManualRiskProfile = "" | "low" | "medium" | "high";

type ManualPortfolioLine = {
  allocationPct: string;
  costBasis: string;
  quantity: string;
  riskProfile: ManualRiskProfile;
  symbol: string;
};

type Props = {
  accountValue?: number | null;
  opportunities: OpportunityViewModel[];
  scenarioSystem: ScenarioIntelligenceSystem | null;
};

const STARTER_LINES: ManualPortfolioLine[] = [
  { allocationPct: "35", costBasis: "", quantity: "", riskProfile: "medium", symbol: "AMD" },
  { allocationPct: "25", costBasis: "", quantity: "", riskProfile: "medium", symbol: "NVDA" },
  { allocationPct: "15", costBasis: "", quantity: "", riskProfile: "low", symbol: "GLD" },
];

export function ManualPortfolioScenarioLab({ accountValue = null, opportunities, scenarioSystem }: Props) {
  const [lines, setLines] = useState<ManualPortfolioLine[]>(STARTER_LINES);
  const opportunityMap = useMemo(() => new Map(opportunities.map((row) => [row.symbol.toUpperCase(), row])), [opportunities]);
  const normalizedAccountValue = positiveNumber(accountValue) ?? 100_000;
  const positions = useMemo(
    () => linesToPositions(lines, opportunityMap, normalizedAccountValue),
    [lines, normalizedAccountValue, opportunityMap],
  );
  const manualSystem = useMemo(() => buildPortfolioIntelligenceSystem({
    accountValue: normalizedAccountValue,
    generatedAt: "manual-portfolio-lab",
    opportunities,
    positions,
    scenarioSystem,
  }), [normalizedAccountValue, opportunities, positions, scenarioSystem]);

  function updateLine(index: number, patch: Partial<ManualPortfolioLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function addLine() {
    setLines((current) => [...current, { allocationPct: "", costBasis: "", quantity: "", riskProfile: "", symbol: "" }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  const estimatedExposure = positions.reduce((sum, position) => sum + (positiveNumber(position.current_price) ?? position.entry_price) * position.quantity, 0);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Manual Portfolio Stress Lab</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Test exposure before committing to a portfolio shape.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Enter symbols with quantity or allocation percent. Cost basis and risk profile are optional research inputs. This does not create a paper trade or broker order.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs sm:min-w-[300px]">
            <SummaryPill label="Reference Value" value={formatMoney(normalizedAccountValue, 0)} />
            <SummaryPill label="Modeled Exposure" value={formatMoney(estimatedExposure, 0)} />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((line, index) => (
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" key={`${index}:${line.symbol}`}>
              <LabInput label="Symbol" onChange={(value) => updateLine(index, { symbol: value.toUpperCase() })} placeholder="AMD" value={line.symbol} />
              <LabInput label="Quantity" numeric onChange={(value) => updateLine(index, { quantity: value })} placeholder="10" value={line.quantity} />
              <LabInput label="Allocation %" numeric onChange={(value) => updateLine(index, { allocationPct: value })} placeholder="25" value={line.allocationPct} />
              <LabInput label="Cost Basis" numeric onChange={(value) => updateLine(index, { costBasis: value })} placeholder="optional" value={line.costBasis} />
              <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Risk Profile
                <select
                  className="mt-1 h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-violet-300/60"
                  onChange={(event) => updateLine(index, { riskProfile: event.currentTarget.value as ManualRiskProfile })}
                  value={line.riskProfile}
                >
                  <option value="">Optional</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <div className="md:col-span-5 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>{lineHint(line, opportunityMap, normalizedAccountValue)}</span>
                <button className="self-start rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-300 hover:border-rose-300/40 hover:text-rose-100" onClick={() => removeLine(index)} type="button">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button className="rounded-full border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-100 hover:bg-violet-400/15" onClick={addLine} type="button">
            Add Symbol
          </button>
          <div className="text-xs leading-5 text-slate-500">
            Scenario output uses current TradeVeto scanner context when available; missing symbols degrade to exposure math only.
          </div>
        </div>
      </div>

      <PortfolioIntelligencePanel system={manualSystem} />
    </section>
  );
}

function linesToPositions(lines: ManualPortfolioLine[], opportunityMap: Map<string, OpportunityViewModel>, accountValue: number): PaperPositionRow[] {
  return lines
    .map((line, index) => manualLineToPosition(line, index, opportunityMap, accountValue))
    .filter((position): position is PaperPositionRow => position !== null);
}

function manualLineToPosition(line: ManualPortfolioLine, index: number, opportunityMap: Map<string, OpportunityViewModel>, accountValue: number): PaperPositionRow | null {
  const symbol = line.symbol.trim().toUpperCase();
  if (!symbol) return null;
  const opportunity = opportunityMap.get(symbol) ?? null;
  const currentPrice = positiveNumber(opportunity?.price) ?? positiveNumber(line.costBasis) ?? 1;
  const explicitQuantity = positiveNumber(line.quantity);
  const allocationPct = positiveNumber(line.allocationPct);
  const quantity = explicitQuantity ?? (allocationPct !== null ? (accountValue * Math.min(100, allocationPct) / 100) / currentPrice : null);
  if (quantity === null || quantity <= 0) return null;
  const entryPrice = positiveNumber(line.costBasis) ?? currentPrice;
  const riskPct = riskPercent(line.riskProfile);
  const stopLoss = riskPct === null ? null : entryPrice * (1 - riskPct);
  const targetPrice = opportunity?.target ?? (riskPct === null ? null : entryPrice * (1 + riskPct * 2));
  return {
    close_reason: null,
    closed_at: null,
    current_price: currentPrice,
    entry_price: entryPrice,
    entry_status: "manual_portfolio_lab",
    exit_price: null,
    final_decision: "MANUAL_PORTFOLIO_LAB",
    id: `manual-portfolio-${symbol}-${index}`,
    opened_at: new Date(0).toISOString(),
    quantity,
    rating: "RESEARCH",
    realized_pnl: null,
    recommendation_quality: "RESEARCH",
    return_pct: null,
    setup_type: "manual_portfolio",
    status: "OPEN",
    stop_loss: stopLoss,
    symbol,
    target_price: targetPrice,
    unrealized_pnl: (currentPrice - entryPrice) * quantity,
  };
}

function riskPercent(profile: ManualRiskProfile): number | null {
  if (profile === "low") return 0.06;
  if (profile === "medium") return 0.10;
  if (profile === "high") return 0.16;
  return null;
}

function lineHint(line: ManualPortfolioLine, opportunityMap: Map<string, OpportunityViewModel>, accountValue: number): string {
  const symbol = line.symbol.trim().toUpperCase();
  if (!symbol) return "Add a symbol to model scenario exposure.";
  const opportunity = opportunityMap.get(symbol) ?? null;
  const price = positiveNumber(opportunity?.price) ?? positiveNumber(line.costBasis);
  const qty = positiveNumber(line.quantity);
  const allocationPct = positiveNumber(line.allocationPct);
  if (!opportunity) return `${symbol} will use manual exposure only until scanner context is available.`;
  if (qty !== null && price !== null) return `${symbol} modeled value ${formatMoney(qty * price, 0)} using current context.`;
  if (allocationPct !== null && price !== null) return `${symbol} allocation models about ${formatNumber((accountValue * allocationPct / 100) / price, 2)} shares from current context.`;
  return `${symbol} scanner context found. Add quantity or allocation percent to include it.`;
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function LabInput({ label, numeric = false, onChange, placeholder, value }: { label: string; numeric?: boolean; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
      <input
        className="mt-1 h-10 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-violet-300/60"
        inputMode={numeric ? "decimal" : "text"}
        onChange={(event) => onChange(numeric ? event.currentTarget.value.replace(/[^0-9.]/g, "") : event.currentTarget.value.toUpperCase())}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono font-semibold text-slate-100">{value}</div>
    </div>
  );
}
