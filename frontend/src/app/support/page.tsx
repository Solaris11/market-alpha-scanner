import { AlertTriangle, Bot, CircleHelp, FileText, LifeBuoy, MessageSquare, RadioTower, TicketCheck } from "lucide-react";
import { TerminalShell } from "@/components/terminal/TerminalShell";
import { UtilityCard, UtilityHero, UtilityPageStack, UtilityStatusRows, UtilityTimeline } from "@/components/utility/CinematicUtilitySurface";
import { UtilitySurfaceMaturityPanel } from "@/components/utility/UtilitySurfaceMaturityPanel";
import { SUPPORT_DISCLAIMER } from "@/lib/support/content";

export const dynamic = "force-dynamic";

const links = [
  { copy: "Answers about product concepts, billing, alerts, paper trading, and data freshness.", href: "/support/faq", Icon: CircleHelp, title: "FAQ", tone: "cyan" as const },
  { copy: "Short workflow guides for reading Terminal, alerts, billing, and support handoffs.", href: "/support/guides", Icon: FileText, title: "Guides", tone: "violet" as const },
  { copy: "Create or review signed-in support tickets with status awareness.", href: "/support/tickets", Icon: TicketCheck, title: "Tickets", tone: "emerald" as const },
  { copy: "Send a one-time support request without signing in.", href: "/support/contact", Icon: LifeBuoy, title: "Contact", tone: "amber" as const },
  { copy: "Ask product-support questions with strict no-financial-advice guardrails.", href: "/support/chat", Icon: Bot, title: "AI Support Chat", tone: "cyan" as const },
] as const;

export default function SupportPage() {
  return (
    <TerminalShell>
      <UtilityPageStack>
        <UtilityHero
          eyebrow="Support Intelligence"
          metrics={[
            { detail: "Support assistant blocks financial-advice requests.", label: "Guardrail", tone: "emerald", value: "Active" },
            { detail: "Tickets preserve category, status, and reply history.", label: "Audit", tone: "cyan", value: "Tracked" },
            { detail: "Guides route users back into product workflows.", label: "Workflow", tone: "violet", value: "Connected" },
            { detail: SUPPORT_DISCLAIMER, label: "Boundary", tone: "amber", value: "Research only" },
          ]}
          right={
            <UtilityCard eyebrow="Support operating model" icon={<MessageSquare className="h-5 w-5" />} title="Help without hype or advice" tone="cyan">
              <UtilityStatusRows
                items={[
                  { detail: "Product questions, billing navigation, alert behavior, and troubleshooting are supported.", label: "Allowed", tone: "emerald", value: "Product help" },
                  { detail: "Personal buy/sell recommendations and broker execution guidance remain blocked.", label: "Blocked", tone: "amber", value: "Advice" },
                  { detail: "Ticket requests should include page, browser, timestamp, and safe screenshots when useful.", label: "Best evidence", tone: "cyan", value: "Context" },
                ]}
              />
            </UtilityCard>
          }
          subtitle="Find workflow help, product explanations, tickets, and support chat inside the same calm research-first system."
          title="Support command center"
          tone="cyan"
        />
        <UtilitySurfaceMaturityPanel surfaceId="support" />
        <section className="grid gap-4 lg:grid-cols-3">
          <UtilityCard action="Open live status" eyebrow="Incident status" href="/status" icon={<AlertTriangle className="h-5 w-5" />} title="Check degraded systems" tone="amber">
            <p className="text-sm leading-6 text-slate-400">Public status shows provider freshness, degraded systems, stale data states, and known operational incidents without hiding limitations.</p>
          </UtilityCard>
          <UtilityCard action="Open FAQ" eyebrow="Provider outage help" href="/support/faq#wrong-stale-data" icon={<RadioTower className="h-5 w-5" />} title="Understand stale or delayed data" tone="violet">
            <p className="text-sm leading-6 text-slate-400">Provider outage help routes users to freshness checks, affected symbols, timestamps, and the right support evidence to attach.</p>
          </UtilityCard>
          <UtilityCard action="Open tickets" eyebrow="Ticket clarity" href="/support/tickets" icon={<TicketCheck className="h-5 w-5" />} title="Create evidence-backed tickets" tone="emerald">
            <p className="text-sm leading-6 text-slate-400">Tickets should include page, browser, timestamp, symbol, and safe screenshots so support can reproduce workflow problems.</p>
          </UtilityCard>
        </section>
        <UtilityCard eyebrow="Workflow FAQ routing" icon={<CircleHelp className="h-5 w-5" />} title="Support paths tied to intelligence workflows" tone="cyan">
          <UtilityTimeline
            items={[
              { detail: "Stale scanner or provider issue: check /status first, then include page, symbol, and time in the ticket.", label: "Data freshness issue", tone: "amber" },
              { detail: "Alert noise or missing trigger: open Alerts, capture rule id, cooldown, target, and last state.", label: "Alert workflow issue", tone: "violet" },
              { detail: "History, replay, paper, or performance confusion: start with FAQ and attach the workflow step that felt unclear.", label: "Intelligence workflow issue", tone: "cyan" },
            ]}
          />
        </UtilityCard>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {links.map(({ copy, href, Icon, title, tone }) => (
            <UtilityCard action="Open surface" href={href} icon={<Icon className="h-5 w-5" />} key={href} title={title} tone={tone}>
              <p className="text-sm leading-6 text-slate-400">{copy}</p>
            </UtilityCard>
          ))}
        </section>
        <div className="rounded-3xl border border-amber-300/18 bg-amber-400/[0.055] p-4 text-xs leading-5 text-amber-100">
          {SUPPORT_DISCLAIMER}
        </div>
      </UtilityPageStack>
    </TerminalShell>
  );
}
