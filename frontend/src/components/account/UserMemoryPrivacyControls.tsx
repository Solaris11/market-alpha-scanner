"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import type { UserMemorySettings } from "@/lib/trading/user-memory-settings";

type SettingsResponse = {
  message?: string;
  ok?: boolean;
  settings?: UserMemorySettings;
};

type MutationResponse = {
  message?: string;
  ok?: boolean;
};

export function UserMemoryPrivacyControls({ initialSettings, memoryAvailable }: { initialSettings: UserMemorySettings; memoryAvailable: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"clear" | "export" | "settings" | null>(null);

  async function updateSettings(next: Partial<UserMemorySettings>): Promise<void> {
    setBusy("settings");
    setStatus(null);
    try {
      const response = await csrfFetch("/api/user/memory-settings", {
        body: JSON.stringify({ ...settings, ...next }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as SettingsResponse | null;
      if (!response.ok || !payload?.ok || !payload.settings) {
        setStatus(payload?.message ?? "Memory settings could not be updated.");
        return;
      }
      setSettings(payload.settings);
      setStatus("Memory settings updated.");
      router.refresh();
    } catch {
      setStatus("Memory settings could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function exportMemory(): Promise<void> {
    setBusy("export");
    setStatus(null);
    try {
      const response = await fetch("/api/user/memory/export", { credentials: "same-origin" });
      if (!response.ok) {
        setStatus("Memory export is not available.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tradeveto-memory-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("Memory export prepared.");
    } catch {
      setStatus("Memory export is not available.");
    } finally {
      setBusy(null);
    }
  }

  async function clearMemory(): Promise<void> {
    if (typeof window !== "undefined" && !window.confirm("Clear decision journal and workflow memory for this account? Watchlist and risk profile settings are kept.")) return;
    setBusy("clear");
    setStatus(null);
    try {
      const response = await csrfFetch("/api/user/decision-journal", {
        body: JSON.stringify({ confirm: "CLEAR DECISION MEMORY" }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as MutationResponse | null;
      if (!response.ok || !payload?.ok) {
        setStatus(payload?.message ?? "Memory could not be cleared.");
        return;
      }
      setStatus("Decision and workflow memory cleared. Watchlist and risk settings were kept.");
      router.refresh();
    } catch {
      setStatus("Memory could not be cleared.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Memory controls</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ToggleRow
          checked={settings.behavioralLearningEnabled}
          description="Uses recent product interactions and workflow visits to personalize ranking context."
          disabled={busy === "settings"}
          label="Behavioral learning"
          onChange={(value) => void updateSettings({ behavioralLearningEnabled: value })}
        />
        <ToggleRow
          checked={settings.journalCoachingEnabled}
          description="Summarizes repeated journal patterns into strengths, cautions, and revisit notes."
          disabled={busy === "settings"}
          label="Journal coaching"
          onChange={(value) => void updateSettings({ journalCoachingEnabled: value })}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-60"
          disabled={busy !== null}
          onClick={() => void exportMemory()}
          type="button"
        >
          {busy === "export" ? "Preparing..." : "Export memory"}
        </button>
        <button
          className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null || !memoryAvailable}
          onClick={() => void clearMemory()}
          type="button"
        >
          {busy === "clear" ? "Clearing..." : "Clear memory"}
        </button>
        <span className="text-xs leading-5 text-slate-500">Export/delete affects memory, not your account, watchlist, or billing.</span>
      </div>
      {status ? <p className="mt-3 text-xs leading-5 text-slate-400">{status}</p> : null}
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 accent-cyan-300"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  );
}
