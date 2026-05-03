import { TerminalShell } from "@/components/terminal/TerminalShell";

export default function RiskDisclosurePage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-amber-300/20 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Risk Disclosure</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Trading Risk Disclosure</h1>
        <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
          <p>Trading and investing involve substantial risk, including loss of principal. Market Alpha Scanner outputs are research signals and simulations, not financial advice or instructions to trade.</p>
          <p>Scanner data can be delayed, stale, incomplete, incorrect, or affected by third-party data provider issues. Past performance, backtests, score buckets, and paper simulations do not guarantee future results.</p>
          <p>You should size positions, manage risk, and decide whether to trade based on your own judgment, constraints, and professional advice where appropriate.</p>
        </div>
      </section>
    </TerminalShell>
  );
}
