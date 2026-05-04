import Link from "next/link";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

const links = [
  ["/support/faq", "FAQ", "Answers about product concepts, billing, alerts, paper trading, and data freshness."],
  ["/support/guides", "Guides", "Short how-to guides for common workflows."],
  ["/support/tickets", "Tickets", "Create or review support tickets."],
  ["/support/contact", "Contact", "Send a support request without signing in."],
  ["/support/chat", "AI Support Chat", "Ask product-support questions with strict no-financial-advice guardrails."],
] as const;

export default function SupportPage() {
  return (
    <TerminalShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Support Center</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">How can we help?</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Find product help, read guides, open a ticket, or use the support assistant for safe product questions.</p>
          <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map(([href, title, copy]) => (
            <Link className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.06]" href={href} key={href}>
              <div className="text-lg font-semibold text-slate-50">{title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </Link>
          ))}
        </section>
      </div>
    </TerminalShell>
  );
}
