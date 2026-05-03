import Link from "next/link";
import type { PublicMarketSummary } from "@/lib/public-signals";

export function PublicSignalPreviewList({
  ctaHref = "/account",
  ctaLabel = "Sign in",
  summary,
  title = "Market Preview",
}: {
  ctaHref?: string;
  ctaLabel?: string;
  summary: PublicMarketSummary;
  title?: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Preview</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Live symbols, rankings, trade plans, risk levels, and scanner intelligence are available after sign-in and subscription.
          </p>
        </div>
        <Link className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/20" href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Scanner state" value={summary.scannerStatus.replace(/_/g, " ")} />
        <SummaryCard label="Data files" value={`${summary.filesAvailable}/2 available`} />
        <SummaryCard label="Trade plan" value={summary.premiumDataHidden ? "Locked" : "Unavailable"} />
      </div>
      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">{summary.message}</p>
    </section>
  );
}

export function PublicSymbolPreview({ summary }: { summary: PublicMarketSummary }) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Symbol Research</div>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-50">Trade plan locked</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Live symbol identity, rankings, levels, simulator data, and execution planning are hidden until Premium access is confirmed.
          </p>
        </div>
        <Link className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/20" href="/account">
          Sign in
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Scanner state" value={summary.scannerStatus.replace(/_/g, " ")} />
        <SummaryCard label="Live details" value="Locked" />
        <SummaryCard label="Risk levels" value="Locked" />
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold capitalize text-slate-100">{value}</div>
    </div>
  );
}
