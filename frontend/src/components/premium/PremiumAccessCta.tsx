"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BillingActionButton } from "@/components/account/AccountPageActions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { premiumAccessCopy, premiumAccessState, type PremiumAccessState } from "@/lib/security/premium-access-state";

type PremiumAccessCtaProps = {
  ctaHref?: string;
  ctaLabel?: string;
  initialState: PremiumAccessState;
  refreshOnPremium?: boolean;
};

export function PremiumAccessCta({ ctaHref = "/account", ctaLabel = "Sign in", initialState, refreshOnPremium = false }: PremiumAccessCtaProps) {
  const router = useRouter();
  const { authenticated, entitlement, loading } = useCurrentUser();
  const [refreshedForPremium, setRefreshedForPremium] = useState(false);
  const state = loading
    ? initialState
    : premiumAccessState({
        authenticated,
        isAdmin: entitlement.isAdmin,
        isPremium: entitlement.isPremium,
        plan: entitlement.plan,
      });
  const copy = premiumAccessCopy(state);

  useEffect(() => {
    if (refreshOnPremium && state === "authenticated_premium" && !refreshedForPremium) {
      setRefreshedForPremium(true);
      router.refresh();
    }
  }, [refreshOnPremium, refreshedForPremium, router, state]);

  return (
    <div className="min-w-0">
      <p className="max-w-3xl text-xs leading-5 text-cyan-100/75">{copy.helper}</p>
      <div className="mt-3">
        {state === "unauthenticated" ? (
          <Link className="inline-flex w-full rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-center text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/20 sm:w-auto" href={ctaHref}>
            {ctaLabel}
          </Link>
        ) : null}
        {state === "authenticated_free" ? <BillingActionButton mode="checkout" /> : null}
        {state === "authenticated_premium" && copy.statusLabel ? (
          <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">
            {copy.statusLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
