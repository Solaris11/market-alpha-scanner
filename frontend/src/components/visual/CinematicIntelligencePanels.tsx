"use client";

import Link from "next/link";
import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { StableDetailOverlay } from "@/components/ui/StableDetailOverlay";
import {
  LivingIntelligenceStatusStrip,
  NarrativeEvolutionPanel,
  type LivingSignal,
  type LivingStory,
} from "@/components/visual/LivingIntelligence";
import {
  MiniCandleStrip,
  MiniSparkline,
  PosterGauge,
  ScoreFactorStrip,
  VisualMetricRail,
  type ScoreFactor,
  type VisualTone,
} from "@/components/visual/MiniVisuals";
import { PosterHeatmapChart, PosterIntelligenceOrbit, type PosterOrbitNode } from "@/components/visual/PosterDataVisuals";

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

type ClusterSelection =
  | { cluster: CinematicCluster; kind: "cluster" }
  | { clusterTitle?: string; item: CinematicClusterItem; kind: "item" };

function openWithKeyboard(event: KeyboardEvent<HTMLElement>, open: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  open();
}

function symbolHref(symbol: string): string {
  return `/symbol/${encodeURIComponent(symbol.toUpperCase())}`;
}

function finiteClusterValues(values: Array<number | null | undefined> | undefined): number[] {
  if (!values) return [];
  return values.filter((value): value is number => Number.isFinite(value));
}

function clusterDelta(cluster: CinematicCluster): number | null {
  const values = finiteClusterValues(cluster.values);
  if (values.length < 2) return null;
  return Math.round((values[values.length - 1] ?? 0) - (values[0] ?? 0));
}

function clusterLivingSignals(clusters: CinematicCluster[]): LivingSignal[] {
  return clusters.map((cluster) => ({
    id: cluster.title,
    label: cluster.title,
    score: cluster.score,
    summary: cluster.summary,
    tone: cluster.tone ?? "cyan",
    updatedAt: cluster.updatedAt,
    values: cluster.values,
  }));
}

