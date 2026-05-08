import type { PublicMarketSummary } from "@/lib/public-signals";
import { premiumAccessState, type PremiumAccessState } from "@/lib/security/premium-access-state";
import { dataStatusLabel } from "@/lib/ui/labels";
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
            Live symbols, rankings, research plans, risk levels, and scanner intelligence are available when Premium access is confirmed.
          </p>
        </div>
        <PremiumAccessCta ctaHref={ctaHref} ctaLabel={ctaLabel} initialState={initialState} refreshOnPremium={refreshOnPremium} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Scanner state" value={dataStatusLabel(summary.scannerStatus)} />
        <SummaryCard label="Data files" value={`${summary.filesAvailable}/2 available`} />
        <SummaryCard label="Research plan" value={summary.premiumDataHidden ? "Locked" : "Unavailable"} />
      </div>
      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">{summary.message}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TrustCard title="What unlocks" detail="Ranked setups, confidence/readiness, veto reasons, and symbol-level research context." />
        <TrustCard title="Why WAIT matters" detail="The system is designed to preserve discipline when conditions are incomplete or risk is elevated." />
        <TrustCard title="Beta expectation" detail="Historical evidence is still growing; TradeVeto is research software, not financial advice." />
      </div>
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
          <h1 className="text-3xl font-black tracking-tight text-slate-50 sm:text-4xl">Research plan locked</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Live symbol identity, rankings, levels, simulator data, and risk planning are hidden until Premium access is confirmed.
          </p>
        </div>
        <PremiumAccessCta ctaHref="/account" ctaLabel="Sign in" initialState={initialState} refreshOnPremium />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Scanner state" value={dataStatusLabel(summary.scannerStatus)} />
        <SummaryCard label="Live details" value="Locked" />
        <SummaryCard label="Risk levels" value="Locked" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <TrustCard title="Symbol context" detail="Premium shows the decision, factor scores, vetoes, and what to monitor next." />
        <TrustCard title="Research levels" detail="Charts use support, resistance, entry-zone, stop, and target context without saying where to trade." />
        <TrustCard title="Evidence first" detail="Confidence reflects setup strength and data quality; it is not a prediction." />
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

function TrustCard({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-xl border border-cyan-300/10 bg-cyan-400/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
