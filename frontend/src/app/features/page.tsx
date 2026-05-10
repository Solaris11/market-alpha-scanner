import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/features", {
  title: "Features — TradeVeto",
  description: "Explore TradeVeto features for WAIT-first AI market intelligence, evidence-aware research, shock analysis, replay, paper simulation, alerts, and premium decision support.",
});

const featureGroups = [
  ["AI market terminal", "A focused workspace that turns market data into a clear research decision instead of another crowded dashboard."],
  ["Daily Action", "One dominant action for the day: wait, watch, research, or avoid."],
  ["Opportunity filter", "Ranked market setups with premium research details gated server-side."],
  ["Symbol analysis", "Trend, momentum, volatility, market regime, and risk context in one symbol view."],
  ["Shock research", "Historical large-move behavior, chase risk, and two-sided volatility context without direct trade instructions."],
  ["Evidence maturity", "Labels show when history, outcomes, analogs, and calibration evidence are limited or stronger."],
  ["Replay intelligence", "Historical state playback helps users see what the system knew before or after a move."],
  ["Verified event context", "Macro, earnings, filings, and company events are only summarized when trusted-source context exists."],
  ["Paper simulation", "Simulate decisions and track discipline without connecting a brokerage account."],
  ["Alerts", "DB-backed user alerts for important account and signal events."],
  ["Premium research view", "Full scanner intelligence for subscribers without exposing premium data to public previews."],
  ["Beta feedback loop", "Lightweight feedback and admin analytics help identify confusion, retention signals, and product gaps without invasive tracking."],
] as const;

const notClaims = [
  "Not a broker, trading bot, or real-money execution system.",
  "Not a promise that AI can predict markets.",
  "Not a replacement for user judgment, risk controls, or professional advice.",
] as const;

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="TradeVeto is built around decision quality: fewer impulsive trades, clearer risk, visible evidence, and a single workflow for research. The closed beta focuses on trust, learning, and disciplined product feedback." eyebrow="Closed Beta Features" title="A market intelligence system for disciplined decisions." />
        <div className="mx-auto mt-12 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureGroups.map(([title, copy]) => (
            <MarketingCard key={title}>
              <div className="text-lg font-semibold text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
            </MarketingCard>
          ))}
        </div>
        <div className="mx-auto mt-8 grid max-w-5xl gap-3 md:grid-cols-3">
          {notClaims.map((item) => (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.055] p-4 text-sm leading-6 text-amber-50/90" key={item}>
              {item}
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <PrimaryCta>Start Free</PrimaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
