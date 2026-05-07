import type { Metadata } from "next";
import { LegalMarketingPage } from "@/components/marketing/LegalMarketingPage";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/risk-disclosure", {
  title: "Risk Disclosure — TradeVeto",
});

export default function RiskDisclosurePage() {
  return (
    <LegalMarketingPage eyebrow="Risk Disclosure" title="Trading Risk Disclosure">
      <p>Trading and investing involve substantial risk, including loss of principal. TradeVeto outputs are research signals and simulations, not financial advice or instructions to trade.</p>
      <p>Scanner data can be delayed, stale, incomplete, incorrect, or affected by third-party data provider issues. Past performance, backtests, score ranges, and paper simulations do not guarantee future results.</p>
      <p>You should size positions, manage risk, and decide whether to trade based on your own judgment, constraints, and professional advice where appropriate.</p>
    </LegalMarketingPage>
  );
}
