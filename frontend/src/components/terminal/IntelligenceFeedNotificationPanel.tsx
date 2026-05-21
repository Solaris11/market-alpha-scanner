"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bell,
  BellRing,
  CalendarDays,
  ChevronRight,
  Clock,
  Eye,
  Gauge,
  Inbox,
  LineChart,
  Mail,
  Radio,
  RefreshCw,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import {
  notificationCategoryLabel,
  notificationChannelLabel,
  notificationFrequencyLabel,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_FREQUENCIES,
  NOTIFICATION_SYMBOL_SCOPES,
  type DailyBrief,
  type DailyBriefSection,
  type IntelligenceFeedItem,
  type NotificationChannel,
  type NotificationPreferences,
} from "@/lib/trading/intelligence-feed";
import { buildFeedItemTrustModel } from "@/lib/trading/institutional-trust";
import { InstitutionalTrustStrip } from "./InstitutionalTrustStrip";
import { GlassPanel } from "./ui/GlassPanel";

export function IntelligenceFeedNotificationPanel({
  brief,
  initialPreferences,
  items,
  watchlistSymbols,
}: {
  brief: DailyBrief;
  initialPreferences: NotificationPreferences;
  items: IntelligenceFeedItem[];
  watchlistSymbols: string[];
}) {
  const { actions, hydrated, preferences, saving } = useNotificationPreferences(initialPreferences);
  const urgentCount = items.filter((item) => item.notificationEligible).length;
  const visibleItems = items.slice(0, 10);
  const customSymbols = useMemo(() => uniqueSymbols([...preferences.symbols, ...watchlistSymbols]).slice(0, 10), [preferences.symbols, watchlistSymbols]);
  function trackPreferenceUpdate(field: string, value: string | number | boolean): void {
    trackAnalyticsEvent("notification_engagement", { action: "preference_update", field, value }, { source: "notification_preferences" });
  }

  return (
    <GlassPanel className="poster-scanline overflow-hidden border-sky-300/15 bg-sky-400/[0.025] p-4 sm:p-5" id="intelligence-feed">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
            <Radio className="h-4 w-4" />
            Market Awareness OS
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">What changed, why it matters, what to monitor</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{brief.headline}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
          <BriefStat label="Feed items" value={items.length.toLocaleString()} />
          <BriefStat label="Notify-ready" value={urgentCount.toLocaleString()} />
          <BriefStat label="Mode" value={notificationFrequencyLabel(preferences.frequency)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            <CalendarDays className="h-4 w-4" />
            Daily Brief
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {brief.sections.slice(0, 8).map((section) => <BriefSectionCard key={section.key} section={section} />)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                <Eye className="h-4 w-4" />
                Since your last visit
              </div>
              <div className="mt-2 grid gap-2">
                {brief.sinceLastVisit.length ? brief.sinceLastVisit.slice(0, 4).map((item) => (
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2 text-xs leading-5 text-slate-300" key={item}>{item}</div>
                )) : (
                  <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2 text-xs leading-5 text-slate-500">TradeVeto is building a real workflow baseline. No synthetic changes are shown.</div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.045] p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                <Gauge className="h-4 w-4" />
                What to monitor
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {brief.monitorList.length ? brief.monitorList.map((item) => (
                  <span className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-xs font-semibold text-slate-300" key={item}>{item}</span>
                )) : (
                  <span className="text-xs text-slate-500">No validated monitor list yet.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              <Inbox className="h-4 w-4" />
              High-signal feed
            </div>
            <div className="text-[11px] text-slate-500">{new Date(brief.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div className="mt-3 grid gap-2">
            {visibleItems.length ? visibleItems.map((item) => <FeedItemCard item={item} key={item.sourceKey} watchlistSymbols={watchlistSymbols} />) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-500">
                No feed item is ready yet. TradeVeto will show updates after the scanner, watchlist, or workflow state changes.
              </div>
            )}
          </div>
        </div>
      </div>

      <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
          <span className="inline-flex items-center gap-2"><Settings className="h-4 w-4 text-cyan-300" /> Notification controls</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{saving ? "saving" : hydrated ? "saved" : "loading"}</span>
        </summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <ControlGroup label="High-signal categories">
              {NOTIFICATION_CATEGORIES.map((category) => (
                <Chip active={preferences.categories.includes(category)} key={category} onClick={() => {
                  trackPreferenceUpdate("category", category);
                  actions.toggleCategory(category);
                }}>
                  {notificationCategoryLabel(category)}
                </Chip>
              ))}
            </ControlGroup>
            <ControlGroup label="Frequency">
              {NOTIFICATION_FREQUENCIES.map((frequency) => (
                <Chip active={preferences.frequency === frequency} key={frequency} onClick={() => {
                  trackPreferenceUpdate("frequency", frequency);
                  actions.setFrequency(frequency);
                }}>
                  {notificationFrequencyLabel(frequency)}
                </Chip>
              ))}
            </ControlGroup>
            <ControlGroup label="Channels">
              {NOTIFICATION_CHANNELS.map((channel) => (
                <ChannelChip active={preferences.channels.includes(channel)} channel={channel} key={channel} onClick={() => {
                  trackPreferenceUpdate("channel", channel);
                  actions.toggleChannel(channel);
                }} />
              ))}
            </ControlGroup>
          </div>

          <div className="space-y-3">
            <ControlGroup label="Symbol scope">
              {NOTIFICATION_SYMBOL_SCOPES.map((scope) => (
                <Chip active={preferences.symbolScope === scope} key={scope} onClick={() => {
                  trackPreferenceUpdate("symbol_scope", scope);
                  actions.setSymbolScope(scope);
                }}>
                  {scopeLabel(scope)}
                </Chip>
              ))}
            </ControlGroup>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                <Clock className="h-4 w-4" />
                Quiet hours
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input className="min-h-10 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-300/45" onChange={(event) => actions.setQuietHours(event.target.value || null, preferences.quietHoursEnd)} type="time" value={preferences.quietHoursStart ?? ""} />
                <input className="min-h-10 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-300/45" onChange={(event) => actions.setQuietHours(preferences.quietHoursStart, event.target.value || null)} type="time" value={preferences.quietHoursEnd ?? ""} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Daily in-app cap</span>
                <input className="h-2 w-28 accent-cyan-300" max={12} min={1} onChange={(event) => {
                  const nextLimit = Number(event.target.value);
                  trackPreferenceUpdate("daily_limit", nextLimit);
                  actions.setDailyLimit(nextLimit);
                }} type="range" value={preferences.dailyLimit} />
                <span className="w-8 text-right font-mono text-sm font-black text-cyan-100">{preferences.dailyLimit}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tracked symbols</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {customSymbols.length ? customSymbols.map((symbol) => (
                  <button className={`rounded-full border px-3 py-1 font-mono text-xs font-black transition ${preferences.symbols.includes(symbol) ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35"}`} key={symbol} onClick={() => {
                    trackPreferenceUpdate("symbol", symbol);
                    actions.toggleSymbol(symbol);
                  }} type="button">
                    {symbol}
                  </button>
                )) : <span className="text-xs text-slate-500">Add watchlist symbols to tune custom notifications.</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-3 text-xs leading-5 text-amber-50/80">
              Smart notifications stay research-only. Email and push are stored as preferences, but delivery still depends on configured email/push permission and future channel rollout.
            </div>
          </div>
        </div>
      </details>
    </GlassPanel>
  );
}

function BriefSectionCard({ section }: { section: DailyBriefSection }) {
  const Icon = sectionIcon(section.key);
  const symbols = section.symbols.slice(0, 4);
  return (
    <Link className={`group rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.05] ${sectionClass(section.severity)}`} href={section.actionHref}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border ${sectionIconClass(section.severity)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="truncate text-sm font-semibold text-slate-50">{section.title}</div>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
          </div>
          <div className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{section.status}</div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{section.summary}</p>
          {symbols.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {symbols.map((symbol) => <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[10px] font-black text-cyan-100" key={symbol}>{symbol}</span>)}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function FeedItemCard({ item, watchlistSymbols }: { item: IntelligenceFeedItem; watchlistSymbols: string[] }) {
  const Icon = itemIcon(item);
  const actions = feedActions(item);
  const trustModel = buildFeedItemTrustModel(item, { watchlistSymbols });
  function trackFeedEngagement(action: string): void {
    const metadata = { action, itemType: item.itemType, notificationEligible: item.notificationEligible, severity: item.severity, sourceKey: item.sourceKey };
    trackAnalyticsEvent("feed_item_open", metadata, { source: "intelligence_feed", symbol: item.relatedSymbol ?? undefined });
    trackAnalyticsEvent("feed_engagement", metadata, { source: "intelligence_feed", symbol: item.relatedSymbol ?? undefined });
    if (item.notificationEligible) {
      trackAnalyticsEvent("notification_engagement", { action: "feed_notification_candidate", category: item.category, itemType: item.itemType, severity: item.severity }, { source: "intelligence_feed", symbol: item.relatedSymbol ?? undefined });
    }
  }
  return (
    <article className={`rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.045] ${itemClass(item)}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${sectionIconClass(item.severity)}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${severityPillClass(item.severity)}`}>{item.severity}</span>
                <span className="text-[11px] text-slate-500">{item.evidenceLabel}</span>
              </div>
              <Link
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-100 transition hover:text-cyan-100"
                href={item.actionHref}
                onClick={() => trackFeedEngagement("open_title")}
              >
                {item.title}
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              </Link>
            </div>
            {item.relatedSymbol ? <Link className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 font-mono text-[11px] font-black text-cyan-100 transition hover:border-cyan-200/55" href={`/symbol/${encodeURIComponent(item.relatedSymbol)}`}>{item.relatedSymbol}</Link> : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <FeedCopyBlock label="What changed" text={item.summary} />
            <FeedCopyBlock label="Why it matters" text={item.whyItMatters} />
          </div>
          <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/35 p-2 text-xs leading-5 text-slate-300">
            <span className="font-black uppercase tracking-[0.12em] text-slate-500">Monitor </span>{item.monitorNext}
          </div>
          <InstitutionalTrustStrip className="mt-3" compact model={trustModel} />
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100"
                href={action.href}
                key={action.label}
                onClick={() => trackFeedEngagement(action.label)}
              >
                {action.label}
              </Link>
            ))}
            {item.notificationEligible ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100">notification eligible</span> : <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-500">feed only</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

function FeedCopyBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-2">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}

function BriefStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function ControlGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      className={`min-h-9 rounded-full border px-3 text-xs font-black transition ${active ? "border-cyan-200/55 bg-cyan-300/15 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]" : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-cyan-300/35 hover:text-slate-100"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ChannelChip({ active, channel, onClick }: { active: boolean; channel: NotificationChannel; onClick: () => void }) {
  const Icon = channel === "email" ? Mail : channel === "push" ? Smartphone : Bell;
  return (
    <Chip active={active} onClick={onClick}>
      <span className="inline-flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{notificationChannelLabel(channel)}</span>
    </Chip>
  );
}

function itemClass(item: IntelligenceFeedItem): string {
  if (item.severity === "critical") return "border-rose-300/25 bg-rose-400/[0.055]";
  if (item.severity === "warning") return "border-amber-300/20 bg-amber-300/[0.045]";
  if (item.severity === "positive") return "border-emerald-300/20 bg-emerald-300/[0.045]";
  return "border-white/10 bg-white/[0.025]";
}

function sectionClass(severity: IntelligenceFeedItem["severity"]): string {
  if (severity === "critical") return "border-rose-300/25 bg-rose-400/[0.045]";
  if (severity === "warning") return "border-amber-300/20 bg-amber-300/[0.04]";
  if (severity === "positive") return "border-emerald-300/20 bg-emerald-300/[0.04]";
  return "border-white/10 bg-white/[0.025]";
}

function sectionIconClass(severity: IntelligenceFeedItem["severity"]): string {
  if (severity === "critical") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (severity === "warning") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  if (severity === "positive") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
}

function severityPillClass(severity: IntelligenceFeedItem["severity"]): string {
  if (severity === "critical") return "border-rose-300/35 bg-rose-400/10 text-rose-100";
  if (severity === "warning") return "border-amber-300/35 bg-amber-300/10 text-amber-100";
  if (severity === "positive") return "border-emerald-300/35 bg-emerald-300/10 text-emerald-100";
  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function sectionIcon(key: DailyBriefSection["key"]) {
  if (key === "market_state") return Gauge;
  if (key === "macro_pressure") return Activity;
  if (key === "risk_environment" || key === "dangerous_names") return ShieldAlert;
  if (key === "shock_watch") return AlertTriangle;
  if (key === "watchlist_changes") return Eye;
  if (key === "what_changed") return RefreshCw;
  if (key === "stale_setups") return Clock;
  if (key === "replay_similarities") return LineChart;
  if (key === "best_setups") return Sparkles;
  return BellRing;
}

function itemIcon(item: IntelligenceFeedItem) {
  if (item.itemType === "score_improved" || item.itemType === "watchlist_score_improved" || item.itemType === "opportunity_attention_queue") return TrendingUp;
  if (item.itemType === "score_deteriorated" || item.itemType === "breadth_deteriorated" || item.itemType === "sector_pressure_changed") return TrendingDown;
  if (item.itemType === "risk_pressure_increased" || item.itemType === "shock_risk_detected" || item.itemType === "volatility_spiked" || item.itemType === "contradiction_detected") return AlertTriangle;
  if (item.itemType === "freshness_decayed" || item.itemType === "stale_setup_detected") return Clock;
  if (item.itemType === "replay_similarity_found") return RefreshCw;
  if (item.itemType === "alert_triggered") return BellRing;
  if (item.itemType === "market_regime_changed" || item.itemType === "macro_pressure_changed") return Gauge;
  return Activity;
}

function feedActions(item: IntelligenceFeedItem): Array<{ href: string; label: string }> {
  const actions: Array<{ href: string; label: string }> = [{ href: item.actionHref, label: item.relatedSymbol ? "Open Symbol" : "Open Detail" }];
  if (item.relatedSymbol) {
    const symbol = encodeURIComponent(item.relatedSymbol);
    actions.push({ href: `/symbol/${symbol}#chart`, label: "Open Chart" });
    actions.push({ href: `/symbol/${symbol}#replay`, label: "Open Replay" });
    actions.push({ href: `/alerts?symbol=${symbol}`, label: "Add Alert" });
    actions.push({ href: "/terminal#copilot", label: "Ask Copilot" });
  } else {
    actions.push({ href: "/terminal#market-charts", label: "Open Charts" });
    actions.push({ href: "/history", label: "Open History" });
  }
  return actions.slice(0, 5);
}

function scopeLabel(scope: string): string {
  if (scope === "all") return "All symbols";
  if (scope === "custom_symbols") return "Custom symbols";
  return "Watchlist + favorites";
}

function uniqueSymbols(symbols: string[]): string[] {
  const output: string[] = [];
  for (const raw of symbols) {
    const symbol = raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
    if (symbol && !output.includes(symbol)) output.push(symbol);
  }
  return output;
}
