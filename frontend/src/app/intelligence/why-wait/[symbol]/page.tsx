import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PublishedSymbolIntelligenceBlock } from "@/components/seo/IntelligencePublishingBlocks";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublishedWhyWaitPage } from "@/lib/server/intelligence-publishing";
import { publishingJsonLdForSymbol } from "@/lib/trading/intelligence-publishing";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ symbol: string }>;
};

function cleanSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const cleaned = cleanSymbol(symbol) || "Symbol";
  return marketingMetadata(`/intelligence/why-wait/${cleaned}`, {
    title: `Why WAIT on ${cleaned} — TradeVeto`,
    description: `Public TradeVeto reasoning for why ${cleaned} may require patience, confirmation, or restraint based on macro context, fragility, shock memory, and narrative evidence.`,
  });
}

export default async function WhyWaitSymbolPage({ params }: PageProps) {
  const { symbol } = await params;
  const cleaned = cleanSymbol(symbol);
  if (!cleaned) notFound();

  const intelligence = await getPublishedWhyWaitPage(cleaned);
  if (!intelligence) notFound();

  const jsonLd = publishingJsonLdForSymbol({
    ...intelligence,
    title: `Why WAIT on ${intelligence.symbol}`,
  });

  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <PublishedSymbolIntelligenceBlock
            intelligence={{
              ...intelligence,
              title: `Why WAIT on ${intelligence.symbol}`,
            }}
          />
          <section className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.045] p-6 shadow-2xl shadow-black/20">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Decision Restraint</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              WAIT pages explain why the system may prefer patience even when a setup has attractive traits. They are designed to show risk context, not to provide financial advice or a direct trade instruction.
            </p>
          </section>
        </div>
      </section>
    </MarketingShell>
  );
}
