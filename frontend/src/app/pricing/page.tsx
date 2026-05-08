import type { Metadata } from "next";
import { MarketingCard, MarketingShell, PrimaryCta, SecondaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/pricing", {
  title: "Pricing — TradeVeto",
  description: "TradeVeto closed beta pricing preview. $20/month for premium AI-powered market intelligence with optional beta trial and promo support. Not financial advice.",
});

const included = ["AI market terminal", "Daily Action", "Ranked research previews", "Risk engine", "Paper simulation", "Alerts", "Premium research view"];
const betaNotes = ["Optional Stripe trial support", "Promo-code compatible checkout", "Cancel through Stripe anytime", "No broker execution or financial advice"];
const billingTrust = [
  ["Trial visibility", "If a beta trial is enabled, Stripe shows the trial end date before confirmation."],
  ["Promo transparency", "Promo-code discounts are applied in Stripe checkout and reflected before payment."],
  ["Renewal clarity", "The renewal amount and billing cadence are visible before the subscription starts."],
  ["Cancellation control", "Users can cancel or manage billing in Stripe without contacting support."],
] as const;

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader copy="Closed beta pricing is intentionally simple. Early users help shape the product while Stripe handles trials, promo codes, renewal visibility, and cancellation." eyebrow="Closed Beta Pricing" title="$20/month Premium after any beta trial." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <MarketingCard>
            <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">Beta</div>
            <h2 className="mt-5 text-3xl font-semibold text-white">Research preview</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">Free beta users can explore the WAIT-first workflow and understand how vetoes, confidence, and readiness work before upgrading.</p>
            <div className="mt-6">
              <SecondaryCta>Open App</SecondaryCta>
            </div>
          </MarketingCard>
          <MarketingCard className="border-emerald-300/25 bg-emerald-300/[0.055]">
            <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Early adopter Premium</div>
            <div className="mt-5 text-5xl font-black text-white">$20<span className="text-lg font-semibold text-slate-400">/month</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-300">Premium unlocks full research context, ranked setups, alerts, simulations, and decision intelligence. Stripe shows trial, discount, renewal, and cancellation details before confirmation.</p>
            <ul className="mt-6 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {included.map((item) => (
                <li className="rounded-xl border border-white/10 bg-black/15 px-3 py-2" key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
              {betaNotes.map((item) => (
                <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-2" key={item}>{item}</div>
              ))}
            </div>
            <div className="mt-6">
              <PrimaryCta>Join Beta</PrimaryCta>
            </div>
          </MarketingCard>
        </div>
        <div className="mx-auto mt-6 grid max-w-5xl gap-3 md:grid-cols-4">
          {billingTrust.map(([title, copy]) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={title}>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">{title}</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
