import Link from "next/link";

type PremiumLockedStateProps = {
  authenticated: boolean;
  className?: string;
  compact?: boolean;
  description: string;
  previewItems?: string[];
  title: string;
};

export function PremiumLockedState({ authenticated, className = "", compact = false, description, previewItems = [], title }: PremiumLockedStateProps) {
  const eyebrow = authenticated ? "Limited Preview" : "Premium";
  const primaryLabel = authenticated ? "Upgrade coming soon" : "Sign in";

  return (
    <section className={`rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl ${className}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</div>
          <h2 className={`${compact ? "mt-1 text-xl" : "mt-2 text-3xl"} font-semibold tracking-tight text-slate-50`}>{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {authenticated ? (
            <button
              className="cursor-not-allowed rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 opacity-80"
              disabled
              type="button"
            >
              {primaryLabel}
            </button>
          ) : (
            <Link className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-400/20" href="/account">
              {primaryLabel}
            </Link>
          )}
          <Link className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100" href="/terminal">
            Back to Terminal
          </Link>
        </div>
      </div>

      {previewItems.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {previewItems.slice(0, 3).map((item) => (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300" key={item}>
              <div className="mb-2 h-1 w-10 rounded-full bg-cyan-300/70" />
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
