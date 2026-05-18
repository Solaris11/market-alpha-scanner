"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "@visx/gradient";
import { Group } from "@visx/group";
import { Arc } from "@visx/shape";
import { motion } from "motion/react";
import { ResponsiveHeatMap } from "@nivo/heatmap";
import type { ComputedCell, TooltipProps } from "@nivo/heatmap";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PosterVisualTone = "amber" | "cyan" | "emerald" | "rose" | "violet";

export type PosterFactor = {
  detail?: string;
  label: string;
  tone?: PosterVisualTone;
  value: number | null | undefined;
};

export type PosterHeatCell = {
  detail?: string;
  label: string;
  tone?: PosterVisualTone;
  value: number | null;
};

export type PosterOrbitNode = {
  detail?: string;
  icon?: ReactNode;
  id?: string;
  label: string;
  metric?: string;
  score?: number | null;
  tone?: PosterVisualTone;
};

type ToneConfig = {
  glow: string;
  hex: string;
  rgb: string;
  soft: string;
  text: string;
};

const TONE: Record<PosterVisualTone, ToneConfig> = {
  amber: { glow: "rgba(251,191,36,0.30)", hex: "#fbbf24", rgb: "251,191,36", soft: "rgba(251,191,36,0.12)", text: "text-amber-100" },
  cyan: { glow: "rgba(34,211,238,0.30)", hex: "#22d3ee", rgb: "34,211,238", soft: "rgba(34,211,238,0.12)", text: "text-cyan-100" },
  emerald: { glow: "rgba(52,211,153,0.28)", hex: "#34d399", rgb: "52,211,153", soft: "rgba(52,211,153,0.12)", text: "text-emerald-100" },
  rose: { glow: "rgba(251,113,133,0.30)", hex: "#fb7185", rgb: "251,113,133", soft: "rgba(251,113,133,0.12)", text: "text-rose-100" },
  violet: { glow: "rgba(167,139,250,0.30)", hex: "#a78bfa", rgb: "167,139,250", soft: "rgba(167,139,250,0.12)", text: "text-violet-100" },
};

const GRID_STROKE = "rgba(148,163,184,0.12)";
const AXIS_STROKE = "rgba(148,163,184,0.44)";
const CHART_TEXT = "#94a3b8";

type SeriesPoint = {
  index: number;
  label: string;
  value: number;
};

type BarPoint = SeriesPoint & {
  fill: string;
  positive: boolean;
};

type HeatDatum = {
  cellIndex: number;
  x: string;
  y: number | null;
};

type HeatExtraProps = Record<never, never>;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toneForValue(value: number): PosterVisualTone {
  if (value >= 70) return "emerald";
  if (value >= 50) return "amber";
  if (value <= 35) return "rose";
  return "cyan";
}

function sanitizedSeries(values: Array<number | null | undefined>): SeriesPoint[] {
  return values
    .map((value, index) => ({ index, value: finiteNumber(value) }))
    .filter((point): point is { index: number; value: number } => point.value !== null)
    .map((point) => ({ index: point.index, label: `${point.index + 1}`, value: point.value }));
}

function formatValue(value: number | null | undefined): string {
  const safe = finiteNumber(value);
  return safe === null ? "N/A" : `${Math.round(safe)}`;
}

function chartTooltipStyle(): { backgroundColor: string; border: string; borderRadius: number; color: string; boxShadow: string } {
  return {
    backgroundColor: "rgba(2,6,23,0.96)",
    border: "1px solid rgba(103,232,249,0.22)",
    borderRadius: 14,
    boxShadow: "0 18px 50px rgba(0,0,0,0.42)",
    color: "#e2e8f0",
  };
}

function rechartsValueFormatter(value: unknown): [string, string] {
  const numeric = typeof value === "number" && Number.isFinite(value) ? Math.round(value).toString() : String(value ?? "N/A");
  return [numeric, "Value"];
}

function rechartsLabelFormatter(label: ReactNode): string {
  return `Point ${String(label ?? "")}`;
}

function MeasuredChartFrame({
  children,
  height,
}: {
  children: (size: { height: number; width: number }) => ReactNode;
  height: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width);
      setWidth(nextWidth > 1 ? nextWidth : 0);
    };

    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full min-w-0" ref={ref} style={{ height, minHeight: height }}>
      {width > 1 ? children({ height, width }) : <div aria-hidden="true" className="h-full rounded-xl bg-white/[0.02]" />}
    </div>
  );
}

