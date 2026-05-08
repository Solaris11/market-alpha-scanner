"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "@/components/account/AuthModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";

const CHECKOUT_INTENT_KEY = "tv_pricing_checkout_intent";

type BillingResponse = {
  message?: string;
  ok?: boolean;
  url?: string;
};

export function PricingConversionCta() {
  const { authenticated, entitlement, loading } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading || authOpen || !authenticated || entitlement.isPremium || entitlement.isAdmin) return;
    if (window.sessionStorage.getItem(CHECKOUT_INTENT_KEY) !== "true") return;
    window.sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    void startBilling("checkout");
  }, [authOpen, authenticated, entitlement.isAdmin, entitlement.isPremium, loading]);

  async function startBilling(mode: "checkout" | "portal") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await csrfFetch(`/api/stripe/${mode}`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as BillingResponse | null;
      if (!response.ok || !payload?.url) {
        setMessage(payload?.message ?? (mode === "checkout" ? "Checkout is temporarily unavailable." : "Billing portal is temporarily unavailable."));
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setMessage(mode === "checkout" ? "Checkout is temporarily unavailable." : "Billing portal is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrimaryClick() {
    setMessage(null);
    if (!authenticated) {
      window.sessionStorage.setItem(CHECKOUT_INTENT_KEY, "true");
      setAuthOpen(true);
      return;
    }
    if (entitlement.isPremium || entitlement.isAdmin) {
      void startBilling("portal");
      return;
    }
    void startBilling("checkout");
  }

  const premiumActive = entitlement.isPremium || entitlement.isAdmin;
  const label = loading ? "Checking access..." : entitlement.isAdmin ? "Premium Active" : premiumActive ? "Manage Subscription" : authenticated ? "Unlock Premium Intelligence" : "Get Started";

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-4 shadow-[0_0_34px_rgba(34,211,238,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Premium next step</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
          {entitlement.isAdmin
            ? "Admin beta access is active. Billing is managed internally."
            : premiumActive
              ? "Premium access is active. Manage billing in Stripe when you need to update renewal or cancellation settings."
              : "Create an account or sign in, then Stripe handles trial, promo, renewal, and cancellation details before confirmation."}
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.22)] transition hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60 sm:min-w-[190px]"
          disabled={busy || loading || entitlement.isAdmin}
          onClick={handlePrimaryClick}
          type="button"
        >
          {busy ? "Opening Stripe..." : label}
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">No broker execution</div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Research-only workflow</div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Stripe-secured checkout</div>
      </div>
      {message ? <p className="mt-3 text-xs leading-5 text-amber-100">{message}</p> : null}
      {authOpen ? <AuthModal initialMode="register" onClose={() => setAuthOpen(false)} /> : null}
    </div>
  );
}
