import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  Gauge,
  LineChart,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
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
    "TradeVeto is WAIT-first AI market intelligence for evidence-aware market research, shock analysis, replayable simulations, and disciplined opportunity review. Not financial advice.",
});

const heroSignals = [
  ["WAIT-first", "Designed to slow decisions down when the setup is incomplete."],
  ["Veto-aware", "Risk, confidence, stale data, and regime conditions can block weak setups."],
  ["Research only", "No broker execution, no guaranteed outcomes, no financial advice."],
] as const;

type MarketingTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

const toneClasses: Record<MarketingTone, { border: string; bg: string; glow: string; text: string }> = {
  amber: { bg: "bg-amber-300/10", border: "border-amber-300/25", glow: "shadow-amber-950/20", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-300/10", border: "border-cyan-300/25", glow: "shadow-cyan-950/20", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-300/10", border: "border-emerald-300/25", glow: "shadow-emerald-950/20", text: "text-emerald-100" },
  rose: { bg: "bg-rose-300/10", border: "border-rose-300/25", glow: "shadow-rose-950/20", text: "text-rose-100" },
  violet: { bg: "bg-violet-300/10", border: "border-violet-300/25", glow: "shadow-violet-950/20", text: "text-violet-100" },
};

const toneGradient: Record<MarketingTone, string> = {
  amber: "from-amber-300 to-yellow-200",
  cyan: "from-cyan-300 to-sky-300",
  emerald: "from-emerald-300 to-teal-200",
  rose: "from-rose-300 to-pink-300",
  violet: "from-violet-300 to-fuchsia-300",
};

const focusTiles: Array<{ copy: string; Icon: LucideIcon; title: string; tone: MarketingTone }> = [
  { copy: "Regime and freshness", Icon: Activity, title: "Market State", tone: "cyan" },
  { copy: "Quality scores that matter", Icon: Target, title: "Decision Quality", tone: "emerald" },
  { copy: "High-quality setups", Icon: Radar, title: "Best Opportunities", tone: "violet" },
  { copy: "Elevated-risk alerts", Icon: AlertTriangle, title: "Dangerous Now", tone: "amber" },
  { copy: "Key context shifts", Icon: CalendarClock, title: "What Changed", tone: "rose" },
  { copy: "Monitoring with confidence", Icon: Gauge, title: "Watchlist Signals", tone: "cyan" },
];

const featureVisuals: Array<{ Icon: LucideIcon; tone: MarketingTone }> = [
  { Icon: ShieldCheck, tone: "cyan" },
  { Icon: Gauge, tone: "emerald" },
  { Icon: Activity, tone: "violet" },
  { Icon: Radar, tone: "amber" },
  { Icon: BookOpenCheck, tone: "rose" },
  { Icon: CalendarClock, tone: "cyan" },
];

const proofVisuals: Array<{ Icon: LucideIcon; tone: MarketingTone }> = [
  { Icon: BarChart3, tone: "cyan" },
  { Icon: BookOpenCheck, tone: "violet" },
  { Icon: LineChart, tone: "emerald" },
  { Icon: BrainCircuit, tone: "amber" },
];

const edgeVisuals: Array<{ Icon: LucideIcon; tone: MarketingTone }> = [
  { Icon: ShieldCheck, tone: "rose" },
  { Icon: CalendarClock, tone: "amber" },
  { Icon: Gauge, tone: "cyan" },
  { Icon: Activity, tone: "violet" },
  { Icon: BarChart3, tone: "emerald" },
  { Icon: BookOpenCheck, tone: "cyan" },
];

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
  ["Shock + Asymmetry Research", "Large-move history, chase risk, and two-sided volatility are separated from core buy/sell-style signals."],
  ["Replay + Calibration", "Historical state, forward outcomes, and score reliability help users see what the system knew at the time."],
  ["Verified Event Context", "Macro, earnings, filings, and trusted-source events are treated as evidence inputs, not invented narratives."],
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
  ["Proof over hype", "Simulated strategy performance, replay studies, and evidence maturity are shown with limitations instead of promises."],
  ["Source-backed context", "Verified event context must come from configured trusted sources or the app says it is unavailable."],
  ["Operational readiness", "Monitoring, backups, support workflows, and health checks are part of the beta operating model."],
] as const;