function clusterLivingStories(clusters: CinematicCluster[]): LivingStory[] {
  return clusters.slice(0, 6).map((cluster): LivingStory => {
    const delta = clusterDelta(cluster);
    const scoreText =
      typeof cluster.score === "number" && Number.isFinite(cluster.score)
        ? `${Math.round(cluster.score)}`
        : cluster.metric ?? "Limited";
    const direction =
      delta === null ? "limited evidence" : Math.abs(delta) < 3 ? "stable" : delta > 0 ? "strengthening" : "weakening";

    return {
      id: `${cluster.title}:story`,
      metric: scoreText,
      summary:
        delta === null
          ? `${cluster.title} has limited validated evolution history. ${cluster.summary}`
          : `${cluster.title} is ${direction} by ${Math.abs(delta)} points across the available evidence window. ${cluster.summary}`,
      title: `${cluster.title} ${direction}`,
      tone: cluster.tone ?? "cyan",
      updatedAt: cluster.updatedAt,
    };
  });
}

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
  const [selection, setSelection] = useState<ClusterSelection | null>(null);

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
  const latestUpdatedAt = clusters.find((cluster) => cluster.updatedAt)?.updatedAt;
  const livingSignals = clusterLivingSignals(clusters);
  const livingStories = clusterLivingStories(clusters);
  const orbitNodes: PosterOrbitNode[] = clusters.map((cluster) => {
    const score = typeof cluster.score === "number" && Number.isFinite(cluster.score) ? cluster.score : null;
    return {
      detail: cluster.summary,
      icon: cluster.icon,
      id: cluster.title,
      label: cluster.title,
      metric: cluster.metric ?? (score === null ? "Limited" : `${Math.round(score)}`),
      score,
      tone: cluster.tone ?? "cyan",
    };
  });

  return (
    <>
      <section className="poster-panel rounded-3xl border-cyan-300/16 bg-slate-950/50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">{summary}</p>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(310px,0.72fr)_minmax(0,1.28fr)]">
          <PosterIntelligenceOrbit
            centerLabel="TradeVeto"
            nodes={orbitNodes}
            onNodeClick={(_, index) => {
              const cluster = clusters[index];
              if (cluster) setSelection({ cluster, kind: "cluster" });
            }}
          />
          <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
            {hero ? (
              <CinematicClusterCard
                cluster={hero}
                onOpen={(cluster) => setSelection({ cluster, kind: "cluster" })}
                onOpenItem={(item, clusterTitle) => setSelection({ clusterTitle, item, kind: "item" })}
                prominent
              />
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {rest.map((cluster) => (
                <CinematicClusterCard
                  cluster={cluster}
                  key={cluster.title}
                  onOpen={(nextCluster) => setSelection({ cluster: nextCluster, kind: "cluster" })}
                  onOpenItem={(item, clusterTitle) => setSelection({ clusterTitle, item, kind: "item" })}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <LivingIntelligenceStatusStrip
            generatedAt={latestUpdatedAt}
            signals={livingSignals}
            stories={livingStories}
            summary="Data-backed cluster evolution highlights changing pressure, confidence, freshness, and attention without inventing live activity."
            title="Living Attention Layer"
          />
        </div>
      </section>
      <CinematicClusterDetailOverlay onClose={() => setSelection(null)} selection={selection} />
    </>
  );
}

export function CinematicClusterCard({
  cluster,
  onOpen,
  onOpenItem,
  prominent = false,
}: {
  cluster: CinematicCluster;
  onOpen?: (cluster: CinematicCluster) => void;
  onOpenItem?: (item: CinematicClusterItem, clusterTitle: string) => void;
  prominent?: boolean;
}) {
  const tone = cluster.tone ?? "cyan";
  const style = TONE_STYLE[tone];
  const values = cluster.values ?? [];
  const items = cluster.items ?? [];
  const hasScore = typeof cluster.score === "number" && Number.isFinite(cluster.score);
  const metric = cluster.metric ?? (hasScore ? `${Math.round(cluster.score ?? 0)}` : "Limited");
  const openCluster = () => onOpen?.(cluster);
  const delta = clusterDelta(cluster);
  const materialShift = delta !== null && Math.abs(delta) >= 8;
  const content = (
    <motion.div
      className={`group tv-depth-surface relative h-full cursor-pointer overflow-hidden rounded-3xl border ${style.border} bg-gradient-to-br ${style.panel} p-4 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-200/70 ${style.glow}`}
      data-stable-overlay-trigger="true"
      onClick={openCluster}
      onKeyDown={(event) => openWithKeyboard(event, openCluster)}
      role="button"
      tabIndex={0}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.992 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      {materialShift ? <div className="pointer-events-none absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-cyan-200 tv-attention-pulse" /> : null}
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
          items.slice(0, prominent ? 6 : 4).map((item) => (
            <CinematicClusterItemRow
              clusterTitle={cluster.title}
              item={item}
              key={`${cluster.title}:${item.label}:${item.value ?? ""}`}
              onOpen={onOpenItem}
            />
          ))
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
          {delta !== null ? (
            <span className={delta >= 0 ? "font-bold text-emerald-200" : "font-bold text-rose-200"}>
              {delta >= 0 ? "+" : ""}
              {delta} evolution
            </span>
          ) : null}
        </div>
      ) : null}

      {cluster.href ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <Link
            className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] ${style.text} transition hover:text-white`}
            href={cluster.href}
            onClick={(event) => event.stopPropagation()}
          >
            Open detail
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </motion.div>
  );

  return content;
}

function CinematicClusterItemRow({
  clusterTitle,
  item,
  onOpen,
}: {
  clusterTitle: string;
  item: CinematicClusterItem;
  onOpen?: (item: CinematicClusterItem, clusterTitle: string) => void;
}) {
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
    <Link className="block" href={item.href} onClick={(event) => event.stopPropagation()}>
      {content}
    </Link>
  ) : (
    <button
      className="block w-full text-left"
      data-stable-overlay-trigger="true"
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(item, clusterTitle);
      }}
      type="button"
    >
      {content}
    </button>
  );
}

function CinematicClusterDetailOverlay({ onClose, selection }: { onClose: () => void; selection: ClusterSelection | null }) {
  if (!selection) return null;

  if (selection.kind === "item") {
    const tone = selection.item.tone ?? "cyan";
    const style = TONE_STYLE[tone];
    return (
      <StableDetailOverlay
        analyticsSurface={`cinematic_item_${selection.item.label}`}
        closeLabel="Close intelligence detail"
        description={selection.item.detail ?? "This intelligence item opens only from the validated cluster context shown on the page."}
        eyebrow={<span className={style.text}>{selection.clusterTitle ?? "Intelligence item"}</span>}
        onClose={onClose}
        open
        size="md"
        title={selection.item.label}
      >
        <div className={`h-1 rounded-full ${toneAccentClass(tone)}`} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border ${style.border} bg-slate-950/45 p-4`}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Status</div>
            <div className={`mt-2 font-mono text-2xl font-black ${style.text}`}>{selection.item.value ?? "Limited"}</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {selection.item.detail ?? "Limited evidence. TradeVeto is not drawing extra conclusions without validated context."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Navigation</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selection.item.symbol ? (
                <Link className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-black transition hover:border-cyan-200/60 hover:text-white ${style.text}`} href={symbolHref(selection.item.symbol)}>
                  {selection.item.symbol.toUpperCase()}
                </Link>
              ) : null}
              {selection.item.href ? (
                <Link className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70 hover:text-white" href={selection.item.href} onClick={onClose}>
                  Open linked view
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs leading-5 text-slate-500">
          Research context only. This item is an explanation surface, not a recommendation to buy or sell.
        </div>
      </StableDetailOverlay>
    );
  }

  const cluster = selection.cluster;
  const tone = cluster.tone ?? "cyan";
  const style = TONE_STYLE[tone];
  const values = cluster.values ?? [];
  const relatedSymbols = Array.from(new Set((cluster.items ?? []).map((item) => item.symbol?.toUpperCase()).filter((symbol): symbol is string => Boolean(symbol))));

  return (
    <StableDetailOverlay
      analyticsSurface={`cinematic_cluster_${cluster.title}`}
      closeLabel="Close intelligence cluster"
      description={cluster.summary}
      eyebrow={<span className={style.text}>{cluster.eyebrow ?? "Intelligence cluster"}</span>}
      onClose={onClose}
      open
      size="xl"
      title={cluster.title}
    >
      <div className={`h-1 rounded-full ${toneAccentClass(tone)}`} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className={`rounded-2xl border ${style.border} bg-slate-950/45 p-4`}>
          <PosterGauge label={cluster.metricLabel ?? "score"} score={cluster.score ?? null} tone={tone} />
          <div className="mt-3 text-[11px] text-slate-500">{cluster.updatedAt ? `Updated ${cluster.updatedAt}` : "Latest validated context shown."}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <MiniSparkline
            emptyMessage={cluster.emptyMessage ?? "No validated trend history is available for this cluster yet."}
            label="cluster evolution"
            tone={tone}
            values={values}
          />
          <MiniCandleStrip emptyMessage={cluster.emptyMessage ?? "No validated movement history yet."} tone={tone} values={values} />
        </div>
      </div>

      <div className="mt-4">
        <NarrativeEvolutionPanel stories={clusterLivingStories([cluster])} compact />
      </div>

      {cluster.factors?.length ? <ScoreFactorStrip className="mt-4" factors={cluster.factors} label="Data-backed drivers" /> : null}

      {relatedSymbols.length ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Related symbols</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedSymbols.map((symbol) => (
              <Link className={`rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs font-black transition hover:border-cyan-200/60 hover:text-white ${style.text}`} href={symbolHref(symbol)} key={symbol}>
                {symbol}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(cluster.items ?? []).length ? (
          (cluster.items ?? []).slice(0, 10).map((item) => (
            <div className={`rounded-2xl border ${TONE_STYLE[item.tone ?? tone].border} bg-slate-950/45 p-3`} key={`${cluster.title}:${item.label}:${item.value ?? ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className={`text-xs font-black ${TONE_STYLE[item.tone ?? tone].text}`}>{item.label}</div>
                  {item.detail ? <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.detail}</p> : null}
                </div>
                {item.value ? <div className="font-mono text-sm font-black text-slate-100">{item.value}</div> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.symbol ? (
                  <Link className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-black text-cyan-100 transition hover:border-cyan-200/60 hover:text-white" href={symbolHref(item.symbol)}>
                    {item.symbol.toUpperCase()}
                  </Link>
                ) : null}
                {item.href ? (
                  <Link className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-slate-300 transition hover:border-cyan-200/50 hover:text-cyan-100" href={item.href} onClick={onClose}>
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-500">
            {cluster.emptyMessage ?? "Limited evidence. This cluster will fill in as validated scanner, replay, or watchlist data accumulates."}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs text-slate-500">
        <span>{cluster.footer ?? "Research context only. Not financial advice."}</span>
        {cluster.href ? (
          <Link className="inline-flex items-center gap-2 font-black uppercase tracking-[0.12em] text-cyan-100 transition hover:text-white" href={cluster.href} onClick={onClose}>
            Open full detail
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </StableDetailOverlay>
  );
}

function toneAccentClass(tone: VisualTone): string {
  if (tone === "amber") return "bg-amber-300";
  if (tone === "emerald") return "bg-emerald-300";
  if (tone === "rose") return "bg-rose-300";
  if (tone === "violet") return "bg-violet-300";
  return "bg-cyan-300";
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
  const [activeCell, setActiveCell] = useState<CinematicHeatCell | null>(null);

  return (
    <>
      <section className="poster-panel rounded-3xl border-cyan-300/16 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
            <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
            {summary ? <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{summary}</p> : null}
          </div>
          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono text-[11px] font-black text-cyan-100">
            {cells.filter((cell) => typeof cell.value === "number" && Number.isFinite(cell.value)).length} live cells
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.55fr)]">
          <PosterHeatmapChart cells={cells} emptyMessage={emptyMessage} onCellSelect={setActiveCell} />
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {cells.length ? cells.slice(0, 8).map((cell) => <HeatMatrixCell cell={cell} key={cell.label} onOpen={setActiveCell} />) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">{emptyMessage}</div>
            )}
          </div>
        </div>
      </section>
      <HeatMatrixDetailOverlay cell={activeCell} onClose={() => setActiveCell(null)} title={title} />
    </>
  );
}

function HeatMatrixCell({ cell, onOpen }: { cell: CinematicHeatCell; onOpen: (cell: CinematicHeatCell) => void }) {
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
  return (
    <button className="block w-full text-left" data-stable-overlay-trigger="true" onClick={() => onOpen(cell)} type="button">
      {content}
    </button>
  );
}

function HeatMatrixDetailOverlay({ cell, onClose, title }: { cell: CinematicHeatCell | null; onClose: () => void; title: string }) {
  if (!cell) return null;
  const tone = cell.tone ?? toneForScore(cell.value);
  const style = TONE_STYLE[tone];
  const value = typeof cell.value === "number" && Number.isFinite(cell.value) ? Math.round(cell.value) : null;
  return (
    <StableDetailOverlay
      analyticsSurface={`heat_matrix_${cell.label}`}
      closeLabel="Close heat-map detail"
      description={cell.detail ?? "This heat-map cell is shown only when validated category data exists for this page."}
      eyebrow={<span className={style.text}>{title}</span>}
      onClose={onClose}
      open
      size="md"
      title={cell.label}
    >
      <div className={`h-1 rounded-full ${toneAccentClass(tone)}`} />
      <div className={`mt-4 rounded-2xl border ${style.border} bg-gradient-to-br ${style.panel} p-5`}>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Validated value</div>
        <div className={`mt-2 font-mono text-4xl font-black ${style.text}`}>{value === null ? "N/A" : value}</div>
        <VisualMetricRail metrics={[{ label: cell.label, tone, value }]} />
        <p className="mt-4 text-sm leading-6 text-slate-300">
          {cell.detail ?? "Data is limited. TradeVeto keeps this cell visible as a measured category, but does not infer extra trend context without source history."}
        </p>
      </div>
      {cell.href ? (
        <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href={cell.href} onClick={onClose}>
          Open linked detail
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </StableDetailOverlay>
  );
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
  const [activeItem, setActiveItem] = useState<CinematicTimelineItem | null>(null);

  return (
    <>
      <section className="poster-panel rounded-3xl border-cyan-300/16 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>
        <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
        {summary ? <p className="mt-2 text-xs leading-5 text-slate-500">{summary}</p> : null}
        <div className="mt-4 grid gap-2">
          {items.length ? items.slice(0, 7).map((item, index) => (
            <TimelineRow index={index} item={item} key={`${item.label}:${item.timestamp ?? index}`} onOpen={setActiveItem} />
          )) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-500">{emptyMessage}</div>
          )}
        </div>
      </section>
      <TimelineDetailOverlay item={activeItem} onClose={() => setActiveItem(null)} title={title} />
    </>
  );
}

function TimelineRow({ index, item, onOpen }: { index: number; item: CinematicTimelineItem; onOpen: (item: CinematicTimelineItem) => void }) {
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
  return (
    <button className="block w-full text-left" data-stable-overlay-trigger="true" onClick={() => onOpen(item)} type="button">
      {content}
    </button>
  );
}

function TimelineDetailOverlay({ item, onClose, title }: { item: CinematicTimelineItem | null; onClose: () => void; title: string }) {
  if (!item) return null;
  const tone = item.tone ?? "cyan";
  const style = TONE_STYLE[tone];
  return (
    <StableDetailOverlay
      analyticsSurface={`timeline_${item.label}`}
      closeLabel="Close timeline detail"
      description={item.detail ?? "This timeline event is shown from validated page context. Missing history remains marked as limited."}
      eyebrow={<span className={style.text}>{title}</span>}
      onClose={onClose}
      open
      size="md"
      title={item.label}
    >
      <div className={`h-1 rounded-full ${toneAccentClass(tone)}`} />
      <div className={`mt-4 rounded-2xl border ${style.border} bg-slate-950/45 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Event context</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {item.detail ?? "No additional timeline detail is available yet. TradeVeto will expand this event as source evidence accumulates."}
            </p>
          </div>
          {item.metric || item.timestamp ? <div className={`font-mono text-sm font-black ${style.text}`}>{item.metric ?? item.timestamp}</div> : null}
        </div>
      </div>
      {item.href ? (
        <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href={item.href} onClick={onClose}>
          Open linked detail
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </StableDetailOverlay>
  );
}

function toneForScore(value: number | null): VisualTone {
  if (value === null || !Number.isFinite(value)) return "cyan";
  if (value >= 75) return "emerald";
  if (value >= 55) return "amber";
  if (value >= 35) return "violet";
  return "rose";
}