export function PosterEmptyVisual({
  className = "",
  message,
}: {
  className?: string;
  message: string;
}) {
  return (
    <div className={`grid min-h-24 place-items-center rounded-2xl border border-dashed border-white/10 bg-slate-950/45 px-4 py-5 text-center text-xs leading-5 text-slate-500 ${className}`}>
      {message}
    </div>
  );
}

export function PosterRadialGauge({
  className = "",
  emptyMessage = "Limited evidence",
  label,
  score,
  tone = "cyan",
}: {
  className?: string;
  emptyMessage?: string;
  label: string;
  score: number | null | undefined;
  tone?: PosterVisualTone;
}) {
  const safe = finiteNumber(score);
  const value = safe === null ? null : clamp(safe);
  const config = TONE[tone];
  const startAngle = -Math.PI * 0.72;
  const endAngle = Math.PI * 0.72;
  const progressAngle = value === null ? startAngle : startAngle + ((endAngle - startAngle) * value) / 100;
  const needleAngle = progressAngle - Math.PI / 2;
  const needleX = Math.cos(needleAngle) * 42;
  const needleY = Math.sin(needleAngle) * 42;
  const gradientId = `poster-gauge-${tone}-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  return (
    <motion.div
      className={`rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
      initial={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, scale: 1 }}
    >
      <div className="mx-auto h-32 w-full max-w-[11rem]">
        {value === null ? (
          <PosterEmptyVisual className="h-full" message={emptyMessage} />
        ) : (
          <svg aria-label={`${label}: ${Math.round(value)}`} className="h-full w-full overflow-visible" role="img" viewBox="0 0 160 124">
            <LinearGradient from={config.hex} fromOpacity={0.92} id={gradientId} to="#e0f2fe" toOpacity={0.96} />
            <Group left={80} top={82}>
              <Arc endAngle={endAngle} fill="rgba(148,163,184,0.14)" innerRadius={48} outerRadius={61} startAngle={startAngle} />
              <Arc endAngle={progressAngle} fill={`url(#${gradientId})`} innerRadius={48} outerRadius={61} startAngle={startAngle} />
              <circle fill="rgba(2,6,23,0.88)" r={38} stroke="rgba(148,163,184,0.16)" strokeWidth={1} />
              <line stroke="#f8fafc" strokeLinecap="round" strokeWidth={4} x1={0} x2={needleX} y1={0} y2={needleY} />
              <circle fill={config.hex} r={5} />
              <text dominantBaseline="middle" fill="#f8fafc" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={28} fontWeight={900} textAnchor="middle" y={16}>
                {Math.round(value)}
              </text>
            </Group>
            <text fill={CHART_TEXT} fontSize={10} fontWeight={800} letterSpacing={1.8} textAnchor="middle" x={80} y={116}>
              {label.toUpperCase()}
            </text>
          </svg>
        )}
      </div>
    </motion.div>
  );
}

export function PosterTrendChart({
  className = "",
  emptyMessage = "No validated trend history yet.",
  label,
  tone = "cyan",
  values,
}: {
  className?: string;
  emptyMessage?: string;
  label: string;
  tone?: PosterVisualTone;
  values: Array<number | null | undefined>;
}) {
  const data = sanitizedSeries(values);
  const config = TONE[tone];
  const gradientId = `poster-area-${tone}-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  return (
    <motion.div className={`rounded-2xl border border-white/10 bg-slate-950/45 p-3 ${className}`} whileHover={{ scale: 1.008 }} transition={{ duration: 0.2 }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
        <div className="rounded-full px-2 py-0.5 font-mono text-[10px] font-black" style={{ backgroundColor: config.soft, color: config.hex }}>
          {data.length >= 2 ? `${data.length} pts` : "Limited"}
        </div>
      </div>
      {data.length >= 2 ? (
        <MeasuredChartFrame height={80}>
          {({ height, width }) => (
            <AreaChart data={data} height={height} margin={{ bottom: 4, left: 0, right: 0, top: 8 }} width={width}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={config.hex} stopOpacity={0.42} />
                  <stop offset="100%" stopColor={config.hex} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis domain={["dataMin", "dataMax"]} hide />
              <Tooltip contentStyle={chartTooltipStyle()} cursor={{ stroke: config.hex, strokeOpacity: 0.28 }} formatter={rechartsValueFormatter} labelFormatter={rechartsLabelFormatter} />
              <Area dataKey="value" fill={`url(#${gradientId})`} isAnimationActive stroke={config.hex} strokeWidth={2.5} type="monotone" />
            </AreaChart>
          )}
        </MeasuredChartFrame>
      ) : (
        <PosterEmptyVisual className="h-20" message={emptyMessage} />
      )}
    </motion.div>
  );
}

