"use client";

import Link from "next/link";
import type { ReactNode, TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
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

function VisualDetailDrawer({ onClose, zone }: { onClose: () => void; zone: InteractiveInsightZoneItem | null }) {
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!zone) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, zone]);

  if (!zone) return null;

  const tone = TONE_CLASS[zone.tone ?? "cyan"];
  const bullets = zone.bullets?.filter(Boolean).slice(0, 8) ?? [];
  const monitorNext = zone.monitorNext?.filter(Boolean).slice(0, 6) ?? [];
  const relatedSymbols = zone.relatedSymbols?.filter(Boolean).slice(0, 12) ?? [];

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    if (touchStartY.current === null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;
    setDragY(Math.max(0, Math.min(160, currentY - touchStartY.current)));
  }

  function handleTouchEnd() {
    if (dragY > 72) onClose();
    setDragY(0);
    touchStartY.current = null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${zone.label} detail`}>
      <button className="absolute inset-0 cursor-default bg-slate-950/75 backdrop-blur-md" onClick={onClose} type="button" aria-label="Close detail drawer" />
      <aside
        className="relative z-10 max-h-[88dvh] w-full max-w-3xl overflow-auto overscroll-contain rounded-t-[2rem] border border-cyan-300/18 bg-slate-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/70 ring-1 ring-cyan-300/10 transition-transform sm:max-h-[min(88vh,860px)] sm:rounded-3xl sm:p-6"
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${tone.text}`}>{zone.eyebrow ?? "Intelligence detail"}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{zone.detailTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              <TextWithSymbolLinks symbols={relatedSymbols} text={humanizeInsightText(zone.detailSummary)} />
            </p>
          </div>
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" onClick={onClose} type="button" aria-label="Close detail drawer">
            <X className="h-4 w-4" />
          </button>
        </div>

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
      </aside>
    </div>
  );
}
