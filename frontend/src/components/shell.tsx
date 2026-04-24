import Link from "next/link";

export function TerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-[1720px] px-4 py-4 text-slate-100">
      <header className="mb-3 flex items-end justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">Market Alpha Scanner</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Trading Terminal</h1>
        </div>
        <nav className="flex gap-2 text-xs text-slate-400">
          <Link className="rounded border border-slate-700/70 px-3 py-1.5 hover:border-sky-400/40 hover:text-sky-200" href="/">
            Overview
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
