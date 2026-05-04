import Link from "next/link";
import { SupportTicketForm } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getCurrentUser } from "@/lib/server/auth";
import { listSupportTicketsForUser } from "@/lib/server/support";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default async function SupportTicketsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return (
      <TerminalShell>
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Tickets</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Sign in to view support tickets</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">You can still send a one-time contact request without signing in.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100" href="/account">Sign in</Link>
            <Link className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200" href="/support/contact">Contact support</Link>
          </div>
        </section>
      </TerminalShell>
    );
  }
  const tickets = await listSupportTicketsForUser(user.id);
  return (
    <TerminalShell>
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Open ticket</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Create a support ticket</h1>
          <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
          <div className="mt-6"><SupportTicketForm /></div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Your tickets</div>
          <div className="mt-4 grid gap-3">
            {tickets.length ? tickets.map((ticket) => (
              <Link className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/35" href={`/support/tickets/${ticket.id}`} key={ticket.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold text-slate-50">{ticket.subject}</div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">{ticket.status}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">{ticket.category} - {new Date(ticket.updatedAt).toLocaleString()}</div>
              </Link>
            )) : <p className="text-sm text-slate-400">No support tickets yet.</p>}
          </div>
        </section>
      </div>
    </TerminalShell>
  );
}
