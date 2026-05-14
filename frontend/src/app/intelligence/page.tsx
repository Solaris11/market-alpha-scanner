import type { Metadata } from "next";
import Link from "next/link";
import { HeroBlock, IntelligenceCollectionGrid, PublishedSymbolIntelligenceBlock } from "@/components/seo/IntelligencePublishingBlocks";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublishedIntelligenceIndex } from "@/lib/server/intelligence-publishing";
import { publishingItemListJsonLd } from "@/lib/trading/intelligence-publishing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/intelligence", {
  title: "Market Intelligence Library — TradeVeto",
  description:
    "Public TradeVeto intelligence pages for symbol context, macro regime, shock research, WAIT reasoning, strategy proof, evidence depth, and market pressure analysis. Research only.",
});

const trustBoundaries = [
  ["Public-safe", "These pages do not expose premium entry/exit levels, private user data, or direct action instructions."],
  ["Evidence-labeled", "TradeVeto should distinguish limited evidence from stronger historical support."],
  ["Source-aware", "Event context must be verified from trusted sources or disclosed as unavailable."],
] as const;

export default async function IntelligenceIndexPage() {
  const page = await getPublishedIntelligenceIndex();
  const jsonLd = publishingItemListJsonLd("TradeVeto Market Intelligence Library", page.collections);

  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <HeroBlock
            eyebrow="Market Intelligence Library"
            title="Explainable market reasoning, published without the signal spam."
            copy="TradeVeto publishes public-safe intelligence from market memory, macro regime, shock behavior, fragility, event context, evidence depth, and institutional pressure layers. These pages explain context and restraint; they are research only and not financial advice."
          />

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">What Matters Now</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                {page.marketBriefing.length ? page.marketBriefing.map((item) => <p key={item}>{item}</p>) : <p>Public intelligence is waiting for the next scanner snapshot.</p>}
              </div>
            </section>
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Publishing Guardrails</div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Public pages summarize structured TradeVeto intelligence without exposing premium research-plan fields. They avoid direct instructions, predictions, and unsupported news claims.
              </p>
              <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{page.universeCount} symbols in the latest public-safe intelligence universe</div>
            </section>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            {trustBoundaries.map(([title, copy]) => (
              <div className="rounded-2xl border border-emerald-300/18 bg-emerald-400/[0.045] p-5" key={title}>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">{title}</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{copy}</p>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Collections</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Research collections built from structured intelligence.</h2>
            </div>
            <IntelligenceCollectionGrid items={page.collections} />
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Symbol Intelligence</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Public symbol research pages.</h2>
              </div>
              <Link className="text-sm font-bold text-cyan-200 transition hover:text-cyan-100" href="/intelligence/shock-opportunities">
                Explore shock research
              </Link>
            </div>
            <div className="grid gap-4">
              {page.symbolPages.slice(0, 6).map((item) => (
                <PublishedSymbolIntelligenceBlock compact intelligence={item} key={item.symbol} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </MarketingShell>
  );
}
