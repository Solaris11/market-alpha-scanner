import type { PublicMarketSummary } from "@/lib/public-signals";
import { premiumAccessState, type PremiumAccessState } from "@/lib/security/premium-access-state";
import { PremiumAccessCta } from "./PremiumAccessCta";

export function PublicSignalPreviewList({
  accessState,
  authenticated = false,
  ctaHref = "/account",
  ctaLabel = "Sign in",
  refreshOnPremium = false,
  summary,
  title = "Market Preview",
}: {
  accessState?: PremiumAccessState;
  ctaHref?: string;
  ctaLabel?: string;
  authenticated?: boolean;
  refreshOnPremium?: boolean;
  summary: PublicMarketSummary;
  title?: string;
}) {
  const initialState = accessState ?? premiumAccessState({ authenticated });

  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Preview</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Live symbols, rankings, trade plans, risk levels, and scanner intelligence are available when Premium access is confirmed.
          </p>
        </div>
        <PremiumAccessCta ctaHref={ctaHref} ctaLabel={ctaLabel} initialState={initialState} refreshOnPremium={refreshOnPremium} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Scanner state" value={summary.scannerStatus.replace(/_/g, " ")} />
        <SummaryCard label="Data files" value={`${summary.filesAvailable}/2 available`} />
        <SummaryCard label="Trade plan" value={summary.premiumDataHidden ? "Locked" : "Unavailable"} />
      </div>
      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">{summary.message}</p>
    </section>
  );
}

export function PublicSymbolPreview({ accessState, authenticated = false, summary }: { accessState?: PremiumAccessState; authenticated?: boolean; summary: PublicMarketSummary }) {
  const initialState = accessState ?? premiumAccessState({ authenticated });

  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Symbol Research</div>
      <div className="mt-3 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-slate-50 sm:text-4xl">Trade plan locked</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Live symbol identity, rankings, levels, simulator data, and execution planning are hidden until Premium access is confirmed.
          </p>
        </div>
        <PremiumAccessCta ctaHref="/account" ctaLabel="Sign in" initialState={initialState} refreshOnPremium />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Scanner state" value={summary.scannerStatus.replace(/_/g, " ")} />
        <SummaryCard label="Live details" value="Locked" />
        <SummaryCard label="Risk levels" value="Locked" />
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold capitalize text-slate-100">{value}</div>
    </div>
  );
}
