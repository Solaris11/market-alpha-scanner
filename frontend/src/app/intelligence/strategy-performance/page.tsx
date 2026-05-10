import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PublicStrategyPerformanceView } from "@/components/seo/PublicStrategyPerformanceView";
import { marketingMetadata } from "@/lib/marketing-seo";
import { getPublicStrategyPerformanceSystem } from "@/lib/server/public-strategy-performance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingMetadata("/intelligence/strategy-performance", {
  title: "Public Strategy Performance Proof — TradeVeto",
  description:
    "Public simulated TradeVeto strategy performance with replayable trade history, benchmark comparison, drawdown visibility, limitations, and why trades worked or failed. Research only.",
});

export default async function PublicStrategyPerformancePage() {
  const system = await getPublicStrategyPerformanceSystem();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    creator: { "@type": "Organization", name: "TradeVeto" },
    description:
      "Public simulated strategy performance evidence from TradeVeto, including benchmark comparison, replayable closed trade history, and drawdown visibility.",
    name: "TradeVeto Public Strategy Performance Proof",
    url: "https://tradeveto.com/intelligence/strategy-performance",
    variableMeasured: ["simulated return", "benchmark comparison", "max drawdown", "win rate", "closed simulated trades"],
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <PublicStrategyPerformanceView system={system} />
        </div>
      </section>
    </MarketingShell>
  );
}
