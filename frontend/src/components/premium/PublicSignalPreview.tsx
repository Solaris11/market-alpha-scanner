import Link from "next/link";
import type { PublicSignal } from "@/lib/public-signals";

export function PublicSignalPreviewList({ ctaHref = "/account", ctaLabel = "Sign in", signals, title = "Limited Market Preview" }: { ctaHref?: string; ctaLabel?: string; signals: PublicSignal[]; title?: string }) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Preview</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Sign in with Premium to unlock trade plans, risk levels, and full scanner intelligence.</p>
        </div>
        <Link className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/20" href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {signals.length ? (
          signals.map((signal) => (
            <article className="rounded-xl border border-white/10 bg-white/[0.04] p-4" key={signal.symbol}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-lg font-black text-slate-50">{signal.symbol}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{signal.company_name || signal.sector || "Market signal"}</div>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">{signal.rating}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Bucket</div>
                  <div className="mt-1 font-semibold capitalize text-slate-200">{signal.score_bucket}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Type</div>
                  <div className="mt-1 font-semibold text-slate-200">{signal.asset_type || "Signal"}</div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400 md:col-span-2 xl:col-span-3">No preview signals are available right now.</div>
        )}
      </div>
    </section>
  );
}

export function PublicSymbolPreview({ signal }: { signal: PublicSignal }) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Symbol Preview</div>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-mono text-4xl font-black tracking-tight text-slate-50">{signal.symbol}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{signal.company_name || signal.sector || "Premium unlocks this symbol's full trade plan."}</p>
        </div>
        <Link className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/20" href="/account">
          Sign in
        </Link>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Rating</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{signal.rating}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Bucket</div>
          <div className="mt-1 text-lg font-semibold capitalize text-slate-100">{signal.score_bucket}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Status</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">Locked</div>
        </div>
      </div>
    </section>
  );
}
