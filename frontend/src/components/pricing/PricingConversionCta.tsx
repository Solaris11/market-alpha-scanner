"use client";

import { usePricingCheckout } from "./usePricingCheckout";

export function PricingConversionCta() {
  const checkout = usePricingCheckout();

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-4 shadow-[0_0_34px_rgba(34,211,238,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Premium next step</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
          {checkout.isAdmin
            ? "Operator access is active. Billing is managed internally."
            : checkout.betaAccessActive
              ? "Founding early-access premium is active. No Stripe subscription is needed for this account."
            : checkout.premiumActive
              ? "Premium access is active. Manage billing in Stripe when you need to update renewal or cancellation settings."
              : "Create an account or sign in, then Stripe handles founding pricing, trial, promo, renewal, and cancellation details before confirmation."}
          </p>
        </div>
        <button
          className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal rounded-full bg-cyan-300 px-5 py-2.5 text-center text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.22)] transition hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:shrink-0 sm:whitespace-nowrap sm:min-w-[190px]"
          disabled={checkout.disabled}
          onClick={checkout.handlePrimaryClick}
          type="button"
        >
          {checkout.busy ? "Opening Stripe..." : checkout.label}
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">No broker execution</div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Research-only workflow</div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Stripe-secured checkout</div>
      </div>
      {checkout.message ? <p className="mt-3 text-xs leading-5 text-amber-100">{checkout.message}</p> : null}
      {checkout.authModal}
    </div>
  );
}
