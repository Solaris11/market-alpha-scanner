"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Expand, Info, X } from "lucide-react";
import {
  INTERACTIVE_CHART_PERIODS,
  filterInteractivePricePoints,
  pricePointIsoDate,
  summarizePriceMove,
  validClosePoints,
  type InteractiveChartPacket,
  type InteractiveChartPeriod,
  type InteractivePricePoint,
} from "@/lib/interactive-chart-data";

type Tone = "cyan" | "emerald" | "rose" | "violet";

type InteractivePriceChartProps = {
  className?: string;
  defaultPeriod?: InteractiveChartPeriod;
  interpretation?: string;
  label?: string;
  relatedSignals?: string[];
  tone?: Tone;
  compact?: boolean;
  packet: InteractiveChartPacket;
};

type ChartGeometry = {
  circles: Array<{ cx: number; cy: number; point: InteractivePricePoint & { close: number } }>;
  height: number;
  path: string;
  width: number;
};

const TONE_CLASSES: Record<Tone, { border: string; glow: string; line: string; text: string }> = {
  cyan: {
    border: "border-cyan-300/25 hover:border-cyan-200/55",
    glow: "shadow-cyan-950/20",
    line: "#22d3ee",
    text: "text-cyan-100",
  },
  emerald: {
    border: "border-emerald-300/25 hover:border-emerald-200/55",
    glow: "shadow-emerald-950/20",
    line: "#34d399",
    text: "text-emerald-100",
  },
  rose: {
    border: "border-rose-300/25 hover:border-rose-200/55",
    glow: "shadow-rose-950/20",
    line: "#fb7185",
    text: "text-rose-100",
  },
  violet: {
    border: "border-violet-300/25 hover:border-violet-200/55",
    glow: "shadow-violet-950/20",
    line: "#a78bfa",
    text: "text-violet-100",
  },
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function InteractivePriceChart({
  className = "",
  defaultPeriod = "1mo",
  interpretation,
  label,
  relatedSignals = [],
  tone = "cyan",
  compact = false,
  packet,
}: InteractivePriceChartProps) {
  const [period, setPeriod] = useState<InteractiveChartPeriod>(defaultPeriod);
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(() => filterInteractivePricePoints(packet.rows, period), [packet.rows, period]);
  const summary = useMemo(() => summarizePriceMove(filtered), [filtered]);
  const valid = useMemo(() => validClosePoints(filtered), [filtered]);
  const toneClass = TONE_CLASSES[tone];
  const chartTitle = label ?? packet.symbol;
  const changeClass = summary.tone === "up" ? "text-emerald-200" : summary.tone === "down" ? "text-rose-200" : "text-slate-300";
  const changeText = summary.changePct === null ? "Limited data" : `${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(2)}%`;

  return (
    <>
      <article
        className={`group min-w-0 overflow-hidden rounded-2xl border bg-slate-950/55 shadow-xl transition hover:bg-slate-950/70 ${toneClass.border} ${toneClass.glow} ${className}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3 p-4 pb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`font-mono text-lg font-black ${toneClass.text}`}>{packet.symbol}</div>
              <div className="truncate text-xs font-semibold text-slate-400">{chartTitle}</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>{packet.pointCount.toLocaleString()} stored points</span>
              <span aria-hidden="true">·</span>
              <span>{packet.lastUpdated ? `Updated ${formatShortDate(packet.lastUpdated)}` : "No timestamp"}</span>
            </div>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
            onClick={() => setExpanded(true)}
            type="button"
            aria-label={`Expand ${packet.symbol} chart`}
          >
            <Expand className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4">
          <PeriodSwitcher active={period} onChange={setPeriod} />
        </div>

        <button
          className="block w-full text-left"
          onClick={() => setExpanded(true)}
          type="button"
          aria-label={`Open ${packet.symbol} chart details`}
        >
          <div className={`${compact ? "h-32" : "h-40"} px-3 py-2`}>
            {valid.length >= 2 ? (
              <PriceSvg points={valid} tone={tone} />
            ) : (
              <ChartLimitedState error={packet.error} period={period} />
            )}
          </div>
        </button>

        <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-white/10 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Interpretation</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{interpretation ?? defaultInterpretation(packet.symbol, summary)}</p>
          </div>
          <div className="text-right">
            <div className={`font-mono text-lg font-black ${changeClass}`}>{changeText}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{period}</div>
          </div>
        </div>
      </article>

      {expanded ? (
        <ExpandedChartModal
          changeText={changeText}
          chartTitle={chartTitle}
          close={() => setExpanded(false)}
          interpretation={interpretation ?? defaultInterpretation(packet.symbol, summary)}
          packet={packet}
          period={period}
          relatedSignals={relatedSignals}
          setPeriod={setPeriod}
          tone={tone}
        />
      ) : null}
    </>
  );
}

function PeriodSwitcher({ active, onChange }: { active: InteractiveChartPeriod; onChange: (period: InteractiveChartPeriod) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {INTERACTIVE_CHART_PERIODS.map((period) => (
        <button
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition ${
            active === period
              ? "border-cyan-300/55 bg-cyan-300/12 text-cyan-100"
              : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-white/20 hover:text-slate-200"
          }`}
          key={period}
          onClick={(event) => {
            event.stopPropagation();
            onChange(period);
          }}
          type="button"
        >
          {period}
        </button>
      ))}
    </div>
  );
}

