import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingConversionCtas } from "@/components/marketing/LandingConversionCtas";
import { MarketingCard, MarketingShell, SectionHeader } from "@/components/marketing/MarketingShell";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { PricingActionCard } from "@/components/pricing/PricingActionCard";
import { PricingConversionCta } from "@/components/pricing/PricingConversionCta";
import { BRAND_NAME, BRAND_PRODUCT_DESCRIPTION, BRAND_TAGLINE } from "@/lib/brand";
import { marketingMetadata, softwareApplicationJsonLd } from "@/lib/marketing-seo";

export const dynamic = "force-dynamic";
export const metadata = marketingMetadata("/", {
  title: "TradeVeto — AI Market Intelligence for Disciplined Traders",
  description:
    "TradeVeto helps traders avoid low-quality setups with AI veto logic, readiness scoring, confidence, and regime-aware research. Research only. Not financial advice.",
});

const heroSignals = [
  ["WAIT-first", "Designed to slow decisions down when the setup is incomplete."],
  ["Veto-aware", "Risk, confidence, stale data, and regime conditions can block weak setups."],
  ["Research only", "No broker execution, no guaranteed outcomes, no financial advice."],
] as const;

const primaryScreenshot = {
  caption: "Terminal view",
  copy: "Daily action, market context, scanner freshness, and WAIT-first decision framing.",
  src: "/marketing/screenshots/terminal-desktop.png",
  title: "Command center for disciplined market research",
} as const;

const productScreenshots = [
  {
    caption: "Opportunity intelligence",
    copy: "Ranked research previews, unlock paths, and context explaining why WAIT can be the right answer.",
    src: "/marketing/screenshots/opportunities-desktop.png",
    title: "Find setups without chasing every mover",
  },
  {
    caption: "History and evidence",
    copy: "Filtered history views help users understand observations, score movement, and available evidence.",
    src: "/marketing/screenshots/history-desktop.png",
    title: "Track what the scanner has actually seen",
  },
] as const;

const features = [
  ["AI Veto Engine", "Blocks weak setups when risk, confidence, data quality, or regime conditions are not aligned."],
  ["Readiness + Confidence", "Every symbol gets context for signal strength, data quality, and how close the setup is to being research-ready."],
  ["Regime-Aware Intelligence", "Market state matters. TradeVeto adjusts interpretation when conditions are overheated, neutral, or risk-off."],
  ["Opportunity Intelligence", "Surface higher-quality research candidates without treating every price move as a reason to act."],
  ["History + Calibration", "Signals are tracked over time so users can understand how evidence is growing and where confidence is still early."],
  ["Alerts + Watchlist", "Monitor important symbols and conditions without staring at charts all day."],
] as const;

const workflowSteps = [
  ["1", "Scan the market", "Market data, trend, momentum, volume, risk, and regime context are normalized into a research view."],
  ["2", "Apply vetoes", "Weak confirmation, stale data, poor risk/reward, or hostile regime conditions can block a setup before it reaches the user."],
  ["3", "Explain the decision", "TradeVeto shows positives, negatives, readiness, confidence, and what would need to improve."],
  ["4", "Monitor patiently", "Watchlists, alerts, and history help users follow conditions without forcing unnecessary action."],
] as const;

const comparisonRows = [
  ["WAIT-first philosophy", "Core workflow", "Often focused on more alerts"],
  ["Veto explanations", "Risk and data-quality context", "Usually manual interpretation"],
  ["Readiness / confidence", "Visible per setup", "Often raw indicators only"],
  ["Regime context", "Market-state-aware research", "Often static filters"],
  ["Risk-first filtering", "Designed to reduce low-quality action", "Often optimized for more signals"],
  ["Research-only positioning", "Explicitly not advice or execution", "Varies by tool"],
  ["Feedback loop", "Closed-beta feedback and support surfaces", "Depends on platform"],
] as const;

const trustItems = [
  ["Research only", "TradeVeto does not provide financial advice, broker execution, or guaranteed outcomes."],
  ["Built to filter", "The product is intentionally comfortable saying WAIT, AVOID, or not enough evidence yet."],
  ["Transparent logic", "Decision reasons, vetoes, readiness, and confidence are shown as context, not hidden black-box claims."],
  ["Operational readiness", "Monitoring, R2 backups, support workflows, and health checks are part of the beta operating model."],
] as const;

const edgeItems = [
  ["Veto logic", "Weak setup blockers are visible instead of hidden in a final number."],
  ["WAIT clarity", "No-trade decisions are explained as part of the workflow."],
  ["Readiness score", "Confidence, data quality, risk, and vetoes are compressed into context users can understand."],
  ["Regime impact", "Market state is shown as part of setup interpretation."],
  ["History filters", "Users can inspect what history is available and why ranges may look similar when data is new."],
  ["Beta feedback loop", "Confusing signals and product friction are captured for support and prioritization."],
] as const;

