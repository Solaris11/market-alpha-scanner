"use client";

import { useEffect, useMemo, useState } from "react";
import { csrfFetch } from "@/lib/client/csrf-fetch";

type PushPreferences = {
  fragility: boolean;
  macro: boolean;
  replay: boolean;
  shock: boolean;
  watchlist: boolean;
  whatChanged: boolean;
};

type PushStatusPayload = {
  deliveryConfigured?: boolean;
  ok?: boolean;
  publicKey?: string | null;
  status?: {
    enabledCount: number;
    lastSeenAt: string | null;
    preferences: PushPreferences;
  };
};

type PushUiState = "blocked" | "checking" | "configured" | "missing_key" | "ready" | "unsupported";

const DEFAULT_STATUS: PushStatusPayload = {
  deliveryConfigured: false,
  publicKey: null,
  status: {
    enabledCount: 0,
    lastSeenAt: null,
    preferences: {
      fragility: true,
      macro: true,
      replay: true,
      shock: true,
      watchlist: true,
      whatChanged: true,
    },
  },
};

export function PushPermissionCard() {
  const [status, setStatus] = useState<PushStatusPayload>(DEFAULT_STATUS);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(notificationPermission());
    void refreshStatus();
  }, []);

  const state: PushUiState = useMemo(() => {
    if (permission === "unsupported" || typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (permission === "denied") return "blocked";
    if (!status.ok && !status.publicKey) return "checking";
    if (!status.publicKey) return "missing_key";
    if ((status.status?.enabledCount ?? 0) > 0) return "configured";
    return "ready";
  }, [permission, status.ok, status.publicKey, status.status?.enabledCount]);

  async function refreshStatus(): Promise<void> {
    const response = await fetch("/api/push/status", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setStatus(DEFAULT_STATUS);
      return;
    }
    const payload = (await response.json().catch(() => DEFAULT_STATUS)) as PushStatusPayload;
    setStatus({ ...DEFAULT_STATUS, ...payload });
  }

  async function connectPush(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      if (!status.publicKey) {
        setMessage("Server push key is not configured yet.");
        return;
      }
      const browserPermission = await Notification.requestPermission();
      setPermission(browserPermission);
      if (browserPermission !== "granted") {
        setMessage("Browser notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/tradeveto-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToArrayBuffer(status.publicKey),
          userVisibleOnly: true,
        }));

      const response = await csrfFetch("/api/push/subscribe", {
        body: JSON.stringify({
          platform: platformLabel(),
          preferences: status.status?.preferences ?? DEFAULT_STATUS.status?.preferences,
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Push subscription failed.");
      }
      setMessage("Mobile push is connected for this device.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Push could not be connected.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectPush(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await csrfFetch("/api/push/unsubscribe", {
          body: JSON.stringify({ endpoint: subscription.endpoint }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        await subscription.unsubscribe();
      }
      setMessage("Push is disconnected for this device.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Push could not be disconnected.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await csrfFetch("/api/push/test", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { delivered?: number; message?: string } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Test push failed.");
      setMessage(payload?.message ?? `Test sent to ${payload?.delivered ?? 0} device${payload?.delivered === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test push could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCurrentPacket(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await csrfFetch("/api/push/intelligence", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { message?: string; summary?: { delivered?: number; eligiblePackets?: number } } | null;
      if (!response.ok) throw new Error(payload?.message ?? "Current intelligence push failed.");
      setMessage(payload?.message ?? `Sent ${payload?.summary?.eligiblePackets ?? 0} eligible intelligence packet${payload?.summary?.eligiblePackets === 1 ? "" : "s"} to ${payload?.summary?.delivered ?? 0} device${payload?.summary?.delivered === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Current intelligence push could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-4 shadow-2xl shadow-cyan-950/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Mobile Push</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Device intelligence alerts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/75">{copyForState(state, status.deliveryConfigured ?? false)}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClassFor(state)}`}>{labelForState(state)}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Subscribed devices" value={(status.status?.enabledCount ?? 0).toLocaleString()} />
        <MiniStat label="Browser permission" value={permission === "unsupported" ? "Unsupported" : permission} />
        <MiniStat label="Delivery keys" value={status.deliveryConfigured ? "Configured" : "Pending"} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {state === "configured" ? (
          <>
            <button className="min-h-11 rounded-full border border-cyan-200/40 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto" disabled={busy} onClick={sendTest} type="button">
              Send test
            </button>
            <button className="min-h-11 rounded-full border border-emerald-300/35 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto" disabled={busy} onClick={sendCurrentPacket} type="button">
              Send current packet
            </button>
            <button className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-300/40 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto" disabled={busy} onClick={disconnectPush} type="button">
              Disconnect device
            </button>
          </>
        ) : (
          <button className="min-h-11 rounded-full border border-cyan-200/40 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto" disabled={busy || state === "blocked" || state === "unsupported" || state === "missing_key"} onClick={connectPush} type="button">
            Connect this device
          </button>
        )}
      </div>

      {message ? <p className="mt-3 text-xs leading-5 text-cyan-50/75">{message}</p> : null}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold capitalize text-slate-100">{value}</div>
    </div>
  );
}

function copyForState(state: PushUiState, deliveryConfigured: boolean): string {
  if (state === "unsupported") return "This browser does not support web push. You can still use the mobile console from the browser.";
  if (state === "blocked") return "Notifications are blocked in the browser. Enable them in browser settings to receive TradeVeto push alerts.";
  if (state === "missing_key") return "The mobile app surface is ready, but the public VAPID push key is not configured yet.";
  if (state === "configured") {
    return deliveryConfigured
      ? "This device can receive watchlist, shock, macro, fragility, and what-changed alerts."
      : "This device is subscribed. Server delivery keys still need to be configured before pushes can be sent.";
  }
  return "Connect this device to receive high-signal TradeVeto alerts. Alerts are research context, not trade instructions.";
}

function labelForState(state: PushUiState): string {
  if (state === "configured") return "Connected";
  if (state === "missing_key") return "Setup needed";
  if (state === "blocked") return "Blocked";
  if (state === "unsupported") return "Unsupported";
  return "Ready";
}

function badgeClassFor(state: PushUiState): string {
  if (state === "configured") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (state === "blocked" || state === "unsupported") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
}

function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function platformLabel(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("iphone") || userAgent.includes("ipad")) return "ios";
  if (userAgent.includes("android")) return "android";
  return "desktop";
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}
