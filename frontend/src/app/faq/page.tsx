import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/faq", {
  title: "FAQ — TradeVeto",
  description: "Frequently asked questions about TradeVeto, WAIT-first market intelligence, evidence depth, shock research, replay, simulations, billing, and risk boundaries.",
});

const faqs = [
  ["Is TradeVeto financial advice?", "No. It is research and education software. It does not provide personalized investment advice, brokerage services, or guaranteed outcomes."],
  ["Is this a trading bot?", "No. TradeVeto does not place trades. It helps you evaluate whether a setup is worth researching, watching, avoiding, or waiting on."],
  ["What does Daily Action do?", "Daily Action summarizes the current market state into one clear action so the app does not push conflicting trade messages."],
  ["Why does the product often say WAIT?", "The product is designed to reduce overtrading. If market conditions are poor, stale, overheated, or too risky, the correct action can be no trade."],
  ["What makes TradeVeto different from a screener?", "A screener usually lists symbols that match filters. TradeVeto tries to explain decision quality: what matters now, why a setup may fail, how much evidence exists, and when waiting is rational."],
  ["What is evidence maturity?", "Evidence maturity summarizes whether a setup has enough historical depth, analogs, and later outcome history to support stronger confidence."],
  ["What is shock intelligence?", "Shock intelligence studies historical large upside/downside moves, two-sided volatility, chase risk, and follow-through. It is speculative research context, not a core buy signal."],
  ["How does TradeVeto handle news and events?", "Verified event context must come from trusted configured sources. If the system lacks verified source-backed context, it should say so instead of inventing a catalyst."],
  ["What is public strategy performance?", "It is simulated, research-only strategy evidence with benchmark and drawdown visibility. It is not real-money trading and does not guarantee future returns."],
  ["Can AI override the scores?", "No. The rules-based and statistical engines own scores, rankings, and metrics. AI is used to explain structured data, not to invent facts or make trade decisions."],
  ["What happens after early access?", "Founding Member pricing starts at $20/month. Early access is focused on real customer feedback, product quality, retention learning, and operational confidence before wider launch."],
  ["How do founding trials or promo codes work?", "If enabled for your account, Stripe will show the trial length, discount, renewal price, and billing date before checkout is confirmed."],
  ["Can I cancel?", "Yes. Subscription management is handled through Stripe Billing Portal. If you cancel during a trial, Stripe shows when access will end and whether billing will begin."],
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
