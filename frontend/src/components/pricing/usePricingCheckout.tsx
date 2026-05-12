"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthModal } from "@/components/account/AuthModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { csrfFetch } from "@/lib/client/csrf-fetch";

const CHECKOUT_INTENT_KEY = "tv_pricing_checkout_intent";

type BillingResponse = {
  message?: string;
  ok?: boolean;
  url?: string;
};

export type PricingCheckoutController = {
  authModal: ReactNode;
  betaAccessActive: boolean;
  busy: boolean;
  disabled: boolean;
  handlePrimaryClick: () => void;
  isAdmin: boolean;
  label: string;
  loading: boolean;
  message: string | null;
  premiumActive: boolean;
};

export function usePricingCheckout(): PricingCheckoutController {
  const { authenticated, entitlement, loading } = useCurrentUser();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingClick, setPendingClick] = useState(false);

  useEffect(() => {
    if (loading || authOpen || !authenticated || entitlement.isPremium || entitlement.isAdmin) return;
    if (window.sessionStorage.getItem(CHECKOUT_INTENT_KEY) !== "true") return;
    window.sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
    void startBilling("checkout");
  }, [authOpen, authenticated, entitlement.isAdmin, entitlement.isPremium, loading]);

  useEffect(() => {
    if (loading || !pendingClick) return;
    setPendingClick(false);
    handlePrimaryClick();
  }, [loading, pendingClick]);

  async function startBilling(mode: "checkout" | "portal"): Promise<void> {
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

  function handlePrimaryClick(): void {
    setMessage(null);
    if (loading) {
      setPendingClick(true);
      return;
    }
    if (!authenticated) {
      window.sessionStorage.setItem(CHECKOUT_INTENT_KEY, "true");
      setAuthOpen(true);
      return;
    }
    if (entitlement.betaAccess) {
      setMessage("Closed beta access is already active. No billing action is needed for this beta account.");
      return;
    }
    if (entitlement.isPremium || entitlement.isAdmin) {
      void startBilling("portal");
      return;
    }
    void startBilling("checkout");
  }

  const betaAccessActive = entitlement.betaAccess;
  const premiumActive = entitlement.isPremium || entitlement.isAdmin;
  const label = loading ? "Checking access..." : entitlement.isAdmin ? "Premium Active" : entitlement.betaAccess ? "Beta Premium Active" : premiumActive ? "Manage Subscription" : authenticated ? "Unlock Premium Intelligence" : "Get Started";

  return {
    authModal: authOpen ? <AuthModal initialMode="register" onClose={() => setAuthOpen(false)} /> : null,
    betaAccessActive,
    busy,
    disabled: busy || entitlement.isAdmin || entitlement.betaAccess,
    handlePrimaryClick,
    isAdmin: entitlement.isAdmin,
    label,
    loading,
    message,
    premiumActive,
  };
}
