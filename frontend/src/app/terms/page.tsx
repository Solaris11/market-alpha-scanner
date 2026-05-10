import type { Metadata } from "next";
import { LegalMarketingPage } from "@/components/marketing/LegalMarketingPage";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/terms", {
  title: "Terms of Service — TradeVeto",
  description: "TradeVeto terms for research-only market intelligence, subscriptions, simulations, alerts, AI explanations, and user responsibility.",
});

export default function TermsPage() {
  return (
    <LegalMarketingPage eyebrow="Terms" title="Terms of Service">
      <p>TradeVeto provides market research, signal summaries, paper simulation, and risk-planning tools. It does not provide brokerage, investment advisory, tax, legal, or fiduciary services.</p>
      <p>You are responsible for evaluating all information before making any trading or investment decision. You agree not to treat any signal, score, simulator output, alert, or dashboard label as a guaranteed outcome or personalized financial advice.</p>
      <p>Public strategy proof, replay studies, and AI-generated explanations are educational research features. They may be incomplete, stale, or wrong and should be independently evaluated.</p>
      <p>Access may be limited, suspended, or changed to protect the service, users, or data providers. Billing terms will be presented before any paid subscription is activated.</p>
    </LegalMarketingPage>
  );
}
