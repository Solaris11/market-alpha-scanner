export function LegalAcceptanceRequiredState() {
  return (
    <section className="rounded-2xl border border-amber-300/25 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 ring-1 ring-amber-300/10 backdrop-blur-xl">
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-200">Legal Acceptance Required</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">Accept the legal terms to continue</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
        TradeVeto is research software, not financial advice. You can lose money, and you are responsible for every trading decision.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        Use the Terms, Privacy, and Risk Disclosure checklist shown on this page to continue using account features.
      </p>
    </section>
  );
}
