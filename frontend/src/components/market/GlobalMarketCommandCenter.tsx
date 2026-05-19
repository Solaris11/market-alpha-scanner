"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, Bitcoin, CircleDollarSign, Droplets, ExternalLink, Landmark, LineChart, Mountain, Newspaper, Waves } from "lucide-react";
import { InteractivePriceChart } from "@/components/charts/InteractivePriceChart";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { MiniSparkline, PosterGauge, ScoreFactorStrip, type VisualTone } from "@/components/visual/MiniVisuals";
import type { MarketCommandItem, MarketCommandModel, MarketNewsItem } from "@/lib/trading/market-research";

type Props = {
  compact?: boolean;
  model: MarketCommandModel;
  title?: string;
};

const TONE_CLASSES: Record<VisualTone, { border: string; glow: string; panel: string; text: string }> = {
  amber: { border: "border-amber-300/25", glow: "shadow-[0_0_32px_rgba(251,191,36,0.12)]", panel: "bg-amber-400/[0.07]", text: "text-amber-100" },
  cyan: { border: "border-cyan-300/25", glow: "shadow-[0_0_32px_rgba(34,211,238,0.12)]", panel: "bg-cyan-400/[0.07]", text: "text-cyan-100" },
  emerald: { border: "border-emerald-300/25", glow: "shadow-[0_0_32px_rgba(52,211,153,0.12)]", panel: "bg-emerald-400/[0.07]", text: "text-emerald-100" },
  rose: { border: "border-rose-300/25", glow: "shadow-[0_0_32px_rgba(251,113,133,0.12)]", panel: "bg-rose-400/[0.07]", text: "text-rose-100" },
  violet: { border: "border-violet-300/25", glow: "shadow-[0_0_32px_rgba(167,139,250,0.12)]", panel: "bg-violet-400/[0.07]", text: "text-violet-100" },
};

const ICONS: Record<string, ReactNode> = {
  BTC: <Bitcoin className="h-5 w-5" />,
  DIA: <Landmark className="h-5 w-5" />,
  GLD: <Mountain className="h-5 w-5" />,
  QQQ: <LineChart className="h-5 w-5" />,
  SPY: <Activity className="h-5 w-5" />,
  TLT: <Waves className="h-5 w-5" />,
  UUP: <CircleDollarSign className="h-5 w-5" />,
  USO: <Droplets className="h-5 w-5" />,
};