export function PosterMovementBars({
  className = "",
  emptyMessage = "No validated visual history yet.",
  tone = "cyan",
  values,
}: {
  className?: string;
  emptyMessage?: string;
  tone?: PosterVisualTone;
  values: Array<number | null | undefined>;
}) {
  const series = sanitizedSeries(values);
  const config = TONE[tone];
  const data: BarPoint[] = series.slice(0, 18).map((point, index) => {
    const previous = index === 0 ? point.value : series[index - 1]?.value ?? point.value;
    const positive = point.value >= previous;
    return { ...point, fill: positive ? config.hex : TONE.rose.hex, positive };
  });

  return (
    <motion.div className={`poster-mini-chart rounded-2xl border border-white/10 bg-slate-950/45 p-3 ${className}`} whileHover={{ scale: 1.008 }} transition={{ duration: 0.2 }}>
      {data.length >= 2 ? (
        <MeasuredChartFrame height={96}>
          {({ height, width }) => (
            <BarChart data={data} height={height} margin={{ bottom: 0, left: 0, right: 0, top: 8 }} width={width}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip contentStyle={chartTooltipStyle()} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={rechartsValueFormatter} labelFormatter={rechartsLabelFormatter} />
              <Bar dataKey="value" radius={[5, 5, 1, 1]}>
                {data.map((point) => (
                  <Cell fill={point.fill} fillOpacity={point.positive ? 0.86 : 0.78} key={`${point.label}:${point.value}`} />
                ))}
              </Bar>
            </BarChart>
          )}
        </MeasuredChartFrame>
      ) : (
        <PosterEmptyVisual className="h-24" message={emptyMessage} />
      )}
    </motion.div>
  );
}

