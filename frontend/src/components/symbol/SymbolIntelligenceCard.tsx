"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { AlertCircle, Bell, ExternalLink, GitCompare, History, LineChart, ShieldAlert, Star } from "lucide-react";
import { useLocalWatchlist } from "@/hooks/useLocalWatchlist";
import { closeSymbolCard } from "@/lib/symbol/symbol-overlay-store";
import type { SymbolChartPoint, SymbolIntelligenceCardModel, SymbolSourceField } from "@/lib/symbol/symbol-intelligence-card";

type SymbolIntelligenceCardProps = {
  error?: string;
  loading?: boolean;
  model: SymbolIntelligenceCardModel;
};

export function SymbolIntelligenceCard({ error = "", loading = false, model }: SymbolIntelligenceCardProps) {
  const { isWatched, toggle } = useLocalWatchlist();
  const watched = isWatched(model.symbol);

  return (
    <div className="space-y-4" data-symbol-card-content="true">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-cyan-300/18 bg-slate-950/58 p-4 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="symbol-intelligence-card-title" className="font-mono text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {model.symbol}
                </h2>
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  {model.decision}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Research only
                </span>
              </div>
              <div className="mt-2 text-base font-semibold text-slate-200">{model.companyName}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{model.sector}</span>
                <span aria-hidden="true">/</span>
                <span>{model.assetClass}</span>
                <span aria-hidden="true">/</span>
                <span>{model.freshness}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[21rem]">
              <HeroMetric label="Price" value={model.currentPrice === null ? "N/A" : money(model.currentPrice)} />
              <HeroMetric label="Conviction" value={score(model.convictionScore)} />
              <HeroMetric label="Risk" value={score(model.riskScore)} tone={model.riskScore !== null && model.riskScore >= 70 ? "rose" : "amber"} />
            </div>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">{model.decisionExplanation}</p>
          <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-100">
            This card is evidence-backed research context, not financial advice. Missing provider-backed fields stay limited instead of being inferred.
          </div>
          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}
          {loading ? <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Hydrating symbol packet...</div> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Immediate actions</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${watched ? "border-amber-300/40 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-amber-300/35 hover:text-amber-100"}`}
              onClick={() => toggle(model.symbol)}
              type="button"
            >
              <Star className={`h-4 w-4 ${watched ? "fill-amber-300" : ""}`} />
              {watched ? "Watching" : "Watchlist"}
            </button>
            <ActionLink href={`/alerts?symbol=${encodeURIComponent(model.symbol)}&source=symbol-card`} icon={<Bell className="h-4 w-4" />} label="Create alert" />
            <ActionLink href={`/symbol/${encodeURIComponent(model.symbol)}#chart`} icon={<LineChart className="h-4 w-4" />} label="Full chart" />
            <ActionLink href={`/history?symbol=${encodeURIComponent(model.symbol)}`} icon={<History className="h-4 w-4" />} label="History" />
            <ActionLink href="/performance#history" icon={<ShieldAlert className="h-4 w-4" />} label="Performance" />
            <ActionLink href={`/discover?compare=${encodeURIComponent(model.symbol)}`} icon={<GitCompare className="h-4 w-4" />} label="Compare" />
          </div>
          <ActionLink className="mt-3 w-full border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/70" href={`/symbol/${encodeURIComponent(model.symbol)}`} icon={<ExternalLink className="h-4 w-4" />} label="Open full symbol page" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Decision zones</div>
              <h3 className="mt-1 text-lg font-semibold text-white">Price, risk, and change conditions</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] font-black text-slate-300">{model.dataConfidence}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {model.zones.map((zone) => (
              <div className={`rounded-2xl border p-3 ${zone.status === "available" ? "border-cyan-300/18 bg-cyan-300/[0.045]" : "border-amber-300/18 bg-amber-300/[0.055]"}`} key={zone.label}>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{zone.label}</div>
                <div className={`mt-1 min-h-5 break-words text-sm font-semibold ${zone.status === "available" ? "text-slate-100" : "text-amber-100"}`}>{zone.value}</div>
                {zone.limitedReason ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{zone.limitedReason}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Chart preview</div>
              <h3 className="mt-1 text-lg font-semibold text-white">Compact price context</h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">1H / 2H / 4H show limited unless stored intraday data exists</span>
          </div>
          <MiniSymbolChart model={model} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Intelligence context</div>
          <div className="mt-3 grid gap-2">
            <ContextLine label="Why now" value={model.decisionExplanation} />
            <ContextLine label="Scanner context" value={`Opened from ${model.sourceContext}. Conviction ${score(model.convictionScore)}; risk ${score(model.riskScore)}.`} />
            <ContextLine label="Macro / watchlist impact" value={`${model.sector}. Watchlist state is local/account-backed when available.`} />
            <ContextLine label="Replay / market memory" value={model.dataConfidence} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Source-linked events</div>
          <div className="mt-3 grid gap-2">
            {model.events.length ? model.events.map((event) => (
              <a className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 transition hover:border-cyan-300/30" href={event.sourceUrl} key={`${event.provider}:${event.timestamp}:${event.headline}`} rel="noreferrer" target="_blank">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
                  <span>{event.provider}</span>
                  <span>{event.freshness}</span>
                  <span>{event.uncertainty}</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-100">{event.headline}</p>
                <div className="mt-1 text-[11px] text-slate-500">{event.timestamp} · {event.affectedSymbols.join(", ")}</div>
              </a>
            )) : (
              <div className="rounded-2xl border border-dashed border-amber-300/20 bg-amber-300/[0.055] p-4 text-sm leading-6 text-amber-100">
                Limited: no source-linked event cards with provider, URL, timestamp, freshness, and uncertainty are available for this card.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Limited data closure</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {model.limitedFields.map((field) => <SourceFieldRow field={field} key={field.label} />)}
        </div>
      </section>
    </div>
  );
}

function ActionLink({ className = "", href, icon, label }: { className?: string; href: string; icon: ReactNode; label: string }) {
  const router = useRouter();

  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 ${className}`}
      data-symbol-navigation="page"
      href={href}
      onClick={(event) => handleCardNavigation(event, href, (target) => router.push(target))}
    >
      {icon}
      {label}
    </Link>
  );
}

function handleCardNavigation(event: MouseEvent<HTMLAnchorElement>, href: string, navigate: (href: string) => void): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  closeSymbolCard({ restoreFocus: false, restoreScroll: false, skipHistoryBack: true });
  window.setTimeout(() => navigate(href), 0);
}

function HeroMetric({ label, tone = "cyan", value }: { label: string; tone?: "amber" | "cyan" | "rose"; value: string }) {
  const toneClass = tone === "rose" ? "text-rose-100" : tone === "amber" ? "text-amber-100" : "text-cyan-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 truncate font-mono text-lg font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function SourceFieldRow({ field }: { field: SymbolSourceField }) {
  return (
    <div className={`rounded-2xl border p-3 ${field.status === "available" ? "border-emerald-300/18 bg-emerald-300/[0.055]" : "border-amber-300/18 bg-amber-300/[0.055]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{field.label}</div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${field.status === "available" ? "bg-emerald-300/15 text-emerald-100" : "bg-amber-300/15 text-amber-100"}`}>
          {field.status === "available" ? "Available" : "Limited"}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">{field.status === "available" ? field.value : field.limitedReason}</p>
      {field.provider || field.timestamp ? <div className="mt-2 text-[11px] text-slate-500">{field.provider ?? "Provider limited"} · {field.timestamp ?? "Timestamp limited"}</div> : null}
      {field.sourceUrl ? <a className="mt-1 inline-flex text-[11px] font-semibold text-cyan-200 hover:text-cyan-100" href={field.sourceUrl} rel="noreferrer" target="_blank">Open source</a> : null}
    </div>
  );
}

function MiniSymbolChart({ model }: { model: SymbolIntelligenceCardModel }) {
  if (model.chart.status === "limited") {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-amber-300/20 bg-amber-300/[0.055] p-8 text-center text-sm leading-6 text-amber-100">
        {model.chart.limitedReason}
      </div>
    );
  }
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/70">
      <svg aria-label={`${model.symbol} compact chart`} className="block h-[260px] w-full" preserveAspectRatio="none" role="img" viewBox="0 0 720 260">
        <defs>
          <linearGradient id={`symbol-card-chart-${model.symbol}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.38)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
          </linearGradient>
        </defs>
        <path d={areaPath(model.chart.points, 720, 260)} fill={`url(#symbol-card-chart-${model.symbol})`} />
        <path d={linePath(model.chart.points, 720, 260)} fill="none" stroke="rgb(103,232,249)" strokeLinecap="round" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="grid grid-cols-4 gap-2 border-t border-white/10 p-3 text-xs">
        {["1H", "2H", "4H", "1D", "1W", "1M", "6M", "1Y"].map((label) => (
          <span className={`rounded-full border px-2 py-1 text-center font-mono font-black ${["1D", "1W", "1M", "6M", "1Y"].includes(label) ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : "border-amber-300/20 bg-amber-300/[0.06] text-amber-100"}`} key={label}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function linePath(points: SymbolChartPoint[], width: number, height: number): string {
  const plotted = plottedPoints(points, width, height);
  return plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function areaPath(points: SymbolChartPoint[], width: number, height: number): string {
  const plotted = plottedPoints(points, width, height);
  if (!plotted.length) return "";
  const line = plotted.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  return `${line} L ${plotted.at(-1)?.x.toFixed(1) ?? width} ${height} L ${plotted[0]?.x.toFixed(1) ?? 0} ${height} Z`;
}

function plottedPoints(points: SymbolChartPoint[], width: number, height: number): Array<{ x: number; y: number }> {
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(0.01, max - min);
  const pad = 18;
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - pad - ((point.close - min) / span) * (height - pad * 2);
    return { x, y };
  });
}

function money(value: number): string {
  return value.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: value >= 100 ? 2 : 4, style: "currency" });
}

function score(value: number | null): string {
  return value === null ? "N/A" : `${value}/100`;
}
