import { notFound } from "next/navigation";
import { SupportReplyForm } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { getCurrentUser } from "@/lib/server/auth";
import { getSupportTicketForUser } from "@/lib/server/support";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";
import { humanizeLabel, supportStatusLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function SupportTicketDetailPage({ params }: PageProps) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) notFound();
  const { ticketId } = await params;
  const ticket = await getSupportTicketForUser(ticketId, user.id).catch(() => null);
  if (!ticket) notFound();
  return (
    <TerminalShell>
      <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-6 shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Ticket</div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">{ticket.subject}</h1>
        <p className="mt-2 text-sm text-slate-400">{humanizeLabel(ticket.category)} - {supportStatusLabel(ticket.status)} - {humanizeLabel(ticket.priority)}</p>
        <p className="mt-3 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
        <div className="mt-6 grid gap-3">
          {ticket.messages.map((message) => (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={message.id}>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{humanizeLabel(message.senderType)}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.message}</p>
              <div className="mt-2 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</div>
            </article>
          ))}
        </div>
        <div className="mt-6">
          <SupportReplyForm ticketId={ticket.id} />
        </div>
      </section>
    </TerminalShell>
  );
}