function PriceSvg({ points, tone }: { points: Array<InteractivePricePoint & { close: number }>; tone: Tone }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartId = useId().replace(/:/g, "");
  const geometry = useMemo(() => buildGeometry(points), [points]);
  const hovered = hoverIndex === null ? null : geometry.circles[hoverIndex] ?? null;
  const lineColor = TONE_CLASSES[tone].line;
  const fillId = `chart-fill-${tone}-${chartId}`;
  const glowId = `chart-glow-${tone}-${chartId}`;

  return (
    <div className="relative h-full w-full">
      <svg
        className="h-full w-full overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(event) => {
          const box = svgRef.current?.getBoundingClientRect();
          if (!box || !geometry.circles.length) return;
          const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
          setHoverIndex(Math.round(ratio * (geometry.circles.length - 1)));
        }}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          const box = svgRef.current?.getBoundingClientRect();
          if (!touch || !box || !geometry.circles.length) return;
          const ratio = Math.min(1, Math.max(0, (touch.clientX - box.left) / box.width));
          setHoverIndex(Math.round(ratio * (geometry.circles.length - 1)));
        }}
        ref={svgRef}
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        role="img"
        aria-label="Validated price history chart"
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.24" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0.25, 0.5, 0.75].map((line) => (
          <line key={line} x1="0" x2={geometry.width} y1={geometry.height * line} y2={geometry.height * line} stroke="rgba(148,163,184,0.13)" strokeDasharray="4 6" />
        ))}
        <path d={`${geometry.path} L ${geometry.width} ${geometry.height} L 0 ${geometry.height} Z`} fill={`url(#${fillId})`} />
        <path d={geometry.path} fill="none" filter={`url(#${glowId})`} stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {hovered ? (
          <>
            <line x1={hovered.cx} x2={hovered.cx} y1="0" y2={geometry.height} stroke="rgba(226,232,240,0.28)" strokeDasharray="4 5" />
            <circle cx={hovered.cx} cy={hovered.cy} fill={lineColor} r="4" stroke="#020617" strokeWidth="2" />
          </>
        ) : null}
      </svg>
      {hovered ? (
        <div
          className="pointer-events-none absolute top-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs shadow-xl backdrop-blur-xl"
          style={{ left: `${Math.min(78, Math.max(0, (hovered.cx / geometry.width) * 100))}%` }}
        >
          <div className="font-mono font-black text-slate-100">{formatPrice(hovered.point.close)}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">{pricePointIsoDate(hovered.point)}</div>
        </div>
      ) : null}
    </div>
  );
}

