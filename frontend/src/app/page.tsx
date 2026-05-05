import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MarketingCard, MarketingShell, PrimaryCta, SecondaryCta, SectionHeader } from "@/components/marketing/MarketingShell";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { marketingMetadata, softwareApplicationJsonLd } from "@/lib/marketing-seo";

export const dynamic = "force-dynamic";
export const metadata = marketingMetadata("/");

const decisionBadges = [
  ["WAIT", "Market conditions do not justify action.", "border-amber-300/35 bg-amber-300/10 text-amber-100"],
  ["WATCH", "Setup is forming, but not ready.", "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"],
  ["RESEARCH", "Complete setup context with acceptable risk.", "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"],
  ["AVOID", "Risk or quality is not acceptable.", "border-rose-300/35 bg-rose-300/10 text-rose-100"],
] as const;

const features = ["AI trading terminal", "Daily Action", "Opportunities scanner", "Symbol analysis", "Risk engine", "Paper trading", "Alerts", "Premium research view"];
const analysisLayers = [
  ["Trend", "76%"],
  ["Momentum", "84%"],
  ["Volatility", "58%"],
  ["Risk / Reward", "69%"],
  ["Macro Alignment", "73%"],
  ["Market Regime", "64%"],
] as const;

export default async function HomePage() {
  const host = (await headers()).get("host") ?? "";
  if (host.startsWith("app.")) redirect("/terminal");

  return (
    <MarketingShell>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }} type="application/ld+json" />
      <section className="landing-hero-sweep px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <MarketingReveal>
            <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">AI trading research platform</div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">Stop Overtrading. Start Making Better Decisions.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Market Alpha Scanner is an AI-powered trading research platform that helps you know when to wait, when to avoid bad setups, and when a trade is worth watching.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCta>Start Free</PrimaryCta>
              <SecondaryCta>Open App</SecondaryCta>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-400">Not financial advice. Not a trading bot. A decision-support system.</p>
          </MarketingReveal>

          <MarketingReveal className="relative">
            <div className="absolute -inset-8 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Today&apos;s Action</div>
                  <div className="mt-1 text-3xl font-black text-amber-100">WAIT</div>
                </div>
                <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">No Trade Today</div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">Market is overheated. The research system is waiting for conditions to improve.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {decisionBadges.map(([label, copy, style]) => (
                  <div className={`landing-badge-loop rounded-2xl border p-4 ${style}`} key={label}>
                    <div className="text-lg font-black">{label}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-300">{copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </MarketingReveal>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader copy="Most traders do not need more noise. They need a system that slows them down before weak setups become expensive mistakes." eyebrow="Problem" title="Most traders lose money because they trade too often." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {["They chase noise.", "They ignore risk.", "They enter weak setups."].map((item) => (
              <MarketingCard key={item}>
                <div className="text-lg font-semibold text-white">{item}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">Market Alpha Scanner is built to reduce bad decisions before they become trades.</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader copy="The platform analyzes trend, momentum, volatility, risk/reward, macro alignment, and market regime, then compresses the result into one clear decision." eyebrow="Solution" title="Market → Decision → Discipline" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analysisLayers.map(([item, width]) => (
              <MarketingCard key={item}>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">{item}</div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width }} />
                </div>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Features" title="Built for trading discipline, not hype." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <MarketingCard key={feature}>
                <div className="text-base font-semibold text-white">{feature}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">Research-first workflow designed to clarify risk and reduce impulsive decisions.</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <MarketingReveal className="mx-auto max-w-5xl rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.055] p-8 text-center shadow-2xl shadow-emerald-950/20 backdrop-blur-xl">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Why different</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Most trading tools push more trades.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-300">Market Alpha Scanner is designed to stop unnecessary trades. The goal is discipline, not hype. The best trade is often no trade.</p>
        </MarketingReveal>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <MarketingCard>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Pricing preview</div>
            <div className="mt-4 text-5xl font-black text-white">$20<span className="text-lg font-semibold text-slate-400">/month</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-300">After beta. During beta, early users get limited free access, premium trial access, and prioritized feedback loops.</p>
          </MarketingCard>
          <MarketingCard>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Beta access</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">Join the beta. Start building trading discipline.</h2>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <PrimaryCta>Join Beta</PrimaryCta>
              <SecondaryCta>Open App</SecondaryCta>
            </div>
          </MarketingCard>
        </div>
      </section>
    </MarketingShell>
  );
}
