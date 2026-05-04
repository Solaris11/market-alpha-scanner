import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/how-it-works", {
  title: "How It Works — Market Alpha Scanner",
  description: "How Market Alpha Scanner analyzes trend, momentum, volatility, risk/reward, macro alignment, and market regime to support clearer trading research decisions.",
});

const steps = [
  ["1", "Scan the market", "The scanner evaluates symbols across trend, momentum, volatility, macro alignment, and risk context."],
  ["2", "Score the setup", "The system ranks opportunities and suppresses action when market conditions or risk rules are unfavorable."],
  ["3", "Show one decision", "Daily Action becomes the authority: WAIT, WATCH, BUY as a research signal, or AVOID."],
  ["4", "Simulate before action", "What-if and paper workflows help you test risk before making any real-world decision."],
] as const;

export default function HowItWorksPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="The product is intentionally structured as Market → Decision → UI, so research starts with whether action is justified at all." eyebrow="How it works" title="From noisy data to one disciplined decision." />
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
        <div className="mt-12 text-center">
          <PrimaryCta>Start Free</PrimaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
