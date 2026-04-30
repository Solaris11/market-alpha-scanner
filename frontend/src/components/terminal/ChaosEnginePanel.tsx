"use client";

import { useEffect, useRef, useState } from "react";
import type { TradePlanEngine } from "@/hooks/useTradePlanEngine";
import { formatMoney } from "@/lib/ui/formatters";

type ChaosResult = {
  reasons: string[];
  riskLabel: "Risky" | "Watch" | "Safe";
  riskReduction: number;
  stopSafetyScore: number;
  suggestedStop: number;
};

export function ChaosEnginePanel({ engine }: { engine: TradePlanEngine }) {
  const [hasRun, setHasRun] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<ChaosResult | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  function runStressTest() {
    setIsTesting(true);
    setHasRun(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setResult(buildChaosResult(engine));
      setIsTesting(false);
    }, 1000);
  }

  const tone = result?.riskLabel === "Safe" ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : result?.riskLabel === "Watch" ? "border-amber-300/25 bg-amber-400/10 text-amber-100" : "border-rose-300/25 bg-rose-500/10 text-rose-100";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 shadow-xl shadow-black/20 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">Chaos Engine</div>
          <div className="mt-1 text-sm font-semibold text-slate-50">Stop Stress Test</div>
        </div>
        <button
          className="rounded-full border border-rose-300/35 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-400/15 disabled:cursor-wait disabled:opacity-60"
          disabled={isTesting}
          onClick={runStressTest}
          type="button"
        >
          {isTesting ? "Testing..." : "Run Stress Test"}
        </button>
      </div>

      {!hasRun ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Stress the current stop against normal price vibration before placing a paper order.</p>
      ) : null}

      {isTesting ? <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs text-slate-300">Running volatility scenarios...</div> : null}

      {result && !isTesting ? (
        <div className={`mt-3 rounded-xl border px-3 py-3 text-xs leading-5 ${tone}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">{result.riskLabel === "Safe" ? "Stop appears outside normal noise." : "Your stop is close to volatility noise."}</div>
            <div className="rounded-full border border-current/30 px-2 py-0.5 font-mono">{result.stopSafetyScore}/100</div>
          </div>
          <div className="mt-2">Suggested stop: {formatMoney(result.suggestedStop)}</div>
          <div>Risk reduced by {result.riskReduction}% with adjusted sizing.</div>
          <ul className="mt-2 space-y-1 text-slate-300">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function buildChaosResult(engine: TradePlanEngine): ChaosResult {
  const entry = positiveNumber(engine.state.entryPrice) ?? positiveNumber(engine.state.currentPrice) ?? 100;
  const stop = positiveNumber(engine.state.stopLoss) ?? entry * 0.96;
  const current = positiveNumber(engine.state.currentPrice) ?? entry;
  const riskPerShare = Math.max(0.01, entry - stop);
  const volatilityNoise = Math.max(current * 0.012, riskPerShare * 0.8);
  const safetyRatio = riskPerShare / volatilityNoise;
  const stopSafetyScore = clamp(Math.round(safetyRatio * 45), 18, 92);
  const riskLabel = stopSafetyScore >= 72 ? "Safe" : stopSafetyScore >= 48 ? "Watch" : "Risky";
  const suggestedRisk = Math.max(riskPerShare, volatilityNoise * 1.35);
  const suggestedStop = Math.max(0.01, entry - suggestedRisk);
  const riskReduction = riskLabel === "Safe" ? 24 : riskLabel === "Watch" ? 42 : 60;

  return {
    reasons: [
      "This is a probabilistic stress test against normal volatility ranges.",
      riskLabel === "Safe" ? "The current stop has reasonable room for routine noise." : "The current stop may be inside routine price vibration.",
      "Position size should be recalculated if the stop changes.",
    ],
    riskLabel,
    riskReduction,
    stopSafetyScore,
    suggestedStop,
  };
}

function positiveNumber(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
