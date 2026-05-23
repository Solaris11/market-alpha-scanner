import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/how-it-works", {
  title: "How It Works — TradeVeto",
  description: "How TradeVeto turns market data, verified context, evidence depth, scoring, replay, and AI explanations into WAIT-first research decisions.",
});

const steps = [
  ["1", "Read the current market", "The scanner evaluates symbols across trend, momentum, volatility, macro alignment, data quality, and risk context."],
  ["2", "Check the evidence", "Historical depth, forward outcomes, analog quality, shock memory, and verified event context determine how mature the claim is."],
  ["3", "Apply vetoes", "Weak confirmation, stale data, poor timing, hostile regime pressure, or elevated fragility can force WAIT or AVOID."],
  ["4", "Explain the decision", "AI summaries are allowed to explain structured TradeVeto data, but not invent prices, news, or probabilities."],
  ["5", "Replay and simulate", "Replay, paper, and strategy-proof workflows help evaluate process quality without real-money execution."],
] as const;

const proofBoundaries = [
  ["Statistics own the numbers", "Scores, returns, drawdowns, shock counts, and evidence labels come from rules-based systems."],
  ["LLM explains, not decides", "AI text summarizes structured inputs and falls back to plain system copy when validation fails."],
  ["Public pages are limited", "Public intelligence pages do not expose premium trade-plan fields or direct action instructions."],
] as const;

export default function HowItWorksPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="The product is intentionally structured as Market → Evidence → Decision → Explanation, so research starts with whether action is justified at all." eyebrow="How it works" title="From noisy data to one disciplined decision." />
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-2">
          {steps.map(([step, title, copy]) => (
            <MarketingCard key={step}>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-black text-cyan-100">{step}</div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
                </div>
              </div>
            </MarketingCard>
          ))}
        </div>
        <div className="mx-auto mt-8 grid max-w-6xl gap-4 md:grid-cols-3">
          {proofBoundaries.map(([title, copy]) => (
            <MarketingCard key={title}>
              <div className="text-base font-semibold text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
            </MarketingCard>
          ))}
        </div>
        <div className="mt-12 text-center">
          <PrimaryCta>Join Early Access</PrimaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
