import Link from "next/link";
import { Activity, Gauge, Globe2, Layers, ShieldAlert, Zap } from "lucide-react";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import type { ScoreFactor, VisualTone } from "@/components/visual/MiniVisuals";
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
  const clusters = publishedCollectionClusters(page.items, "rose", "Shock cluster", ShieldAlert);
  const heatCells = publishedCollectionHeatCells(page.items);
  return (
    <div className="space-y-10">
      <HeroBlock eyebrow="Shock Intelligence" title={page.title} copy={page.narrative.join(" ")} />
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Shock intelligence surface"
        summary="Shock intelligence clusters are built from published TradeVeto shock collections. Missing symbol coverage stays limited rather than being simulated."
        title="Shock Risk Command Surface"
      />
      <CinematicHeatMatrix cells={heatCells} emptyMessage="No published shock collection is available yet." eyebrow="Shock heat" title="Risk Concentration Map" />
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
  const clusters = macroPublishingClusters(page);
  const heatCells = [
    ...page.metrics.map((metric) => publishedMetricHeatCell(metric)),
    ...page.sectorMap.slice(0, 8).map((item) => publishedCollectionHeatCell(item)),
  ];
  const timelineItems: CinematicTimelineItem[] = page.metrics.slice(0, 6).map((metric) => ({
    detail: metric.detail,
    label: metric.label,
    metric: metric.value,
    timestamp: page.generatedAt,
    tone: visualToneFromPublished(metric.tone),
  }));
  return (
    <div className="space-y-10">
      <HeroBlock eyebrow="Macro Regime" title={page.title} copy={page.narrative.join(" ")} />
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Macro intelligence surface"
        summary="Macro regime, volatility, breadth, liquidity, and sector collections are displayed as connected intelligence layers from published TradeVeto data."
        title="Macro Intelligence Command Surface"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <CinematicHeatMatrix
          cells={heatCells}
          emptyMessage="Published macro heat data is not available yet."
          eyebrow="Macro heat"
          summary="Heat cells are derived from published macro metrics and sector collection coverage."
          title="Market Pressure Matrix"
        />
        <CinematicTimeline
          emptyMessage="Published macro timeline metrics are not available yet."
          eyebrow="Regime timeline"
          items={timelineItems}
          summary="Current published metrics anchored to the latest macro page timestamp."
          title="Macro State Timeline"
        />
      </div>
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

function macroPublishingClusters(page: PublishedMacroRegimePage): CinematicCluster[] {
  const primaryMetrics = page.metrics.slice(0, 4);
  const sectorRows = page.sectorMap.slice(0, 6);
  return [
    {
      emptyMessage: "Published macro metrics are not available yet.",
      eyebrow: "Macro cluster",
      factors: primaryMetrics.map((metric) => publishedMetricFactor(metric)),
      icon: <Globe2 className="h-6 w-6" />,
      items: primaryMetrics.map((metric) => ({
        detail: metric.detail,
        label: metric.label,
        tone: visualToneFromPublished(metric.tone),
        value: metric.value,
      })),
      metric: page.marketState,
      metricLabel: "market state",
      score: averagePublishedMetricScore(primaryMetrics),
      summary: page.narrative[0] ?? "Published macro regime context from TradeVeto.",
      title: "Market Environment Overview",
      tone: "cyan",
      updatedAt: page.generatedAt,
      values: primaryMetrics.map((metric) => publishedNumericValue(metric.value)),
    },
    {
      emptyMessage: "No sector collection is available for this macro page yet.",
      eyebrow: "Sector rotation",
      factors: [
        { label: "Collections", tone: "cyan", value: sectorRows.length ? Math.min(100, sectorRows.length * 12) : null },
        { label: "Risk Groups", tone: "rose", value: percentOfPublished(sectorRows, (item) => item.tone === "risk") },
        { label: "Constructive Groups", tone: "emerald", value: percentOfPublished(sectorRows, (item) => item.tone === "constructive") },
      ],
      icon: <Layers className="h-6 w-6" />,
      items: sectorRows.map((item) => ({
        detail: item.description,
        href: item.href,
        label: item.label,
        tone: visualToneFromPublished(item.tone),
        value: `${item.symbols.length} symbols`,
      })),
      metric: `${page.sectorMap.length}`,
      metricLabel: "sector groups",
      score: page.sectorMap.length ? Math.min(100, page.sectorMap.length * 10) : null,
      summary: "Sector map panels show published market context collections and symbol coverage.",
      title: "Sector Rotation Heat",
      tone: "amber",
      values: sectorRows.map((item) => Math.min(100, item.symbols.length * 12)),
    },
    {
      emptyMessage: "Volatility and pressure metrics are limited in this published macro packet.",
      eyebrow: "Pressure drivers",
      factors: primaryMetrics.map((metric) => publishedMetricFactor(metric)),
      icon: <Gauge className="h-6 w-6" />,
      items: page.metrics.slice(0, 6).map((metric) => ({
        detail: metric.detail,
        label: metric.label,
        tone: visualToneFromPublished(metric.tone),
        value: metric.value,
      })),
      metric: page.metrics.length.toLocaleString(),
      metricLabel: "published drivers",
      score: averagePublishedMetricScore(page.metrics),
      summary: "Macro pressure drivers are shown together so the public view feels like one market-state system.",
      title: "Macro Pressure Drivers",
      tone: "rose",
      values: page.metrics.map((metric) => publishedNumericValue(metric.value)),
    },
  ];
}

function publishedCollectionClusters(
  items: PublishedCollectionItem[],
  tone: VisualTone,
  eyebrow: string,
  Icon: typeof Activity,
): CinematicCluster[] {
  const riskPct = percentOfPublished(items, (item) => item.tone === "risk");
  const constructivePct = percentOfPublished(items, (item) => item.tone === "constructive");
  return [
    {
      emptyMessage: "No published collection data is available yet.",
      eyebrow,
      factors: [
        { label: "Collections", tone: "cyan", value: items.length ? Math.min(100, items.length * 12) : null },
        { label: "Risk", tone: "rose", value: riskPct },
        { label: "Constructive", tone: "emerald", value: constructivePct },
      ],
      icon: <Icon className="h-6 w-6" />,
      items: items.slice(0, 8).map((item) => ({
        detail: item.description,
        href: item.href,
        label: item.label,
        tone: visualToneFromPublished(item.tone),
        value: `${item.symbols.length} symbols`,
      })),
      metric: items.length.toLocaleString(),
      metricLabel: "collections",
      score: items.length ? Math.min(100, items.length * 10) : null,
      summary: "Published intelligence collections are grouped into one high-density tactical layer.",
      title: "Published Intelligence Ecosystem",
      tone,
      values: items.map((item) => Math.min(100, item.symbols.length * 12)),
    },
  ];
}

function publishedMetricFactor(metric: PublishedInsightCard): ScoreFactor {
  return { label: metric.label, tone: visualToneFromPublished(metric.tone), value: publishedNumericValue(metric.value) };
}

function publishedMetricHeatCell(metric: PublishedInsightCard): CinematicHeatCell {
  return {
    detail: metric.detail,
    label: metric.label,
    tone: visualToneFromPublished(metric.tone),
    value: publishedNumericValue(metric.value),
  };
}

function publishedCollectionHeatCell(item: PublishedCollectionItem): CinematicHeatCell {
  return {
    detail: item.description,
    href: item.href,
    label: item.label,
    tone: visualToneFromPublished(item.tone),
    value: item.symbols.length ? Math.min(100, item.symbols.length * 12) : null,
  };
}

function publishedCollectionHeatCells(items: PublishedCollectionItem[]): CinematicHeatCell[] {
  return items.slice(0, 12).map((item) => publishedCollectionHeatCell(item));
}

function visualToneFromPublished(tone: PublishedInsightCard["tone"]): VisualTone {
  if (tone === "constructive") return "emerald";
  if (tone === "risk") return "rose";
  if (tone === "mixed") return "amber";
  return "cyan";
}

function publishedNumericValue(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function averagePublishedMetricScore(metrics: PublishedInsightCard[]): number | null {
  const values = metrics.map((metric) => publishedNumericValue(metric.value)).filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentOfPublished<T>(items: T[], predicate: (item: T) => boolean): number | null {
  if (!items.length) return null;
  return (items.filter(predicate).length / items.length) * 100;
}
