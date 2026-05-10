import { TerminalShell } from "@/components/terminal/TerminalShell";

export default function StrategyLabsLoading() {
  return (
    <TerminalShell>
      <div className="space-y-5 pb-24 sm:pb-8">
        <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5">
          <div className="h-4 w-32 animate-pulse rounded bg-cyan-300/20" />
          <div className="mt-4 h-8 w-full max-w-md animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-white/10" />
          <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => (
              <div className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" key={index} />
            ))}
          </div>
          <div className="mt-5 h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
        </section>
      </div>
    </TerminalShell>
  );
}
