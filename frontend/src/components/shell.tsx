import { TopNav } from "./top-nav";

export function TerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-[1720px] px-4 py-4 text-slate-100">
      <header className="mb-3 flex flex-col gap-3 border-b border-slate-800 pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">Market Alpha Scanner</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">Trading Terminal</h1>
        </div>
        <TopNav />
      </header>
      {children}
    </main>
  );
}
