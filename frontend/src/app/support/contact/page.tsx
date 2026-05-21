import { LifeBuoy, ShieldCheck } from "lucide-react";
import { SupportTicketForm } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityStatusRows } from "@/components/utility/CinematicUtilitySurface";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportContactPage() {
  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="Contact Support"
          metrics={[
            { detail: "Anonymous requests create a one-time support record.", label: "History", tone: "amber", value: "Limited" },
            { detail: "Signed-in tickets preserve status and replies.", label: "Audit", tone: "cyan", value: "Available" },
            { detail: SUPPORT_DISCLAIMER, label: "Boundary", tone: "emerald", value: "Research" },
          ]}
          right={
            <UtilityCard eyebrow="What to include" icon={<ShieldCheck className="h-5 w-5" />} title="Useful evidence, no secrets" tone="emerald">
              <UtilityStatusRows
                items={[
                  { detail: "Page, browser, approximate time, symbol, and what looked wrong.", label: "Include", tone: "cyan", value: "Context" },
                  { detail: "Passwords, reset tokens, payment card details, or brokerage credentials.", label: "Never include", tone: "amber", value: "Secrets" },
                ]}
              />
            </UtilityCard>
          }
          subtitle="Anonymous contact requests create a ticket, but ticket history and replies are easiest to manage after signing in."
          title="Contact support"
          tone="amber"
        />
        <UtilityCard icon={<LifeBuoy className="h-5 w-5" />} title="Send a support request" tone="cyan">
          <div className="max-w-3xl">
            <SupportTicketForm anonymous />
          </div>
        </UtilityCard>
      </UtilityPageStack>
    </TerminalShell>
  );
}