const faqs = [
  ["Is TradeVeto financial advice?", "No. TradeVeto is research and education software. It does not tell users what to buy or sell."],
  ["Why does it often say WAIT?", "WAIT is intentional. The system is built to reduce low-conviction action when setup, risk, or market conditions are incomplete."],
  ["What does Veto mean?", "A veto is a risk or quality blocker. Examples include weak confirmation, stale data, poor risk/reward, or mismatched market regime."],
  ["Why are there few BUY signals?", "TradeVeto is designed to prefer missing marginal setups over encouraging weak trades. Fewer signals can be a feature, not a bug."],
  ["What is readiness?", "Readiness summarizes how close a setup is to being research-ready after confidence, vetoes, data quality, and risk context are considered."],
  ["What is confidence?", "Confidence reflects signal strength and data quality. It is not a prediction."],
  ["Can I cancel anytime?", "Subscription management is handled through Stripe, including renewal visibility and cancellation controls."],
  ["Is this for day trading?", "TradeVeto is built for research workflows and discipline. It is not a high-frequency execution tool or trading bot."],
  ["What data does TradeVeto use?", "The scanner uses market data providers with fallback behavior and records data-quality context when available."],
] as const;

export default async function HomePage() {
  const host = (await headers()).get("host") ?? "";
  if (host.startsWith("app.")) redirect("/terminal");

  return (
    <MarketingShell>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }} type="application/ld+json" />
      <section className="landing-hero-sweep px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <MarketingReveal>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">AI market intelligence</div>
              <div className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">Closed beta</div>
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">{BRAND_TAGLINE}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {BRAND_NAME} combines AI market intelligence, readiness scoring, confidence, veto logic, and regime-aware analysis to help users avoid low-quality trades.
            </p>
            <div className="mt-8">
              <LandingConversionCtas />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroSignals.map(([title, copy]) => (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={title}>
                  <div className="text-sm font-black text-white">{title}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{copy}</p>
                </div>
              ))}
            </div>
          </MarketingReveal>

          <MarketingReveal className="relative">
            <div className="absolute -inset-8 rounded-full bg-cyan-400/10 blur-3xl" />
            <ScreenshotFrame
              caption="Live product preview"
              src="/marketing/screenshots/terminal-desktop.png"
              title="A terminal that is allowed to say no trade today"
            />
          </MarketingReveal>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            copy="Most trading tools create more alerts. TradeVeto is built around the opposite idea: filter weak setups, show why, and make patience visible."
            eyebrow="Why TradeVeto"
            title="Trade less. Trade smarter. Know when to wait."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {["Avoid low-quality setups.", "Understand the veto.", "Monitor without overreacting."].map((item) => (
              <MarketingCard key={item}>
                <div className="text-lg font-semibold text-white">{item}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">Built for disciplined research workflows, not signal spam or trade hype.</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            copy="The core workflow is intentionally conservative. A setup has to survive data quality, risk, confidence, and regime checks before it becomes research-ready."
            eyebrow="Decision workflow"
            title="From noisy market data to a clear research decision."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {workflowSteps.map(([number, title, copy]) => (
              <MarketingCard className="relative overflow-hidden" key={title}>
                <div className="absolute right-4 top-3 text-5xl font-black text-cyan-300/10">{number}</div>
                <div className="relative">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-sm font-black text-cyan-100">{number}</div>
                  <div className="mt-5 text-lg font-semibold text-white">{title}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
                </div>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            copy="Real closed-beta product screens show the terminal, opportunity preview, history, and mobile experience. Premium data remains gated until access is confirmed."
            eyebrow="Product preview"
            title="Decision intelligence that users can inspect."
          />
          <div className="mt-10 grid gap-6">
            <ScreenshotFrame
              caption={primaryScreenshot.caption}
              copy={primaryScreenshot.copy}
              src={primaryScreenshot.src}
              title={primaryScreenshot.title}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              {productScreenshots.map((shot) => (
                <ScreenshotFrame caption={shot.caption} copy={shot.copy} key={shot.src} src={shot.src} title={shot.title} />
              ))}
            </div>
            <MarketingReveal className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:grid-cols-[0.72fr_1fr] md:items-center">
              <div className="overflow-hidden rounded-[1.5rem] border border-cyan-300/20 bg-slate-950 shadow-2xl shadow-cyan-950/20">
                <img alt="TradeVeto mobile terminal preview" className="mx-auto max-h-[620px] w-auto" loading="lazy" src="/marketing/screenshots/terminal-mobile.png" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Mobile preview</div>
                <h3 className="mt-3 text-3xl font-semibold text-white">Compact enough for mobile, complete enough for research.</h3>
                <p className="mt-4 text-sm leading-6 text-slate-400">The mobile workflow keeps primary actions close while preserving the same risk-aware language and access controls.</p>
              </div>
            </MarketingReveal>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" id="features">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Features" title="Built around disciplined decision quality." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, copy]) => (
              <MarketingCard key={title}>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{title}</div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{copy}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeader
            copy="This is a category comparison, not a claim about every individual competitor. TradeVeto is optimized for disciplined filtering instead of more trade prompts."
            eyebrow="Comparison"
            title="TradeVeto vs. generic screeners and signal feeds"
          />
          <MarketingReveal className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-white/10 bg-white/[0.035] text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <div className="p-4">Capability</div>
              <div className="p-4 text-cyan-100">TradeVeto</div>
              <div className="p-4">Generic screeners / feeds</div>
            </div>
            {comparisonRows.map(([capability, tradeveto, generic]) => (
              <div className="grid grid-cols-1 border-b border-white/10 last:border-b-0 md:grid-cols-[1.1fr_1fr_1fr]" key={capability}>
                <div className="p-4 text-sm font-semibold text-white">{capability}</div>
                <div className="p-4 text-sm leading-6 text-cyan-100">{tradeveto}</div>
                <div className="p-4 text-sm leading-6 text-slate-400">{generic}</div>
              </div>
            ))}
          </MarketingReveal>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" id="pricing">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <PricingActionCard>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Early adopter Premium</div>
            <div className="mt-4 text-5xl font-black text-white">$20<span className="text-lg font-semibold text-slate-400">/month</span></div>
            <p className="mt-4 text-sm leading-6 text-slate-300">Closed beta pricing is intentionally simple. Stripe shows trial, promo, renewal, and cancellation details before confirmation.</p>
            <ul className="mt-6 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {["Full research context", "Ranked setups", "Alerts and watchlist", "Paper simulation", "Decision intelligence", "History and calibration"].map((item) => (
                <li className="rounded-xl border border-white/10 bg-black/15 px-3 py-2" key={item}>{item}</li>
              ))}
            </ul>
          </PricingActionCard>
          <MarketingCard>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Premium conversion</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">Start with research access. Upgrade only when the value is clear.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">Anonymous visitors are routed through signup first. Free users go straight to Stripe checkout. Premium users manage access without duplicate checkout sessions.</p>
            <div className="mt-6">
              <PricingConversionCta />
            </div>
          </MarketingCard>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Trust model" title="Built to earn trust by being clear about limits." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {trustItems.map(([title, copy]) => (
              <MarketingCard key={title}>
                <div className="text-base font-semibold text-white">{title}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <MarketingReveal className="mx-auto max-w-5xl rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.055] p-8 text-center shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Closed beta traders</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Help shape a decision system that respects risk.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-300">Real testimonials will only be shown after real beta feedback exists. For now, the beta program is focused on learning where users trust the system, where they feel confused, and what improves decision discipline.</p>
        </MarketingReveal>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            copy="A quick view of what makes the product different. These are product capabilities, not performance promises."
            eyebrow="Edge at a glance"
            title="Built to make lower-quality action harder."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {edgeItems.map(([title, copy]) => (
              <MarketingCard key={title}>
                <div className="text-base font-semibold text-white">{title}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" id="reviews">
        <MarketingReveal className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Beta feedback, not fake testimonials</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Built with early users, measured honestly.</h2>
              <p className="mt-4 text-base leading-7 text-slate-300">TradeVeto will only publish real testimonials after real users provide them. During closed beta, the focus is product learning: clarity, trust, retention, and whether WAIT-first guidance reduces impulsive workflows.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Clarity", "Do users understand vetoes and WAIT decisions?"],
                ["Trust", "Do explanations match the data users see?"],
                ["Retention", "Do users return after no-trade days?"],
              ].map(([title, copy]) => (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4" key={title}>
                  <div className="text-sm font-black text-cyan-100">{title}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </MarketingReveal>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" id="faq">
        <div className="mx-auto max-w-5xl">
          <SectionHeader eyebrow="FAQ" title="Common closed-beta questions" />
          <div className="mt-10 grid gap-3">
            {faqs.map(([question, answer]) => (
              <MarketingCard key={question}>
                <div className="text-base font-semibold text-white">{question}</div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{answer}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <MarketingReveal className="mx-auto max-w-6xl rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/[0.12] to-cyan-300/[0.06] p-8 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Beta access</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">Ready to filter weak setups before they become decisions?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{BRAND_PRODUCT_DESCRIPTION}</p>
          </div>
          <div className="mt-6 md:mt-0">
            <LandingConversionCtas />
          </div>
        </MarketingReveal>
      </section>
    </MarketingShell>
  );
}

function ScreenshotFrame({ caption, copy, src, title }: { caption: string; copy?: string; src: string; title: string }) {
  return (
    <MarketingReveal className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/75 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{caption}</div>
          <div className="mt-1 text-sm font-semibold text-white">{title}</div>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
        </div>
      </div>
      <img alt={`TradeVeto ${caption.toLowerCase()} screenshot`} className="w-full bg-slate-950 object-cover" loading="lazy" src={src} />
      {copy ? <p className="border-t border-white/10 px-4 py-3 text-sm leading-6 text-slate-400">{copy}</p> : null}
    </MarketingReveal>
  );
}
