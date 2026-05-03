import { TerminalShell } from "@/components/terminal/TerminalShell";

export default function TermsPage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Terms</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Terms of Service</h1>
        <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
          <p>Market Alpha Scanner provides market research, scanner summaries, paper simulation, and risk-planning tools. It does not provide brokerage, investment advisory, tax, legal, or fiduciary services.</p>
          <p>You are responsible for evaluating all information before making any trading or investment decision. You agree not to treat any signal, score, simulator output, alert, or dashboard label as a guaranteed outcome or personalized financial advice.</p>
          <p>Access may be limited, suspended, or changed to protect the service, users, or data providers. Billing terms will be presented before any paid subscription is activated.</p>
        </div>
      </section>
    </TerminalShell>
  );
}
