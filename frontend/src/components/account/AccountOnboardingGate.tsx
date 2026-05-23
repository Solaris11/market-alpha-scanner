"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { lockMobileBodyScroll } from "@/lib/client/mobile-scroll-lock";
import { installMobileViewportCssVars } from "@/lib/client/mobile-viewport";
import { RISK_EXPERIENCE_LEVELS, formatRiskExperienceLevel, normalizeRiskExperienceLevel, normalizeTimezone, requiresAccountOnboarding, type RiskExperienceLevel } from "@/lib/security/onboarding-profile";

const PUBLIC_PATHS = new Set(["/terms", "/privacy", "/risk-disclosure", "/reset-password"]);

const FALLBACK_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Istanbul",
  "Asia/Tokyo",
];

const RISK_EXPERIENCE_HELP: Record<RiskExperienceLevel, { detail: string; nextStep: string }> = {
  advanced: {
    detail: "Show deeper research controls, large-move context, higher-risk ideas, and evidence labels.",
    nextStep: "Start with the full console, then compare opportunities and symbol detail.",
  },
  beginner: {
    detail: "Explain WAIT, fragility, and opportunity timing in the simplest workflow first.",
    nextStep: "Start with What Matters Most Now, then add one symbol to your watchlist.",
  },
  intermediate: {
    detail: "Balance opportunity quality, risk controls, entry timing, and broader market context.",
    nextStep: "Start with the console, then review the top opportunities by risk/reward.",
  },
};

type ProfileResponse = {
  authenticated?: boolean;
  error?: string;
  profile?: {
    onboardingCompleted: boolean;
    riskExperienceLevel: string | null;
    timezone: string | null;
  };
};

export function AccountOnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, loading, refresh, user } = useCurrentUser();
  const [timezone, setTimezone] = useState("");
  const [riskExperienceLevel, setRiskExperienceLevel] = useState("");
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timezones = useMemo(() => supportedTimezones(), []);

  const bypass = pathname ? PUBLIC_PATHS.has(pathname) : false;
  const visible = !loading && authenticated && Boolean(user) && !bypass && requiresAccountOnboarding(user);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible || !user) return;
    const browserTimezone = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? FALLBACK_TIMEZONES[0];
    setTimezone(normalizeTimezone(user.timezone) ?? browserTimezone);
    setRiskExperienceLevel(normalizeRiskExperienceLevel(user.riskExperienceLevel) ?? "");
  }, [user, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const cleanupViewport = installMobileViewportCssVars();
    const unlockBodyScroll = lockMobileBodyScroll(window.scrollY);
    return () => {
      unlockBodyScroll();
      cleanupViewport();
    };
  }, [visible]);

  if (!mounted || !visible) return null;

  const selectedRiskExperience = normalizeRiskExperienceLevel(riskExperienceLevel);
  const canSave = Boolean(normalizeTimezone(timezone) && selectedRiskExperience);

  async function handleSave() {
    if (!canSave || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await csrfFetch("/api/user/profile", {
        body: JSON.stringify({
          onboardingCompleted: true,
          riskExperienceLevel,
          timezone,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok || !payload?.authenticated || !payload.profile || requiresAccountOnboarding(payload.profile)) {
        setError(payload?.error ?? "Unable to save onboarding.");
        return;
      }
      trackAnalyticsEvent("onboarding_complete", { onboarding: "account_profile", riskExperienceLevel }, { source: "account_onboarding" });
      await refresh();
      router.push("/terminal?firstRun=1");
    } catch {
      setError("Unable to save onboarding.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      aria-label="Account setup"
      aria-modal="true"
      className="tv-critical-overlay-root fixed inset-0 flex items-end justify-center bg-black/75 backdrop-blur-md md:items-center"
      data-mobile-gesture-ignore="true"
      data-stable-overlay="true"
      role="dialog"
    >
      <div className="tv-critical-overlay-panel w-full max-w-2xl rounded-2xl border border-cyan-300/25 bg-slate-950 shadow-2xl shadow-black/60">
        <div className="tv-critical-overlay-scroll p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Account setup</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Choose your starting path</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            TradeVeto adapts the first walkthrough to your experience level. You do not need to understand every score on day one; the first session focuses on one market read, one opportunity, and one watchlist.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">1. Timezone</span>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-300/60"
                onChange={(event) => setTimezone(event.target.value)}
                value={timezone}
              >
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">2. Risk experience</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {RISK_EXPERIENCE_LEVELS.map((level) => {
                  const help = RISK_EXPERIENCE_HELP[level];
                  return (
                  <label
                    className={`cursor-pointer rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      riskExperienceLevel === level ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                    }`}
                    key={level}
                  >
                    <input checked={riskExperienceLevel === level} className="sr-only" name="riskExperienceLevel" onChange={() => setRiskExperienceLevel(level)} type="radio" />
                    <span className="block text-sm text-slate-50">{formatRiskExperienceLevel(level)}</span>
                    <span className="mt-2 block text-xs font-normal leading-5 text-slate-400">{help.detail}</span>
                  </label>
                  );
                })}
              </div>
            </fieldset>

            {selectedRiskExperience ? (
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.06] p-3 text-xs leading-5 text-cyan-50/90">
                <div className="font-bold text-cyan-100">What happens next</div>
                <p className="mt-1">{RISK_EXPERIENCE_HELP[selectedRiskExperience].nextStep}</p>
                <p className="mt-1 text-cyan-100/70">The walkthrough explains WAIT-first, fragility, upside/downside balance, large-move opportunities, risk/reward controls, and where to look first in plain language.</p>
              </div>
            ) : null}
          </div>

          {error ? <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}
        </div>

        <div className="tv-critical-overlay-footer border-t px-5 py-3">
          <div className="flex justify-end">
            <button
              className="tv-governed-action min-h-11 w-full rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!canSave || busy}
              onClick={() => void handleSave()}
              type="button"
            >
              {busy ? "Saving..." : "Save and start"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function supportedTimezones(): string[] {
  const intlWithValues = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const values = typeof intlWithValues.supportedValuesOf === "function" ? intlWithValues.supportedValuesOf("timeZone") : FALLBACK_TIMEZONES;
  const preferred = new Set(FALLBACK_TIMEZONES);
  return [...FALLBACK_TIMEZONES, ...values.filter((value) => !preferred.has(value))];
}
