import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  CalendarClock,
  Eye,
  FlaskConical,
  Gauge,
  Hourglass,
  LineChart,
  MessageCircle,
  Radar,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LandingConversionCtas } from "@/components/marketing/LandingConversionCtas";
import { MarketingCard, MarketingShell, SectionHeader } from "@/components/marketing/MarketingShell";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { PricingActionCard } from "@/components/pricing/PricingActionCard";
import { PricingConversionCta } from "@/components/pricing/PricingConversionCta";
import { IconInsightRail, PosterGauge, ScoreFactorStrip, VisualMetricRail, type VisualTone } from "@/components/visual/MiniVisuals";
import { BRAND_NAME, BRAND_PRODUCT_DESCRIPTION } from "@/lib/brand";
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

type PosterFeature = {
  accentWord: string;
  eyebrow: string;
  iconItems: Array<{ copy: string; Icon: LucideIcon; label: string; tone: VisualTone }>;
  narrative: string;
  score: number;
  subtitle: string;
  title: string;
  tone: VisualTone;
  visual: "candles" | "gauge" | "bars";
};

const posterFeatures: PosterFeature[] = [
  {
    accentWord: "Now",
    eyebrow: "Introducing TradeVeto Features - Part 1",
    iconItems: [
      { copy: "Regime & freshness", Icon: Activity, label: "Market State", tone: "cyan" },
      { copy: "Quality scores", Icon: Target, label: "Decision Quality", tone: "emerald" },
      { copy: "High-quality setups", Icon: Radar, label: "Best Opportunities", tone: "violet" },
      { copy: "Elevated-risk alerts", Icon: AlertTriangle, label: "Dangerous Now", tone: "amber" },
    ],
    narrative: "A unified attention layer that helps users see what changed, what is risky, and what deserves patience.",
    score: 58,
    subtitle: "Focus on what actually matters. Not the noise.",
    title: "What Matters",
    tone: "cyan",
    visual: "bars",
  },
  {
    accentWord: "Assistant",
    eyebrow: "Introducing TradeVeto Features - Part 2",
    iconItems: [
      { copy: "Current regime", Icon: Gauge, label: "Market Regime", tone: "cyan" },
      { copy: "Reward vs risk", Icon: Scale, label: "Risk / Reward", tone: "rose" },
      { copy: "Setup timing", Icon: ShieldCheck, label: "Entry Quality", tone: "emerald" },
      { copy: "Replay context", Icon: BookOpenCheck, label: "Replay", tone: "violet" },
    ],
    narrative: "Explains why a setup is blocked, watched, or research-ready before the user acts.",
    score: 44,
    subtitle: "Understand why. Trade with clarity, not noise.",
    title: "Decision",
    tone: "cyan",
    visual: "gauge",
  },
  {
    accentWord: "Replay",
    eyebrow: "Introducing TradeVeto Features - Part 3",
    iconItems: [
      { copy: "Real ticker context", Icon: Eye, label: "Symbol Context", tone: "cyan" },
      { copy: "Large-move history", Icon: TrendingUp, label: "Replay Proof", tone: "emerald" },
      { copy: "Volatility pressure", Icon: Waves, label: "Risk Pressure", tone: "rose" },
      { copy: "Watch zones", Icon: Hourglass, label: "Why Wait", tone: "amber" },
    ],
    narrative: "Shows what the system saw before a move, then compares the outcome with the original context.",
    score: 72,
    subtitle: "Not just signals. Context.",
    title: "Symbol Intelligence +",
    tone: "violet",
    visual: "candles",
  },
  {
    accentWord: "Intelligence",
    eyebrow: "Introducing TradeVeto Features - Part 4",
    iconItems: [
      { copy: "Large-move risk", Icon: Zap, label: "Volatility", tone: "rose" },
      { copy: "Catalyst pressure", Icon: CalendarClock, label: "Event Risk", tone: "amber" },
      { copy: "Fragile setups", Icon: ShieldAlert, label: "Shock Risk", tone: "rose" },
      { copy: "Avoid chasing", Icon: AlertTriangle, label: "Dangerous", tone: "rose" },
    ],
    narrative: "Separates real asymmetry from noisy moves that only look attractive after the spike.",
    score: 78,
    subtitle: "Not every breakout deserves chasing.",
    title: "Shock",
    tone: "rose",
    visual: "gauge",
  },
  {
    accentWord: "Copilot",
    eyebrow: "Introducing TradeVeto Features - Part 5",
    iconItems: [
      { copy: "Grounded Q&A", Icon: Bot, label: "Ask Why", tone: "violet" },
      { copy: "Context packet", Icon: BrainCircuit, label: "Reasoning", tone: "cyan" },
      { copy: "Follow-up flow", Icon: MessageCircle, label: "Conversation", tone: "emerald" },
      { copy: "Guardrails", Icon: ShieldCheck, label: "Grounded", tone: "cyan" },
    ],
    narrative: "Turns deterministic TradeVeto packets into concise answers without inventing prices, events, or certainty.",
    score: 72,
    subtitle: "Ask why, not just what.",
    title: "Research",
    tone: "violet",
    visual: "bars",
  },
  {
    accentWord: "Labs",
    eyebrow: "Introducing TradeVeto Features - Part 6",
    iconItems: [
      { copy: "Replay-backed", Icon: FlaskConical, label: "Simulations", tone: "violet" },
      { copy: "Drawdown aware", Icon: ShieldAlert, label: "Risk", tone: "rose" },
      { copy: "Scenario testing", Icon: Target, label: "Scenarios", tone: "cyan" },
      { copy: "Performance curve", Icon: LineChart, label: "Strategy", tone: "emerald" },
    ],
    narrative: "Makes simulated strategy behavior visible through performance curves, drawdowns, and regime context.",
    score: 88,
    subtitle: "Study behavior. Not hype.",
    title: "Strategy",
    tone: "violet",
    visual: "candles",
  },
  {
    accentWord: "Alerts",
    eyebrow: "Introducing TradeVeto Features - Part 7",
    iconItems: [
      { copy: "Setup improved", Icon: Eye, label: "Context Alerts", tone: "cyan" },
      { copy: "Risk rising", Icon: AlertTriangle, label: "Risk Review", tone: "amber" },
      { copy: "Large-move watch", Icon: Zap, label: "Shock Watch", tone: "violet" },
      { copy: "Mobile-ready", Icon: BellRing, label: "Push", tone: "emerald" },
    ],
    narrative: "Tracks evolving setups and changing risk so users monitor conditions instead of reacting to every price move.",
    score: 82,
    subtitle: "Monitor the setup, not just the price.",
    title: "Watchlists +",
    tone: "cyan",
    visual: "bars",
  },
  {
    accentWord: "Wait?",
    eyebrow: "Introducing TradeVeto Features - Part 8",
    iconItems: [
      { copy: "Protect capital", Icon: ShieldCheck, label: "Risk First", tone: "amber" },
      { copy: "Be patient", Icon: Hourglass, label: "Patience", tone: "amber" },
      { copy: "Avoid weak setups", Icon: Scale, label: "Balance", tone: "rose" },
      { copy: "Better entries", Icon: Target, label: "Opportunity", tone: "emerald" },
    ],
    narrative: "Shows why patience can be a strategy when confirmation, reward/risk, or regime context is not aligned.",
    score: 27,
    subtitle: "Not every trade deserves risk.",
    title: "Why",
    tone: "amber",
    visual: "gauge",
  },
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
            <h1 className="poster-display-title no-bad-breaks mt-6 max-w-5xl text-4xl sm:text-6xl lg:text-6xl 2xl:text-7xl">
              AI Market <span className="whitespace-nowrap">Intelligence</span>{" "}
              <span className="poster-word-cyan">That</span>{" "}
              <span className="poster-word-cyan">Says</span>{" "}
              <span className="poster-word-cyan whitespace-nowrap">Wait</span>
            </h1>
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

      <FeaturePosterShowcase />

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

function FeaturePosterShowcase() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          copy="The product should feel like a high-signal intelligence system, not a wall of text. These visual modules bring the poster language into the live app: clearer icons, stronger state colors, gauges, bars, sparklines, and QR-ready beta calls to action."
          eyebrow="Visual intelligence system"
          title="Richer market storytelling without losing discipline."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {posterFeatures.map((feature) => (
            <PosterFeatureCard feature={feature} key={`${feature.title}-${feature.accentWord}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PosterFeatureCard({ feature }: { feature: PosterFeature }) {
  return (
    <MarketingReveal className={`poster-panel ${posterPanelClass(feature.tone)} overflow-hidden rounded-[2rem] border p-5 shadow-2xl md:p-6`}>
      <div className="flex flex-col gap-5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">{feature.eyebrow}</div>
          <h3 className="poster-display-title mt-3 text-3xl sm:text-4xl">
            {feature.title} <span className={posterWordClass(feature.tone)}>{feature.accentWord}</span>
          </h3>
          <p className="mt-2 text-lg font-semibold text-slate-200">{feature.subtitle}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{feature.narrative}</p>
        </div>

        <IconInsightRail
          items={feature.iconItems.map((item) => ({
            copy: item.copy,
            icon: <item.Icon className="h-6 w-6" strokeWidth={2.2} />,
            label: item.label,
            tone: item.tone,
          }))}
        />

        <div className="grid gap-4 md:grid-cols-[0.78fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <PosterVisual feature={feature} />
          </div>
          <div className="grid gap-3">
            <VisualMetricRail
              metrics={[
                { label: "Signal clarity", tone: feature.tone, value: feature.score },
                { label: "Risk awareness", tone: feature.tone === "rose" ? "rose" : "amber", value: feature.tone === "amber" ? 84 : 68 },
                { label: "Context depth", tone: "cyan", value: 76 },
              ]}
            />
            <div className="rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.055] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Beta action</div>
              <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="text-base font-black text-white">Join the limited closed beta</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Invite code required. Research-first intelligence, not financial advice.</p>
                </div>
                <img
                  alt="TradeVeto register QR code"
                  className="h-20 w-20 rounded-xl border border-white/15 bg-white object-cover p-1"
                  loading="lazy"
                  src="/marketing/qr/tradeveto-register-qr-dark.png"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingReveal>
  );
}

function PosterVisual({ feature }: { feature: PosterFeature }) {
  if (feature.visual === "gauge") {
    return (
      <div className="grid gap-3">
        <PosterGauge label={feature.tone === "amber" ? "Elevated Risk" : feature.tone === "rose" ? "Shock Risk" : "Readiness"} score={feature.score} tone={feature.tone} />
        <FeatureFactorPreview feature={feature} />
      </div>
    );
  }

  if (feature.visual === "candles") {
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Before", "Risk Review", "text-amber-200"],
            ["After", "+8.8% Move", "text-emerald-200"],
            ["Proof", "Replay-backed", "text-cyan-200"],
          ].map(([label, value, className]) => (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={label}>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</div>
              <div className={`mt-1 text-sm font-black ${className}`}>{value}</div>
            </div>
          ))}
        </div>
        <FeaturePreviewNote />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="poster-mini-chart rounded-2xl border border-white/10 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Product preview</div>
          <div className={posterWordClass(feature.tone)}>{feature.score}</div>
        </div>
        <FeatureFactorPreview feature={feature} />
      </div>
      <FeaturePreviewNote />
    </div>
  );
}

function FeatureFactorPreview({ feature }: { feature: PosterFeature }) {
  return (
    <ScoreFactorStrip
      emptyMessage="Feature preview unavailable."
      factors={[
        { detail: "Editorial feature rating for this product area.", label: "Feature", tone: feature.tone, value: feature.score },
        { detail: "Whether this feature helps users understand why the system is cautious.", label: "Explain", tone: "cyan", value: feature.tone === "rose" ? 82 : 74 },
        { detail: "Whether this feature helps users notice risk before acting.", label: "Risk", tone: feature.tone === "rose" || feature.tone === "amber" ? feature.tone : "amber", value: feature.tone === "rose" ? 91 : 78 },
        { detail: "Whether this feature supports a repeatable research workflow.", label: "Workflow", tone: "emerald", value: feature.tone === "violet" ? 88 : 76 },
      ]}
      label="Product preview"
    />
  );
}

function FeaturePreviewNote() {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-[11px] leading-4 text-slate-500">
      Illustrative product preview. Live market charts appear only when validated data is available.
    </div>
  );
}

function posterPanelClass(tone: VisualTone): string {
  if (tone === "amber") return "poster-panel-wait border-amber-300/24";
  if (tone === "rose") return "poster-panel-risk border-rose-300/24";
  if (tone === "violet") return "poster-panel-lab border-violet-300/24";
  if (tone === "emerald") return "border-emerald-300/24";
  return "border-cyan-300/18";
}

function posterWordClass(tone: VisualTone): string {
  if (tone === "amber") return "poster-word-amber";
  if (tone === "rose") return "poster-word-rose";
  if (tone === "violet") return "poster-word-violet";
  return "poster-word-cyan";
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
