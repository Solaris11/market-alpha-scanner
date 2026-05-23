type RouteLoadingSkeletonProps = {
  metricCount?: number;
  title: string;
};

const LOADING_NAV_ITEMS = ["Terminal", "Opportunities", "Performance", "History", "Dashboard", "Labs"];

export function RouteLoadingSkeleton({ metricCount = 4, title }: RouteLoadingSkeletonProps) {
  const metrics = Array.from({ length: metricCount }, (_, index) => `metric-${index}`);
  const cards = Array.from({ length: 6 }, (_, index) => `card-${index}`);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#070a12_0%,#0b1020_48%,#111827_100%)] px-3 pb-[calc(var(--tv-mobile-nav-clearance)+1.5rem)] pt-3 text-slate-100 sm:px-4 sm:pb-6 sm:pt-4 xl:pb-4">
      <div className="mx-auto max-w-[1780px] space-y-4">
        <LoadingHeader />

        <section className="terminal-panel tv-skeleton rounded-3xl p-4 sm:p-5" aria-label={title} aria-busy="true">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-3 w-44 rounded-full bg-cyan-300/20" />
              <div className="mt-4 h-8 max-w-[28rem] rounded-xl bg-white/10 sm:h-10" />
              <div className="mt-3 h-4 max-w-[46rem] rounded-full bg-white/[0.075]" />
              <div className="mt-2 h-4 max-w-[34rem] rounded-full bg-white/[0.055]" />
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[320px]">
              {metrics.slice(0, 4).map((item) => (
                <div className="tv-card-motion min-h-20 rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={item}>
                  <div className="h-3 w-16 rounded-full bg-white/10" />
                  <div className="mt-4 h-6 w-20 rounded-lg bg-white/[0.12]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="terminal-panel min-h-[28rem] rounded-3xl p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((item) => (
                <div className="tv-card-motion min-h-44 rounded-2xl border border-white/10 bg-slate-950/45 p-4" key={item}>
                  <div className="h-3 w-24 rounded-full bg-cyan-300/15" />
                  <div className="mt-4 h-7 w-28 rounded-lg bg-white/10" />
                  <div className="mt-5 space-y-2">
                    <div className="h-3 rounded-full bg-white/[0.07]" />
                    <div className="h-3 w-10/12 rounded-full bg-white/[0.055]" />
                    <div className="h-3 w-8/12 rounded-full bg-white/[0.045]" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="terminal-panel min-h-[28rem] rounded-3xl p-4 sm:p-5">
            <div className="h-3 w-32 rounded-full bg-cyan-300/15" />
            <div className="mt-4 h-7 w-48 rounded-lg bg-white/10" />
            <div className="mt-5 space-y-3">
              {cards.slice(0, 4).map((item) => (
                <div className="tv-card-motion rounded-2xl border border-white/10 bg-white/[0.035] p-3" key={`rail-${item}`}>
                  <div className="h-4 w-28 rounded-full bg-white/10" />
                  <div className="mt-3 h-3 rounded-full bg-white/[0.06]" />
                  <div className="mt-2 h-3 w-9/12 rounded-full bg-white/[0.045]" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function LoadingHeader() {
  return (
    <header className="sticky top-3 z-40 mb-4 rounded-2xl border border-white/10 bg-slate-950/95 px-3 py-3 shadow-xl shadow-black/25 lg:px-5 lg:py-4">
      <div className="hidden min-w-0 gap-3 xl:flex xl:flex-col">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-sm font-black text-cyan-100">TV</div>
            <div className="min-w-0">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-50">TradeVeto</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">Decision OS</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.04]" />
            <div className="h-9 w-20 rounded-full border border-white/10 bg-white/[0.04]" />
          </div>
        </div>
        <nav aria-label="Loading navigation" className="flex min-w-0 items-center gap-5 overflow-hidden border-b border-white/10 text-xs font-semibold text-slate-500">
          {LOADING_NAV_ITEMS.map((item) => (
            <span className="inline-flex min-h-9 shrink-0 items-center border-b-2 border-transparent px-0.5 py-2" key={item}>
              {item}
            </span>
          ))}
        </nav>
      </div>

      <div className="xl:hidden">
        <div className="flex min-h-14 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-xs font-black text-cyan-100">TV</div>
          <div className="min-w-0 flex-1">
            <div className="h-4 w-32 rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-24 rounded-full bg-cyan-300/15" />
          </div>
          <div className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.04]" />
          <div className="h-10 w-16 rounded-full border border-white/10 bg-white/[0.04]" />
        </div>
      </div>
    </header>
  );
}
