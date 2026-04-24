"use client";

import { useEffect, useMemo, useState } from "react";

type AlertRule = {
  id: string;
  symbol?: string;
  type: string;
  threshold?: number;
  channels: string[];
  enabled: boolean;
  cooldown_minutes: number;
  source?: "system" | "user";
};

type AlertStateEntry = {
  last_sent_at?: string;
  last_trigger_value?: string;
  last_observed_value?: string;
  last_status?: string;
  last_skip_reason?: string;
  last_channel_results?: Record<string, string>;
};

type AlertOverview = {
  rules: AlertRule[];
  state: { alerts: Record<string, AlertStateEntry> };
  activeCount: number;
  lastSentAt: string | null;
  rulesPath: string;
  statePath: string;
};

type CommandResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
};

const WATCHLIST_STORAGE_KEY = "market-alpha-scanner-watchlist";
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
];
const THRESHOLD_TYPES = new Set(["price_above", "price_below", "score_above", "score_below"]);

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function readWatchlist() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => normalizeSymbol(String(item))).filter(Boolean))).sort();
  } catch {
    return [];
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return value.replace("T", " ").replace("Z", " UTC");
}

function typeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

export function AlertsWorkspace({ initialOverview }: { initialOverview: AlertOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState("price_above");
  const [threshold, setThreshold] = useState("");
  const [channels, setChannels] = useState<string[]>(["telegram"]);
  const [cooldown, setCooldown] = useState("1440");
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
    window.addEventListener("market-alpha-scanner-watchlist-change", refreshWatchlist);
    return () => {
      window.removeEventListener("storage", refreshWatchlist);
      window.removeEventListener("market-alpha-scanner-watchlist-change", refreshWatchlist);
    };
  }, []);

  const sortedRules = useMemo(() => [...overview.rules].sort((a, b) => String(a.symbol ?? "").localeCompare(String(b.symbol ?? "")) || a.type.localeCompare(b.type)), [overview.rules]);
  const thresholdVisible = THRESHOLD_TYPES.has(type);

  async function reload() {
    setOverview(await fetchJson<AlertOverview>("/api/alerts/rules"));
  }

  function toggleChannel(channel: string) {
    setChannels((current) => (current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]));
  }

  async function createRule(payload?: Partial<AlertRule>) {
    setBusyId("create");
    setMessage("");
    try {
      await fetchJson("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          payload ?? {
            symbol: normalizeSymbol(symbol),
            type,
            threshold: thresholdVisible ? Number(threshold) : undefined,
            channels,
            cooldown_minutes: Number(cooldown),
            enabled,
            source: THRESHOLD_TYPES.has(type) ? "user" : "system",
          },
        ),
      });
      setMessage("Alert rule saved.");
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
    setBusyId(rule.id);
    setMessage("");
    try {
      await fetchJson(`/api/alerts/rules/${encodeURIComponent(rule.id)}`, { method: "DELETE" });
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove alert rule.");
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
            symbol: cleaned,
            type: nextType,
            channels: ["telegram"],
            cooldown_minutes: 1440,
            enabled: true,
            source: "system",
            ...extra,
          })
        }
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <section className="grid gap-2 md:grid-cols-4">
        {[
          { label: "Active Rules", value: overview.activeCount.toLocaleString(), meta: `${overview.rules.length.toLocaleString()} total` },
          { label: "Last Sent", value: formatDate(overview.lastSentAt), meta: "alert_state.json" },
          { label: "Rules File", value: "alert_rules.json", meta: overview.rulesPath },
          { label: "State File", value: "alert_state.json", meta: overview.statePath },
        ].map((metric) => (
          <div className="terminal-panel min-w-0 rounded-md px-3 py-2" key={metric.label}>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
            <div className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{metric.value}</div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500" title={metric.meta}>
              {metric.meta}
            </div>
          </div>
        ))}
      </section>

      <section className="terminal-panel rounded-md p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">New Alert</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_0.8fr_1fr_0.7fr]">
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Symbol
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" onChange={(event) => setSymbol(event.target.value)} placeholder="AVGO" value={symbol} />
          </label>
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
          <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Cooldown Minutes
            <input className="mt-1 w-full rounded border border-slate-700/80 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400/60" min="0" onChange={(event) => setCooldown(event.target.value)} type="number" value={cooldown} />
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
                <div className="font-mono font-semibold text-sky-200">{item}</div>
                <div className="flex flex-wrap gap-1.5">
                  {quickRule(item, "buy_zone_hit", "Buy Zone")}
                  {quickRule(item, "stop_loss_broken", "Stop Loss")}
                  {quickRule(item, "take_profit_hit", "Take Profit")}
                  {quickRule(item, "score_changed_by", "Score +/-2", { threshold: 2 })}
                  {quickRule(item, "rating_changed", "Rating Change")}
                  {quickRule(item, "action_changed", "Action Change")}
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 text-slate-500">No local watchlist symbols found. Add symbols from Symbol Detail pages to enable quick system alert buttons.</div>
          )}
        </div>
      </section>

      <section className="terminal-panel overflow-x-auto rounded-md">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Active Alert Rules</div>
          <button className="rounded border border-slate-700/80 px-2 py-1 text-[11px] text-slate-300 hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === "test-send"} onClick={testSend} type="button">
            {busyId === "test-send" ? "Running..." : "Run Alert Evaluation"}
          </button>
        </div>
        <table className="w-full min-w-[1060px] table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: 135 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 155 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 105 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 180 }} />
          </colgroup>
          <thead className="border-b border-slate-800 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-2 py-1.5">Rule</th>
              <th className="px-2 py-1.5">Symbol</th>
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">Threshold</th>
              <th className="px-2 py-1.5">Channels</th>
              <th className="px-2 py-1.5">Cooldown</th>
              <th className="px-2 py-1.5">Last Sent</th>
              <th className="px-2 py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {sortedRules.map((rule) => {
              const state = overview.state.alerts[rule.id] ?? {};
              return (
                <tr className={rule.enabled ? "text-slate-300" : "text-slate-600"} key={rule.id}>
                  <td className="truncate px-2 py-1.5 font-mono" title={rule.id}>
                    {rule.id}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-sky-200">{rule.symbol ?? "GLOBAL"}</td>
                  <td className="truncate px-2 py-1.5">{typeLabel(rule.type)}</td>
                  <td className="px-2 py-1.5 font-mono">{rule.threshold ?? "N/A"}</td>
                  <td className="px-2 py-1.5">{rule.channels.join(", ")}</td>
                  <td className="px-2 py-1.5 font-mono">{rule.cooldown_minutes}</td>
                  <td className="truncate px-2 py-1.5" title={state.last_skip_reason ?? state.last_status ?? ""}>
                    {formatDate(state.last_sent_at)}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      <button className="rounded border border-slate-700/80 px-2 py-1 text-[11px] hover:border-sky-400/50 hover:text-sky-200" disabled={busyId === rule.id} onClick={() => patchRule(rule, { enabled: !rule.enabled })} type="button">
                        {rule.enabled ? "Disable" : "Enable"}
                      </button>
                      <button className="rounded border border-rose-400/30 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-400/10" disabled={busyId === rule.id} onClick={() => deleteRule(rule)} type="button">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {testResult ? (
        <section className={`terminal-panel rounded-md p-4 ${testResult.ok ? "border-emerald-400/20" : "border-rose-400/25"}`}>
          <div className="text-sm font-semibold text-slate-100">{testResult.ok ? "Alert evaluation completed." : "Alert evaluation failed."}</div>
          {testResult.error ? <div className="mt-2 text-xs text-rose-200">{testResult.error}</div> : null}
          <details className="mt-3 text-xs text-slate-400">
            <summary className="cursor-pointer uppercase tracking-[0.12em] text-slate-500">Logs</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-3">{`${testResult.stdout ?? ""}\n${testResult.stderr ?? ""}`.trim() || "No logs returned."}</pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}
