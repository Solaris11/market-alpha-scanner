import Link from "next/link";
import { premiumAccessState, type PremiumAccessState } from "@/lib/security/premium-access-state";
import { PremiumAccessCta } from "./PremiumAccessCta";

type PremiumLockedStateProps = {
  accessState?: PremiumAccessState;
  authenticated: boolean;
  className?: string;
  compact?: boolean;
  description: string;
  previewItems?: string[];
  title: string;
};

export function PremiumLockedState({ accessState, authenticated, className = "", compact = false, description, previewItems = [], title }: PremiumLockedStateProps) {
  const eyebrow = authenticated ? "Limited Preview" : "Premium";
  const initialState = accessState ?? premiumAccessState({ authenticated });

  return (
    <section className={`min-w-0 max-w-full rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl ${className}`}>
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</div>
          <h2 className={`${compact ? "mt-1 text-xl" : "mt-2 text-3xl"} font-semibold tracking-tight text-slate-50`}>{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>

        <div className="flex min-w-0 flex-wrap gap-3">
          <PremiumAccessCta ctaHref="/account" ctaLabel="Sign in" initialState={initialState} refreshOnPremium />
          <Link className="w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100 sm:w-auto" href="/terminal">
            Back to Terminal
          </Link>
        </div>
      </div>

      {previewItems.length ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {previewItems.slice(0, 3).map((item) => (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300" key={item}>
              <div className="mb-2 h-1 w-10 rounded-full bg-cyan-300/70" />
              {item}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PreviewContext title="What you can inspect" detail="Premium opens the full research context behind the preview: signals, history, risk, and decision reasons." />
        <PreviewContext title="Why it is gated" detail="TradeVeto hides high-detail research until account, legal, and entitlement checks are complete." />
        <PreviewContext title="Research boundary" detail="The product helps structure market research and patience. It is not financial advice or broker execution." />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        <ConfidenceItem label="Access" value="Account verified" />
        <ConfidenceItem label="Billing" value="Stripe managed" />
        <ConfidenceItem label="Data" value="Coverage disclosed" />
        <ConfidenceItem label="Support" value="Ticket history saved" />
      </div>
    </section>
  );
}

function PreviewContext({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function ConfidenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-200">{value}</div>
    </div>
  );
}
