"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { usePricingCheckout } from "./usePricingCheckout";

type PricingActionCardProps = {
  children: ReactNode;
  className?: string;
};

export function PricingActionCard({ children, className = "" }: PricingActionCardProps) {
  const checkout = usePricingCheckout();
  const actionLabel = checkout.busy ? "Opening Stripe..." : checkout.label;

  function handleCardClick(event: MouseEvent<HTMLDivElement>): void {
    if (checkout.disabled || isNestedInteractiveTarget(event.target)) return;
    checkout.handlePrimaryClick();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (checkout.disabled || isNestedInteractiveTarget(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    checkout.handlePrimaryClick();
  }

  return (
    <MarketingReveal
      className={`group rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200/45 hover:bg-emerald-300/[0.075] ${checkout.disabled ? "" : "cursor-pointer"} ${className}`}
    >
      <div
        aria-disabled={checkout.disabled}
        aria-label={checkout.premiumActive ? "Manage Premium subscription" : "Start Premium checkout"}
        className="outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={checkout.disabled ? -1 : 0}
      >
        {children}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-cyan-300/20 bg-slate-950/55 p-4 shadow-[0_0_34px_rgba(34,211,238,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Premium checkout</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {checkout.premiumActive ? "Premium access is active. Manage billing in Stripe." : "Click this card or use the button to start the secure Stripe flow."}
            </p>
          </div>
          <span className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.22)] transition group-hover:bg-cyan-200 sm:min-w-[178px]">
            {actionLabel}
          </span>
        </div>
        {checkout.message ? <p className="mt-3 text-xs leading-5 text-amber-100">{checkout.message}</p> : null}
      </div>
      {checkout.authModal}
    </MarketingReveal>
  );
}

function isNestedInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("a,button,input,select,textarea,[role='button'][data-nested-action='true']"));
}
