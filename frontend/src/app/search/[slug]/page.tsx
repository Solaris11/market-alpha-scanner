import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareIntelligenceAsset } from "@/components/growth/ShareIntelligenceAsset";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { BRAND_NAME } from "@/lib/brand";
import { marketingMetadata } from "@/lib/marketing-seo";
import {
  SEO_SEARCH_LANDING_PAGES,
  getSearchLandingPage,
  searchLandingJsonLd,
} from "@/lib/seo/organic-acquisition";

export const dynamic = "force-static";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): Array<{ slug: string }> {
  return SEO_SEARCH_LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSearchLandingPage(slug);
  if (!page) return marketingMetadata("/search", { title: `Search Intelligence - ${BRAND_NAME}` });
  return marketingMetadata(`/search/${page.slug}`, {
    description: page.description,
    keywords: page.primaryKeywords,
    title: page.title,
  });
}

export default async function SearchLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getSearchLandingPage(slug);
  if (!page) notFound();
  const jsonLd = searchLandingJsonLd(page);

  return (
    <MarketingShell>
      {jsonLd.map((item, index) => (
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          key={`${page.slug}-jsonld-${index}`}
          suppressHydrationWarning
          type="application/ld+json"
        />
      ))}
      <section className="px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-start">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Search Intelligence</div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl">{page.headline}</h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">{page.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {page.primaryKeywords.map((keyword) => (
                  <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 text-xs font-bold text-slate-200" key={keyword}>
                    {keyword}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="inline-flex min-h-11 items-center rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200" href="/register">
                  Start Research
                </Link>
                <Link className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.045] px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-cyan-300/40 hover:bg-white/[0.075]" href="/feed">
                  View Intelligence Feed
                </Link>
              </div>
            </div>
            <aside className="rounded-2xl border border-cyan-300/18 bg-cyan-300/[0.055] p-5 shadow-2xl shadow-black/20">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Tracked Symbols</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {page.primarySymbols.map((symbol) => (
                  <Link className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm font-black text-white transition hover:border-cyan-300/35 hover:bg-cyan-300/10" href={`/symbol/${symbol}`} key={symbol}>
                    {symbol}
                  </Link>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-50">
                Research only. TradeVeto does not provide financial advice, broker execution, certain outcomes, or fixed-price forecasts.
              </div>
            </aside>
          </div>

          <div className="mt-8">
            <ShareIntelligenceAsset
              asset={{
                assetType: page.assetType === "macro" ? "macro_intelligence" : page.assetType === "opportunity" ? "market_opportunity" : page.assetType === "symbol" ? "symbol_page" : "ai_insight",
                description: page.description,
                path: `/search/${page.slug}`,
                symbol: page.primarySymbols[0],
                title: page.headline,
              }}
              compact
            />
          </div>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {page.sections.map((section) => (
              <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/15" key={section.heading}>
                <h2 className="text-lg font-black text-white">{section.heading}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{section.body}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Continue Research</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {page.relatedLinks.map((link) => (
                <Link className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm font-bold text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/10" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </MarketingShell>
  );
}
