"use client";

import { useMemo, useState } from "react";
import { calculateTradeRisk } from "@/lib/trading/risk-calculator";

export function useTradeSimulator(defaults: { accountSize: number; riskPct: number; entry: number; stop: number; target: number }) {
  const [accountSize, setAccountSize] = useState(defaults.accountSize);
  const [riskPct, setRiskPct] = useState(defaults.riskPct);
  const [entryPrice, setEntryPrice] = useState(defaults.entry);
  const [stopPrice, setStopPrice] = useState(defaults.stop);
  const [targetPrice, setTargetPrice] = useState(defaults.target);
  const result = useMemo(
    () => calculateTradeRisk({ accountSize, riskPct, entryPrice, stopPrice, targetPrice }),
    [accountSize, entryPrice, riskPct, stopPrice, targetPrice],
  );
  return {
    state: { accountSize, riskPct, entryPrice, stopPrice, targetPrice },
    setters: { setAccountSize, setRiskPct, setEntryPrice, setStopPrice, setTargetPrice },
    result,
  };
}
