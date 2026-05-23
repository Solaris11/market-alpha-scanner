"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BellRing, Eye, ListChecks, RadioTower, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";
import { SimpleAdvancedTabs } from "@/components/ui/SimpleAdvancedTabs";
import { ResponsiveAdvancedDetails } from "@/components/ui/ResponsiveAdvancedDetails";
import { UtilitySurfaceMaturityPanel } from "@/components/utility/UtilitySurfaceMaturityPanel";
import {
  CinematicClusterMosaic,
  CinematicHeatMatrix,
  CinematicTimeline,
  type CinematicCluster,
  type CinematicHeatCell,
  type CinematicTimelineItem,
} from "@/components/visual/CinematicIntelligencePanels";
import { InteractiveInsightZoneGrid, type InteractiveInsightZoneItem } from "@/components/visual/InteractiveVisualIntelligence";
import type { ScoreFactor, VisualTone } from "@/components/visual/MiniVisuals";
import { trackAnalyticsEvent, trackFirstUsefulAction } from "@/lib/client/analytics";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { humanizeLabel } from "@/lib/ui/labels";
import { readWatchlistStorage, WATCHLIST_EVENT } from "@/lib/watchlist-storage";
import { ActiveAlertMatches } from "./active-alert-matches";

type AlertRule = {
  id: string;
  scope?: string;
  symbol?: string;
  type: string;
  threshold?: number;
  min_score?: number;
  min_rating?: string;
  allowed_actions?: string[];
  min_risk_reward?: number;
  max_alerts_per_run?: number;
  channels: string[];
  enabled: boolean;
  cooldown_minutes: number;
  entry_filter?: string;
  source?: "system" | "user";
};

type AlertStateEntry = {
  alert_id?: string;
  symbol?: string;
  last_sent_at?: string;
  last_skipped_at?: string;
  last_trigger_value?: string;
  last_observed_value?: string;
  last_status?: string;
  last_skip_reason?: string;
  last_entry_status?: string;
  last_channel_results?: Record<string, string>;
};

type AlertOverview = {
  rules: AlertRule[];
  state: { alerts: Record<string, AlertStateEntry> };
  activeCount: number;
  lastSentAt: string | null;
};

type CommandResult = {
  ok: boolean;
  message?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
};

type RuleSaveResult = {
  message: string;
  mode?: string;
  ok: boolean;
};

type QuickRuleStatus = {
  message: string;
  tone: "error" | "success";
};

const FORM_TYPES = [
  "price_above",
  "price_below",
  "buy_zone_hit",
  "stop_loss_broken",
  "take_profit_hit",
  "score_above",
  "score_below",
  "rating_changed",
  "action_changed",
  "new_top_candidate",
  "entry_ready",
];
const THRESHOLD_TYPES = new Set(["price_above", "price_below", "score_above", "score_below", "score_changed_by"]);
const ENTRY_FILTERS = [
  { value: "any", label: "Any" },
  { value: "good_only", label: "Good entry only" },
  { value: "good_or_wait", label: "Good or wait" },
  { value: "avoid_overextended", label: "Avoid overextended" },
];
const SCOPES = [
  { value: "symbol", label: "Single Symbol" },
  { value: "watchlist", label: "Watchlist" },
  { value: "global", label: "Global Scanner Universe" },
];
const RECOMMENDED_ALERT_PRESET: Partial<AlertRule>[] = [
  {
    id: "global_entry_ready",
    scope: "global",
    type: "entry_ready",
    min_score: 70,
    min_rating: "ACTIONABLE",
    allowed_actions: ["STRONG BUY", "BUY"],
    entry_filter: "good_or_wait",
    min_risk_reward: 1.5,
    max_alerts_per_run: 5,
    channels: ["telegram"],
    cooldown_minutes: 720,
    enabled: true,
    source: "system",
  },
  {
    id: "global_top_signals",
    scope: "global",
    type: "score_above",
    threshold: 80,
    min_rating: "TOP",
    allowed_actions: ["STRONG BUY", "BUY"],
    entry_filter: "avoid_overextended",
    min_risk_reward: 1.5,
    max_alerts_per_run: 5,
    channels: ["telegram"],
    cooldown_minutes: 720,
    enabled: true,
    source: "system",
  },
  {
    id: "watchlist_buy_zone",
    scope: "watchlist",
    type: "buy_zone_hit",
    entry_filter: "any",
    channels: ["telegram"],
    cooldown_minutes: 360,
    enabled: true,
    source: "system",
  },
  {
    id: "watchlist_stop_loss",
    scope: "watchlist",
    type: "stop_loss_broken",
    entry_filter: "any",
    channels: ["telegram"],
    cooldown_minutes: 1440,
    enabled: true,
    source: "system",
  },
  {
    id: "watchlist_take_profit",
    scope: "watchlist",
    type: "take_profit_hit",
    entry_filter: "any",
    channels: ["telegram"],
    cooldown_minutes: 720,
    enabled: true,
    source: "system",
  },
  {
    id: "watchlist_action_changed",
    scope: "watchlist",
    type: "action_changed",
    entry_filter: "any",
    channels: ["telegram"],
    cooldown_minutes: 720,
    enabled: true,
    source: "system",
  },
  {
    id: "watchlist_score_spike",
    scope: "watchlist",
    type: "score_changed_by",
    threshold: 2,
    entry_filter: "good_or_wait",
    channels: ["telegram"],
    cooldown_minutes: 720,
    enabled: true,
    source: "system",
  },
];

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function readWatchlist() {
  return readWatchlistStorage();
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return value.replace("T", " ").replace("Z", " UTC");
}

function typeLabel(value: string) {
  return humanizeLabel(value);
}

function entryFilterLabel(value?: string) {
  return ENTRY_FILTERS.find((item) => item.value === value)?.label ?? "Any";
}

