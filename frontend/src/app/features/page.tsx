import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/features", {
  title: "Features — Market Alpha Scanner",
  description: "Explore Market Alpha Scanner features for AI trading research, risk-aware decision support, paper trading, alerts, and premium market scanning.",
});

const featureGroups = [
  ["AI trading terminal", "A focused workspace that turns market data into a clear research decision instead of another crowded dashboard."],
  ["Daily Action", "One dominant action for the day: wait, watch, buy as a research signal, or avoid."],
  ["Opportunities scanner", "Ranked market setups with premium research details gated server-side."],
  ["Symbol analysis", "Trend, momentum, volatility, market regime, and risk context in one symbol view."],
  ["Risk engine", "Rules and veto states designed to slow down oversized or emotionally driven trades."],
  ["Paper trading", "Simulate decisions and track discipline without connecting a brokerage account."],
  ["Alerts", "DB-backed user alerts for important account and signal events."],
  ["Premium research view", "Full scanner intelligence for subscribers without exposing premium data to public previews."],
] as const;

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="Market Alpha Scanner is built around decision quality: fewer impulsive trades, clearer risk, and a single workflow for research." eyebrow="Features" title="A trading research system for disciplined decisions." />
        <div className="mx-auto mt-12 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureGroups.map(([title, copy]) => (
            <MarketingCard key={title}>
              <div className="text-lg font-semibold text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
            </MarketingCard>
          ))}
        </div>
        <div className="mt-12 text-center">
          <PrimaryCta>Start Free</PrimaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
