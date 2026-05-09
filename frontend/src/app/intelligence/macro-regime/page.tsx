import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MacroPublishingView } from "@/components/seo/IntelligencePublishingBlocks";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublishedMacroRegimePage } from "@/lib/server/intelligence-publishing";
import { publishingItemListJsonLd } from "@/lib/trading/intelligence-publishing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/intelligence/macro-regime", {
  title: "Macro Regime Intelligence — TradeVeto",
  description:
    "Current TradeVeto macro regime, market pressure, sector leadership, volatility pressure, and liquidity context for public market research.",
});

export default async function MacroRegimePage() {
  const page = await getPublishedMacroRegimePage();
  const jsonLd = publishingItemListJsonLd(page.title, page.sectorMap);

  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <MacroPublishingView page={page} />
        </div>
      </section>
    </MarketingShell>
  );
}
