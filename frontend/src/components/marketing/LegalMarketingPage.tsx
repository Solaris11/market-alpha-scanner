import { MarketingShell } from "./MarketingShell";

export function LegalMarketingPage({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <MarketingShell>
      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <article className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">{children}</div>
        </article>
      </section>
    </MarketingShell>
  );
}
