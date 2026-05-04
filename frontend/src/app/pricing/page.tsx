import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SecondaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/pricing", {
  title: "Pricing — Market Alpha Scanner",
  description: "Market Alpha Scanner beta pricing preview. $20/month after beta for premium AI-powered trading research. Not financial advice.",
});

const included = ["AI trading terminal", "Daily Action", "Ranked scanner previews", "Risk engine", "Paper trading", "Alerts", "Premium research view"];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="Simple pricing is planned after beta. The beta period is focused on product quality, feedback, and disciplined decision workflows." eyebrow="Pricing" title="$20/month after beta." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <MarketingCard>
            <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">Beta</div>
            <h2 className="mt-5 text-3xl font-semibold text-white">Limited free access</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">Free beta users can explore the workflow and understand the decision system before upgrading.</p>
            <div className="mt-6">
              <SecondaryCta>Open App</SecondaryCta>
            </div>
          </MarketingCard>
          <MarketingCard className="border-emerald-300/25 bg-emerald-300/[0.055]">
            <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Premium preview</div>
            <div className="mt-5 text-5xl font-black text-white">$20<span className="text-lg font-semibold text-slate-400">/month</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-300">Premium unlocks full trade plans, ranked setups, alerts, simulations, and scanner intelligence when public billing is enabled.</p>
            <ul className="mt-6 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {included.map((item) => (
                <li className="rounded-xl border border-white/10 bg-black/15 px-3 py-2" key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-6">
              <PrimaryCta>Join Beta</PrimaryCta>
            </div>
          </MarketingCard>
        </div>
      </section>
    </MarketingShell>
  );
}
