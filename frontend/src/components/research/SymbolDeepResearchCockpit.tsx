"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, Building2, CalendarClock, CircleDollarSign, ExternalLink, FileText, Newspaper, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { HeatDots, PosterGauge, ScoreFactorStrip, type VisualTone } from "@/components/visual/MiniVisuals";
import type { MarketNewsItem, ResearchMetric, SymbolResearchModel } from "@/lib/trading/market-research";

type Props = {
  model: SymbolResearchModel;
};

const TONE_CLASSES: Record<VisualTone, { bg: string; border: string; text: string }> = {
  amber: { bg: "bg-amber-400/[0.075]", border: "border-amber-300/25", text: "text-amber-100" },
  cyan: { bg: "bg-cyan-400/[0.075]", border: "border-cyan-300/25", text: "text-cyan-100" },
  emerald: { bg: "bg-emerald-400/[0.075]", border: "border-emerald-300/25", text: "text-emerald-100" },
  rose: { bg: "bg-rose-400/[0.075]", border: "border-rose-300/25", text: "text-rose-100" },
  violet: { bg: "bg-violet-400/[0.075]", border: "border-violet-300/25", text: "text-violet-100" },
};

export function SymbolDeepResearchCockpit({ model }: Props) {
  const [selectedNews, setSelectedNews] = useState<MarketNewsItem | null>(null);
  const completenessTone: VisualTone = model.researchCompleteness >= 70 ? "emerald" : model.researchCompleteness >= 42 ? "amber" : "cyan";
  const financialFactors = useMemo(() => metricsToFactors(model.financialMetrics), [model.financialMetrics]);
  const macroFactors = useMemo(() => metricsToFactors(model.macroConnections), [model.macroConnections]);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/18 bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.14),transparent_30rem),radial-gradient(circle_at_86%_18%,rgba(34,211,238,0.12),transparent_30rem),linear-gradient(135deg,rgba(2,8,23,0.95),rgba(15,23,42,0.72))] p-4 shadow-2xl shadow-black/30 sm:p-5" id="company-research">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-55" />
      <div className="relative z-10 space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">Deep research</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Scanner fundamentals</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Verified events</span>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{model.company.symbol} Company Research Cockpit</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Company overview, fundamentals, earnings, dividends, verified headlines, and macro connections are restored as first-class research context. Missing fields stay labeled as limited evidence instead of being inferred.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
            <div className="flex items-center gap-4">
              <PosterGauge label="Research Depth" score={model.researchCompleteness} tone={completenessTone} />
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Data completeness</div>
                <div className="mt-2 text-2xl font-black text-slate-50">{model.researchCompleteness}/100</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Completeness reflects fields in the latest scanner packet. It does not imply recommendation quality.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Evidence density</div>
              <div className="mt-3">
                <HeatDots active={Math.round(model.researchCompleteness / 9)} tone={completenessTone} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)_390px]">
          <CompanyOverview model={model} />
          <div className="space-y-4">
            <VisualMetricCluster
              eyebrow="Financial system"
              icon={<BarChart3 className="h-5 w-5" />}
              metrics={model.financialMetrics}
              title="Fundamentals, profitability, and valuation"
            />
            <ScoreFactorStrip factors={financialFactors} label="Financial factor map" />
            <div className="grid gap-3 md:grid-cols-2">
              <ResearchNarrativeCard
                icon={<CalendarClock className="h-5 w-5" />}
                label="Earnings intelligence"
                tone={model.earnings.date ? "amber" : "cyan"}
                value={model.earnings.date ?? "Limited"}
                narrative={model.earnings.narrative}
                chips={[
                  model.earnings.surpriseHistoryAvailable ? "Surprise history available" : "Surprise history limited",
                  model.earnings.reactionHistoryAvailable ? "Reaction history available" : "Reaction history limited",
                  model.earnings.riskScore === null ? "Risk score limited" : `Event risk ${Math.round(model.earnings.riskScore)}/100`,
                ]}
              />
              <ResearchNarrativeCard
                icon={<CircleDollarSign className="h-5 w-5" />}
                label="Dividend intelligence"
                tone={model.dividend.yield !== null && model.dividend.yield > 0 ? "emerald" : "cyan"}
                value={model.dividend.yield === null ? "Limited" : `${model.dividend.yield.toFixed(2)}%`}
                narrative={model.dividend.narrative}
                chips={[
                  model.dividend.historyAvailable ? "History available" : "History limited",
                  model.dividend.yield !== null && model.dividend.yield > 0 ? "Income context present" : "No yield context",
                ]}
              />
            </div>
          </div>
          <div className="space-y-4">
            <VisualMetricCluster
              eyebrow="Market connection"
              icon={<ShieldAlert className="h-5 w-5" />}
              metrics={model.macroConnections}
              title="Macro, sector, event, and volatility context"
            />
            <ScoreFactorStrip factors={macroFactors} label="Macro connection map" />
            <BullBearPanel bearish={model.bearishFactors} bullish={model.bullishFactors} />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">Company news intelligence</div>
                <h3 className="mt-1 text-xl font-bold text-slate-50">Source-linked context, not fabricated headlines</h3>
              </div>
              <Newspaper className="h-5 w-5 text-violet-200" />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {model.news.length ? model.news.map((item) => (
                <button
                  className={`rounded-2xl border p-3 text-left transition hover:border-cyan-300/35 hover:bg-white/[0.055] ${TONE_CLASSES[item.tone].border} bg-white/[0.025]`}
                  data-stable-overlay-trigger="true"
                  key={item.id}
                  onClick={() => setSelectedNews(item)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.source} · {formatDate(item.publishedAt)}</div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{item.title}</div>
                    </div>
                    <span className={`rounded-full border border-white/10 px-2 py-1 text-[10px] font-black ${TONE_CLASSES[item.tone].text}`}>{item.relevance}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.whyItMatters}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.reasonCodes.slice(0, 4).map((code) => (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300" key={code}>{cleanReason(code)}</span>
                    ))}
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-5 text-sm leading-6 text-slate-400 lg:col-span-2">
                  No verified source-linked company headlines are attached to this symbol in the latest scanner packet. TradeVeto is showing a limited-news state instead of generating synthetic news.
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <SymbolEventTimeline items={model.eventTimeline} />
            <div className="rounded-3xl border border-cyan-300/16 bg-cyan-400/[0.035] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Research gaps</div>
              <h3 className="mt-1 text-xl font-bold text-slate-50">What is not yet validated</h3>
              <div className="mt-4 grid gap-2">
                <LimitedItem available={Boolean(model.company.description)} label="Company description" />
                <LimitedItem available={Boolean(model.company.headquarters)} label="Headquarters / CEO profile" />
                <LimitedItem available={model.earnings.surpriseHistoryAvailable} label="Earnings surprise history" />
                <LimitedItem available={model.earnings.reactionHistoryAvailable} label="Post-earnings reaction history" />
                <LimitedItem available={model.dividend.historyAvailable} label="Dividend payout history" />
                <LimitedItem available={model.news.length > 0} label="Source-linked news context" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewsOverlay item={selectedNews} onClose={() => setSelectedNews(null)} />
    </section>
  );
}

