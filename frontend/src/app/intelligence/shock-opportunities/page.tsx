import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { ShockPublishingView } from "@/components/seo/IntelligencePublishingBlocks";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublishedShockOpportunitiesPage } from "@/lib/server/intelligence-publishing";
import { publishingItemListJsonLd } from "@/lib/trading/intelligence-publishing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/intelligence/shock-opportunities", {
  title: "Shock Opportunity Research — TradeVeto",
  description:
    "TradeVeto's public high-volatility research layer for upside shock memory, two-sided volatility, chase risk, and historical shock context. Research only.",
});

export default async function ShockOpportunitiesPage() {
  const page = await getPublishedShockOpportunitiesPage();
  const jsonLd = publishingItemListJsonLd(page.title, page.items);

  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ShockPublishingView page={page} />
        </div>
      </section>
    </MarketingShell>
  );
}
