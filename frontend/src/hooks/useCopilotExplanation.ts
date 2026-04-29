"use client";

import { useMemo, useState } from "react";
import type { RankingRow } from "@/lib/types";
import { buildCopilotRecommendation } from "@/lib/trading/signal-explainer";

export function useCopilotExplanation(signal: RankingRow, defaults = { accountBalance: 10000, riskPct: 2 }) {
  const [accountBalance, setAccountBalance] = useState(defaults.accountBalance);
  const [riskPct, setRiskPct] = useState(defaults.riskPct);
  const recommendation = useMemo(
    () => buildCopilotRecommendation({ accountBalance, riskPct, signal }),
    [accountBalance, riskPct, signal],
  );
  return { accountBalance, riskPct, setAccountBalance, setRiskPct, recommendation };
}
