import { TerminalShell } from "@/components/terminal/TerminalShell";
import { SUPPORT_DISCLAIMER, SUPPORT_GUIDES } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportGuidesPage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Guides</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">How-to guides</h1>
        <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {SUPPORT_GUIDES.map((guide) => (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5" key={guide.slug}>
              <h2 className="text-lg font-semibold text-slate-50">{guide.title}</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-400">
                {guide.body.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </TerminalShell>
  );
}
