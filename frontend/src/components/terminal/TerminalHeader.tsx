import { AccountPill } from "@/components/account/AccountPill";
import { TerminalNav } from "./TerminalNav";

export function TerminalHeader() {
  return (
    <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-300">Market Alpha</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">AI Trading Terminal</h1>
      </div>
      <div className="flex flex-col gap-3 lg:items-end">
        <TerminalNav />
        <AccountPill />
      </div>
    </header>
  );
}
