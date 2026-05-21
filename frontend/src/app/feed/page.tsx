import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BrainCircuit, Clock3, Newspaper, Radar, ShieldAlert } from "lucide-react";
import {
  HeroBlock,
  IntelligenceCollectionGrid,
  PublishedSymbolIntelligenceBlock,
} from "@/components/seo/IntelligencePublishingBlocks";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublishedIntelligenceIndex } from "@/lib/server/intelligence-publishing";
import { publishingItemListJsonLd } from "@/lib/trading/intelligence-publishing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/feed", {
  title: "Intelligence Feed — TradeVeto",
  description:
    "A direct TradeVeto intelligence feed for public-safe market briefings, symbol context, macro collections, shock research, and evidence-labeled research updates.",
});

const feedGuardrails = [
  {
    Icon: Activity,
    copy: "Briefings are generated from structured scanner and market-intelligence packets, not freeform unsupported claims.",
    label: "Structured",
  },
  {
    Icon: ShieldAlert,
    copy: "Risk, shock, and WAIT contexts stay marked as research and never become buy/sell instructions.",
    label: "Bounded",
  },
  {
    Icon: Clock3,
    copy: "Freshness and limited-evidence states remain visible when the current production packet is incomplete.",
    label: "Freshness-aware",
  },
] as const;

export default async function FeedPage() {
  const page = await getPublishedIntelligenceIndex();
  const jsonLd = publishingItemListJsonLd("TradeVeto Intelligence Feed", page.collections);

  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <HeroBlock
            copy="The direct feed route restores fast access to market briefings, macro pressure, shock research, symbol intelligence, and public-safe context. It is designed as a visible intelligence stream, not a hidden library index."
            eyebrow="Intelligence Feed"
            title="Today’s public-safe market intelligence stream."
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.62fr)]">
            <section className="rounded-3xl border border-cyan-300/18 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.18),transparent_28rem),linear-gradient(135deg,rgba(2,8,23,0.96),rgba(15,23,42,0.72))] p-5 shadow-2xl shadow-black/25 ring-1 ring-white/5">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">What matters now</div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Latest structured briefing</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {page.marketBriefing.length ? (
                  page.marketBriefing.map((item, index) => (
                    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4" key={`${index}:${item}`}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-xs font-black text-cyan-100">{index + 1}</span>
                        <p className="text-sm leading-6 text-slate-300">{item}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm leading-6 text-slate-400">
                    Public intelligence is waiting for the next validated scanner snapshot.
                  </div>
                )}
              </div>
            </section>

            <aside className="grid gap-3">
              <section className="rounded-3xl border border-violet-300/18 bg-violet-400/[0.045] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-violet-300/25 bg-violet-300/10 text-violet-100">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200">Universe</div>
                    <div className="text-3xl font-black text-white">{page.universeCount.toLocaleString("en-US")}</div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">Symbols in the latest public-safe intelligence universe.</p>
              </section>
              <section className="rounded-3xl border border-amber-300/18 bg-amber-400/[0.045] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-100">
                    <Radar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Direct access</div>
                    <div className="text-lg font-black text-white">Feed, Macro, Memory</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70" href="/macro">Macro</Link>
                  <Link className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100 transition hover:border-violet-200/70" href="/market-memory">Market Memory</Link>
                </div>
              </section>
            </aside>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            {feedGuardrails.map(({ copy, Icon, label }) => (
              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4" key={label}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-black uppercase tracking-[0.14em] text-slate-100">{label}</div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
              </article>
            ))}
          </section>

          <section className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Collections</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Connected public intelligence surfaces.</h2>
            </div>
            <IntelligenceCollectionGrid items={page.collections} />
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Symbol Intelligence</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Current public research packets.</h2>
              </div>
              <Link className="text-sm font-bold text-cyan-200 transition hover:text-cyan-100" href="/discover">
                Open Discovery
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
