"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { trackAnalyticsEvent } from "@/lib/client/analytics";
import { csrfFetch } from "@/lib/client/csrf-fetch";
import { RISK_EXPERIENCE_LEVELS, formatRiskExperienceLevel, normalizeRiskExperienceLevel, normalizeTimezone, requiresAccountOnboarding } from "@/lib/security/onboarding-profile";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timezones = useMemo(() => supportedTimezones(), []);

  const bypass = pathname ? PUBLIC_PATHS.has(pathname) : false;
  const visible = !loading && authenticated && Boolean(user) && !bypass && requiresAccountOnboarding(user);

  useEffect(() => {
    if (!visible || !user) return;
    const browserTimezone = normalizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? FALLBACK_TIMEZONES[0];
    setTimezone(normalizeTimezone(user.timezone) ?? browserTimezone);
    setRiskExperienceLevel(normalizeRiskExperienceLevel(user.riskExperienceLevel) ?? "");
  }, [user, visible]);

  if (!visible) return null;

  const canSave = Boolean(normalizeTimezone(timezone) && normalizeRiskExperienceLevel(riskExperienceLevel));

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
      router.refresh();
    } catch {
      setError("Unable to save onboarding.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/75 p-4 backdrop-blur-md md:items-center">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-300/25 bg-slate-950 p-5 shadow-2xl shadow-black/60">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Account setup</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Complete your trading profile</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">TradeVeto uses these account settings for timestamps, risk language, and product safety checks.</p>

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
              {RISK_EXPERIENCE_LEVELS.map((level) => (
                <label
                  className={`cursor-pointer rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    riskExperienceLevel === level ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                  }`}
                  key={level}
                >
                  <input checked={riskExperienceLevel === level} className="sr-only" name="riskExperienceLevel" onChange={() => setRiskExperienceLevel(level)} type="radio" />
                  {formatRiskExperienceLevel(level)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</div> : null}

        <div className="mt-5 flex justify-end">
          <button
            className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave || busy}
            onClick={() => void handleSave()}
            type="button"
          >
            {busy ? "Saving..." : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function supportedTimezones(): string[] {
  const intlWithValues = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const values = typeof intlWithValues.supportedValuesOf === "function" ? intlWithValues.supportedValuesOf("timeZone") : FALLBACK_TIMEZONES;
  const preferred = new Set(FALLBACK_TIMEZONES);
  return [...FALLBACK_TIMEZONES, ...values.filter((value) => !preferred.has(value))];
}