export function PosterFactorBars({
  className = "",
  emptyMessage = "Insufficient scored evidence for a visual breakdown.",
  factors,
  label = "Data-backed factors",
}: {
  className?: string;
  emptyMessage?: string;
  factors: PosterFactor[];
  label?: string;
}) {
  const data = factors
    .map((factor) => ({ ...factor, value: finiteNumber(factor.value) }))
    .filter((factor): factor is PosterFactor & { value: number } => factor.value !== null)
    .slice(0, 7)
    .map((factor) => ({ ...factor, fill: TONE[factor.tone ?? toneForValue(factor.value)].hex, value: clamp(factor.value) }));

  if (!data.length) {
    return (
      <div className={`rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-3 ${className}`}>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <PosterEmptyVisual className="mt-2" message={emptyMessage} />
      </div>
    );
  }

  return (
    <motion.div className={`rounded-2xl border border-white/10 bg-slate-950/35 p-3 ${className}`} whileHover={{ scale: 1.004 }} transition={{ duration: 0.18 }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <div className="text-[10px] font-bold text-slate-500">{data.length} drivers</div>
      </div>
      <MeasuredChartFrame height={150}>
        {({ height, width }) => (
          <BarChart data={data} height={height} layout="vertical" margin={{ bottom: 4, left: 0, right: 26, top: 4 }} width={width}>
            <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
            <XAxis domain={[0, 100]} hide type="number" />
            <YAxis axisLine={false} dataKey="label" tick={{ fill: CHART_TEXT, fontSize: 10, fontWeight: 700 }} tickLine={false} type="category" width={112} />
            <Tooltip contentStyle={chartTooltipStyle()} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={rechartsValueFormatter} />
            <Bar dataKey="value" radius={[0, 7, 7, 0]}>
              {data.map((factor) => (
                <Cell fill={factor.fill} fillOpacity={0.86} key={`${factor.label}:${factor.value}`} />
              ))}
            </Bar>
          </BarChart>
        )}
      </MeasuredChartFrame>
    </motion.div>
  );
}

export function PosterMetricBars({
  metrics,
}: {
  metrics: Array<{ label: string; tone?: PosterVisualTone; value: number | null }>;
}) {
  const data = metrics
    .map((metric) => ({ ...metric, value: finiteNumber(metric.value) }))
    .filter((metric): metric is { label: string; tone?: PosterVisualTone; value: number } => metric.value !== null)
    .map((metric) => ({ ...metric, fill: TONE[metric.tone ?? toneForValue(metric.value)].hex, value: clamp(metric.value) }));

  if (!data.length) {
    return <PosterEmptyVisual message="Data unavailable" />;
  }

  return (
    <MeasuredChartFrame height={92}>
      {({ height, width }) => (
        <BarChart data={data} height={height} layout="vertical" margin={{ bottom: 2, left: 0, right: 22, top: 2 }} width={width}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis domain={[0, 100]} hide type="number" />
          <YAxis axisLine={false} dataKey="label" tick={{ fill: CHART_TEXT, fontSize: 9, fontWeight: 800 }} tickLine={false} type="category" width={96} />
          <Tooltip contentStyle={chartTooltipStyle()} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={rechartsValueFormatter} />
          <Bar dataKey="value" radius={[0, 7, 7, 0]}>
            {data.map((metric) => (
              <Cell fill={metric.fill} fillOpacity={0.88} key={`${metric.label}:${metric.value}`} />
            ))}
          </Bar>
        </BarChart>
      )}
    </MeasuredChartFrame>
  );
}

export function PosterHeatmapChart({
  cells,
  className = "",
  emptyMessage = "No validated heat-map data is available yet.",
  onCellSelect,
}: {
  cells: PosterHeatCell[];
  className?: string;
  emptyMessage?: string;
  onCellSelect?: (cell: PosterHeatCell) => void;
}) {
  const visibleCells = cells.filter((cell) => finiteNumber(cell.value) !== null).slice(0, 16);
  if (!visibleCells.length) {
    return <PosterEmptyVisual className={className} message={emptyMessage} />;
  }

  const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(visibleCells.length))));
  const rows = Math.ceil(visibleCells.length / columns);
  const data = Array.from({ length: rows }).map((_, rowIndex) => ({
    id: `Layer ${rowIndex + 1}`,
    data: Array.from({ length: columns }).map((__, columnIndex): HeatDatum => {
      const cellIndex = rowIndex * columns + columnIndex;
      const cell = visibleCells[cellIndex];
      return {
        cellIndex,
        x: cell?.label ?? `Empty ${columnIndex + 1}`,
        y: cell ? clamp(cell.value ?? 0) : null,
      };
    }),
  }));

  const resolveCell = (cell: ComputedCell<HeatDatum>): PosterHeatCell | null => {
    const source = visibleCells[cell.data.cellIndex];
    return source ?? null;
  };

  return (
    <div className={`h-64 rounded-2xl border border-cyan-300/16 bg-slate-950/45 p-2 ${className}`}>
      <ResponsiveHeatMap<HeatDatum, HeatExtraProps>
        activeOpacity={1}
        ariaLabel="TradeVeto validated intelligence heatmap"
        axisBottom={null}
        axisLeft={null}
        axisRight={null}
        axisTop={null}
        borderColor="rgba(255,255,255,0.18)"
        borderRadius={10}
        borderWidth={1}
        colors={(cell) => heatColor(cell.value)}
        data={data}
        emptyColor="rgba(15,23,42,0.72)"
        enableGridX={false}
        enableGridY={false}
        enableLabels
        inactiveOpacity={0.52}
        margin={{ bottom: 8, left: 8, right: 8, top: 8 }}
        motionConfig="gentle"
        onClick={(cell) => {
          const source = resolveCell(cell);
          if (source) onCellSelect?.(source);
        }}
        renderWrapper
        theme={{
          labels: { text: { fill: "#e2e8f0", fontSize: 10, fontWeight: 800 } },
          tooltip: { container: chartTooltipStyle() },
        }}
        tooltip={({ cell }: TooltipProps<HeatDatum>) => {
          const source = resolveCell(cell);
          return (
            <div className="max-w-60 rounded-xl border border-cyan-300/20 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl">
              <div className="font-black text-cyan-100">{source?.label ?? cell.data.x}</div>
              <div className="mt-1 font-mono text-lg font-black">{formatValue(source?.value)}</div>
              {source?.detail ? <div className="mt-1 leading-5 text-slate-400">{source.detail}</div> : null}
            </div>
          );
        }}
        valueFormat={(value) => `${Math.round(value)}`}
        xInnerPadding={0.08}
        yInnerPadding={0.08}
      />
    </div>
  );
}