function ExpandedChartModal({
  changeText,
  chartTitle,
  close,
  interpretation,
  packet,
  period,
  relatedSignals,
  setPeriod,
  tone,
}: {
  changeText: string;
  chartTitle: string;
  close: () => void;
  interpretation: string;
  packet: InteractiveChartPacket;
  period: InteractiveChartPeriod;
  relatedSignals: string[];
  setPeriod: (period: InteractiveChartPeriod) => void;
  tone: Tone;
}) {
  const filtered = useMemo(() => filterInteractivePricePoints(packet.rows, period), [packet.rows, period]);
  const valid = useMemo(() => validClosePoints(filtered), [filtered]);
  const toneClass = TONE_CLASSES[tone];
  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`${packet.symbol} chart detail`}>
      <button className="absolute inset-0 cursor-default bg-slate-950/75 backdrop-blur-md" onClick={close} type="button" aria-label="Close chart detail" />
      <section className="relative z-10 max-h-[min(90vh,900px)] w-full max-w-5xl overflow-auto overscroll-contain rounded-3xl border border-cyan-300/20 bg-slate-950 p-4 shadow-2xl shadow-black/75 ring-1 ring-cyan-300/10 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className={`text-[10px] font-black uppercase tracking-[0.24em] ${toneClass.text}`}>Interactive chart</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{packet.symbol} · {chartTitle}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{interpretation}</p>
          </div>
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100" onClick={close} type="button" aria-label="Close chart detail">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <PeriodSwitcher active={period} onChange={setPeriod} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Move: <span className={toneClass.text}>{changeText}</span></span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Source: {packet.dataSource}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">Updated: {packet.lastUpdated ? formatShortDate(packet.lastUpdated) : "Unavailable"}</span>
          </div>
        </div>

        <div className="mt-4 h-[360px] rounded-2xl border border-white/10 bg-slate-950/70 p-3">
          {valid.length >= 2 ? <PriceSvg points={valid} tone={tone} /> : <ChartLimitedState error={packet.error} period={period} />}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <DetailTile label="Data coverage" value={`${valid.length.toLocaleString()} usable points`} detail={packet.startDate && packet.endDate ? `${packet.startDate} to ${packet.endDate}` : "No validated range yet."} />
          <DetailTile label="Trend summary" value={changeText} detail="Calculated from the visible validated close prices in the selected timeframe." />
          <DetailTile label="TradeVeto context" value="Research only" detail="This chart provides market context. It is not a trade instruction or financial advice." />
        </div>

        {relatedSignals.length ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              <Info className="h-3.5 w-3.5" />
              Related TradeVeto signals
            </div>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-300 md:grid-cols-2">
              {relatedSignals.slice(0, 6).map((signal) => (
                <li className="flex gap-2" key={signal}>
                  <ArrowUpRight className={`mt-1 h-4 w-4 shrink-0 ${toneClass.text}`} />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DetailTile({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-lg font-black text-slate-50">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function ChartLimitedState({ error, period }: { error?: string; period: InteractiveChartPeriod }) {
  return (
    <div className="flex h-full min-h-28 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-center">
      <div>
        <div className="text-sm font-semibold text-slate-200">Limited data for {period}</div>
        <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{error ?? "This range is hidden until at least two validated price points are available. No synthetic chart data is drawn."}</p>
      </div>
    </div>
  );
}

function buildGeometry(points: Array<InteractivePricePoint & { close: number }>): ChartGeometry {
  const width = 420;
  const height = 150;
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = Math.max(max - min, Math.abs(max) * 0.01, 1);
  const circles = points.map((point, index) => {
    const cx = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const cy = height - ((point.close - min) / span) * (height - 16) - 8;
    return { cx, cy, point };
  });
  return {
    circles,
    height,
    path: circles.map((point, index) => `${index === 0 ? "M" : "L"} ${point.cx.toFixed(2)} ${point.cy.toFixed(2)}`).join(" "),
    width,
  };
}

function defaultInterpretation(symbol: string, summary: ReturnType<typeof summarizePriceMove>): string {
  if (summary.changePct === null) return `${symbol} has insufficient validated history in this selected range.`;
  if (summary.tone === "up") return `${symbol} is rising across the selected validated range. Use this as context alongside TradeVeto risk and regime signals.`;
  if (summary.tone === "down") return `${symbol} is weakening across the selected validated range. Review risk pressure and setup quality before interpreting the move.`;
  return `${symbol} is mostly flat across the selected validated range. Watch for confirmation before overreading the chart.`;
}

function formatShortDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value.slice(0, 16);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(parsed));
}

function formatPrice(value: number): string {
  return `$${CURRENCY_FORMATTER.format(value)}`;
}
