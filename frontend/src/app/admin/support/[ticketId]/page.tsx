import { notFound } from "next/navigation";
import { AdminSupportReplyForm, AdminSupportStatusForm } from "@/components/admin/AdminSupportActions";
import { AdminSection, StatusBadge } from "@/components/admin/AdminChrome";
import { getAdminSupportTicket } from "@/lib/server/support";
import { formatAdminDate, statusTone } from "../../view-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function AdminSupportDetailPage({ params }: PageProps) {
  const { ticketId } = await params;
  const ticket = await getAdminSupportTicket(ticketId).catch(() => null);
  if (!ticket) notFound();
  return (
    <div className="space-y-5">
      <AdminSection title={ticket.subject} subtitle={`${ticket.email} - ${ticket.category}`}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={statusTone(ticket.status)}>{ticket.status}</StatusBadge>
          <StatusBadge>{ticket.priority}</StatusBadge>
          <span className="text-xs text-slate-500">Updated {formatAdminDate(ticket.updatedAt)}</span>
        </div>
        <div className="mt-5">
          <AdminSupportStatusForm priority={ticket.priority} status={ticket.status} ticketId={ticket.id} />
        </div>
      </AdminSection>
      <AdminSection title="Thread">
        <div className="grid gap-3">
          {ticket.messages.map((message) => (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4" key={message.id}>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{message.senderType}</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.message}</p>
              <div className="mt-2 text-xs text-slate-500">{formatAdminDate(message.createdAt)}</div>
            </article>
          ))}
        </div>
      </AdminSection>
      <AdminSection title="Admin reply">
        <AdminSupportReplyForm ticketId={ticket.id} />
      </AdminSection>
    </div>
  );
}