export function PosterIntelligenceOrbit({
  centerLabel = "TradeVeto",
  className = "",
  emptyMessage = "No validated intelligence categories are available yet.",
  nodes,
  onNodeClick,
}: {
  centerLabel?: string;
  className?: string;
  emptyMessage?: string;
  nodes: PosterOrbitNode[];
  onNodeClick?: (node: PosterOrbitNode, index: number) => void;
}) {
  const visible = nodes.slice(0, 10);
  if (!visible.length) {
    return <PosterEmptyVisual className={className} message={emptyMessage} />;
  }

  const width = 460;
  const height = 320;
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = 178;
  const radiusY = 112;
  const positions = visible.map((node, index) => {
    const angle = -Math.PI / 2 + (index / visible.length) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;
    return { angle, node, x, y };
  });

  return (
    <div className={`relative min-h-[20rem] overflow-hidden rounded-3xl border border-cyan-300/16 bg-slate-950/45 ${className}`}>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <radialGradient cx="50%" cy="50%" id="orbitGlow" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
        </defs>
        <ellipse cx={centerX} cy={centerY} fill="none" rx={radiusX} ry={radiusY} stroke="rgba(103,232,249,0.16)" strokeDasharray="5 7" />
        <ellipse cx={centerX} cy={centerY} fill="none" rx={radiusX * 0.7} ry={radiusY * 0.68} stroke="rgba(167,139,250,0.10)" strokeDasharray="3 8" />
        <circle cx={centerX} cy={centerY} fill="url(#orbitGlow)" r={95} />
        {positions.map(({ node, x, y }) => {
          const tone = TONE[node.tone ?? "cyan"];
          return <line key={`line-${node.id ?? node.label}`} stroke={tone.hex} strokeOpacity={0.38} strokeWidth={1.4} x1={centerX} x2={x} y1={centerY} y2={y} />;
        })}
        <circle cx={centerX} cy={centerY} fill="rgba(2,6,23,0.86)" r={48} stroke="rgba(103,232,249,0.42)" strokeWidth={1.4} />
        <text fill="#f8fafc" fontSize={15} fontWeight={900} letterSpacing={2.4} textAnchor="middle" x={centerX} y={centerY - 3}>
          {centerLabel.toUpperCase()}
        </text>
        <text fill="#67e8f9" fontSize={10} fontWeight={900} letterSpacing={1.8} textAnchor="middle" x={centerX} y={centerY + 18}>
          LIVE INTELLIGENCE
        </text>
      </svg>

      <div className="absolute inset-0">
        {positions.map(({ node, x, y }, index) => {
          const tone = TONE[node.tone ?? "cyan"];
          const score = finiteNumber(node.score);
          return (
            <motion.button
              className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border bg-slate-950/78 px-2 py-2 text-center shadow-2xl backdrop-blur-md"
              data-stable-overlay-trigger="true"
              key={node.id ?? node.label}
              onClick={(event) => {
                event.stopPropagation();
                onNodeClick?.(node, index);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onNodeClick?.(node, index);
              }}
              style={{
                borderColor: `rgba(${tone.rgb},0.32)`,
                boxShadow: `0 0 28px ${tone.glow}`,
                color: tone.hex,
                left: `${(x / width) * 100}%`,
                top: `${(y / height) * 100}%`,
              }}
              transition={{ duration: 0.18 }}
              type="button"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-current/35 bg-white/[0.04] text-current">
                {node.icon ?? <span className="h-2.5 w-2.5 rounded-full bg-current" />}
              </span>
              <span className="line-clamp-2 text-[10px] font-black uppercase leading-3 tracking-[0.08em] text-slate-100">{node.label}</span>
              <span className="font-mono text-[10px] font-black text-current">{node.metric ?? (score === null ? "Limited" : Math.round(score))}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function heatColor(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "rgba(15,23,42,0.72)";
  const safe = clamp(value);
  if (safe >= 75) return "rgba(52,211,153,0.82)";
  if (safe >= 55) return "rgba(251,191,36,0.78)";
  if (safe >= 35) return "rgba(167,139,250,0.70)";
  return "rgba(251,113,133,0.78)";
}
