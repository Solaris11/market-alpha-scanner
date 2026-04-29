"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  cashBalance?: number | null;
};

type OpenPaperResponse = {
  error?: string;
  ok: boolean;
};

function numberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

function ratioText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}R`;
}

export function ManualPaperTradeForm({ cashBalance = null }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const estimate = useMemo(() => {
    const entry = numberValue(entryPrice);
    const qty = numberValue(quantity);
    const stop = numberValue(stopLoss);
    const target = numberValue(targetPrice);
    const hasPositionInputs = entry !== null && entry > 0 && qty !== null && qty > 0;
    const validTradeMath = hasPositionInputs && stop !== null && target !== null && entry > stop && target > entry;
    const estimatedCost = validTradeMath ? entry * qty : null;
    const maxLoss = validTradeMath ? (entry - stop) * qty : null;
    const potentialGain = validTradeMath ? (target - entry) * qty : null;
    const riskRewardRatio = validTradeMath ? (target - entry) / (entry - stop) : null;
    return { entry, estimatedCost, maxLoss, potentialGain, qty, riskRewardRatio, stop, target, validTradeMath };
  }, [entryPrice, quantity, stopLoss, symbol, targetPrice]);

  const validationError = useMemo(() => {
    if (!symbol.trim()) return "Symbol is required.";
    if (estimate.entry === null || estimate.entry <= 0) return "Entry price must be greater than zero.";
    if (estimate.qty === null || estimate.qty <= 0) return "Quantity must be greater than zero.";
    if (stopLoss.trim() && (estimate.stop === null || estimate.stop <= 0)) return "Stop loss must be greater than zero.";
    if (targetPrice.trim() && (estimate.target === null || estimate.target <= 0)) return "Target price must be greater than zero.";
    if (estimate.stop !== null && estimate.stop >= estimate.entry) return "Stop loss must be below entry price.";
    if (estimate.target !== null && estimate.target <= estimate.entry) return "Target price must be above entry price.";
    if (cashBalance !== null && estimate.estimatedCost !== null && estimate.estimatedCost > cashBalance) return "Estimated cost exceeds available paper cash.";
    return "";
  }, [cashBalance, estimate.entry, estimate.estimatedCost, estimate.qty, estimate.stop, estimate.target, stopLoss, symbol, targetPrice]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setError("");
    setMessage("");
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/paper/open", {
        body: JSON.stringify({
          entry_price: estimate.entry,
          quantity: estimate.qty,
          side: "buy",
          stop_loss: estimate.stop,
          symbol,
          target_price: estimate.target,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as OpenPaperResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Failed to open paper trade.");
      setMessage(`Opened paper trade for ${symbol.trim().toUpperCase()}.`);
      setSymbol("");
      setEntryPrice("");
      setQuantity("");
      setStopLoss("");
      setTargetPrice("");
      setAttemptedSubmit(false);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to open paper trade.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Manual Paper Trade</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Test your own idea without real execution.</h2>
          <p className="mt-1 text-sm text-slate-400">Paper simulation only. No real order will be placed.</p>
          <p className="mt-1 text-xs text-slate-500">Enter values to calculate cost, risk, reward, and R/R.</p>
        </div>
        {cashBalance !== null ? <div className="font-mono text-xs text-slate-400">Cash {money(cashBalance)}</div> : null}
      </div>

      <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]" onSubmit={submit}>
        <TradeInput label="Symbol" onChange={setSymbol} placeholder="e.g. TSM" value={symbol} />
        <TradeInput label="Entry price" numeric onChange={setEntryPrice} placeholder="e.g. 392" value={entryPrice} />
        <TradeInput label="Quantity" numeric onChange={setQuantity} placeholder="e.g. 10" value={quantity} />
        <TradeInput label="Stop loss" numeric onChange={setStopLoss} placeholder="e.g. 380" value={stopLoss} />
        <TradeInput label="Target price" numeric onChange={setTargetPrice} placeholder="e.g. 420" value={targetPrice} />
        <button
          className="h-10 self-end rounded-full bg-cyan-300 px-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-950 transition-all hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Opening..." : "Open Paper Trade"}
        </button>
      </form>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <Estimate label="Estimated Cost" value={money(estimate.estimatedCost)} />
        <Estimate label="Max Loss" tone="risk" value={money(estimate.maxLoss)} />
        <Estimate label="Potential Gain" tone="reward" value={money(estimate.potentialGain)} />
        <Estimate label="Risk/Reward" value={ratioText(estimate.riskRewardRatio)} />
      </div>

      {attemptedSubmit && validationError && !error ? <div className="mt-3 text-xs text-amber-200">{validationError}</div> : null}
      {error ? <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
      {message ? <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">{message}</div> : null}
    </section>
  );
}

function TradeInput({ label, numeric = false, onChange, placeholder, value }: { label: string; numeric?: boolean; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <label className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
      <input
        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/60"
        inputMode={numeric ? "decimal" : "text"}
        onChange={(event) => onChange(numeric ? event.currentTarget.value.replace(/[^0-9.]/g, "") : event.currentTarget.value.toUpperCase())}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function Estimate({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "reward" | "risk"; value: string }) {
  const color = tone === "risk" ? "text-rose-200" : tone === "reward" ? "text-emerald-200" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
