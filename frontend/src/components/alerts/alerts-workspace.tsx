"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SimpleAdvancedTabs } from "@/components/ui/SimpleAdvancedTabs";
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

  async function createRule(payload?: Partial<AlertRule>) {
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
      setMessage(result.mode === "updated" ? "Alert rule updated." : "Alert rule saved.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save alert rule.");
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
        onClick={() =>
          createRule({
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
          })
        }
        type="button"
      >
        {label}
      </button>
    );
  }

  function quickScopedRule(label: string, payload: Partial<AlertRule>) {
    return (
      <button
        className="rounded border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/15"
        disabled={busyId === "create"}
        onClick={() => createRule(payload)}
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
        <button className="rounded border border-slate-700/80 px-2 py-1 text-[11px] text-slate-300 hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === "test-send"} onClick={testSend} type="button">
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
                  <button className="rounded border border-slate-700/80 px-2 py-1 text-[11px] hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === rule.id} onClick={() => patchRule(rule, { enabled: !rule.enabled })} type="button">
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
                    <button className="rounded border border-slate-700/80 px-2 py-1 text-[11px] hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === `test_${rule.id}`} onClick={() => testRule(rule, false)} type="button">
                      Test
                    </button>
                    <button className="rounded border border-sky-400/30 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-400/10" disabled={busyId === `test_${rule.id}`} onClick={() => testRule(rule, true)} type="button">
                      Test Send
                    </button>
                    <button className="rounded border border-rose-400/30 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-400/10" disabled={busyId === rule.id} onClick={() => deleteRule(rule)} type="button">
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

      <section className="terminal-panel rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Alert System Status</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { label: "Active Rules", value: overview.activeCount.toLocaleString(), meta: `${overview.rules.length.toLocaleString()} total configured` },
            { label: "Last Alert Sent", value: formatDate(overview.lastSentAt), meta: "delivery status" },
          ].map((metric) => (
            <div className="min-w-0 rounded border border-slate-800 bg-slate-950/50 px-3 py-2" key={metric.label}>
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
              <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">{metric.meta}</div>
            </div>
          ))}
        </div>
      </section>

      <SimpleAdvancedTabs
        simple={(
          <section className="terminal-panel rounded-md p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Summary View</div>
            <p className="mt-1 text-sm leading-6 text-slate-400">Alert status and quick actions are shown by default. Open Advanced for active matches and rule tables.</p>
          </section>
        )}
        advanced={(
          <>
            <ActiveAlertMatches />
            {alertRulesTable}
          </>
        )}
      />

      <section className="terminal-panel rounded-md p-4">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Quick Global Alerts</div>
            <div className="mt-1 text-xs text-slate-500">Preset controls create, disable, or clean alert rules using the alert rules API.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/15" disabled={Boolean(busyId)} onClick={installRecommendedPreset} type="button">
              {busyId === "install-preset" ? "Installing..." : "Install Recommended Alert Preset"}
            </button>
            <button className="rounded border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/10" disabled={Boolean(busyId)} onClick={disableAllAlerts} type="button">
              {busyId === "disable-all" ? "Disabling..." : "Disable All Alerts"}
            </button>
            <button className="rounded border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-400/10" disabled={Boolean(busyId)} onClick={deleteAllDisabledAlerts} type="button">
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

      <section className="terminal-panel rounded-md p-4">
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
          <button className="rounded border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/15" disabled={busyId === "create"} onClick={() => createRule()} type="button">
            Add Alert
          </button>
          {message ? <span className="text-slate-400">{message}</span> : null}
        </div>
      </section>

      <section className="terminal-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Watched Symbols</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Quick System Alerts</h2>
          </div>
          <div className="font-mono text-xs text-slate-500">{watchlist.length}</div>
        </div>
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
