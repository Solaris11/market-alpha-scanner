import { TerminalShell } from "@/components/terminal/TerminalShell";
import { SUPPORT_DISCLAIMER, SUPPORT_FAQ } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportFaqPage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">FAQ</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">Frequently asked questions</h1>
        <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
        <div className="mt-6 grid gap-3">
          {SUPPORT_FAQ.map((item) => (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={item.slug}>
              <h2 className="text-base font-semibold text-slate-50">{item.question}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </TerminalShell>
  );
}
