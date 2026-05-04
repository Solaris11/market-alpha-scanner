import { SupportTicketForm } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportContactPage() {
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Contact</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">Contact support</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Anonymous contact requests create a ticket, but ticket history is only available after signing in.</p>
        <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
        <div className="mt-6 max-w-2xl">
          <SupportTicketForm anonymous />
        </div>
      </section>
    </TerminalShell>
  );
}