export function GlobalMarketCommandCenter({ compact = false, model, title = "Global Market Command" }: Props) {
  const [selected, setSelected] = useState<MarketCommandItem | null>(null);
  const [selectedNews, setSelectedNews] = useState<MarketNewsItem | null>(null);
  const topNews = model.macroNews.slice(0, compact ? 4 : 6);
  const pressure = model.pressureSummary.pressureScore;
  const factors = [
    { detail: "Validated market proxy charts moving constructively over the one-month context window.", label: "Constructive", tone: "emerald" as const, value: model.pressureSummary.constructive * 12 },
    { detail: "Validated market proxy charts deteriorating over the one-month context window.", label: "Deteriorating", tone: "rose" as const, value: model.pressureSummary.deteriorating * 12 },
    { detail: "Missing or insufficient chart history. Limited inputs are marked instead of inferred.", label: "Limited", tone: "cyan" as const, value: model.pressureSummary.limited * 12 },
  ];

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,0.14),transparent_32rem),radial-gradient(circle_at_90%_18%,rgba(168,85,247,0.12),transparent_28rem),linear-gradient(135deg,rgba(2,8,23,0.94),rgba(15,23,42,0.72))] p-4 shadow-2xl shadow-black/30 sm:p-5" id="market-command">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-55" />
      <div className="relative z-10">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">Market OS</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cross-asset</span>
              {model.generatedAt ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Updated {formatDate(model.generatedAt)}</span> : null}
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Nasdaq, Dow, S&P 500, BTC, gold, oil, dollar, and bonds are visible again as first-class intelligence inputs. Every chart uses stored validated price history or an explicit limited-data state.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4">
            <div className="flex items-center gap-4">
              <PosterGauge label="Market Pressure" score={pressure} tone={pressure === null ? "cyan" : pressure >= 55 ? "rose" : pressure >= 35 ? "amber" : "emerald"} />
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Global pressure read</div>
                <div className="mt-2 text-2xl font-black text-slate-50">{pressure === null ? "Limited" : `${pressure}/100`}</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Derived from validated cross-asset chart direction. This is context, not a standalone signal.
                </p>
              </div>
            </div>
            <ScoreFactorStrip className="mt-3" factors={factors} label="Market visibility" />
          </div>
        </div>

        <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-5 sm:px-5 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          {model.barItems.map((item) => (
            <button
              className={`group relative min-w-[82vw] snap-center overflow-hidden rounded-3xl border p-4 text-left shadow-xl transition hover:-translate-y-0.5 md:min-w-0 ${TONE_CLASSES[item.tone].border} ${TONE_CLASSES[item.tone].panel} ${TONE_CLASSES[item.tone].glow}`}
              data-stable-overlay-trigger="true"
              key={item.symbol}
              onClick={() => setSelected(item)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/65 ${TONE_CLASSES[item.tone].text}`}>{ICONS[item.symbol] ?? <LineChart className="h-5 w-5" />}</span>
                  <div className="min-w-0">
                    <div className="font-mono text-lg font-black text-slate-50">{item.symbol}</div>
                    <div className="truncate text-xs font-semibold text-slate-400">{item.label}</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-100" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <MarketMiniStat label="Price" value={money(item.currentPrice)} />
                <MarketMiniStat label="1D" tone={changeTone(item.dayChangePct)} value={percent(item.dayChangePct)} />
                <MarketMiniStat label="1M" tone={changeTone(item.monthChangePct)} value={percent(item.monthChangePct)} />
              </div>
              <MiniSparkline className="mt-4" label="Validated close trend" tone={item.tone} values={item.values} />
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{item.pointCount.toLocaleString()} points</span>
                <span className="truncate">{formatDate(item.freshness)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Macro / geopolitical intelligence</div>
                <h3 className="mt-1 text-xl font-bold text-slate-50">Verified market-moving context</h3>
              </div>
              <Newspaper className="h-5 w-5 text-cyan-200" />
            </div>
            <div className="mt-4 grid gap-2">
              {topNews.length ? topNews.map((item) => (
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
                    {item.relatedAssets.slice(0, 5).map((symbol) => (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-300" key={symbol}>{symbol}</span>
                    ))}
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">
                  No verified macro/news event feed is available in the current scanner packet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/16 bg-cyan-400/[0.035] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Market connection map</div>
            <h3 className="mt-1 text-xl font-bold text-slate-50">What each proxy explains</h3>
            <div className="mt-4 grid gap-2">
              {model.barItems.slice(0, 8).map((item) => (
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3" key={`map-${item.symbol}`}>
                  <div className="flex items-center gap-2">
                    <span className={TONE_CLASSES[item.tone].text}>{ICONS[item.symbol] ?? <LineChart className="h-4 w-4" />}</span>
                    <span className="font-mono text-xs font-black text-slate-100">{item.symbol}</span>
                    <span className="truncate text-xs text-slate-500">{item.label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{item.macroRelevance}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MarketDetailOverlay item={selected} news={model.macroNews.filter((news) => selected?.symbol ? news.relatedAssets.includes(selected.symbol) : false)} onClose={() => setSelected(null)} />
      <NewsDetailOverlay item={selectedNews} onClose={() => setSelectedNews(null)} />
    </section>
  );
}

function MarketDetailOverlay({ item, news, onClose }: { item: MarketCommandItem | null; news: MarketNewsItem[]; onClose: () => void }) {
  const relatedSignals = useMemo(() => {
    if (!item) return [];
    return [
      item.macroRelevance,
      item.marketPressure === null ? "No direct pressure score is available for this proxy." : `Market pressure reads ${Math.round(item.marketPressure)}/100.`,
      item.row?.event_context_summary ? String(item.row.event_context_summary) : "No verified event summary is available for this proxy.",
    ];
  }, [item]);
  if (!item) return null;
  return (
    <StableDetailOverlay analyticsSurface="market_command_detail" closeLabel={`Close ${item.symbol} market detail`} eyebrow="Market command detail" onClose={onClose} open size="xl" title={`${item.label} intelligence`}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <InteractivePriceChart
          defaultPeriod="3mo"
          interpretation={item.macroRelevance}
          label={item.label}
          packet={item.chart.chart}
          relatedSignals={relatedSignals}
          tone={item.tone === "amber" ? "cyan" : item.tone}
        />
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Market interpretation</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.macroRelevance}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MarketMiniStat label="Latest" value={money(item.currentPrice)} />
              <MarketMiniStat label="1D" tone={changeTone(item.dayChangePct)} value={percent(item.dayChangePct)} />
              <MarketMiniStat label="1M" tone={changeTone(item.monthChangePct)} value={percent(item.monthChangePct)} />
              <MarketMiniStat label="Pressure" value={item.marketPressure === null ? "Limited" : `${Math.round(item.marketPressure)}/100`} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Related verified context</div>
            <div className="mt-3 grid gap-2">
              {news.length ? news.slice(0, 4).map((item) => (
                <a className="rounded-xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-cyan-300/35" href={item.sourceUrl} key={item.id} rel="noreferrer" target="_blank">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{item.source} · {formatDate(item.publishedAt)}</div>
                  <div className="mt-1 text-sm font-semibold leading-5 text-slate-100">{item.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.whyItMatters}</p>
                </a>
              )) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/45 p-3 text-sm text-slate-500">No verified source-linked event is attached to this market proxy yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StableDetailOverlay>
  );
}

function NewsDetailOverlay({ item, onClose }: { item: MarketNewsItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <StableDetailOverlay analyticsSurface="macro_news_detail" closeLabel="Close macro news detail" eyebrow="Verified macro context" onClose={onClose} open size="lg" title={item.eventType.replace(/_/g, " ")}>
      <div className="space-y-4">
        <div className={`rounded-3xl border p-5 ${TONE_CLASSES[item.tone].border} ${TONE_CLASSES[item.tone].panel}`}>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <span>{item.source}</span>
            <span>{formatDate(item.publishedAt)}</span>
            <span>{item.scope}</span>
            <span>{item.direction}</span>
          </div>
          <h3 className="mt-3 text-2xl font-black leading-tight text-slate-50">{item.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{item.whyItMatters}</p>
          <a className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:border-cyan-200/60" href={item.sourceUrl} rel="noreferrer" target="_blank">
            Open original source <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MarketMiniStat label="Relevance" value={`${item.relevance}/100`} />
          <MarketMiniStat label="Assets" value={item.relatedAssets.slice(0, 4).join(", ") || "Limited"} />
          <MarketMiniStat label="Sectors" value={item.affectedSectors.slice(0, 3).join(", ") || "Limited"} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Reason codes</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.reasonCodes.length ? item.reasonCodes.map((code) => (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-slate-300" key={code}>{code.replace(/^EVENT_/, "").replace(/_/g, " ")}</span>
            )) : <span className="text-sm text-slate-500">No reason-code detail available.</span>}
          </div>
        </div>
      </div>
    </StableDetailOverlay>
  );
}

function MarketMiniStat({ label, tone = "text-slate-100", value }: { label: string; tone?: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-black ${tone}`}>{value}</div>
    </div>
  );
}

function changeTone(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value > 0.25) return "text-emerald-200";
  if (value < -0.25) return "text-rose-200";
  return "text-amber-200";
}

function percent(value: number | null): string {
  if (value === null) return "Limited";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function money(value: number | null): string {
  if (value === null) return "Limited";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(new Date(parsed));
}