function SymbolEventTimeline({ items }: { items: SymbolResearchModel["eventTimeline"] }) {
  return (
    <div className="rounded-3xl border border-violet-300/16 bg-violet-400/[0.04] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-300">Company event timeline</div>
      <h3 className="mt-1 text-xl font-bold text-slate-50">News, earnings, analyst, and dividend context</h3>
      <div className="mt-4 grid gap-2">
        {items.length ? items.slice(0, 6).map((item) => (
          <div className={`rounded-2xl border p-3 ${TONE_CLASSES[item.tone].border} ${TONE_CLASSES[item.tone].bg}`} key={`${item.category}:${item.date}:${item.label}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${TONE_CLASSES[item.tone].text}`}>{formatDate(item.date)} · {item.category}</div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{item.label}</div>
              </div>
              {item.sourceUrl ? (
                <a className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black text-cyan-100 transition hover:border-cyan-300/35" href={item.sourceUrl} rel="noreferrer" target="_blank">
                  Source
                </a>
              ) : null}
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{item.source}</div>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
            No source-linked company event timeline is available for this symbol yet.
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyOverview({ model }: { model: SymbolResearchModel }) {
  const company = model.company;
  const profile = [
    { label: "Company", value: company.companyName },
    { label: "Sector", value: company.sector ?? "Limited" },
    { label: "Industry", value: company.industry ?? "Limited" },
    { label: "Asset type", value: company.assetType },
    { label: "Exchange / provider", value: company.exchange ?? "Limited" },
    { label: "Market cap", value: money(company.marketCap) },
  ];
  return (
    <div className="rounded-3xl border border-cyan-300/16 bg-slate-950/50 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <Building2 className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-2xl font-black text-slate-50">{company.symbol}</div>
          <div className="truncate text-sm font-semibold text-slate-300">{company.companyName}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {profile.map((item) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={item.label}>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          <FileText className="h-3.5 w-3.5" />
          Company description
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {company.description ?? "No validated company description is stored in the current scanner packet."}
        </p>
      </div>
    </div>
  );
}

function VisualMetricCluster({ eyebrow, icon, metrics, title }: { eyebrow: string; icon: ReactNode; metrics: ResearchMetric[]; title: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-300/18 bg-cyan-300/10 text-cyan-100">{icon}</span>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</div>
          <h3 className="mt-1 text-lg font-bold text-slate-50">{title}</h3>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div className={`rounded-2xl border p-3 ${TONE_CLASSES[metric.tone].border} ${TONE_CLASSES[metric.tone].bg}`} key={metric.label}>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{metric.label}</div>
            <div className={`mt-1 font-mono text-lg font-black ${TONE_CLASSES[metric.tone].text}`}>{metric.value}</div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{metric.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchNarrativeCard({
  chips,
  icon,
  label,
  narrative,
  tone,
  value,
}: {
  chips: string[];
  icon: ReactNode;
  label: string;
  narrative: string;
  tone: VisualTone;
  value: string;
}) {
  return (
    <div className={`rounded-3xl border p-4 ${TONE_CLASSES[tone].border} ${TONE_CLASSES[tone].bg}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/50 ${TONE_CLASSES[tone].text}`}>{icon}</span>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className={`mt-1 font-mono text-xl font-black ${TONE_CLASSES[tone].text}`}>{value}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{narrative}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-slate-300" key={chip}>{chip}</span>
        ))}
      </div>
    </div>
  );
}

function BullBearPanel({ bearish, bullish }: { bearish: string[]; bullish: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FactorList icon={<TrendingUp className="h-4 w-4" />} items={bullish} title="Bullish drivers" tone="emerald" />
      <FactorList icon={<TrendingDown className="h-4 w-4" />} items={bearish} title="Bearish / risk drivers" tone="rose" />
    </div>
  );
}

function FactorList({ icon, items, title, tone }: { icon: ReactNode; items: string[]; title: string; tone: VisualTone }) {
  return (
    <div className={`rounded-3xl border p-4 ${TONE_CLASSES[tone].border} ${TONE_CLASSES[tone].bg}`}>
      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] ${TONE_CLASSES[tone].text}`}>
        {icon}
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
        {items.slice(0, 5).map((item) => (
          <li className="flex gap-2" key={item}>
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "emerald" ? "bg-emerald-300" : "bg-rose-300"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LimitedItem({ available, label }: { available: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${available ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-cyan-300/18 bg-cyan-300/[0.08] text-cyan-100"}`}>
        {available ? "Available" : "Limited"}
      </span>
    </div>
  );
}

function NewsOverlay({ item, onClose }: { item: MarketNewsItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <StableDetailOverlay analyticsSurface="symbol_research_news" closeLabel="Close news detail" eyebrow="Source-linked company context" onClose={onClose} open size="lg" title={item.title}>
      <div className="space-y-4">
        <div className={`rounded-3xl border p-5 ${TONE_CLASSES[item.tone].border} ${TONE_CLASSES[item.tone].bg}`}>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span>{item.source}</span>
            <span>{formatDate(item.publishedAt)}</span>
            <span>{item.direction}</span>
            <span>{item.scope}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">{item.whyItMatters}</p>
          <a className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60" href={item.sourceUrl} rel="noreferrer" target="_blank">
            Open original source <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailTile label="Relevance" value={`${item.relevance}/100`} />
          <DetailTile label="Related assets" value={item.relatedAssets.join(", ") || "Limited"} />
          <DetailTile label="Affected sectors" value={item.affectedSectors.join(", ") || "Limited"} />
          <DetailTile label="Tracking" value={item.eventTrackingLabel} />
          <DetailTile label="Event read" value={item.marketMovingLabel} />
          <DetailTile label="Direction" value={item.direction} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NewsContextPanel label="Bullish implication" tone="emerald" value={item.bullishImplication} />
          <NewsContextPanel label="Bearish implication" tone="rose" value={item.bearishImplication} />
          <NewsContextPanel label="Macro context" tone="cyan" value={item.relatedMacroContext} />
          <NewsContextPanel label="Replay / memory context" tone="violet" value={item.relatedReplayContext} />
        </div>
      </div>
    </StableDetailOverlay>
  );
}

function NewsContextPanel({ label, tone, value }: { label: string; tone: MarketNewsItem["tone"]; value: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONE_CLASSES[tone].border} ${TONE_CLASSES[tone].bg}`}>
      <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${TONE_CLASSES[tone].text}`}>{label}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function metricsToFactors(metrics: ResearchMetric[]) {
  return metrics.map((metric) => ({
    detail: metric.detail,
    label: metric.label,
    tone: metric.tone,
    value: metric.value === "Limited" ? null : parseMetricValue(metric.value),
  }));
}

function parseMetricValue(value: string): number | null {
  const parsed = Number(value.replace(/[$,%]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  if (Math.abs(parsed) <= 1) return Math.round(parsed * 100);
  return Math.max(0, Math.min(100, parsed));
}

function money(value: number | null): string {
  if (value === null) return "Limited";
  if (value >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(parsed));
}

function cleanReason(value: string): string {
  return value.replace(/^EVENT_/, "").replace(/_/g, " ").toLowerCase();
}