const edgeItems = [
  ["Veto logic", "Weak setup blockers are visible instead of hidden in a final number."],
  ["WAIT clarity", "No-trade decisions are explained as part of the workflow."],
  ["Readiness score", "Confidence, data quality, risk, and vetoes are compressed into context users can understand."],
  ["Regime impact", "Market state is shown as part of setup interpretation."],
  ["Evidence depth", "Users can see when evidence is limited, developing, mature, or high confidence."],
  ["Replayable proof", "Strategy simulations and replay studies show both wins and uncomfortable drawdowns."],
] as const;

const proofItems = [
  ["Evidence maturity", "TradeVeto labels when a setup has shallow history, limited outcomes, or stronger historical coverage."],
  ["Decision replay", "Replay views are designed to show what the system knew before a move, not rewrite the story afterward."],
  ["Simulated strategies", "Public strategy performance uses research-only simulated sleeves with benchmark and drawdown context."],
  ["LLM boundaries", "AI summaries explain deterministic packets. They are not allowed to invent prices, events, or probabilities."],
] as const;

const faqs = [
  ["Is TradeVeto financial advice?", "No. TradeVeto is research and education software. It does not tell users what to buy or sell."],
  ["Why does it often say WAIT?", "WAIT is intentional. The system is built to reduce low-conviction action when setup, risk, or market conditions are incomplete."],
  ["What does Veto mean?", "A veto is a risk or quality blocker. Examples include weak confirmation, stale data, poor risk/reward, or mismatched market regime."],
  ["Why are there few BUY signals?", "TradeVeto is designed to prefer missing marginal setups over encouraging weak trades. Fewer signals can be a feature, not a bug."],
  ["What is readiness?", "Readiness summarizes how close a setup is to being research-ready after confidence, vetoes, data quality, and risk context are considered."],
  ["What is confidence?", "Confidence reflects signal strength and data quality. It is not a prediction."],
  ["What is shock intelligence?", "It is a high-volatility research layer that studies historical large moves, follow-through, reversal, and chase risk. It is not a core buy signal."],
  ["What is public strategy proof?", "It is simulated, replayable research evidence with benchmark and drawdown context. It is not real-money execution or a promise of future returns."],
  ["How does TradeVeto use news or macro events?", "Only trusted, configured event sources can support public event context. If verified context is missing, TradeVeto should say that plainly."],
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
              {BRAND_NAME} combines WAIT-first market intelligence, evidence maturity, verified event context, shock research, replay, and regime-aware analysis to help users review opportunities without turning every mover into a trade idea.
            </p>
            <div className="mt-8">
              <LandingConversionCtas />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {focusTiles.map((tile) => (
                <VisualFocusTile key={tile.title} tile={tile} />
              ))}
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroSignals.map(([title, copy]) => (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg shadow-black/20" key={title}>
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
            copy="Most trading tools create more alerts. TradeVeto is built around the opposite idea: filter weak setups, show why, publish limitations, and make patience visible."
            eyebrow="Why TradeVeto"
            title="Trade less. Trade smarter. Know when to wait."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {["Avoid low-quality setups.", "Understand the veto.", "Monitor without overreacting."].map((item, index) => {
              const Icon = [ShieldCheck, BrainCircuit, Radar][index] ?? ShieldCheck;
              return (
                <MarketingCard key={item}>
                  <MarketingIcon Icon={Icon} tone={index === 0 ? "rose" : index === 1 ? "cyan" : "emerald"} />
                  <div className="mt-5 text-lg font-semibold text-white">{item}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Built for disciplined research workflows, not signal spam or trade hype.</p>
                </MarketingCard>
              );
            })}
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

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            copy="TradeVeto should earn trust by showing evidence quality, replayable history, and boundaries before asking users to believe a score."
            eyebrow="Proof model"
            title="Public trust starts with what the system can prove."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {proofItems.map(([title, copy], index) => {
              const visual = proofVisuals[index % proofVisuals.length] ?? { Icon: BarChart3, tone: "cyan" as const };
              return (
                <MarketingCard key={title}>
                  <MarketingIcon Icon={visual.Icon} tone={visual.tone} />
                  <div className="mt-5 text-base font-semibold text-white">{title}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
                </MarketingCard>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8" id="features">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Features" title="Built around disciplined decision quality." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, copy], index) => {
              const visual = featureVisuals[index % featureVisuals.length] ?? { Icon: ShieldCheck, tone: "cyan" as const };
              return (
                <MarketingCard key={title}>
                  <MarketingIcon Icon={visual.Icon} tone={visual.tone} />
                  <div className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{title}</div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{copy}</p>
                  <MetricStory tone={visual.tone} value={72 - index * 4} />
                </MarketingCard>
              );
            })}
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
            <p className="mt-4 text-sm leading-6 text-slate-400">Anonymous visitors are routed through signup first. Free users can preview the WAIT-first workflow before Stripe checkout. Premium users manage access without duplicate checkout sessions.</p>
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
            {trustItems.map(([title, copy], index) => {
              const Icon = [BookOpenCheck, ShieldCheck, BrainCircuit, BarChart3, CalendarClock, Gauge][index % 6] ?? BookOpenCheck;
              const tone: MarketingTone = index % 3 === 0 ? "cyan" : index % 3 === 1 ? "emerald" : "violet";
              return (
                <MarketingCard key={title}>
                  <MarketingIcon Icon={Icon} tone={tone} />
                  <div className="mt-5 text-base font-semibold text-white">{title}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
                </MarketingCard>
              );
            })}
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
            {edgeItems.map(([title, copy], index) => {
              const visual = edgeVisuals[index % edgeVisuals.length] ?? { Icon: ShieldCheck, tone: "cyan" as const };
              return (
                <MarketingCard key={title}>
                  <MarketingIcon Icon={visual.Icon} tone={visual.tone} />
                  <div className="mt-5 text-base font-semibold text-white">{title}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
                </MarketingCard>
              );
            })}
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
        <MarketingReveal className="visual-card mx-auto max-w-6xl overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/[0.12] to-cyan-300/[0.06] p-8 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">Beta access</div>
            <h2 className="mt-3 text-3xl font-semibold text-white">Ready to filter weak setups before they become decisions?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{BRAND_PRODUCT_DESCRIPTION}</p>
            <div className="mt-6">
              <LandingConversionCtas />
            </div>
          </div>
          <div className="mt-8 shrink-0 md:mt-0">
            <div className="rounded-[2rem] border border-cyan-300/25 bg-slate-950/70 p-3 shadow-2xl shadow-cyan-950/25">
              <img
                alt="TradeVeto register QR code"
                className="h-36 w-36 rounded-2xl object-cover sm:h-44 sm:w-44"
                loading="eager"
                src="/marketing/qr/tradeveto-register-qr-social-square.png"
              />
              <div className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Scan to join</div>
            </div>
          </div>
        </MarketingReveal>
      </section>
    </MarketingShell>
  );
}

function VisualFocusTile({ tile }: { tile: { copy: string; Icon: LucideIcon; title: string; tone: MarketingTone } }) {
  const tone = toneClasses[tile.tone];
  return (
    <div className={`visual-card flex min-w-0 items-center gap-3 rounded-2xl border ${tone.border} ${tone.bg} p-3 shadow-lg ${tone.glow}`}>
      <MarketingIcon Icon={tile.Icon} compact tone={tile.tone} />
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{tile.title}</div>
        <div className="mt-1 truncate text-xs font-semibold text-slate-100">{tile.copy}</div>
      </div>
    </div>
  );
}

function MarketingIcon({ compact = false, Icon, tone }: { compact?: boolean; Icon: LucideIcon; tone: MarketingTone }) {
  const classes = toneClasses[tone];
  return (
    <div
      className={`visual-icon-tile relative ${compact ? "h-10 w-10" : "h-12 w-12"} ${classes.border} ${classes.bg} ${classes.text} shadow-lg ${classes.glow}`}
    >
      <Icon aria-hidden="true" className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={2.2} />
      {!compact ? <Sparkles aria-hidden="true" className="absolute -right-1 -top-1 h-3.5 w-3.5 text-white/50" /> : null}
    </div>
  );
}

function MetricStory({ tone, value }: { tone: MarketingTone; value: number }) {
  const bounded = Math.max(18, Math.min(92, value));
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <span>Signal clarity</span>
        <span className={toneClasses[tone].text}>{bounded}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full bg-gradient-to-r ${toneGradient[tone]}`} style={{ width: `${bounded}%` }} />
      </div>
    </div>
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
