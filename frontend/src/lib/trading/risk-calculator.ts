export type TradeRiskInput = {
  accountSize: number;
  riskPct: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
};

export type TradeRiskResult = {
  quantity: number;
  maxLoss: number;
  potentialProfit: number;
  riskRewardRatio: number;
  accountRiskPct: number;
  violatesRisk: boolean;
};

export function calculateTradeRisk(input: TradeRiskInput): TradeRiskResult {
  const riskBudget = input.accountSize * (input.riskPct / 100);
  const riskPerShare = Math.max(0, input.entryPrice - input.stopPrice);
  const quantity = riskPerShare > 0 ? Math.floor(riskBudget / riskPerShare) : 0;
  const maxLoss = quantity * riskPerShare;
  const potentialProfit = quantity * Math.max(0, input.targetPrice - input.entryPrice);
  const riskRewardRatio = maxLoss > 0 ? potentialProfit / maxLoss : 0;
  const accountRiskPct = input.accountSize > 0 ? (maxLoss / input.accountSize) * 100 : 0;
  return {
    quantity,
    maxLoss,
    potentialProfit,
    riskRewardRatio,
    accountRiskPct,
    violatesRisk: accountRiskPct > input.riskPct || quantity <= 0,
  };
}
