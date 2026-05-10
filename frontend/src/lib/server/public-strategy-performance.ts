import "server-only";

import { getPerformanceData } from "@/lib/scanner-data";
import { buildPublicStrategyPerformanceSystem } from "@/lib/trading/public-strategy-performance";
import type { PublicStrategyPerformanceSystem } from "@/lib/trading/public-strategy-performance";
import { buildSimulatedAiPortfolioSystem } from "@/lib/trading/simulated-ai-portfolio";
import { buildStrategyIntelligenceSystem } from "@/lib/trading/strategy-intelligence";

export async function getPublicStrategyPerformanceSystem(): Promise<PublicStrategyPerformanceSystem> {
  const performance = await getPerformanceData({ forwardTailRows: 5000 }).catch(() => null);
  const forwardRows = performance?.forwardReturns.rows ?? [];
  const strategySystem = buildStrategyIntelligenceSystem({ forwardRows });
  const portfolioSystem = buildSimulatedAiPortfolioSystem({ forwardRows, strategySystem });
  return buildPublicStrategyPerformanceSystem({ portfolioSystem, strategySystem });
}
