import Link from "next/link";
import { MessageSquarePlus, TicketCheck } from "lucide-react";
import { SupportTicketForm } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityStatusRows } from "@/components/utility/CinematicUtilitySurface";
import { getCurrentUser } from "@/lib/server/auth";
import { listSupportTicketsForUser } from "@/lib/server/support";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";
import { humanizeLabel, supportStatusLabel } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

export default async function SupportTicketsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return (
      <TerminalShell>
        <UtilityPageStack>
          <UtilityHero
            actions={[{ href: "/account", label: "Sign in" }, { href: "/support/contact", label: "Contact support", variant: "secondary" }]}
            eyebrow="Tickets"
            metrics={[
              { detail: "Ticket history is private to signed-in users.", label: "Session", tone: "amber", value: "Required" },
              { detail: "Anonymous contact remains available.", label: "Fallback", tone: "cyan", value: "Contact" },
            ]}
            right={<TicketCheck className="mx-auto h-28 w-28 text-cyan-100" />}
            subtitle="Sign in to review support ticket history, replies, status, and category. You can still send a one-time contact request without signing in."
            title="Support ticket history"
            tone="cyan"
          />
        </UtilityPageStack>
      </TerminalShell>
    );
  }
  const tickets = await listSupportTicketsForUser(user.id);
  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="Support Tickets"
          metrics={[
            { detail: "Signed-in support records available to this account.", label: "Tickets", tone: tickets.length ? "cyan" : "amber", value: tickets.length.toLocaleString() },
            { detail: SUPPORT_DISCLAIMER, label: "Boundary", tone: "emerald", value: "Research" },
          ]}
          right={
            <UtilityCard icon={<TicketCheck className="h-5 w-5" />} title="Ticket operating model" tone="cyan">
              <UtilityStatusRows
                items={[
                  { detail: "Ticket history gives support enough context without requiring repeated explanations.", label: "Continuity", tone: "cyan", value: "Tracked" },
                  { detail: "Do not paste secrets, tokens, brokerage data, or payment card details.", label: "Privacy", tone: "amber", value: "Protected" },
                ]}
              />
            </UtilityCard>
          }
          subtitle="Create, review, and continue support issues with status awareness while staying inside TradeVeto’s research-only boundary."
          title="Support ticket console"
          tone="cyan"
        />
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <UtilityCard icon={<MessageSquarePlus className="h-5 w-5" />} title="Create a support ticket" tone="emerald">
            <p className="mb-4 text-xs text-amber-100">{SUPPORT_DISCLAIMER}</p>
            <SupportTicketForm />
          </UtilityCard>
          <UtilityCard icon={<TicketCheck className="h-5 w-5" />} title="Your tickets" tone="cyan">
            <div className="grid gap-3">
              {tickets.length ? tickets.map((ticket) => (
                <Link className="rounded-2xl border border-white/10 bg-slate-950/42 p-4 transition hover:border-cyan-300/35 hover:bg-white/[0.055]" href={`/support/tickets/${ticket.id}`} key={ticket.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold text-slate-50">{ticket.subject}</div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300">{supportStatusLabel(ticket.status)}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{humanizeLabel(ticket.category)} - {new Date(ticket.updatedAt).toLocaleString()}</div>
                </Link>
              )) : <p className="text-sm text-slate-400">No support tickets yet.</p>}
            </div>
          </UtilityCard>
        </div>
      </UtilityPageStack>
    </TerminalShell>
  );
}
