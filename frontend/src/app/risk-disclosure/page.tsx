import type { Metadata } from "next";
import { LegalMarketingPage } from "@/components/marketing/LegalMarketingPage";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/risk-disclosure", {
  title: "Risk Disclosure — TradeVeto",
  description: "TradeVeto risk disclosure for research-only market intelligence, simulations, scanner data, historical evidence, and no-advice boundaries.",
});

export default function RiskDisclosurePage() {
  return (
    <LegalMarketingPage eyebrow="Risk Disclosure" title="Trading Risk Disclosure">
      <p>Trading and investing involve substantial risk, including loss of principal. TradeVeto outputs are research signals and simulations, not financial advice or instructions to trade.</p>
      <p>Scanner data can be delayed, stale, incomplete, incorrect, or affected by third-party data provider issues. Past performance, backtests, score ranges, and paper simulations do not guarantee future results.</p>
      <p>AI explanations summarize structured TradeVeto data and may be incomplete or wrong. Verified events, strategy simulations, replay studies, and evidence labels are research aids, not predictions.</p>
      <p>You should size positions, manage risk, and decide whether to trade based on your own judgment, constraints, and professional advice where appropriate.</p>
    </LegalMarketingPage>
  );
}
