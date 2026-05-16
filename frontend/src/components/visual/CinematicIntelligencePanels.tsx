import Link from "next/link";
import type { ReactNode } from "react";
import {
  HeatDots,
  MiniCandleStrip,
  MiniSparkline,
  PosterGauge,
  ScoreFactorStrip,
  VisualMetricRail,
  type ScoreFactor,
  type VisualTone,
} from "@/components/visual/MiniVisuals";

type ToneStyle = {
  border: string;
  glow: string;
  icon: string;
  panel: string;
  text: string;
};

const TONE_STYLE: Record<VisualTone, ToneStyle> = {
  amber: {
    border: "border-amber-300/25",
    glow: "shadow-[0_0_36px_rgba(251,191,36,0.12)]",
    icon: "bg-amber-300/12 text-amber-100 ring-amber-200/20",
    panel: "from-amber-400/[0.12] via-slate-950/55 to-slate-950/35",
    text: "text-amber-100",
  },
  cyan: {
    border: "border-cyan-300/25",
    glow: "shadow-[0_0_36px_rgba(34,211,238,0.14)]",
    icon: "bg-cyan-300/12 text-cyan-100 ring-cyan-200/20",
    panel: "from-cyan-400/[0.12] via-slate-950/55 to-slate-950/35",
    text: "text-cyan-100",
  },
  emerald: {
    border: "border-emerald-300/25",
    glow: "shadow-[0_0_36px_rgba(52,211,153,0.12)]",
    icon: "bg-emerald-300/12 text-emerald-100 ring-emerald-200/20",
    panel: "from-emerald-400/[0.12] via-slate-950/55 to-slate-950/35",
    text: "text-emerald-100",
  },
  rose: {
    border: "border-rose-300/25",
    glow: "shadow-[0_0_36px_rgba(251,113,133,0.12)]",
    icon: "bg-rose-300/12 text-rose-100 ring-rose-200/20",
    panel: "from-rose-400/[0.12] via-slate-950/55 to-slate-950/35",
    text: "text-rose-100",
  },
  violet: {
    border: "border-violet-300/25",
    glow: "shadow-[0_0_36px_rgba(167,139,250,0.14)]",
    icon: "bg-violet-300/12 text-violet-100 ring-violet-200/20",
    panel: "from-violet-400/[0.12] via-slate-950/55 to-slate-950/35",
    text: "text-violet-100",
  },
};

export type CinematicClusterItem = {
  detail?: string;
  href?: string;
  label: string;
  symbol?: string;
  tone?: VisualTone;
  value?: string;
};

export type CinematicCluster = {
  emptyMessage?: string;
  eyebrow?: string;
  factors?: ScoreFactor[];
  footer?: string;
  href?: string;
  icon?: ReactNode;
  items?: CinematicClusterItem[];
  metric?: string;
  metricLabel?: string;
  score?: number | null;
  summary: string;
  title: string;
  tone?: VisualTone;
  updatedAt?: string;
  values?: Array<number | null | undefined>;
};

export type CinematicHeatCell = {
  detail?: string;
  href?: string;
  label: string;
  tone?: VisualTone;
  value: number | null;
};

export type CinematicTimelineItem = {
  detail?: string;
  href?: string;
  label: string;
  metric?: string;
  tone?: VisualTone;
  timestamp?: string;
};