function scopeLabel(value?: string) {
  return SCOPES.find((item) => item.value === value)?.label ?? "Single Symbol";
}

function defaultEntryFilter(type: string) {
  if (type === "score_above") return "avoid_overextended";
  if (type === "entry_ready") return "good_or_wait";
  if (type === "stop_loss_broken" || type === "take_profit_hit" || type === "buy_zone_hit") return "any";
  if (type === "rating_changed" || type === "action_changed") return "good_or_wait";
  return "any";
}

function defaultMinScore(type: string, scope: string) {
  if (type === "entry_ready" && scope === "global") return "70";
  return "";
}

function thresholdDisplay(rule: AlertRule) {
  return THRESHOLD_TYPES.has(rule.type) ? String(rule.threshold ?? "—") : "system level";
}

function minScoreDisplay(rule: AlertRule) {
  return rule.min_score === undefined ? "—" : String(rule.min_score);
}

function targetDisplay(rule: AlertRule) {
  if (rule.scope === "watchlist") return "Watchlist";
  if (rule.scope === "global") return "All symbols";
  return rule.symbol || "—";
}

function symbolHref(value: unknown) {
  const symbol = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9._-]+$/.test(symbol) ? `/symbol/${encodeURIComponent(symbol)}` : "";
}

function compactConfig(rule: AlertRule) {
  const parts = [];
  if (rule.min_rating) parts.push(`Rating ${humanizeLabel(rule.min_rating)}+`);
  if (rule.allowed_actions?.length) parts.push(`Action context ${rule.allowed_actions.map((action) => humanizeLabel(action)).join(", ")}`);
  if (rule.min_risk_reward !== undefined) parts.push(`Min R/R ${rule.min_risk_reward}`);
  if (rule.max_alerts_per_run !== undefined) parts.push(`Max/run ${rule.max_alerts_per_run}`);
  return parts;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = String(init?.method ?? "GET").toUpperCase();
  const response = ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? await csrfFetch(url, init) : await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function alertPct(value: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function alertFactor(label: string, value: number | null, tone: VisualTone): ScoreFactor {
  return { label, tone, value };
}

function alertStateTime(state: AlertStateEntry): string | null {
  return state.last_sent_at ?? state.last_skipped_at ?? null;
}

function alertStateTone(state: AlertStateEntry): VisualTone {
  if (state.last_sent_at) return "emerald";
  if (state.last_status === "skipped" || state.last_skip_reason) return "amber";
  if (state.last_status === "error") return "rose";
  return "cyan";
}

function latestAlertStates(overview: AlertOverview): AlertStateEntry[] {
  return Object.values(overview.state.alerts)
    .filter((state) => Boolean(alertStateTime(state) || state.symbol || state.alert_id))
    .sort((left, right) => String(alertStateTime(right) ?? "").localeCompare(String(alertStateTime(left) ?? "")));
}

function AlertVisualCenter({ overview, watchlist }: { overview: AlertOverview; watchlist: string[] }) {
  const totalRules = overview.rules.length;
  const enabledRules = overview.rules.filter((rule) => rule.enabled).length;
  const watchlistRules = overview.rules.filter((rule) => rule.scope === "watchlist").length;
  const globalRules = overview.rules.filter((rule) => rule.scope === "global").length;
  const enabledShare = totalRules ? (enabledRules / totalRules) * 100 : null;
  const activeShare = totalRules ? (overview.activeCount / totalRules) * 100 : null;
  const stateCount = Object.keys(overview.state.alerts).length;
  const lastSent = formatDate(overview.lastSentAt);
  const zones: InteractiveInsightZoneItem[] = [
    {
      bullets: [
        `${enabledRules.toLocaleString()} of ${totalRules.toLocaleString()} alert rules are enabled.`,
        `${overview.activeCount.toLocaleString()} rules are active in the alert engine.`,
        `Last alert sent: ${lastSent}.`,
      ],
      dataSource: "Alert rules API and alert state store",
      detailSummary: "Shows whether alert rules are configured and actively evaluated.",
      detailTitle: "Alert Coverage",
      factors: [
        { label: "Enabled Rules", tone: "emerald", value: enabledShare },
        { label: "Active Rules", tone: "cyan", value: activeShare },
      ],
      icon: <BellRing className="h-6 w-6" />,
      id: "alert-coverage",
      label: "Coverage",
      metric: enabledRules.toLocaleString(),
      summary: totalRules ? `${enabledRules} enabled out of ${totalRules} configured rules.` : "No alert rules configured yet.",
      tone: "cyan",
      updatedAt: lastSent,
    },
    {
      bullets: [
        `${watchlist.length.toLocaleString()} local watchlist symbols are available for quick alerts.`,
        `${watchlistRules.toLocaleString()} watchlist-scoped rules are configured.`,
        "Watchlist alerts fire from actual tracked symbols and alert rule state.",
      ],
      dataSource: "Local watchlist and alert rule scope",
      detailSummary: "Shows how much of the alert system is tied to tracked symbols.",
      detailTitle: "Watchlist Alert Readiness",
      factors: [
        { label: "Watchlist Rules", tone: "cyan", value: totalRules ? (watchlistRules / totalRules) * 100 : null },
      ],
      icon: <RadioTower className="h-6 w-6" />,
      id: "watchlist-alerts",
      label: "Watchlist",
      metric: watchlist.length.toLocaleString(),
      summary: watchlist.length ? `${watchlist.length} tracked symbols can be wired to system alerts.` : "No tracked symbols yet.",
      tone: "emerald",
    },
    {
      bullets: [
        `${globalRules.toLocaleString()} global scanner rules are configured.`,
        "Global alerts are useful for entry-ready or top-ranked contexts but should stay capped to avoid noise.",
        "Rules include cooldown and max-per-run controls where configured.",
      ],
      dataSource: "Alert rule scope, cooldown, and max-per-run settings",
      detailSummary: "Shows whether broader scanner-level alerts are present without exposing raw alert logs by default.",
      detailTitle: "Global Alert Controls",
      factors: [
        { label: "Global Rules", tone: "violet", value: totalRules ? (globalRules / totalRules) * 100 : null },
        { label: "Enabled Share", tone: "cyan", value: enabledShare },
      ],
      icon: <SlidersHorizontal className="h-6 w-6" />,
      id: "global-alerts",
      label: "Global Rules",
      metric: globalRules.toLocaleString(),
      summary: globalRules ? `${globalRules} global scanner alert rules are configured.` : "No global scanner rules configured yet.",
      tone: "violet",
    },
    {
      bullets: [
        `${stateCount.toLocaleString()} alert state entries are stored for rule evaluation history.`,
        `Last delivery checkpoint: ${lastSent}.`,
        "Advanced diagnostics remain available behind the Advanced view.",
      ],
      dataSource: "Alert state store and last delivery timestamp",
      detailSummary: "Shows whether alert evaluation has state history. It does not invent alert activity when no state exists.",
      detailTitle: "Delivery State",
      factors: [
        { label: "State Coverage", tone: "amber", value: totalRules ? (stateCount / totalRules) * 100 : null },
        { label: "Active Rules", tone: "cyan", value: activeShare },
      ],
      icon: <ShieldCheck className="h-6 w-6" />,
      id: "delivery-state",
      label: "Delivery State",
      metric: stateCount.toLocaleString(),
      summary: stateCount ? `${stateCount} alert state entries recorded.` : "No alert state history yet.",
      tone: "amber",
      updatedAt: lastSent,
    },
  ];

  return (
    <InteractiveInsightZoneGrid
      eyebrow="Visual alert center"
      summary="Alert visuals are based on configured rules, watchlist overlap, and stored alert state."
      title="Tap Into Alert Readiness"
      zones={zones}
    />
  );
}

function AlertCinematicEcosystem({ overview, watchlist }: { overview: AlertOverview; watchlist: string[] }) {
  const totalRules = overview.rules.length;
  const enabledRules = overview.rules.filter((rule) => rule.enabled).length;
  const disabledRules = totalRules - enabledRules;
  const watchlistRules = overview.rules.filter((rule) => rule.scope === "watchlist").length;
  const globalRules = overview.rules.filter((rule) => rule.scope === "global").length;
  const symbolRules = overview.rules.filter((rule) => rule.scope === "symbol").length;
  const stateEntries = latestAlertStates(overview);
  const lastSent = formatDate(overview.lastSentAt);
  const activePct = alertPct(overview.activeCount, totalRules);
  const enabledPct = alertPct(enabledRules, totalRules);
  const statePct = alertPct(stateEntries.length, Math.max(totalRules, 1));
  const watchlistPct = alertPct(watchlistRules, totalRules);
  const deliveryValues = stateEntries
    .slice(0, 12)
    .map((state, index) => {
      if (state.last_sent_at) return 82 - index * 3;
      if (state.last_skip_reason) return 48 - index * 2;
      return 58 - index * 2;
    });
  const clusters: CinematicCluster[] = [
    {
      emptyMessage: "Create alert rules to build alert coverage history.",
      eyebrow: "Alert ecosystem",
      factors: [
        alertFactor("Enabled", enabledPct, "emerald"),
        alertFactor("Active", activePct, "cyan"),
        alertFactor("Disabled", alertPct(disabledRules, totalRules), "rose"),
      ],
      footer: "Configured rules only. No fabricated alert activity.",
      icon: <BellRing className="h-6 w-6" />,
      items: overview.rules.slice(0, 6).map((rule) => ({
        detail: `${scopeLabel(rule.scope)} - ${typeLabel(rule.type)}`,
        href: symbolHref(targetDisplay(rule)) ?? undefined,
        label: targetDisplay(rule),
        tone: rule.enabled ? "emerald" : "amber",
        value: rule.enabled ? "On" : "Off",
      })),
      metric: enabledRules.toLocaleString(),
      metricLabel: "enabled rules",
      score: enabledPct,
      summary: totalRules ? `${enabledRules} of ${totalRules} alert rules are enabled, with ${overview.activeCount} active in the alert engine.` : "No alert rules configured yet.",
      title: "Alert Coverage Cluster",
      tone: "cyan",
      updatedAt: lastSent,
      values: [enabledPct, activePct, statePct, watchlistPct],
    },
    {
      emptyMessage: "Track symbols first to build watchlist alert intelligence.",
      eyebrow: "Watchlist radar",
      factors: [
        alertFactor("Tracked Symbols", watchlist.length ? Math.min(100, watchlist.length * 12) : null, "emerald"),
        alertFactor("Scoped Rules", watchlistPct, "cyan"),
      ],
      icon: <Eye className="h-6 w-6" />,
      items: watchlist.slice(0, 6).map((symbol) => ({
        detail: "Tracked locally for quick alert creation.",
        href: `/symbol/${encodeURIComponent(symbol)}`,
        label: symbol,
        tone: "emerald",
        value: "Watch",
      })),
      metric: watchlist.length.toLocaleString(),
      metricLabel: "tracked symbols",
      score: watchlist.length ? Math.min(100, watchlist.length * 12) : null,
      summary: watchlist.length ? `${watchlist.length} tracked symbols can feed quick alert rules.` : "No tracked symbols yet.",
      title: "Watchlist Monitoring Cluster",
      tone: "emerald",
      values: watchlistRules ? [watchlistPct, enabledPct, activePct] : [],
    },
    {
      emptyMessage: "Alert delivery history appears after rules evaluate or send.",
      eyebrow: "Delivery state",
      factors: [
        alertFactor("State Entries", statePct, "amber"),
        alertFactor("Last Delivery", overview.lastSentAt ? 100 : null, "cyan"),
      ],
      icon: <RadioTower className="h-6 w-6" />,
      items: stateEntries.slice(0, 6).map((state) => ({
        detail: state.last_skip_reason ?? state.last_status ?? state.last_entry_status ?? "Alert state recorded.",
        href: state.symbol ? `/symbol/${encodeURIComponent(state.symbol)}` : undefined,
        label: state.symbol ?? state.alert_id ?? "Alert state",
        tone: alertStateTone(state),
        value: state.last_sent_at ? "Sent" : state.last_skip_reason ? "Skipped" : "State",
      })),
      metric: stateEntries.length.toLocaleString(),
      metricLabel: "state entries",
      score: statePct,
      summary: stateEntries.length ? `${stateEntries.length} delivery/evaluation state entries are stored.` : "No alert delivery state yet.",
      title: "Delivery Intelligence Cluster",
      tone: "amber",
      updatedAt: lastSent,
      values: deliveryValues,
    },
    {
      emptyMessage: "Install presets or create rules to build alert coverage.",
      eyebrow: "Noise controls",
      factors: [
        alertFactor("Global", alertPct(globalRules, totalRules), "violet"),
        alertFactor("Symbol", alertPct(symbolRules, totalRules), "cyan"),
        alertFactor("Watchlist", watchlistPct, "emerald"),
      ],
      icon: <SlidersHorizontal className="h-6 w-6" />,
      items: [
        { detail: "Scanner-wide alert rule coverage.", label: "Global rules", tone: "violet", value: globalRules.toLocaleString() },
        { detail: "Single-symbol alert rule coverage.", label: "Symbol rules", tone: "cyan", value: symbolRules.toLocaleString() },
        { detail: "Tracked-symbol alert rule coverage.", label: "Watchlist rules", tone: "emerald", value: watchlistRules.toLocaleString() },
      ],
      metric: totalRules.toLocaleString(),
      metricLabel: "configured",
      score: totalRules ? Math.min(100, enabledRules * 9 + overview.activeCount * 6) : null,
      summary: "Rule scope, cooldown, and preset controls keep alerts high-signal instead of noisy.",
      title: "Alert Noise Control Cluster",
      tone: "violet",
      values: [globalRules, symbolRules, watchlistRules, enabledRules].map((value) => (totalRules ? (value / totalRules) * 100 : null)),
    },
  ];
  const heatCells: CinematicHeatCell[] = [
    { detail: "Enabled rules divided by configured rules.", label: "Enabled coverage", tone: "emerald", value: enabledPct },
    { detail: "Active rules divided by configured rules.", label: "Active pressure", tone: "cyan", value: activePct },
    { detail: "Stored alert state divided by configured rules.", label: "State memory", tone: "amber", value: statePct },
    { detail: "Rules scoped to tracked watchlist symbols.", label: "Watchlist link", tone: "emerald", value: watchlistPct },
    { detail: "Scanner-wide alert exposure.", label: "Global scope", tone: "violet", value: alertPct(globalRules, totalRules) },
    { detail: "Single-symbol alert exposure.", label: "Symbol scope", tone: "cyan", value: alertPct(symbolRules, totalRules) },
  ];
  const timelineItems: CinematicTimelineItem[] = stateEntries.slice(0, 7).map((state) => ({
    detail: state.last_skip_reason ?? state.last_status ?? state.last_entry_status ?? "Alert state recorded.",
    href: state.symbol ? `/symbol/${encodeURIComponent(state.symbol)}` : undefined,
    label: state.symbol ?? state.alert_id ?? "Alert evaluation",
    timestamp: formatDate(alertStateTime(state)),
    tone: alertStateTone(state),
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <CinematicClusterMosaic
        clusters={clusters}
        eyebrow="Watchlists + Alerts cinematic layer"
        summary="A denser alert ecosystem view powered only by configured alert rules, watchlist symbols, and alert state history."
        title="Alert Intelligence Ecosystem"
      />
      <div className="grid gap-4">
        <CinematicHeatMatrix cells={heatCells} title="Alert System Heat" />
        <CinematicTimeline emptyMessage="No alert delivery or evaluation state has been recorded yet." items={timelineItems} title="Alert State Timeline" />
      </div>
    </div>
  );
}

function AlertUtilityControlPanel({ overview }: { overview: AlertOverview }) {
  const totalRules = overview.rules.length;
  const cooldownRules = overview.rules.filter((rule) => Number(rule.cooldown_minutes ?? 0) > 0).length;
  const cappedRules = overview.rules.filter((rule) => Number(rule.max_alerts_per_run ?? 0) > 0).length;
  const sourceLinkedRules = overview.rules.filter((rule) => Boolean(rule.source || rule.type || rule.entry_filter)).length;
  const stateEntries = Object.keys(overview.state.alerts).length;
  const items = [
    {
      detail: "Useful / not useful feedback is captured on delivered notifications and attributed back to notification engagement analytics.",
      label: "Usefulness feedback",
      value: "Tracked",
    },
    {
      detail: `${cooldownRules.toLocaleString()} of ${totalRules.toLocaleString()} rules have cooldowns and ${cappedRules.toLocaleString()} rules have max-per-run caps.`,
      label: "Fatigue controls",
      value: totalRules ? `${Math.round((cooldownRules / totalRules) * 100)}%` : "No rules",
    },
    {
      detail: "Notification actions emit alert-return, scanner-return, replay-return, or personalized-intelligence-return events when a user opens the destination.",
      label: "Return conversion",
      value: "Attributed",
    },
    {
      detail: `${sourceLinkedRules.toLocaleString()} rules expose type, scope, entry filter, or source state; ${stateEntries.toLocaleString()} alert state entries explain sent, skipped, or radar-only outcomes.`,
      label: "Source-linked reasons",
      value: sourceLinkedRules ? "Visible" : "Pending",
    },
  ];
  return (
    <section className="terminal-panel rounded-2xl p-4" aria-labelledby="alert-utility-controls-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Alert utility maturity</div>
          <h2 id="alert-utility-controls-heading" className="mt-1 text-lg font-semibold text-slate-50">Usefulness, fatigue, source reasons, and return loops</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Alert rules now expose why they exist, how often they can fire, how noisy they may become, and whether delivered notifications were useful.
          </p>
        </div>
        <a className="inline-flex min-h-10 items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" href="#alert-rule-table">
          Review rule evidence
        </a>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3" key={item.label}>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{item.value}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AlertsWorkspace({ initialOverview }: { initialOverview: AlertOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [scope, setScope] = useState("symbol");
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState("price_above");
  const [threshold, setThreshold] = useState("");
  const [minScore, setMinScore] = useState("");
  const [channels, setChannels] = useState<string[]>(["telegram"]);
  const [cooldown, setCooldown] = useState("1440");
  const [entryFilter, setEntryFilter] = useState("any");
  const [enabled, setEnabled] = useState(true);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [testResult, setTestResult] = useState<CommandResult | null>(null);
  const [quickRuleStatus, setQuickRuleStatus] = useState<QuickRuleStatus | null>(null);

  useEffect(() => {
    function refreshWatchlist() {
      setWatchlist(readWatchlist());
    }
    refreshWatchlist();
    window.addEventListener("storage", refreshWatchlist);
    window.addEventListener(WATCHLIST_EVENT, refreshWatchlist);
    return () => {
      window.removeEventListener("storage", refreshWatchlist);
      window.removeEventListener(WATCHLIST_EVENT, refreshWatchlist);
    };
  }, []);

  const sortedRules = useMemo(() => [...overview.rules].sort((a, b) => Number(b.enabled) - Number(a.enabled) || String(a.symbol ?? "").localeCompare(String(b.symbol ?? "")) || a.type.localeCompare(b.type)), [overview.rules]);
  const thresholdVisible = THRESHOLD_TYPES.has(type);
  const symbolVisible = scope === "symbol";
  const minScoreVisible = type === "entry_ready" || scope === "global" || type === "new_top_candidate";

  useEffect(() => {
    setEntryFilter(defaultEntryFilter(type));
    setMinScore(defaultMinScore(type, scope));
  }, [scope, type]);

  async function reload() {
    setOverview(await fetchJson<AlertOverview>("/api/alerts/rules"));
  }

  function toggleChannel(channel: string) {
    setChannels((current) => (current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]));
  }

  async function syncWatchlistForRule(ruleScope: string | undefined) {
    if (ruleScope !== "watchlist") return;
    await fetchJson("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: readWatchlist() }),
    });
  }

  async function createRule(payload?: Partial<AlertRule>): Promise<RuleSaveResult> {
    setBusyId("create");
    setMessage("");
    try {
      await syncWatchlistForRule(payload?.scope ?? scope);
      const result = await fetchJson<{ mode?: string }>("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          payload ?? {
            scope,
            symbol: symbolVisible ? normalizeSymbol(symbol) : undefined,
            type,
            threshold: thresholdVisible ? Number(threshold) : undefined,
            min_score: minScore.trim() ? Number(minScore) : undefined,
            channels,
            cooldown_minutes: Number(cooldown),
            entry_filter: entryFilter,
            enabled,
            source: THRESHOLD_TYPES.has(type) ? "user" : "system",
          },
        ),
      });
      const resultMessage = result.mode === "updated" ? "Alert rule updated." : "Alert rule saved.";
      setMessage(resultMessage);
      const alertSymbol = payload?.symbol ?? (symbolVisible ? normalizeSymbol(symbol) : undefined);
      trackAnalyticsEvent("alert_create", { mode: result.mode ?? "created", type: payload?.type ?? type }, { source: "alerts_workspace", symbol: alertSymbol });
      trackFirstUsefulAction("first_alert_creation", { mode: result.mode ?? "created", type: payload?.type ?? type }, { source: "alerts_workspace", symbol: alertSymbol });
      await reload();
      return { message: resultMessage, mode: result.mode, ok: true };
    } catch (error) {
      const resultMessage = error instanceof Error ? error.message : "Failed to save alert rule.";
      setMessage(resultMessage);
      return { message: resultMessage, ok: false };
    } finally {
      setBusyId("");
    }
  }

  async function patchRule(rule: AlertRule, patch: Partial<AlertRule>) {
    setBusyId(rule.id);
    setMessage("");
    try {
      await fetchJson(`/api/alerts/rules/${encodeURIComponent(rule.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update alert rule.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteRule(rule: AlertRule) {
    if (!window.confirm(`Delete alert rule "${rule.id}" permanently?`)) {
      return;
    }
    setBusyId(rule.id);
    setMessage("");
    try {
      const result = await fetchJson<{ removedStateCount?: number }>(`/api/alerts/rules/${encodeURIComponent(rule.id)}`, { method: "DELETE" });
      await reload();
      trackAnalyticsEvent("alert_delete", { removedStateCount: result.removedStateCount ?? 0, type: rule.type }, { source: "alerts_workspace", symbol: rule.symbol });
      setMessage(`Alert rule deleted.${result.removedStateCount ? ` Removed ${result.removedStateCount} state entr${result.removedStateCount === 1 ? "y" : "ies"}.` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete alert rule.");
    } finally {
      setBusyId("");
    }
  }

  async function installRecommendedPreset() {
    setBusyId("install-preset");
    setMessage("");
    try {
      await syncWatchlistForRule("watchlist");
      for (const rule of RECOMMENDED_ALERT_PRESET) {
        await fetchJson<{ mode?: string }>("/api/alerts/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        });
      }
      await reload();
      setMessage("Recommended alert preset installed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to install recommended alert preset.");
    } finally {
      setBusyId("");
    }
  }

  async function disableAllAlerts() {
    const enabledRules = overview.rules.filter((rule) => rule.enabled);
    if (!enabledRules.length) {
      setMessage("All alert rules are already disabled.");
      return;
    }
    setBusyId("disable-all");
    setMessage("");
    try {
      for (const rule of enabledRules) {
        await fetchJson(`/api/alerts/rules/${encodeURIComponent(rule.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        });
      }
      await reload();
      setMessage(`Disabled ${enabledRules.length} alert rule${enabledRules.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to disable alert rules.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteAllDisabledAlerts() {
    const disabledRules = overview.rules.filter((rule) => !rule.enabled);
    if (!disabledRules.length) {
      setMessage("No disabled alert rules to delete.");
      return;
    }
    if (!window.confirm(`Delete ${disabledRules.length} disabled alert rule${disabledRules.length === 1 ? "" : "s"} permanently?`)) {
      return;
    }
    setBusyId("delete-disabled");
    setMessage("");
    try {
      let removedStateCount = 0;
      for (const rule of disabledRules) {
        const result = await fetchJson<{ removedStateCount?: number }>(`/api/alerts/rules/${encodeURIComponent(rule.id)}`, { method: "DELETE" });
        removedStateCount += result.removedStateCount ?? 0;
      }
      await reload();
      setMessage(`Deleted ${disabledRules.length} disabled alert rule${disabledRules.length === 1 ? "" : "s"}.${removedStateCount ? ` Removed ${removedStateCount} state entr${removedStateCount === 1 ? "y" : "ies"}.` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete disabled alert rules.");
    } finally {
      setBusyId("");
    }
  }

  async function testSend() {
    setBusyId("test-send");
    setTestResult(null);
    try {
      const result = await fetchJson<CommandResult>("/api/alerts/test-send", { method: "POST" });
      setTestResult(result);
      await reload();
    } catch (error) {
      setTestResult({ ok: false, error: error instanceof Error ? error.message : "Alert test failed." });
    } finally {
      setBusyId("");
    }
  }

  function quickRule(symbolValue: string, nextType: string, label: string, extra: Partial<AlertRule> = {}) {
    const cleaned = normalizeSymbol(symbolValue);
    return (
      <button
        className="rounded border border-slate-700/80 px-2 py-1 text-[11px] text-slate-300 hover:border-sky-400/50 hover:text-sky-200"
        disabled={busyId === "create"}
        key={`${cleaned}_${nextType}_${label}`}
        onClick={() => {
          if (!cleaned) {
            setQuickRuleStatus({ message: "Symbol unavailable. Add a valid symbol before creating an alert.", tone: "error" });
            return;
          }
          void createRule({
            id: `${cleaned.toLowerCase()}_${nextType}`,
            scope: "symbol",
            symbol: cleaned,
            type: nextType,
            channels: ["telegram"],
            cooldown_minutes: 1440,
            enabled: true,
            source: "system",
            entry_filter: defaultEntryFilter(nextType),
            ...extra,
          }).then((result) => {
            setQuickRuleStatus({
              message: result.ok ? `${label} alert ${result.mode === "updated" ? "updated" : "saved"} for ${cleaned}.` : result.message,
              tone: result.ok ? "success" : "error",
            });
          });
        }}
        type="button"
      >
        {label}
      </button>
    );
  }

  function quickScopedRule(label: string, payload: Partial<AlertRule>) {
    return (
      <button
        className="inline-flex min-h-9 items-center rounded border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/15"
        disabled={busyId === "create"}
        onClick={() => void createRule(payload)}
        type="button"
      >
        {label}
      </button>
    );
  }

  function statesForRule(rule: AlertRule) {
    const prefix = `${rule.id}:`;
    return Object.entries(overview.state.alerts).filter(([key, state]) => key === rule.id || key.startsWith(prefix) || state.alert_id === rule.id);
  }

  function latestSentForRule(rule: AlertRule) {
    const sent = statesForRule(rule)
      .map(([, state]) => state.last_sent_at)
      .filter((value): value is string => Boolean(value))
      .sort();
    return sent.length ? sent[sent.length - 1] : null;
  }

  async function testRule(rule: AlertRule, send = false) {
    setBusyId(`test_${rule.id}`);
    setTestResult(null);
    try {
      const result = await fetchJson<CommandResult>("/api/alerts/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: rule.id, send }),
      });
      setTestResult(result);
      await reload();
    } catch (error) {
      setTestResult({ ok: false, error: error instanceof Error ? error.message : "Alert test failed." });
    } finally {
      setBusyId("");
    }
  }

  const alertRulesTable = (
    <section className="terminal-panel overflow-x-auto rounded-md">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-3 py-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Active Alert Rules</div>
          <div className="mt-1 text-xs text-slate-500">Rules that exist or are enabled for evaluation. Triggered alert events are tracked separately in alert state.</div>
        </div>
        <button className="inline-flex min-h-9 items-center rounded border border-slate-700/80 px-3 py-2 text-[11px] text-slate-300 hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === "test-send"} onClick={testSend} type="button">
          {busyId === "test-send" ? "Running..." : "Run Alert Evaluation"}
        </button>
      </div>
      <table className="w-full min-w-[1460px] table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: 85 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 155 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 95 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 105 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 220 }} />
        </colgroup>
        <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-2 py-1.5">Enabled</th>
            <th className="px-2 py-1.5">Scope</th>
            <th className="px-2 py-1.5">Target</th>
            <th className="px-2 py-1.5">Rule Type</th>
            <th className="px-2 py-1.5">Threshold</th>
            <th className="px-2 py-1.5">Min Score</th>
            <th className="px-2 py-1.5">Entry Filter</th>
            <th className="px-2 py-1.5">Conviction</th>
            <th className="px-2 py-1.5">Channels</th>
            <th className="px-2 py-1.5">Cooldown</th>
            <th className="px-2 py-1.5">Last Sent</th>
            <th className="px-2 py-1.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/90">
          {sortedRules.map((rule) => {
            const ruleStates = statesForRule(rule);
            const configParts = compactConfig(rule);
            const latestState = ruleStates
              .map(([, state]) => state)
              .sort((a, b) => String(a.last_sent_at ?? a.last_skipped_at ?? "").localeCompare(String(b.last_sent_at ?? b.last_skipped_at ?? "")))
              .at(-1);
            return (
              <tr className={rule.enabled ? "text-slate-300" : "text-slate-600"} key={rule.id}>
                <td className="px-2 py-1.5">
                  <button className="inline-flex min-h-9 items-center rounded border border-slate-700/80 px-3 py-2 text-[11px] hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === rule.id} onClick={() => patchRule(rule, { enabled: !rule.enabled })} type="button">
                    {rule.enabled ? "On" : "Off"}
                  </button>
                </td>
                <td className="truncate px-2 py-1.5" title={rule.id}>
                  <div>{scopeLabel(rule.scope)}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{rule.id}</div>
                </td>
                <td className="px-2 py-1.5 font-mono text-sky-200">
                  {symbolHref(targetDisplay(rule)) ? (
                    <Link className="hover:text-sky-100" href={symbolHref(targetDisplay(rule))}>
                      {targetDisplay(rule)}
                    </Link>
                  ) : (
                    targetDisplay(rule)
                  )}
                </td>
                <td className="truncate px-2 py-1.5">{typeLabel(rule.type)}</td>
                <td className="px-2 py-1.5 font-mono">{thresholdDisplay(rule)}</td>
                <td className="px-2 py-1.5 font-mono">{minScoreDisplay(rule)}</td>
                <td className="px-2 py-1.5">
                  <select
                    className="w-full rounded border border-slate-700/80 bg-slate-950/70 px-1.5 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400/60"
                    disabled={busyId === rule.id}
                    onChange={(event) => patchRule(rule, { entry_filter: event.target.value })}
                    value={rule.entry_filter ?? "any"}
                  >
                    {ENTRY_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  {configParts.length ? (
                    <details>
                      <summary className="cursor-pointer text-sky-200">{configParts.length} fields</summary>
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                        {configParts.map((part) => (
                          <div className="truncate" key={part} title={part}>
                            {part}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5">{rule.channels.join(", ")}</td>
                <td className="px-2 py-1.5 font-mono">{rule.cooldown_minutes}</td>
                <td className="truncate px-2 py-1.5" title={latestState?.last_skip_reason ?? latestState?.last_status ?? ""}>
                  {formatDate(latestSentForRule(rule))}
                  {latestState?.last_entry_status ? <div className="truncate text-[10px] text-slate-500">{latestState.last_entry_status}</div> : null}
                  {ruleStates.length > 0 ? <div className="truncate text-[10px] text-slate-500">{ruleStates.length} symbol state{ruleStates.length === 1 ? "" : "s"}</div> : null}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <button className="inline-flex min-h-9 items-center rounded border border-slate-700/80 px-3 py-2 text-[11px] hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === `test_${rule.id}`} onClick={() => testRule(rule, false)} type="button">
                      Test
                    </button>
                    <button className="inline-flex min-h-9 items-center rounded border border-sky-400/30 px-3 py-2 text-[11px] text-sky-200 hover:bg-sky-400/10" disabled={busyId === `test_${rule.id}`} onClick={() => testRule(rule, true)} type="button">
                      Test Send
                    </button>
                    <button className="inline-flex min-h-9 items-center rounded border border-rose-400/30 px-3 py-2 text-[11px] text-rose-200 hover:bg-rose-400/10" disabled={busyId === rule.id} onClick={() => deleteRule(rule)} type="button">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );

  return (
    <div className="space-y-3">
      {message ? (
        <div className="terminal-panel rounded-md border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-100" role="status">
          {message}
        </div>
      ) : null}

      <div id="alert-radar">
        <AlertVisualCenter overview={overview} watchlist={watchlist} />
      </div>

      <AlertCinematicEcosystem overview={overview} watchlist={watchlist} />

      <UtilitySurfaceMaturityPanel surfaceId="alerts" />

      <AlertUtilityControlPanel overview={overview} />

      <SimpleAdvancedTabs
        simple={(
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Summary View</div>
            <p className="mt-1 text-sm leading-6 text-slate-400">Alert status and quick actions are shown by default. Open Advanced for active matches and rule tables.</p>
          </section>
        )}
        advanced={(
          <>
            <div id="alert-history">
              <ActiveAlertMatches />
            </div>
            <div id="alert-rule-table">{alertRulesTable}</div>
          </>
        )}
      />

      <section className="terminal-panel rounded-md p-4" id="alert-rules">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Quick Global Alerts</div>
            <div className="mt-1 text-xs text-slate-500">Preset controls create, disable, or clean alert rules using the alert rules API.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex min-h-9 items-center rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/15" disabled={Boolean(busyId)} onClick={installRecommendedPreset} type="button">
              {busyId === "install-preset" ? "Installing..." : "Install Recommended Alert Preset"}
            </button>
            <button className="inline-flex min-h-9 items-center rounded border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10" disabled={Boolean(busyId)} onClick={disableAllAlerts} type="button">
              {busyId === "disable-all" ? "Disabling..." : "Disable All Alerts"}
            </button>
            <button className="inline-flex min-h-9 items-center rounded border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-400/10" disabled={Boolean(busyId)} onClick={deleteAllDisabledAlerts} type="button">
              {busyId === "delete-disabled" ? "Deleting..." : "Delete All Disabled Alerts"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickScopedRule("Alert me for all entry-ready research contexts", {
            id: "global_entry_ready",
            scope: "global",
            type: "entry_ready",
            min_score: 70,
            min_rating: "ACTIONABLE",
            allowed_actions: ["STRONG BUY", "BUY"],
            min_risk_reward: 1.5,
            max_alerts_per_run: 5,
            channels: ["telegram"],
            cooldown_minutes: 720,
            enabled: true,
            entry_filter: "good_or_wait",
            source: "system",
          })}
          {quickScopedRule("Alert me for all top-ranked contexts", {
            id: "global_top_signals",
            scope: "global",
            type: "score_above",
            threshold: 80,
            min_rating: "TOP",
            allowed_actions: ["STRONG BUY", "BUY"],
            min_risk_reward: 1.5,
            max_alerts_per_run: 5,
            channels: ["telegram"],
            cooldown_minutes: 720,
            enabled: true,
            entry_filter: "avoid_overextended",
            source: "system",
          })}
          {quickScopedRule("Alert me for all stop-context breaks on watchlist", {
            id: "watchlist_stop_loss",
            scope: "watchlist",
            type: "stop_loss_broken",
            channels: ["telegram"],
            cooldown_minutes: 1440,
            enabled: true,
            entry_filter: "any",
            source: "system",
          })}
          {quickScopedRule("Alert me for all take-profit hits on watchlist", {
            id: "watchlist_take_profit",
            scope: "watchlist",
            type: "take_profit_hit",
            channels: ["telegram"],
            cooldown_minutes: 720,
            enabled: true,
            entry_filter: "any",
            source: "system",
          })}
        </div>
      </section>

      <ResponsiveAdvancedDetails
        className="terminal-panel rounded-md"
        eyebrow="Custom alerts"
        summary="Most users can start with presets. Open this for manual rules."
        title="Add custom alert"
      >
      <section>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Add Custom Alert</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_0.8fr_0.8fr_1fr_1fr_0.7fr]">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Scope
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setScope(event.target.value)} value={scope}>
              {SCOPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {symbolVisible ? (
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Symbol
              <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setSymbol(event.target.value)} placeholder="AVGO" value={symbol} />
            </label>
          ) : null}
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Alert Type
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setType(event.target.value)} value={type}>
              {FORM_TYPES.map((item) => (
                <option key={item} value={item}>
                  {typeLabel(item)}
                </option>
              ))}
            </select>
          </label>
          {thresholdVisible ? (
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Threshold
              <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setThreshold(event.target.value)} placeholder="430" type="number" value={threshold} />
            </label>
          ) : null}
          {minScoreVisible ? (
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Min Score
              <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setMinScore(event.target.value)} placeholder="70" type="number" value={minScore} />
            </label>
          ) : null}
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Cooldown Minutes
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" min="0" onChange={(event) => setCooldown(event.target.value)} type="number" value={cooldown} />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Entry Filter
            <select className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setEntryFilter(event.target.value)} value={entryFilter}>
              {ENTRY_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1 text-xs text-slate-300">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            Enabled
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
          {["telegram", "email"].map((channel) => (
            <label className="flex items-center gap-2" key={channel}>
              <input checked={channels.includes(channel)} onChange={() => toggleChannel(channel)} type="checkbox" />
              {channel}
            </label>
          ))}
          <button className="inline-flex min-h-9 items-center rounded border border-sky-400/50 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/15" disabled={busyId === "create"} onClick={() => void createRule()} type="button">
            Add Alert
          </button>
          {message ? <span className="text-slate-400">{message}</span> : null}
        </div>
      </section>
      </ResponsiveAdvancedDetails>

      <section className="terminal-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Watched Symbols</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Quick System Alerts</h2>
            <p className="mt-1 text-xs text-slate-500">Use these buttons to save symbol-specific alert rules. TradeVeto will confirm whether the rule was saved or updated.</p>
          </div>
          <div className="font-mono text-xs text-slate-500">{watchlist.length}</div>
        </div>
        {quickRuleStatus ? (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
              quickRuleStatus.tone === "success" ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" : "border-rose-300/25 bg-rose-400/10 text-rose-100"
            }`}
            role="status"
          >
            {quickRuleStatus.message}
          </div>
        ) : null}
        <div className="mt-3 divide-y divide-slate-800 text-xs">
          {watchlist.length ? (
            watchlist.map((item) => (
              <div className="flex flex-col gap-2 py-2 lg:flex-row lg:items-center lg:justify-between" key={item}>
                <Link className="font-mono font-semibold text-sky-200 hover:text-sky-100" href={`/symbol/${encodeURIComponent(item)}`}>
                  {item}
                </Link>
                <div className="flex flex-wrap gap-1.5">
                  {quickRule(item, "buy_zone_hit", "Entry Zone", { entry_filter: "any" })}
                  {quickRule(item, "stop_loss_broken", "Stop Context", { entry_filter: "any" })}
                  {quickRule(item, "take_profit_hit", "Target Context", { entry_filter: "any" })}
                  {quickRule(item, "score_changed_by", "Score +/-2", { threshold: 2, entry_filter: "avoid_overextended" })}
                  {quickRule(item, "rating_changed", "Rating Change", { entry_filter: "good_or_wait" })}
                  {quickRule(item, "action_changed", "Action Change", { entry_filter: "good_or_wait" })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 text-slate-500">No local watchlist symbols found. Add symbols from Symbol Detail pages to enable quick system alert buttons.</div>
          )}
        </div>
      </section>

      {testResult ? (
        <section className={`terminal-panel rounded-md p-4 ${testResult.ok ? "border-emerald-400/20" : "border-rose-400/25"}`}>
          <div className="text-sm font-semibold text-slate-100">{testResult.ok ? "Alert evaluation completed." : "Alert evaluation failed."}</div>
          {testResult.message ? <div className="mt-2 text-xs text-slate-300">{testResult.message}</div> : null}
          {testResult.error ? <div className="mt-2 text-xs text-rose-200">{testResult.error}</div> : null}
          {testResult.stdout || testResult.stderr ? (
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer uppercase tracking-[0.12em] text-slate-500">Advanced diagnostics</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-3">{`${testResult.stdout ?? ""}\n${testResult.stderr ?? ""}`.trim()}</pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
