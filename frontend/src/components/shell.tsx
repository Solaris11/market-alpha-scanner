import { TopNav } from "./top-nav";

export function TerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#070a12_0%,#0b1020_48%,#111827_100%)] px-4 py-4 text-slate-100">
      <div className="mx-auto max-w-[1720px]">
        <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Market Alpha</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">AI Trading Terminal</h1>
          </div>
          <TopNav />
        </header>
        {children}
      </div>
    </main>
  );
}
