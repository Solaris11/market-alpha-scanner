"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import { IntelligenceGraphPanel } from "@/components/visual/IntelligenceGraphPanel";
import { ScoreFactorStrip, type ScoreFactor, type VisualTone } from "@/components/visual/MiniVisuals";
import type { IntelligenceGraphModel } from "@/lib/trading/intelligence-graph";
import { humanizeInsightText } from "@/lib/ui/labels";

export type InteractiveInsightZoneItem = {
  bullets?: string[];
  dataSource?: string;
  detailSummary: string;
  detailTitle: string;
  emptyMessage?: string;
  eyebrow?: string;
  factors?: ScoreFactor[];
  href?: string;
  icon: ReactNode;
  id: string;
  label: string;
  metric?: string;
  monitorNext?: string[];
  relationshipGraph?: IntelligenceGraphModel;
  relatedSymbols?: string[];
  summary: string;
  tone?: VisualTone;
  updatedAt?: string;
};

const TONE_CLASS: Record<VisualTone, { accent: string; border: string; glow: string; icon: string; text: string }> = {
  amber: {
    accent: "bg-amber-300",
    border: "border-amber-300/25 hover:border-amber-200/55",
    glow: "hover:shadow-[0_0_38px_rgba(251,191,36,0.14)]",
    icon: "bg-amber-300/10 text-amber-100",
    text: "text-amber-100",
  },
  cyan: {
    accent: "bg-cyan-300",
    border: "border-cyan-300/25 hover:border-cyan-200/55",
    glow: "hover:shadow-[0_0_38px_rgba(34,211,238,0.14)]",
    icon: "bg-cyan-300/10 text-cyan-100",
    text: "text-cyan-100",
  },
  emerald: {
    accent: "bg-emerald-300",
    border: "border-emerald-300/25 hover:border-emerald-200/55",
    glow: "hover:shadow-[0_0_38px_rgba(52,211,153,0.14)]",
    icon: "bg-emerald-300/10 text-emerald-100",
    text: "text-emerald-100",
  },
  rose: {
    accent: "bg-rose-300",
    border: "border-rose-300/25 hover:border-rose-200/55",
    glow: "hover:shadow-[0_0_38px_rgba(251,113,133,0.14)]",
    icon: "bg-rose-300/10 text-rose-100",
    text: "text-rose-100",
  },
  violet: {
    accent: "bg-violet-300",
    border: "border-violet-300/25 hover:border-violet-200/55",
    glow: "hover:shadow-[0_0_38px_rgba(167,139,250,0.14)]",
    icon: "bg-violet-300/10 text-violet-100",
    text: "text-violet-100",
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort((left, right) => right.length - left.length);
}

function TextWithSymbolLinks({ symbols, text }: { symbols: string[]; text: string }) {
  const linkableSymbols = normalizedSymbols(symbols);
  if (!linkableSymbols.length) return <>{text}</>;

  const pattern = new RegExp(`(^|[^A-Za-z0-9.])(${linkableSymbols.map(escapeRegExp).join("|")})(?=$|[^A-Za-z0-9.])`, "g");
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const fullMatch = match[0] ?? "";
    const prefix = match[1] ?? "";
    const symbol = match[2] ?? "";
    const symbolStart = match.index + prefix.length;

    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (prefix) nodes.push(prefix);
    nodes.push(
      <Link
        className="font-mono font-black text-cyan-100 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-white hover:decoration-cyan-200"
        href={`/symbol/${encodeURIComponent(symbol.toUpperCase())}`}
        key={`${symbol}-${symbolStart}`}
      >
        {symbol}
      </Link>,
    );
    cursor = symbolStart + symbol.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}

export function InteractiveInsightZoneGrid({
  className = "",
  eyebrow = "Tap to explore",
  summary,
  title = "Intelligence Zones",
  zones,
}: {
  className?: string;
  eyebrow?: string;
  summary?: string;
  title?: string;
  zones: InteractiveInsightZoneItem[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeZone = useMemo(() => zones.find((zone) => zone.id === activeId) ?? null, [activeId, zones]);

  if (!zones.length) return null;

  return (
    <>
      <section className={`rounded-2xl border border-cyan-300/16 bg-slate-950/45 p-3 sm:p-4 ${className}`}>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">{title}</h2>
          </div>
          {summary ? <p className="max-w-2xl text-xs leading-5 text-slate-400">{summary}</p> : null}
        </div>
        <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3 2xl:grid-cols-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {zones.map((zone) => (
            <button
              aria-label={`Open ${zone.label} details`}
              className={`group min-w-[78vw] snap-center rounded-2xl border bg-white/[0.035] p-3 text-left transition sm:min-w-0 ${TONE_CLASS[zone.tone ?? "cyan"].border} ${TONE_CLASS[zone.tone ?? "cyan"].glow}`}
              data-stable-overlay-trigger="true"
              key={zone.id}
              onClick={() => setActiveId(zone.id)}
              type="button"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 ${TONE_CLASS[zone.tone ?? "cyan"].icon}`}>
                  {zone.icon}
                </div>
                {zone.metric ? (
                  <div className={`shrink-0 font-mono text-lg font-black ${TONE_CLASS[zone.tone ?? "cyan"].text}`}>{zone.metric}</div>
                ) : null}
              </div>
              <div className="mt-3 min-w-0">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{zone.eyebrow ?? "Explore"}</div>
                <div className="mt-1 text-sm font-black uppercase leading-5 tracking-[0.08em] text-slate-100">{zone.label}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{humanizeInsightText(zone.summary)}</p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 transition group-hover:text-cyan-100">
                Details
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <VisualDetailDrawer onClose={() => setActiveId(null)} zone={activeZone} />
    </>
  );
}

export function ShowcaseIntelligenceOrbit({
  centerLabel = "V",
  className = "",
  eyebrow = "Unified intelligence system",
  summary = "One connected TradeVeto workflow. Tap any intelligence node to inspect the data, source, related symbols, and what to monitor next.",
  title = "One System. One Focus.",
  zones,
}: {
  centerLabel?: string;
  className?: string;
  eyebrow?: string;
  summary?: string;
  title?: string;
  zones: InteractiveInsightZoneItem[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeZone = useMemo(() => zones.find((zone) => zone.id === activeId) ?? null, [activeId, zones]);
  const orbitZones = zones.slice(0, 10);

  if (!orbitZones.length) return null;

  return (
    <>
      <section className={`poster-scanline overflow-hidden rounded-3xl border border-cyan-300/16 bg-slate-950/55 p-4 shadow-2xl shadow-cyan-950/10 sm:p-5 ${className}`}>
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.88fr)_minmax(0,1.12fr)]">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</div>
              <h2 className="poster-display-title mt-2 text-3xl leading-tight text-slate-50 sm:text-4xl">
                {title.split(". ").map((part, index) => (
                  <span className={index === 1 ? "poster-word-cyan block" : "block"} key={part}>
                    {part}{index === 0 && title.includes(". ") ? "." : ""}
                  </span>
                ))}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{summary}</p>
            </div>
            <div className="mt-5 rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Click behavior</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Nodes open centered, data-backed detail surfaces. Missing history stays marked as limited evidence instead of drawing fake intelligence.
              </p>
            </div>
          </div>

          <div className="relative min-h-[430px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.14),rgba(15,23,42,0.52)_42%,rgba(2,6,23,0.72)_72%)] p-4">
            <div className="pointer-events-none absolute inset-4 rounded-full border border-cyan-300/10" />
            <div className="pointer-events-none absolute inset-14 rounded-full border border-violet-300/10" />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
            <div className="pointer-events-none absolute inset-y-6 left-1/2 w-px bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent" />

            <button
              aria-label="Open primary intelligence system summary"
              className="absolute left-1/2 top-1/2 z-30 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-200/35 bg-slate-950/88 shadow-[0_0_55px_rgba(34,211,238,0.28)] transition hover:scale-[1.02] hover:border-cyan-100/70"
              data-stable-overlay-trigger="true"
              onClick={() => setActiveId(orbitZones[0]?.id ?? null)}
              type="button"
            >
              <span className="poster-word-cyan font-mono text-5xl font-black">{centerLabel}</span>
              <span className="sr-only">Open intelligence overview</span>
            </button>

            <div className="relative z-20 grid h-full min-h-[398px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {orbitZones.map((zone, index) => {
                const tone = TONE_CLASS[zone.tone ?? "cyan"];
                const offsetClass = index % 4 === 1 ? "lg:mt-12" : index % 4 === 2 ? "lg:mt-28" : index % 4 === 3 ? "lg:mt-16" : "";
                return (
                  <button
                    aria-label={`Open ${zone.label} detail`}
                    className={`group min-w-0 rounded-2xl border bg-slate-950/64 p-3 text-left backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.06] ${tone.border} ${tone.glow} ${offsetClass}`}
                    data-stable-overlay-trigger="true"
                    key={zone.id}
                    onClick={() => setActiveId(zone.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 ${tone.icon}`}>
                        {zone.icon}
                      </div>
                      {zone.metric ? <div className={`ml-auto font-mono text-sm font-black ${tone.text}`}>{zone.metric}</div> : null}
                    </div>
                    <div className="mt-3 text-[10px] font-black uppercase leading-4 tracking-[0.12em] text-slate-100">{zone.label}</div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{humanizeInsightText(zone.summary)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <VisualDetailDrawer onClose={() => setActiveId(null)} zone={activeZone} />
    </>
  );
}

function VisualDetailDrawer({ onClose, zone }: { onClose: () => void; zone: InteractiveInsightZoneItem | null }) {
  if (!zone) return null;

  const tone = TONE_CLASS[zone.tone ?? "cyan"];
  const bullets = zone.bullets?.filter(Boolean).slice(0, 8) ?? [];
  const monitorNext = zone.monitorNext?.filter(Boolean).slice(0, 6) ?? [];
  const relatedSymbols = zone.relatedSymbols?.filter(Boolean).slice(0, 12) ?? [];

  return (
    <StableDetailOverlay
      analyticsSurface={`intelligence_zone_${zone.id}`}
      closeLabel="Close detail"
      description={<TextWithSymbolLinks symbols={relatedSymbols} text={humanizeInsightText(zone.detailSummary)} />}
      eyebrow={<span className={tone.text}>{zone.eyebrow ?? "Intelligence detail"}</span>}
      onClose={onClose}
      open={Boolean(zone)}
      size="lg"
      title={zone.detailTitle}
    >
        <div className={`mt-4 h-1 rounded-full ${tone.accent}`} />

        {relatedSymbols.length ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Related symbols</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedSymbols.map((symbol) => (
                <Link className={`rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-xs font-black transition hover:border-cyan-200/60 hover:bg-cyan-300/10 hover:text-white ${tone.text}`} href={`/symbol/${encodeURIComponent(symbol)}`} key={symbol}>
                  {symbol}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <ScoreFactorStrip
          className="mt-4"
          emptyMessage={zone.emptyMessage ?? "This zone does not have enough scored evidence for a factor chart yet."}
          factors={zone.factors ?? []}
          label="Data-backed factor view"
        />

        {zone.relationshipGraph ? <IntelligenceGraphPanel className="mt-4" compact graph={zone.relationshipGraph} /> : null}

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Why this is shown</div>
          {bullets.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {bullets.map((bullet) => (
                <li className="flex gap-2" key={bullet}>
                  <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone.accent}`} />
                  <span><TextWithSymbolLinks symbols={relatedSymbols} text={humanizeInsightText(bullet)} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-500">No extra drill-down items are available yet. TradeVeto will show more detail as evidence accumulates.</p>
          )}
        </div>

        {monitorNext.length ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">What to monitor next</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {monitorNext.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone.accent}`} />
                  <span><TextWithSymbolLinks symbols={relatedSymbols} text={humanizeInsightText(item)} /></span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 text-xs text-slate-500">
          {zone.dataSource ? <div>Data source: <span className="text-slate-300">{zone.dataSource}</span></div> : null}
          {zone.updatedAt ? <div>Last updated: <span className="text-slate-300">{zone.updatedAt}</span></div> : null}
          <div>Research only. Not financial advice.</div>
        </div>

        {zone.href ? (
          <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href={zone.href} onClick={onClose}>
            Open full detail
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
    </StableDetailOverlay>
  );
}
