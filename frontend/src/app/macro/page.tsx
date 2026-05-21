import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MacroPublishingView } from "@/components/seo/IntelligencePublishingBlocks";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublishedMacroRegimePage } from "@/lib/server/intelligence-publishing";
import { publishingItemListJsonLd } from "@/lib/trading/intelligence-publishing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/macro", {
  title: "Macro Intelligence — TradeVeto",
  description:
    "Direct TradeVeto macro intelligence surface for market regime, breadth, volatility, liquidity, sector pressure, and current risk context. Research only.",
});

export default async function MacroPage() {
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