export function CinematicClusterMosaic({
  clusters,
  eyebrow = "Intelligence clusters",
  summary,
  title,
}: {
  clusters: CinematicCluster[];
  eyebrow?: string;
  summary: string;
  title: string;
}) {
  if (!clusters.length) {
    return (
      <section className="poster-panel rounded-3xl border-cyan-300/16 p-5">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
        <p className="mt-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-500">{summary}</p>
      </section>
    );
  }

  const [hero, ...rest] = clusters;

  return (
    <section className="poster-panel rounded-3xl border-cyan-300/16 bg-slate-950/50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">{summary}</p>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        {hero ? <CinematicClusterCard cluster={hero} prominent /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {rest.map((cluster) => (
            <CinematicClusterCard cluster={cluster} key={cluster.title} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CinematicClusterCard({ cluster, prominent = false }: { cluster: CinematicCluster; prominent?: boolean }) {
  const tone = cluster.tone ?? "cyan";
  const style = TONE_STYLE[tone];
  const values = cluster.values ?? [];
  const items = cluster.items ?? [];
  const hasScore = typeof cluster.score === "number" && Number.isFinite(cluster.score);
  const metric = cluster.metric ?? (hasScore ? `${Math.round(cluster.score ?? 0)}` : "Limited");
  const content = (
    <div className={`group relative h-full overflow-hidden rounded-3xl border ${style.border} bg-gradient-to-br ${style.panel} p-4 ${style.glow}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${style.text}`}>{cluster.eyebrow ?? "Intelligence cluster"}</div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{cluster.title}</h3>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{cluster.summary}</p>
        </div>
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${style.icon}`}>{cluster.icon}</div>
      </div>

      <div className={`mt-4 grid gap-3 ${prominent ? "lg:grid-cols-[140px_minmax(0,1fr)]" : ""}`}>
        {hasScore ? (
          <PosterGauge label={cluster.metricLabel ?? "score"} score={cluster.score ?? null} tone={tone} />
        ) : (
          <div className={`rounded-2xl border ${style.border} bg-slate-950/45 p-4`}>
            <div className={`font-mono text-3xl font-black ${style.text}`}>{metric}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{cluster.metricLabel ?? "evidence"}</div>
            {cluster.updatedAt ? <div className="mt-3 text-[11px] text-slate-500">Updated {cluster.updatedAt}</div> : null}
          </div>
        )}

        <div className="grid min-w-0 gap-3">
          <MiniSparkline
            emptyMessage={cluster.emptyMessage ?? "No validated trend history is available for this cluster yet."}
            label="evolution"
            tone={tone}
            values={values}
          />
          {prominent ? <MiniCandleStrip emptyMessage={cluster.emptyMessage ?? "No validated movement history yet."} tone={tone} values={values} /> : null}
        </div>
      </div>

      {cluster.factors?.length ? <ScoreFactorStrip className="mt-3" factors={cluster.factors} label="Data-backed drivers" /> : null}

      <div className={`mt-3 grid gap-2 ${prominent ? "sm:grid-cols-2" : ""}`}>
        {items.length ? (
          items.slice(0, prominent ? 6 : 4).map((item) => <CinematicClusterItemRow item={item} key={`${cluster.title}:${item.label}:${item.value ?? ""}`} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-3 text-xs leading-5 text-slate-500">
            {cluster.emptyMessage ?? "Limited evidence. This cluster will fill in as validated scanner, replay, or watchlist data accumulates."}
          </div>
        )}
      </div>

      {cluster.footer || cluster.updatedAt ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-slate-500">
          <span>{cluster.footer ?? "Research context only. Not financial advice."}</span>
          {cluster.updatedAt ? <span>{cluster.updatedAt}</span> : null}
        </div>
      ) : null}

      {cluster.href ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <Link className={`text-[11px] font-black uppercase tracking-[0.14em] ${style.text} transition hover:text-white`} href={cluster.href}>
            Open detail
          </Link>
        </div>
      ) : null}
    </div>
  );

  return content;
}

function CinematicClusterItemRow({ item }: { item: CinematicClusterItem }) {
  const tone = item.tone ?? "cyan";
  const style = TONE_STYLE[tone];
  const content = (
    <div className={`min-w-0 rounded-2xl border ${style.border} bg-slate-950/45 p-3 transition group-hover:bg-white/[0.045]`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate text-xs font-black ${style.text}`}>{item.label}</div>
          {item.detail ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.detail}</p> : null}
        </div>
        {item.value ? <div className="shrink-0 font-mono text-sm font-black text-slate-100">{item.value}</div> : null}
      </div>
    </div>
  );

  return item.href ? (
    <Link className="block" href={item.href}>
      {content}
    </Link>
  ) : content;
}

export function CinematicHeatMatrix({
  cells,
  emptyMessage = "No validated heat-map data is available yet.",
  eyebrow = "Tactical heat matrix",
  summary,
  title,
}: {
  cells: CinematicHeatCell[];
  emptyMessage?: string;
  eyebrow?: string;
  summary?: string;
  title: string;
}) {
  return (
    <section className="poster-panel rounded-3xl border-cyan-300/16 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
          {summary ? <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{summary}</p> : null}
        </div>
        <HeatDots active={Math.min(12, cells.filter((cell) => typeof cell.value === "number" && cell.value >= 50).length * 2)} tone="cyan" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {cells.length ? cells.slice(0, 12).map((cell) => <HeatMatrixCell cell={cell} key={cell.label} />) : (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function HeatMatrixCell({ cell }: { cell: CinematicHeatCell }) {
  const tone = cell.tone ?? toneForScore(cell.value);
  const style = TONE_STYLE[tone];
  const value = typeof cell.value === "number" && Number.isFinite(cell.value) ? Math.round(cell.value) : null;
  const content = (
    <div className={`min-h-24 rounded-2xl border ${style.border} bg-gradient-to-br ${style.panel} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{cell.label}</div>
        <div className={`font-mono text-lg font-black ${style.text}`}>{value === null ? "N/A" : value}</div>
      </div>
      <VisualMetricRail metrics={[{ label: cell.label, tone, value }]} />
      {cell.detail ? <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">{cell.detail}</p> : null}
    </div>
  );
  return cell.href ? <Link href={cell.href}>{content}</Link> : content;
}

export function CinematicTimeline({
  emptyMessage = "No validated timeline events are available yet.",
  eyebrow = "Cognition timeline",
  items,
  summary,
  title,
}: {
  emptyMessage?: string;
  eyebrow?: string;
  items: CinematicTimelineItem[];
  summary?: string;
  title: string;
}) {
  return (
    <section className="poster-panel rounded-3xl border-cyan-300/16 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
      <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
      {summary ? <p className="mt-2 text-xs leading-5 text-slate-500">{summary}</p> : null}
      <div className="mt-4 grid gap-2">
        {items.length ? items.slice(0, 7).map((item, index) => <TimelineRow index={index} item={item} key={`${item.label}:${item.timestamp ?? index}`} />) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-500">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function TimelineRow({ index, item }: { index: number; item: CinematicTimelineItem }) {
  const tone = item.tone ?? "cyan";
  const style = TONE_STYLE[tone];
  const content = (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <div className={`grid h-7 w-7 place-items-center rounded-full border ${style.border} ${style.text} bg-white/[0.04] font-mono text-[11px] font-black`}>{index + 1}</div>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className={`min-w-0 truncate text-xs font-black ${style.text}`}>{item.label}</div>
          {item.metric || item.timestamp ? <span className="shrink-0 text-[10px] text-slate-500">{item.metric ?? item.timestamp}</span> : null}
        </div>
        {item.detail ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{item.detail}</p> : null}
      </div>
    </div>
  );
  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

function toneForScore(value: number | null): VisualTone {
  if (value === null || !Number.isFinite(value)) return "cyan";
  if (value >= 75) return "emerald";
  if (value >= 55) return "amber";
  if (value >= 35) return "violet";
  return "rose";
}
