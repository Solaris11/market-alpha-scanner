"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BellRing, Gauge, MonitorSmartphone, Save, SlidersHorizontal } from "lucide-react";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  notificationCategoryLabel,
  notificationChannelLabel,
  notificationFrequencyLabel,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationFrequency,
  type NotificationPreferences,
  type NotificationSymbolScope,
} from "@/lib/trading/intelligence-feed";

type PreferencesResponse = {
  authenticated?: boolean;
  error?: string;
  preferences?: NotificationPreferences;
};

type SaveState = {
  message: string;
  tone: "error" | "success" | "working";
};

const FREQUENCIES: NotificationFrequency[] = ["high_signal_only", "daily_digest", "off"];
const SYMBOL_SCOPES: NotificationSymbolScope[] = ["watchlist_and_favorites", "custom_symbols", "all"];
const CHART_DEFAULTS = [
  { label: "Price + volume", value: "price-volume" },
  { label: "Price + SMA + RSI", value: "price-sma-rsi" },
  { label: "Volatility review", value: "volatility-review" },
] as const;
const SCANNER_DENSITY = [
  { label: "Compact rows", value: "compact" },
  { label: "Balanced rows", value: "balanced" },
  { label: "Comfort rows", value: "comfort" },
] as const;
const MOBILE_MODES = [
  { label: "Native sheets", value: "native-sheets" },
  { label: "Dense lists", value: "dense-lists" },
  { label: "Reduced motion", value: "reduced-motion" },
] as const;
const FRESHNESS_MODES = [
  { label: "Strict fresh only", value: "strict" },
  { label: "Balanced", value: "balanced" },
  { label: "Research context", value: "context" },
] as const;

