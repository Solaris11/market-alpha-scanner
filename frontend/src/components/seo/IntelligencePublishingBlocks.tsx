import Link from "next/link";
import type {
  PublishedCollectionItem,
  PublishedInsightCard,
  PublishedMacroRegimePage,
  PublishedShockPage,
  PublishedSymbolIntelligence,
} from "@/lib/trading/intelligence-publishing";

export function PublishedSymbolIntelligenceBlock({ compact = false, intelligence }: { compact?: boolean; intelligence: PublishedSymbolIntelligence }) {
  return (
    <section className={`rounded-2xl border border-cyan-300/20 bg-slate-950/70 ${compact ? "p-5" : "p-6"} shadow-2xl shadow-black/25 ring-1 ring-white/5 backdrop-blur-xl`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Public Intelligence</div>
          {compact ? (
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-50">{intelligence.title}</h2>
          ) : (
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-50 sm:text-4xl">{intelligence.title}</h1>
          )}
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{intelligence.description}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:min-w-[260px]">
          <MiniStat label="Sector" value={intelligence.sector} />
          <MiniStat label="State" value={intelligence.currentOpportunityState} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {intelligence.cards.map((card) => <InsightCard card={card} key={`${intelligence.symbol}-${card.label}`} />)}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Why It May Wait</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{intelligence.whyWaitSummary}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">What To Monitor</div>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
            {intelligence.whatToWatch.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-300/18 bg-amber-400/[0.05] p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Public Trust Boundary</div>
        <p className="mt-2 text-sm leading-6 text-amber-50/85">
          This public page summarizes source-bounded TradeVeto research context. It does not include premium trade-plan levels, real-money execution, personalized advice, or guaranteed outcomes.
        </p>
      </div>

      <InternalLinks links={intelligence.internalLinks} />
    </section>
  );
}

export function IntelligenceCollectionGrid({ items }: { items: PublishedCollectionItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Link className={`rounded-2xl border p-5 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-300/40 ${toneClass(item.tone)}`} href={item.href} key={item.href}>
          <div className="text-lg font-black text-slate-50">{item.label}</div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
          {item.symbols.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.symbols.slice(0, 6).map((symbol) => <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-black text-slate-300" key={`${item.href}-${symbol}`}>{symbol}</span>)}
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function ShockPublishingView({ page }: { page: PublishedShockPage }) {
  return (
    <div className="space-y-10">
      <HeroBlock eyebrow="Shock Intelligence" title={page.title} copy={page.narrative.join(" ")} />
      <TrustBoundaryGrid
        items={[
          ["High volatility", "Shock research is speculative by nature and can include elevated downside risk."],
          ["No chase signal", "Historical large-move behavior is not treated as a direct reason to enter late."],
          ["Stats first", "Shock counts, follow-through, and chase risk are computed before AI text summarizes them."],
        ]}
      />
      <IntelligenceCollectionGrid items={page.items} />
    </div>
  );
}

export function MacroPublishingView({ page }: { page: PublishedMacroRegimePage }) {
  return (
    <div className="space-y-10">
      <HeroBlock eyebrow="Macro Regime" title={page.title} copy={page.narrative.join(" ")} />
      <TrustBoundaryGrid
        items={[
          ["Observed structure", "Macro pages summarize current market pressure; they do not predict exact macro releases."],
          ["Pressure, not certainty", "Volatility, liquidity, and breadth labels describe risk context, not guaranteed direction."],
          ["Fallback honest", "When source coverage is limited, TradeVeto should disclose the limitation."],
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => <InsightCard card={metric} key={metric.label} />)}
      </div>
      <IntelligenceCollectionGrid items={page.sectorMap} />
    </div>
  );
}

function TrustBoundaryGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {items.map(([title, copy]) => (
        <div className="rounded-2xl border border-amber-300/18 bg-amber-400/[0.045] p-4" key={title}>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">{title}</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{copy}</p>
        </div>
      ))}
    </section>
  );
}

export function HeroBlock({ copy, eyebrow, title }: { copy: string; eyebrow: string; title: string }) {
  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/72 p-6 shadow-2xl shadow-black/25 ring-1 ring-white/5 backdrop-blur-xl sm:p-8">
      <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">{eyebrow}</div>
      <h1 className="mt-3 max-w-5xl text-3xl font-black tracking-tight text-slate-50 sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">{copy}</p>
    </section>
  );
}

function InsightCard({ card }: { card: PublishedInsightCard }) {
  return (
    <article className={`rounded-2xl border p-4 ${toneClass(card.tone)}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{card.label}</div>
      <div className="mt-2 text-lg font-black text-slate-50">{card.value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{card.detail}</p>
    </article>
  );
}

function InternalLinks({ links }: { links: PublishedSymbolIntelligence["internalLinks"] }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Related Intelligence</div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {links.slice(0, 6).map((link) => (
          <Link className="rounded-xl border border-white/10 bg-slate-950/35 p-3 transition hover:border-cyan-300/35" href={link.href} key={`${link.href}-${link.label}`}>
            <div className="text-sm font-bold text-slate-100">{link.label}</div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-black leading-5 text-slate-100">{value}</div>
    </div>
  );
}

function toneClass(tone: PublishedInsightCard["tone"]): string {
  if (tone === "constructive") return "border-emerald-300/20 bg-emerald-400/[0.055]";
  if (tone === "risk") return "border-rose-300/20 bg-rose-400/[0.055]";
  if (tone === "mixed") return "border-amber-300/18 bg-amber-400/[0.045]";
  return "border-white/10 bg-white/[0.045]";
}
