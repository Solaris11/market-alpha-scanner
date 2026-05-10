"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

type InstallState = "installed" | "ios_manual" | "prompt_available" | "waiting";

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());
    setIos(isIosBrowser());

    function onBeforeInstallPrompt(event: Event) {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferredPrompt(event);
      setMessage(null);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
      setMessage("TradeVeto is installed on this device.");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const state: InstallState = useMemo(() => {
    if (installed) return "installed";
    if (deferredPrompt) return "prompt_available";
    if (ios) return "ios_manual";
    return "waiting";
  }, [deferredPrompt, installed, ios]);

  async function installApp(): Promise<void> {
    if (!deferredPrompt) {
      setMessage(ios ? "On iPhone or iPad, use Share, then Add to Home Screen." : "If your browser supports install, the prompt appears after the app is eligible.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);
      if (choice?.outcome === "accepted") {
        setInstalled(true);
        setMessage("TradeVeto is installed on this device.");
      } else {
        setMessage("Install was dismissed. You can still use TradeVeto in the browser.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.055] p-4 shadow-2xl shadow-emerald-950/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200 sm:tracking-[0.24em]">Installable Web App</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Add TradeVeto to your phone</h2>
          <p className="mt-2 max-w-[20rem] text-sm leading-6 text-emerald-50/75 sm:max-w-3xl">{copyFor(state)}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClassFor(state)}`}>{labelFor(state)}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InstallStep label="Open" value="Use Safari or Chrome" />
        <InstallStep label="Install" value={ios ? "Share -> Add to Home Screen" : "Use browser install"} />
        <InstallStep label="Use" value="Launch like an app" />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          className="min-h-11 rounded-full border border-emerald-200/40 bg-emerald-300/15 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
          disabled={busy || installed}
          onClick={() => void installApp()}
          type="button"
        >
          {installed ? "Installed" : deferredPrompt ? "Install app" : "How to install"}
        </button>
        <a className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100 sm:w-auto" href="/manifest.webmanifest">
          Check manifest
        </a>
      </div>

      {message ? <p className="mt-3 text-xs leading-5 text-emerald-50/75">{message}</p> : null}
    </section>
  );
}

function InstallStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function copyFor(state: InstallState): string {
  if (state === "installed") return "This device is already in standalone app mode. Push alerts can be configured below if your browser supports them.";
  if (state === "prompt_available") return "Your browser says TradeVeto is install-ready. Install it for a cleaner mobile workflow and faster revisit loop.";
  if (state === "ios_manual") return "iOS does not always show an automatic install prompt. Use Share, then Add to Home Screen.";
  return "The web app is install-ready once the browser confirms eligibility. The mobile console still works normally in the browser.";
}

function labelFor(state: InstallState): string {
  if (state === "installed") return "Installed";
  if (state === "prompt_available") return "Ready";
  if (state === "ios_manual") return "Manual install";
  return "Browser managed";
}

function badgeClassFor(state: InstallState): string {
  if (state === "installed" || state === "prompt_available") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (state === "ios_manual") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const candidate = event as Event & { prompt?: unknown; userChoice?: unknown };
  return typeof candidate.prompt === "function" && candidate.userChoice instanceof Promise;
}

function isStandaloneMode(): boolean {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIosBrowser(): boolean {
  const platform = window.navigator.platform.toLowerCase();
  const userAgent = window.navigator.userAgent.toLowerCase();
  const touchMac = platform === "macintel" && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || touchMac;
}