export function SettingsPreferenceCenter() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [chartDefault, setChartDefault] = useStoredPreference("tradeveto_chart_default_v1", "price-sma-rsi");
  const [scannerDensity, setScannerDensity] = useStoredPreference("tradeveto_scanner_density_v1", "balanced");
  const [mobileMode, setMobileMode] = useStoredPreference("tradeveto_mobile_mode_v1", "native-sheets");
  const [freshnessMode, setFreshnessMode] = useStoredPreference("tradeveto_data_freshness_mode_v1", "balanced");

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      try {
        const response = await fetch("/api/user/notification-preferences", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as PreferencesResponse | null;
        if (active && payload?.preferences) setPreferences(payload.preferences);
      } finally {
        if (active) setLoaded(true);
      }
    }
    void loadPreferences();
    return () => {
      active = false;
    };
  }, []);

  const selectedCategoryCount = preferences.categories.length;
  const selectedChannelCount = preferences.channels.length;
  const categoryPreview = useMemo(() => preferences.categories.slice(0, 4).map(notificationCategoryLabel).join(", "), [preferences.categories]);

  function toggleCategory(category: NotificationCategory) {
    setPreferences((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  function toggleChannel(channel: NotificationChannel) {
    setPreferences((current) => {
      const next = current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];
      return { ...current, channels: next.length ? next : ["in_app"] };
    });
  }

  async function saveNotificationPreferences() {
    setSaveState({ message: "Saving notification preferences...", tone: "working" });
    try {
      const response = await csrfFetch("/api/user/notification-preferences", {
        body: JSON.stringify(preferences),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as PreferencesResponse | null;
      if (!response.ok || !payload?.preferences) {
        throw new Error(payload?.error ?? "Failed to save notification preferences.");
      }
      setPreferences(payload.preferences);
      setSaveState({ message: "Notification preferences saved.", tone: "success" });
    } catch (error) {
      setSaveState({ message: error instanceof Error ? error.message : "Failed to save notification preferences.", tone: "error" });
    }
  }

  return (
    <section className="visual-card poster-panel tv-card-motion rounded-3xl border border-violet-300/16 bg-slate-950/54 p-5 shadow-2xl shadow-black/20 ring-1 ring-white/5" aria-labelledby="settings-preferences-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">Preference controls</div>
          <h2 id="settings-preferences-heading" className="mt-1 text-xl font-bold text-slate-50">Defaults, notifications, and freshness</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Notification preferences are account-backed. Chart, scanner, mobile, and freshness defaults are stored locally on this browser so they remain usable before full profile sync.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-300/18 bg-cyan-400/[0.055] px-3 py-2 text-xs leading-5 text-cyan-50">
          {loaded ? `${selectedCategoryCount} notification categories and ${selectedChannelCount} channel${selectedChannelCount === 1 ? "" : "s"} selected.` : "Loading saved preferences..."}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
            <BellRing className="h-4 w-4" />
            Notification preferences
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Frequency
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/70" onChange={(event) => setPreferences((current) => ({ ...current, frequency: event.target.value as NotificationFrequency }))} value={preferences.frequency}>
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>{notificationFrequencyLabel(frequency)}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Daily limit
              <input className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/70" max={24} min={1} onChange={(event) => setPreferences((current) => ({ ...current, dailyLimit: Number(event.target.value) }))} type="number" value={preferences.dailyLimit} />
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Symbol scope
              <select className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/70" onChange={(event) => setPreferences((current) => ({ ...current, symbolScope: event.target.value as NotificationSymbolScope }))} value={preferences.symbolScope}>
                {SYMBOL_SCOPES.map((scope) => (
                  <option key={scope} value={scope}>{scopeLabel(scope)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <fieldset className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <legend className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Channels</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300" key={channel}>
                    <input checked={preferences.channels.includes(channel)} onChange={() => toggleChannel(channel)} type="checkbox" />
                    <span>{notificationChannelLabel(channel)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <legend className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Quiet hours</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Start
                  <input className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/70" onChange={(event) => setPreferences((current) => ({ ...current, quietHoursStart: event.target.value || null }))} type="time" value={preferences.quietHoursStart ?? ""} />
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  End
                  <input className="mt-1 h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/70" onChange={(event) => setPreferences((current) => ({ ...current, quietHoursEnd: event.target.value || null }))} type="time" value={preferences.quietHoursEnd ?? ""} />
                </label>
              </div>
            </fieldset>
          </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-300">Notification categories</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {NOTIFICATION_CATEGORIES.map((category) => (
                <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-slate-300" key={category}>
                  <input checked={preferences.categories.includes(category)} onChange={() => toggleCategory(category)} type="checkbox" />
                  <span>{notificationCategoryLabel(category)}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Current preview: {categoryPreview || "No categories selected."}</p>
          </details>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15" onClick={() => void saveNotificationPreferences()} type="button">
              <Save className="h-4 w-4" />
              Save notification preferences
            </button>
            {saveState ? (
              <span className={`text-xs leading-5 ${saveState.tone === "error" ? "text-rose-100" : saveState.tone === "working" ? "text-amber-100" : "text-emerald-100"}`} role="status">
                {saveState.message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <PreferenceSelect icon={<SlidersHorizontal className="h-4 w-4" />} label="Chart defaults" onChange={setChartDefault} options={CHART_DEFAULTS} value={chartDefault} />
          <PreferenceSelect icon={<Gauge className="h-4 w-4" />} label="Scanner defaults" onChange={setScannerDensity} options={SCANNER_DENSITY} value={scannerDensity} />
          <PreferenceSelect icon={<MonitorSmartphone className="h-4 w-4" />} label="Mobile preferences" onChange={setMobileMode} options={MOBILE_MODES} value={mobileMode} />
          <PreferenceSelect icon={<BellRing className="h-4 w-4" />} label="Data freshness preferences" onChange={setFreshnessMode} options={FRESHNESS_MODES} value={freshnessMode} />
        </div>
      </div>
    </section>
  );
}

function PreferenceSelect({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  value: string;
}) {
  return (
    <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
      <span className="flex items-center gap-2 text-cyan-200">
        {icon}
        {label}
      </span>
      <select className="mt-3 h-11 w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/70" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function useStoredPreference(key: string, initialValue: string): [string, (value: string) => void] {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(stored);
    } catch {
      // Browser storage can be disabled; defaults still keep the form usable.
    }
  }, [key]);

  function update(nextValue: string) {
    setValue(nextValue);
    try {
      window.localStorage.setItem(key, nextValue);
    } catch {
      // Preference changes remain in-memory when storage is unavailable.
    }
  }

  return [value, update];
}

function scopeLabel(scope: NotificationSymbolScope): string {
  if (scope === "all") return "All symbols";
  if (scope === "custom_symbols") return "Custom symbols";
  return "Watchlist and favorites";
}
