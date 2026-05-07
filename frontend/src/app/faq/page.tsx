import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/faq", {
  title: "FAQ — TradeVeto",
  description: "Frequently asked questions about TradeVeto, an AI-powered market intelligence and decision-support system.",
});

const faqs = [
  ["Is TradeVeto financial advice?", "No. It is research and education software. It does not provide personalized investment advice, brokerage services, or guaranteed outcomes."],
  ["Is this a trading bot?", "No. TradeVeto does not place trades. It helps you evaluate whether a setup is worth researching, watching, avoiding, or waiting on."],
  ["What does Daily Action do?", "Daily Action summarizes the current market state into one clear action so the app does not push conflicting trade messages."],
  ["Why does the product often say WAIT?", "The product is designed to reduce overtrading. If market conditions are poor, stale, overheated, or too risky, the correct action can be no trade."],
  ["What happens after beta?", "The planned premium price is $20/month. Beta access is focused on early feedback and product quality before wider launch."],
  ["Can I cancel?", "Yes. Subscription management is handled through Stripe Billing Portal when billing is enabled."],
] as const;

export default function FaqPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="Short answers for traders evaluating whether TradeVeto fits their workflow." eyebrow="FAQ" title="Built for research, discipline, and risk awareness." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4">
          {faqs.map(([question, answer]) => (
            <MarketingCard key={question}>
              <h2 className="text-lg font-semibold text-white">{question}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{answer}</p>
            </MarketingCard>
          ))}
        </div>
        <div className="mt-12 text-center">
          <PrimaryCta>Open App</PrimaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
