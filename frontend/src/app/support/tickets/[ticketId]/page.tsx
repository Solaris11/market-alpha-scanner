import { notFound } from "next/navigation";
import { MessageSquare, TicketCheck } from "lucide-react";
import { SupportReplyForm } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack } from "@/components/utility/CinematicUtilitySurface";
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
      <UtilityPageStack>
        <UtilityHero
          eyebrow="Ticket"
          metrics={[
            { detail: humanizeLabel(ticket.category), label: "Category", tone: "cyan", value: humanizeLabel(ticket.category) },
            { detail: "Current support queue state.", label: "Status", tone: ticket.status === "closed" ? "emerald" : "amber", value: supportStatusLabel(ticket.status) },
            { detail: "Support priority assigned to this issue.", label: "Priority", tone: ticket.priority === "urgent" ? "rose" : "violet", value: humanizeLabel(ticket.priority) },
            { detail: SUPPORT_DISCLAIMER, label: "Boundary", tone: "emerald", value: "Research" },
          ]}
          right={<TicketCheck className="mx-auto h-28 w-28 text-cyan-100" />}
          subtitle="Review the support conversation, reply with additional context, and keep account-specific troubleshooting inside an auditable workflow."
          title={ticket.subject}
          tone="cyan"
        />
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <UtilityCard icon={<MessageSquare className="h-5 w-5" />} title="Conversation timeline" tone="cyan">
            <div className="grid gap-3">
              {ticket.messages.map((message) => (
                <article className="rounded-2xl border border-white/10 bg-slate-950/42 p-4" key={message.id}>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{humanizeLabel(message.senderType)}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.message}</p>
                  <div className="mt-2 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</div>
                </article>
              ))}
            </div>
          </UtilityCard>
          <UtilityCard icon={<MessageSquare className="h-5 w-5" />} title="Reply" tone="emerald">
            <p className="mb-4 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
            <SupportReplyForm ticketId={ticket.id} />
          </UtilityCard>
        </div>
      </UtilityPageStack>
    </TerminalShell>
  );
}
