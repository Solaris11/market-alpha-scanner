import type { Metadata } from "next";
import { LegalMarketingPage } from "@/components/marketing/LegalMarketingPage";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/terms", {
  title: "Terms of Service — Market Alpha Scanner",
});

export default function TermsPage() {
  return (
    <LegalMarketingPage eyebrow="Terms" title="Terms of Service">
      <p>Market Alpha Scanner provides market research, scanner summaries, paper simulation, and risk-planning tools. It does not provide brokerage, investment advisory, tax, legal, or fiduciary services.</p>
      <p>You are responsible for evaluating all information before making any trading or investment decision. You agree not to treat any signal, score, simulator output, alert, or dashboard label as a guaranteed outcome or personalized financial advice.</p>
      <p>Access may be limited, suspended, or changed to protect the service, users, or data providers. Billing terms will be presented before any paid subscription is activated.</p>
    </LegalMarketingPage>
  );
}
