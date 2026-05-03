"use client";

import { useEffect, useState } from "react";
import { useExecutionTicket } from "@/hooks/useExecutionTicket";
import type { TradePlanEngine } from "@/hooks/useTradePlanEngine";
import type { OrderSide, OrderType, TimeInForce } from "@/lib/trading/order-types";
import { formatMoney } from "@/lib/ui/formatters";
import { GlassPanel } from "./ui/GlassPanel";
import { SectionTitle } from "./ui/SectionTitle";

export function ExecutionTicket({ engine, symbol }: { engine: TradePlanEngine; symbol: string }) {
  const baseExecutionAllowed = engine.validity.isCalculable && !engine.validity.isBlocked;
  const riskStatus = engine.riskEvaluation.status;
  const isRiskVeto = riskStatus === "VETO";
  const [overrideAccepted, setOverrideAccepted] = useState(false);
  const riskOverrideUnlocked = isRiskVeto && engine.riskProfile.allowOverride && overrideAccepted;
  const executionAllowed = baseExecutionAllowed && (!isRiskVeto || riskOverrideUnlocked);
  const qty = baseExecutionAllowed ? engine.metrics.positionSize : 0;
  const limitPrice = engine.state.entryPrice ?? undefined;
  const stopPrice = engine.state.stopLoss ?? undefined;
  const ticket = useExecutionTicket({ symbol, qty, limitPrice, stopPrice });
  const [confirming, setConfirming] = useState(false);
  const s = ticket.state;

  useEffect(() => {
    setOverrideAccepted(false);
  }, [engine.riskEvaluation.reasons, riskStatus]);

  if (!baseExecutionAllowed) {
    return (
      <GlassPanel className="p-5">
        <SectionTitle eyebrow="Execution Ready" title="Mock Order Ticket" meta="blocked" />
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          {engine.validity.message || (engine.validity.isBlocked ? "Execution blocked by system decision" : "No valid trade setup.")}
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className={`p-5 transition-all duration-200 ${riskStatus === "VETO" ? "border-rose-300/30 shadow-[0_0_34px_rgba(244,63,94,0.16)]" : riskStatus === "WARNING" ? "border-amber-300/30 shadow-[0_0_28px_rgba(251,191,36,0.12)]" : ""}`}>
      <SectionTitle eyebrow="Execution Ready" title="Mock Order Ticket" meta={riskOverrideUnlocked ? "Manual override" : riskStatus === "VETO" ? "locked" : "no real orders"} />
      <div className="mt-3 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
        Protected by Risk Rules
      </div>
      <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
        Paper simulation only. This is not financial advice and no live broker order will be placed.
      </div>
      {riskStatus !== "OK" ? <ExecutionRiskBanner allowOverride={engine.riskProfile.allowOverride} checked={overrideAccepted} onChange={setOverrideAccepted} reasons={engine.riskEvaluation.reasons} status={riskStatus} /> : null}
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
        <Select label="Side" value={s.side} onChange={(value) => ticket.setters.setSide(value as OrderSide)} options={["buy", "sell"]} />
        <Select label="Type" value={s.type} onChange={(value) => ticket.setters.setType(value as OrderType)} options={["market", "limit", "stop", "stop_limit"]} />
        <Input label="Qty" value={s.qty} onChange={ticket.setters.setQty} />
        <Select label="TIF" value={s.timeInForce} onChange={(value) => ticket.setters.setTimeInForce(value as TimeInForce)} options={["day", "gtc"]} />
        <Input label="Limit" value={s.limitPrice} onChange={ticket.setters.setLimitPrice} />
        <Input label="Stop" value={s.stopPrice} onChange={ticket.setters.setStopPrice} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
        <span className={s.manualQtyOverride ? "text-amber-200" : "text-cyan-100"}>{s.manualQtyOverride ? "Manual override" : "Synced from risk plan"}</span>
        <button className="rounded-full border border-white/10 px-3 py-1 text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100" onClick={ticket.setters.resyncQty} type="button">Resync</button>
      </div>
      {engine.validity.isCalculable ? <div className="mt-2 text-xs text-slate-500">Entry {formatMoney(engine.state.entryPrice)} / Stop {formatMoney(engine.state.stopLoss)}</div> : null}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
        <span className="text-slate-400">Mode</span>
        <div className="flex gap-2">
          <button className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-100" onClick={() => ticket.setters.setMode("paper")}>Paper</button>
          <button className="cursor-not-allowed rounded-full bg-slate-800 px-3 py-1 text-slate-500" title="Live broker execution is not enabled yet." disabled>Live</button>
        </div>
      </div>
      <pre className="mt-4 max-h-44 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300">{JSON.stringify(ticket.payload, null, 2)}</pre>
      {ticket.validation.errors.length ? <div className="mt-2 text-xs text-rose-300">{ticket.validation.errors.join(" ")}</div> : null}
      <button
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isRiskVeto ? "bg-rose-400 text-slate-950 hover:bg-rose-300" : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
        }`}
        disabled={!executionAllowed || !ticket.validation.valid}
        onClick={() => setConfirming(true)}
      >
        {isRiskVeto && !riskOverrideUnlocked ? <LockIcon /> : null}
        {isRiskVeto ? (riskOverrideUnlocked ? "Review Manual Override" : "Locked by Risk Rules") : "Review Mock Order"}
      </button>
      {confirming ? <ConfirmModal onCancel={() => setConfirming(false)} onConfirm={async () => { await ticket.submit(); setConfirming(false); }} payload={ticket.payload} /> : null}
      {ticket.result ? <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-xs text-emerald-100">{ticket.result.message} ID: {ticket.result.orderId}</div> : null}
    </GlassPanel>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<input className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 font-mono text-slate-100" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label>{label}<select className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-slate-100" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function ExecutionRiskBanner({
  allowOverride,
  checked,
  onChange,
  reasons,
  status,
}: {
  allowOverride: boolean;
  checked: boolean;
  onChange: (value: boolean) => void;
  reasons: string[];
  status: "WARNING" | "VETO";
}) {
  const isVeto = status === "VETO";
  return (
    <div className={`mt-4 rounded-2xl border p-4 text-sm leading-6 transition-all duration-200 ${isVeto ? "border-rose-300/30 bg-rose-500/10 text-rose-100 shadow-[0_0_28px_rgba(244,63,94,0.16)]" : "border-amber-300/30 bg-amber-400/10 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.12)]"}`}>
      <div className="flex items-center gap-2 font-bold">
        {isVeto ? <LockIcon /> : null}
        {isVeto ? "Execution locked by AI risk veto" : "Risk warning: execution allowed"}
      </div>
      {reasons.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {reasons.map((reason) => <li key={reason}>- {reason}</li>)}
        </ul>
      ) : null}
      {isVeto && allowOverride ? (
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-950/20 px-3 py-2 text-xs font-semibold">
            <input checked={checked} className="accent-rose-300" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
            I understand the risk
          </label>
          {checked ? <div className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100">Manual override</div> : null}
        </div>
      ) : null}
      {isVeto && !allowOverride ? <div className="mt-3 text-xs font-semibold">Override is disabled in your risk profile.</div> : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <rect height="11" rx="2" width="14" x="5" y="11" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

function ConfirmModal({ payload, onCancel, onConfirm }: { payload: unknown; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="text-lg font-semibold text-slate-50">Confirm Mock Execution</div>
        <p className="mt-2 text-sm text-amber-100">Mock execution only. No real order will be placed.</p>
        <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-slate-300">{JSON.stringify(payload, null, 2)}</pre>
        <div className="mt-4 flex justify-end gap-2"><button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300" onClick={onCancel}>Cancel</button><button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950" onClick={onConfirm}>Submit Mock</button></div>
      </div>
    </div>
  );
}
