import type { Metadata } from "next";
import { EarlyAccessWaitlistForm } from "@/components/marketing/EarlyAccessWaitlistForm";
import { MarketingCard, MarketingShell, SectionHeader } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/waitlist", {
  title: "Founding Member Waitlist — TradeVeto",
  description: "Join the TradeVeto founding member waitlist for controlled paid early access. Research-only market intelligence. Not financial advice.",
});

const waitlistNotes = [
  ["Controlled access", "If early access is paused or capped later, waitlist requests give operators an auditable queue without exposing private account data."],
  ["Research only", "TradeVeto does not provide financial advice, trading automation, broker execution, or guaranteed intelligence."],
  ["Customer learning", "Founding member signals help prioritize onboarding, scanner, watchlist, replay, alert, and support improvements."],
] as const;

export default function WaitlistPage() {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionHeader
          copy="Early access is open for founding members, but the waitlist remains available if an operator pauses signup, limits a cohort, or needs to prioritize high-fit research workflows."
          eyebrow="Founding Member Waitlist"
          title="Join the controlled early-access queue."
        />
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <MarketingCard>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Waitlist request</div>
            <h2 className="mt-3 text-2xl font-semibold text-white">Tell us where TradeVeto should be useful first.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This creates a support-backed founding member request for operator review. It is not a trading signal, financial advice path, or broker onboarding flow.
            </p>
          </MarketingCard>
          <MarketingCard>
            <EarlyAccessWaitlistForm />
          </MarketingCard>
        </div>
        <div className="mx-auto mt-6 grid max-w-6xl gap-3 md:grid-cols-3">
          {waitlistNotes.map(([title, copy]) => (
            <MarketingCard key={title}>
              <div className="text-base font-semibold text-white">{title}</div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
            </MarketingCard>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
