"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthModal } from "@/components/account/AuthModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const BETA_INTENT_KEY = "tv_landing_beta_intent";
const APP_ENTRY_URL = "/terminal";

export function LandingConversionCtas() {
  const { authenticated, entitlement, loading } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || authOpen || !authenticated) return;
    if (window.sessionStorage.getItem(BETA_INTENT_KEY) !== "true") return;
    window.sessionStorage.removeItem(BETA_INTENT_KEY);
    window.location.assign(APP_ENTRY_URL);
  }, [authOpen, authenticated, loading]);

  function handleGetStarted() {
    setMessage(null);
    if (loading) return;
    if (authenticated || entitlement.isPremium || entitlement.isAdmin) {
      window.location.assign(APP_ENTRY_URL);
      return;
    }
    window.sessionStorage.setItem(BETA_INTENT_KEY, "true");
    setAuthOpen(true);
  }

  const primaryLabel = loading
    ? "Checking access..."
    : entitlement.isPremium || entitlement.isAdmin
      ? "Open Dashboard"
      : authenticated
        ? "Open App"
        : "Get Started";

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          className="landing-cta inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-black text-slate-950 shadow-[0_0_36px_rgba(34,211,238,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
          disabled={loading}
          onClick={handleGetStarted}
          type="button"
        >
          {primaryLabel}
        </button>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[0.075]" href="/pricing">
          View Pricing
        </Link>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-black/20 px-6 py-3 text-sm font-bold text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300/35 hover:text-emerald-100" href="/how-it-works">
          See How It Works
        </Link>
      </div>
      {message ? <p className="mt-3 text-sm leading-6 text-amber-100">{message}</p> : null}
      {authOpen ? <AuthModal initialMode="register" onClose={() => setAuthOpen(false)} /> : null}
    </div>
  );
}
