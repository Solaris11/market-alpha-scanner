import { Bot, ShieldCheck } from "lucide-react";
import { SupportChatBox } from "@/components/support/SupportActions";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityStatusRows } from "@/components/utility/CinematicUtilitySurface";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

export default function SupportChatPage() {
  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="AI Support Chat"
          metrics={[
            { detail: "Support chat answers product workflow questions.", label: "Scope", tone: "cyan", value: "Product" },
            { detail: "Financial advice requests are blocked by policy.", label: "Guardrail", tone: "emerald", value: "Active" },
            { detail: "Escalate account-specific issues to tickets.", label: "Escalation", tone: "amber", value: "Tickets" },
          ]}
          right={
            <UtilityCard icon={<ShieldCheck className="h-5 w-5" />} title="Bounded support intelligence" tone="emerald">
              <UtilityStatusRows
                items={[
                  { detail: "Scanner states, alerts, billing navigation, paper trading, and troubleshooting.", label: "Can answer", tone: "cyan", value: "Product" },
                  { detail: "Personalized buy/sell advice, position sizing advice, and live execution guidance.", label: "Will block", tone: "amber", value: "Advice" },
                ]}
              />
            </UtilityCard>
          }
          subtitle="Ask about using the product, billing navigation, alerts, paper trading, or troubleshooting. The assistant stays inside the research-only support boundary."
          title="Product support assistant"
          tone="cyan"
        />
        <UtilityCard icon={<Bot className="h-5 w-5" />} title="Ask TradeVeto Support" tone="cyan">
          <SupportChatBox />
        </UtilityCard>
        <div className="rounded-3xl border border-amber-300/18 bg-amber-400/[0.055] p-4 text-xs leading-5 text-amber-100">{SUPPORT_DISCLAIMER}</div>
      </UtilityPageStack>
    </TerminalShell>
  );
}
